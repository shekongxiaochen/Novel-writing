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

    return new Set(items.filter((item) => !visible.has(item.id)).map((item) => item.id))
  })

  return { dimmedOutlineIdSet }
}
