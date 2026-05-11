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
  } = deps

  const INDENT = CHAPTER_HUB_FIRST_LINE_INDENT

  const isChapterTextareaFocused = ref(false)
  const hasTextareaSelection = ref(false)

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

  function onChapterTextareaKeydown(e: KeyboardEvent) {
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

    updateChapter({ id: selectedChapter.value.id, content: nextValue })

    const i = chapters.value.findIndex((c) => c.id === selectedChapter.value!.id)
    if (i >= 0) {
      chapters.value = chapters.value.map((c, j) => (j === i ? { ...c, content: nextValue } : c))
    }

    const newPos = start + insert.length
    void nextTick(() => {
      ta.setSelectionRange(newPos, newPos)
      ta.focus()
      scrollCaretIntoView(ta, newPos)
    })
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

  function onChapterTextareaFocus(): void {
    isChapterTextareaFocused.value = true
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

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      window.setTimeout(() => openCtxMenuForExplicitSelection(), 0)
    }
  }

  function onChapterTextareaMouseup(e: MouseEvent): void {
    const ta = chapterTextareaRef.value
    if (!ta || !selectedChapter.value) return

    window.setTimeout(() => {
      const start = ta.selectionStart ?? 0
      const end = ta.selectionEnd ?? start
      if (end <= start) {
        closeCtxMenu()
        return
      }
      openCtxMenuAtPoint(start, end, e.clientX + 6, e.clientY + 6)
    }, 0)
  }

  function onChapterTextareaSelect(): void {
    const ta = chapterTextareaRef.value
    if (ta) hasTextareaSelection.value = (ta.selectionStart ?? 0) !== (ta.selectionEnd ?? 0)
    if (hasTextareaSelection.value) onEntityNameLeave()
    window.setTimeout(() => openCtxMenuForExplicitSelection(), 0)
  }

  function onChapterTextareaBlur(): void {
    isChapterTextareaFocused.value = false
    hasTextareaSelection.value = false
    window.setTimeout(() => {
      resetNameSuggest()
      closeCtxMenu()
      onEntityNameLeave()
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
    onChapterTextareaKeyup,
    onChapterTextareaFocus,
    onChapterTextareaBlur,
    onChapterTextareaMouseup,
    onChapterTextareaSelect,
  }
}
