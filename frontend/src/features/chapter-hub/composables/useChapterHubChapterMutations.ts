import { type ComputedRef, type Ref } from 'vue'
import {
  createChapter,
  getChaptersByNovelId,
  updateChapter,
} from '../../../lib/storage'
import type { Chapter, Novel } from '../../../types'

type ChapterFormState = {
  title: string
  notes: string
  annotation: string
}

export function useChapterHubChapterMutations(deps: {
  novel: ComputedRef<Novel | null>
  chapters: Ref<Chapter[]>
  selectedChapterId: Ref<string>
  chapterForm: ChapterFormState
  reload: () => void
  updateNameSuggestion: (ta: HTMLTextAreaElement) => void
}) {
  const { novel, chapters, selectedChapterId, chapterForm, reload, updateNameSuggestion } = deps

  function handleCreateChapter() {
    if (!novel.value) return
    createChapter({
      novelId: novel.value.id,
      title: chapterForm.title,
      notes: chapterForm.notes,
      annotation: chapterForm.annotation,
    })
    chapterForm.title = ''
    chapterForm.notes = ''
    chapterForm.annotation = ''
    reload()
    const list = getChaptersByNovelId(novel.value.id)
    if (list.length > 0) {
      selectedChapterId.value = list[list.length - 1].id
    }
  }

  function toggleDone(chapterId: string) {
    const current = chapters.value.find((c) => c.id === chapterId)
    if (!current) return
    updateChapter({
      id: chapterId,
      status: current.status === 'done' ? 'draft' : 'done',
    })
    reload()
  }

  function onNotesChange(chapterId: string, event: Event) {
    const target = event.target as HTMLInputElement | null
    updateChapter({ id: chapterId, notes: target?.value ?? '' })
    reload()
  }

  function onChapterTitleChange(chapterId: string, event: Event) {
    const target = event.target as HTMLInputElement | null
    const t = target?.value?.trim() || '未命名章节'
    updateChapter({ id: chapterId, title: t })
    reload()
  }

  function onChapterContentInput(chapterId: string, event: Event) {
    const target = event.target as HTMLTextAreaElement | null
    const v = target?.value ?? ''
    updateChapter({ id: chapterId, content: v })
    const i = chapters.value.findIndex((c) => c.id === chapterId)
    if (i >= 0) {
      chapters.value = chapters.value.map((c, j) => (j === i ? { ...c, content: v } : c))
    }

    if (target) updateNameSuggestion(target)
  }

  function toggleChapterOutline(chapterId: string, outlineId: string) {
    const current = chapters.value.find((c) => c.id === chapterId)
    if (!current) return
    const set = new Set(current.outlineItemIds ?? [])
    if (set.has(outlineId)) set.delete(outlineId)
    else set.add(outlineId)
    updateChapter({ id: chapterId, outlineItemIds: Array.from(set) })
    reload()
  }

  return {
    handleCreateChapter,
    toggleDone,
    onNotesChange,
    onChapterTitleChange,
    onChapterContentInput,
    toggleChapterOutline,
  }
}
