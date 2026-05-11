import { computed, unref, type Ref } from 'vue'
import type { Chapter } from '../../../types'

type MaybeRef<T> = T | Ref<T>

export function useOutlineChapterMapping(deps: {
  chapters: MaybeRef<Chapter[]>
  activeChapterId?: MaybeRef<string>
}) {
  const linkedChapterIdsByOutlineId = computed<Record<string, string[]>>(() => {
    const map = new Map<string, string[]>()
    for (const chapter of unref(deps.chapters)) {
      for (const outlineId of chapter.outlineItemIds ?? []) {
        const current = map.get(outlineId) ?? []
        current.push(chapter.id)
        map.set(outlineId, current)
      }
    }
    const next: Record<string, string[]> = {}
    for (const [outlineId, chapterIds] of map.entries()) {
      next[outlineId] = chapterIds
    }
    return next
  })

  const linkedChapterCountByOutlineId = computed<Record<string, number>>(() => {
    const next: Record<string, number> = {}
    for (const [outlineId, chapterIds] of Object.entries(linkedChapterIdsByOutlineId.value)) {
      next[outlineId] = chapterIds.length
    }
    return next
  })

  const activeChapterLinkedOutlineIds = computed<string[]>(() => {
    const chapterId = String(unref(deps.activeChapterId) ?? '').trim()
    if (!chapterId) return []
    const chapter = unref(deps.chapters).find((item) => item.id === chapterId)
    return chapter?.outlineItemIds ?? []
  })

  const activeChapterLinkedOutlineIdSet = computed(() => new Set(activeChapterLinkedOutlineIds.value))

  function getLinkedChaptersForOutline(outlineId: string): Chapter[] {
    const chapterIdSet = new Set(linkedChapterIdsByOutlineId.value[outlineId] ?? [])
    if (chapterIdSet.size === 0) return []
    return unref(deps.chapters).filter((chapter) => chapterIdSet.has(chapter.id))
  }

  function isOutlineLinkedToActiveChapter(outlineId: string): boolean {
    return activeChapterLinkedOutlineIdSet.value.has(outlineId)
  }

  return {
    linkedChapterIdsByOutlineId,
    linkedChapterCountByOutlineId,
    activeChapterLinkedOutlineIds,
    activeChapterLinkedOutlineIdSet,
    getLinkedChaptersForOutline,
    isOutlineLinkedToActiveChapter,
  }
}
