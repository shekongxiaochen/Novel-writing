import { computed, ref, type Ref } from 'vue'
import { deleteChapter } from '../../../lib/storage'
import type { Chapter } from '../../../types'

export function useChapterHubChapterDelete(chapters: Ref<Chapter[]>, reload: () => void) {
  const chapterDeleteOpen = ref(false)
  const pendingDeleteChapterId = ref<string | null>(null)

  const chapterDeleteMessage = computed(() => {
    const id = pendingDeleteChapterId.value
    if (!id) return ''
    const c = chapters.value.find((x) => x.id === id)
    if (!c) return ''
    return `即将删除「第 ${c.chapterNo} 章 · ${c.title}」。该章正文与笔记会一并移除，其余章节将按顺序重新编号。此操作无法撤销。`
  })

  function openChapterDelete(chapterId: string) {
    pendingDeleteChapterId.value = chapterId
    chapterDeleteOpen.value = true
  }

  function confirmChapterDelete() {
    const id = pendingDeleteChapterId.value
    pendingDeleteChapterId.value = null
    if (!id) return
    deleteChapter(id)
    reload()
  }

  function onChapterDeleteDialogCancel() {
    pendingDeleteChapterId.value = null
  }

  return {
    chapterDeleteOpen,
    chapterDeleteMessage,
    openChapterDelete,
    confirmChapterDelete,
    onChapterDeleteDialogCancel,
  }
}
