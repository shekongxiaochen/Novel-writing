import { computed, unref, type Ref } from 'vue'
import type { OutlineItem } from '../../../types'

type MaybeRef<T> = T | Ref<T>

function s(value: unknown): string {
  return String(value ?? '').trim()
}

export function useOutlineStorylineFilter(deps: {
  outlineItems: MaybeRef<OutlineItem[]>
  filterStorylineId: MaybeRef<string>
}) {
  const matchedCount = computed(() => {
    const filterId = s(unref(deps.filterStorylineId))
    if (!filterId) return 0
    const items = unref(deps.outlineItems)
    return items.filter((item) => (item.storylineIds ?? []).includes(filterId)).length
  })

  const dimmedOutlineIdSet = computed(() => {
    const filterId = s(unref(deps.filterStorylineId))
    if (!filterId) return new Set<string>()

    const items = unref(deps.outlineItems)
    const byId = new Map(items.map((item) => [item.id, item]))
    const visible = new Set<string>()

    for (const item of items) {
      if (!(item.storylineIds ?? []).includes(filterId)) continue
      visible.add(item.id)
      let parentId = s(item.parentId) || null
      while (parentId) {
        visible.add(parentId)
        parentId = s(byId.get(parentId)?.parentId) || null
      }
    }

    // 没有任何节点属于该故事线时，不淡化全部（否则像“整屏坏掉”），交给视图给出空提示
    if (visible.size === 0) return new Set<string>()

    return new Set(items.filter((item) => !visible.has(item.id)).map((item) => item.id))
  })

  return { dimmedOutlineIdSet, matchedCount }
}
