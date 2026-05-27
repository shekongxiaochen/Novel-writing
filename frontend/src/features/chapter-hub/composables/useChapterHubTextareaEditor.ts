import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue'
import { updateChapter } from '../../../lib/storage'
import type { CharacterChangeEvent, FactionChangeEvent } from '../../../lib/storage'
import { buildEntityPreviewLines } from '../entityPreview'
import { planQuoteAutoPairEdit } from '../lib/chapterQuoteAutoPair'
import { scrollCaretIntoView } from '../caretGeometry'
import type { Chapter, Character, Faction, ForeshadowPlant, Item } from '../../../types'

export const CHAPTER_HUB_FIRST_LINE_INDENT = '　　'

export function useChapterHubTextareaEditor(deps: {
  selectedChapterId: Ref<string>
  selectedChapter: ComputedRef<Chapter | null>
  chapters: Ref<Chapter[]>
  characters: Ref<Character[]>
  factions: Ref<Faction[]>
  items: Ref<Item[]>
  foreshadows: Ref<ForeshadowPlant[]> | ComputedRef<ForeshadowPlant[]>
  /** 角色变更历史 Map（characterId -> events[]），用于正文底色区间计算 */
  characterHistories?: ComputedRef<Map<string, CharacterChangeEvent[]>>
  /** 势力变更历史 Map（factionId -> events[]） */
  factionHistories?: ComputedRef<Map<string, FactionChangeEvent[]>>
  chapterTextareaRef: Ref<HTMLTextAreaElement | null>
  nameSuggestOpen: Ref<boolean>
  nameSuggestList: Ref<Array<{ id: string; name: string; kind: 'character' | 'faction' | 'item' }>>
  nameSuggestIndex: Ref<number>
  forceSuggest: Ref<boolean>
  updateNameSuggestion: (ta: HTMLTextAreaElement) => void
  applyNameSuggestion: (name: string) => void
  resetNameSuggest: () => void
  openCtxMenuFromSelection: () => void
  openCtxMenuForExplicitSelection: () => void
  openCtxMenuAtPoint: (selStart: number, selEnd: number, x: number, y: number) => void
  closeCtxMenu: () => void
  onEntityNameLeave: () => void
  hasPinnedQuoteSelection?: () => boolean
}) {
  const {
    selectedChapterId,
    selectedChapter,
    chapters,
    characters,
    factions,
    items,
    foreshadows,
    characterHistories,
    factionHistories,
    chapterTextareaRef,
    nameSuggestOpen,
    nameSuggestList,
    nameSuggestIndex,
    forceSuggest,
    updateNameSuggestion,
    applyNameSuggestion,
    resetNameSuggest,
    openCtxMenuFromSelection,
    openCtxMenuForExplicitSelection,
    openCtxMenuAtPoint,
    closeCtxMenu,
    onEntityNameLeave,
    hasPinnedQuoteSelection,
  } = deps

  const INDENT = CHAPTER_HUB_FIRST_LINE_INDENT

  const isChapterTextareaFocused = ref(false)
  const hasTextareaSelection = ref(false)
  let chapterPaperPointerUntil = 0
  let aiStudioPointerUntil = 0

  const entityPreviewLines = computed(() =>
    buildEntityPreviewLines(
      selectedChapter.value?.content ?? '',
      characters.value,
      factions.value,
      items.value,
      foreshadows.value,
      selectedChapter.value?.id ?? null,
      characterHistories?.value,
      chapters.value,
      factionHistories?.value,
    )
  )

  const shouldShowEntityOverlay = computed(
    () => !isChapterTextareaFocused.value && !hasTextareaSelection.value
  )

  const wordCount = computed(() => {
    const t = selectedChapter.value?.content ?? ''
    return t.replace(/\s/g, '').length
  })

  async function ensureFirstLineIndent(shouldSelect: boolean): Promise<void> {
    const c = selectedChapter.value
    if (!c) return
    if (c.content !== '') return

    const nextValue = INDENT
    updateChapter({ id: c.id, content: nextValue })
    chapters.value = chapters.value.map((x) => (x.id === c.id ? { ...x, content: nextValue } : x))

    await nextTick()
    if (shouldSelect) {
      chapterTextareaRef.value?.setSelectionRange(nextValue.length, nextValue.length)
    }
  }

  function isAltEnter(e: KeyboardEvent): boolean {
    return e.altKey && (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter')
  }

  function clearChapterTextareaInteractionState(options?: { blurTextarea?: boolean; collapseSelection?: boolean }): void {
    const ta = chapterTextareaRef.value
    if (ta && options?.collapseSelection) {
      const pos = ta.selectionEnd ?? ta.value.length
      ta.setSelectionRange(pos, pos)
    }
    if (ta && options?.blurTextarea && document.activeElement === ta) {
      ta.blur()
    }
    isChapterTextareaFocused.value = false
    hasTextareaSelection.value = false
    resetNameSuggest()
    closeCtxMenu()
    onEntityNameLeave()
  }

  watch(selectedChapterId, async () => {
    clearChapterTextareaInteractionState({ blurTextarea: true, collapseSelection: true })
    await nextTick()
    void ensureFirstLineIndent(false)
  })

  function applyChapterContentWithCaret(nextValue: string, caretPos: number): void {
    const chapter = selectedChapter.value
    if (!chapter) return
    updateChapter({ id: chapter.id, content: nextValue })
    const i = chapters.value.findIndex((c) => c.id === chapter.id)
    if (i >= 0) {
      chapters.value = chapters.value.map((c, j) => (j === i ? { ...c, content: nextValue } : c))
    }
    void nextTick(() => {
      const ta = chapterTextareaRef.value
      if (!ta) return
      ta.setSelectionRange(caretPos, caretPos)
      ta.focus()
      scrollCaretIntoView(ta, caretPos)
    })
  }

  function applyQuoteAutoPairEditToTextarea(edit: ReturnType<typeof planQuoteAutoPairEdit>): boolean {
    if (!edit) return false
    const ta = chapterTextareaRef.value
    if (!ta) return false
    if (edit.kind === 'skip-close') {
      ta.setSelectionRange(edit.caret, edit.caret)
      return true
    }
    applyChapterContentWithCaret(edit.text, edit.caret)
    return true
  }

  function tryAutoPairQuote(char: string): boolean {
    if (!char || char.length !== 1) return false
    if (!selectedChapter.value) return false

    const ta = chapterTextareaRef.value
    if (!ta) return false

    const edit = planQuoteAutoPairEdit(char, ta.value, ta.selectionStart ?? 0, ta.selectionEnd ?? 0)
    return applyQuoteAutoPairEditToTextarea(edit)
  }

  function tryAutoPairQuoteOnKeydown(e: KeyboardEvent): boolean {
    if (e.isComposing || e.defaultPrevented) return false
    if (e.ctrlKey || e.metaKey || e.altKey) return false
    if (e.key.length !== 1) return false

    if (!tryAutoPairQuote(e.key)) return false
    e.preventDefault()
    return true
  }

  function tryAutoPairQuoteOnBeforeInput(e: InputEvent): boolean {
    if (e.isComposing || e.defaultPrevented) return false
    if (e.inputType !== 'insertText' || !e.data || e.data.length !== 1) return false

    if (!tryAutoPairQuote(e.data)) return false
    e.preventDefault()
    return true
  }

  function onChapterTextareaBeforeInput(e: InputEvent): void {
    tryAutoPairQuoteOnBeforeInput(e)
  }

  function onChapterTextareaKeydown(e: KeyboardEvent) {
    if (tryAutoPairQuoteOnKeydown(e)) return

    if (e.ctrlKey && e.key.toLowerCase() === ' ') {
      e.preventDefault()
      forceSuggest.value = true
      const ta = chapterTextareaRef.value
      if (ta) updateNameSuggestion(ta)
      return
    }

    if (isAltEnter(e)) {
      e.preventDefault()
      openCtxMenuFromSelection()
      return
    }

    if (nameSuggestOpen.value && nameSuggestList.value.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        nameSuggestIndex.value = (nameSuggestIndex.value + 1) % nameSuggestList.value.length
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        nameSuggestIndex.value =
          (nameSuggestIndex.value - 1 + nameSuggestList.value.length) % nameSuggestList.value.length
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        resetNameSuggest()
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const pick = nameSuggestList.value[nameSuggestIndex.value]
        if (pick) applyNameSuggestion(pick.name)
        return
      }
    }

    if (e.key !== 'Enter') return
    if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
    if (!selectedChapter.value) return

    const ta = chapterTextareaRef.value
    if (!ta) return

    const start = ta.selectionStart ?? 0
    const end = ta.selectionEnd ?? start
    const current = selectedChapter.value.content ?? ''

    const insert = `\n\n${INDENT}`
    const nextValue = current.slice(0, start) + insert + current.slice(end)

    e.preventDefault()
    applyChapterContentWithCaret(nextValue, start + insert.length)
  }

  function onGlobalKeydownCapture(e: KeyboardEvent): void {
    const ta = chapterTextareaRef.value
    if (!ta) return
    if (document.activeElement !== ta) return

    if (isAltEnter(e)) {
      e.preventDefault()
      e.stopPropagation()
      openCtxMenuFromSelection()
    }
  }

  function isFocusInsideAiStudio(target: EventTarget | null | undefined): boolean {
    if (typeof document === 'undefined') return false
    const studio = document.getElementById('chapter-hub-ai-studio')
    if (!studio || !(target instanceof Node)) return false
    return studio.contains(target)
  }

  function markChapterPaperInteraction(): void {
    chapterPaperPointerUntil = Date.now() + 280
  }

  function engageChapterWritingView(): void {
    isChapterTextareaFocused.value = true
  }

  function onChapterPaperPointerDown(): void {
    markChapterPaperInteraction()
  }

  function onAiStudioPointerDown(): void {
    aiStudioPointerUntil = Date.now() + 400
    engageChapterWritingView()
  }

  function onChapterTextareaFocus(): void {
    engageChapterWritingView()
    void (async () => {
      await nextTick()
      await ensureFirstLineIndent(true)
      const ta2 = chapterTextareaRef.value
      if (ta2 && (selectedChapter.value?.content ?? '') === INDENT) {
        ta2.setSelectionRange(INDENT.length, INDENT.length)
      }
      if (ta2) updateNameSuggestion(ta2)
    })()
  }

  function onChapterTextareaKeyup(e: KeyboardEvent): void {
    const ta = chapterTextareaRef.value
    if (!ta) return
    hasTextareaSelection.value = (ta.selectionStart ?? 0) !== (ta.selectionEnd ?? 0)
    if (forceSuggest.value && (ta.selectionStart ?? 0) !== (ta.selectionEnd ?? 0)) {
      forceSuggest.value = false
    }
    updateNameSuggestion(ta)

  }

  function onChapterTextareaMouseup(): void {
    const ta = chapterTextareaRef.value
    if (!ta || !selectedChapter.value) return

    window.setTimeout(() => {
      const start = ta.selectionStart ?? 0
      const end = ta.selectionEnd ?? start
      hasTextareaSelection.value = end > start
      if (end <= start) closeCtxMenu()
    }, 0)
  }

  function onChapterTextareaSelect(): void {
    const ta = chapterTextareaRef.value
    if (ta) hasTextareaSelection.value = (ta.selectionStart ?? 0) !== (ta.selectionEnd ?? 0)
    if (hasTextareaSelection.value) onEntityNameLeave()
  }

  function finishChapterTextareaBlur(): void {
    isChapterTextareaFocused.value = false
    hasTextareaSelection.value = false
    resetNameSuggest()
    closeCtxMenu()
    onEntityNameLeave()
  }

  function onChapterTextareaBlur(e?: FocusEvent): void {
    if (hasPinnedQuoteSelection?.()) {
      engageChapterWritingView()
      return
    }
    if (isFocusInsideAiStudio(e?.relatedTarget)) {
      engageChapterWritingView()
      return
    }
    window.setTimeout(() => {
      if (hasPinnedQuoteSelection?.()) {
        engageChapterWritingView()
        return
      }
      if (isFocusInsideAiStudio(document.activeElement)) {
        engageChapterWritingView()
        return
      }
      if (Date.now() < chapterPaperPointerUntil) return
      if (Date.now() < aiStudioPointerUntil) return
      if (document.activeElement === chapterTextareaRef.value) return
      finishChapterTextareaBlur()
    }, 80)
  }

  function onWindowViewportChange(): void {
    if (!nameSuggestOpen.value) return
    const ta = chapterTextareaRef.value
    if (!ta) return
    updateNameSuggestion(ta)
  }

  function onWindowBlur(): void {
    clearChapterTextareaInteractionState({ blurTextarea: true, collapseSelection: true })
  }

  onMounted(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('scroll', onWindowViewportChange, true)
    window.addEventListener('resize', onWindowViewportChange)
    window.addEventListener('keydown', onGlobalKeydownCapture, true)
    window.addEventListener('blur', onWindowBlur)
  })

  onUnmounted(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('scroll', onWindowViewportChange, true)
    window.removeEventListener('resize', onWindowViewportChange)
    window.removeEventListener('keydown', onGlobalKeydownCapture, true)
    window.removeEventListener('blur', onWindowBlur)
  })

  return {
    isChapterTextareaFocused,
    hasTextareaSelection,
    entityPreviewLines,
    shouldShowEntityOverlay,
    wordCount,
    onChapterTextareaKeydown,
    onChapterTextareaBeforeInput,
    onChapterTextareaKeyup,
    engageChapterWritingView,
    onChapterPaperPointerDown,
    onAiStudioPointerDown,
    onChapterTextareaFocus,
    onChapterTextareaBlur,
    onChapterTextareaMouseup,
    onChapterTextareaSelect,
    exitChapterWritingView: finishChapterTextareaBlur,
  }
}
