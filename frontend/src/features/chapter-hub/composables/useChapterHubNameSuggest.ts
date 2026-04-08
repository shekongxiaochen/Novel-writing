import { nextTick, ref, type ComputedRef, type Ref } from 'vue'
import { updateChapter } from '../../../lib/storage'
import { getCaretPixelOffset, scrollCaretIntoView } from '../caretGeometry'
import { getTypingPrefixInfo, resolveNamePrefix } from '../nameSuggestUtils'
import type { Chapter, Character, Faction } from '../../../types'

export function useChapterHubNameSuggest(deps: {
  characters: Ref<Character[]>
  factions: Ref<Faction[]>
  selectedChapter: ComputedRef<Chapter | null>
  chapters: Ref<Chapter[]>
  chapterTextareaRef: Ref<HTMLTextAreaElement | null>
}) {
  const { characters, factions, selectedChapter, chapters, chapterTextareaRef } = deps

  const nameSuggestOpen = ref(false)
  const nameSuggestList = ref<Array<{ id: string; name: string; kind: 'character' | 'faction' }>>([])
  const nameSuggestIndex = ref(0)
  const nameSuggestRange = ref<{ start: number; end: number } | null>(null)
  const nameSuggestDirection = ref<'down' | 'up'>('down')
  const nameSuggestStyle = ref<Record<string, string>>({})
  const forceSuggest = ref(false)

  function resetNameSuggest(): void {
    nameSuggestOpen.value = false
    nameSuggestList.value = []
    nameSuggestRange.value = null
    nameSuggestIndex.value = 0
    nameSuggestDirection.value = 'down'
    nameSuggestStyle.value = {}
    forceSuggest.value = false
  }

  function updateNameSuggestion(ta: HTMLTextAreaElement): void {
    const info = getTypingPrefixInfo(ta)
    if (!info && !forceSuggest.value) {
      resetNameSuggest()
      return
    }

    const prefixRaw = info?.prefix.trim() ?? ''
    if (!prefixRaw) {
      if (!forceSuggest.value) {
        resetNameSuggest()
        return
      }
    }

    const characterNames = characters.value.map((c) => c.name).filter(Boolean)
    const factionNames = factions.value.map((f) => f.name).filter(Boolean)
    const allNames = [...characterNames, ...factionNames]
    const resolved = prefixRaw ? resolveNamePrefix(prefixRaw, allNames) : null
    const prefix = resolved?.prefix ?? prefixRaw

    if (!forceSuggest.value && allNames.includes(prefix)) {
      resetNameSuggest()
      return
    }

    const normalizedPrefix = prefix.toLowerCase()
    const startsWithMatches = [
      ...characters.value
        .filter((c) => c.name && c.name.toLowerCase().startsWith(normalizedPrefix))
        .map((c) => ({ id: c.id, name: c.name, kind: 'character' as const })),
      ...factions.value
        .filter((f) => f.name && f.name.toLowerCase().startsWith(normalizedPrefix))
        .map((f) => ({ id: f.id, name: f.name, kind: 'faction' as const })),
    ]
    const includeMatches = [
      ...characters.value
        .filter((c) => c.name && !c.name.toLowerCase().startsWith(normalizedPrefix) && c.name.includes(prefix))
        .map((c) => ({ id: c.id, name: c.name, kind: 'character' as const })),
      ...factions.value
        .filter((f) => f.name && !f.name.toLowerCase().startsWith(normalizedPrefix) && f.name.includes(prefix))
        .map((f) => ({ id: f.id, name: f.name, kind: 'faction' as const })),
    ]

    const list = (prefix
      ? [...startsWithMatches, ...includeMatches]
      : [
          ...characters.value.map((c) => ({ id: c.id, name: c.name, kind: 'character' as const })),
          ...factions.value.map((f) => ({ id: f.id, name: f.name, kind: 'faction' as const })),
        ])
      .slice(0, 10)

    if (list.length === 0) {
      resetNameSuggest()
      return
    }

    nameSuggestList.value = list
    nameSuggestOpen.value = true
    if (info) {
      if (resolved) {
        nameSuggestRange.value = {
          start: info.end - resolved.offsetFromEnd,
          end: info.end,
        }
      } else {
        nameSuggestRange.value = { start: info.start, end: info.end }
      }
    }
    if (nameSuggestIndex.value >= list.length) nameSuggestIndex.value = 0

    const caretPos = info?.end ?? (ta.selectionStart ?? ta.value.length)
    const coords = getCaretPixelOffset(ta, caretPos)
    if (!coords) return

    const panelHeight = Math.min(260, list.length * 40 + 16)
    const panelWidth = Math.min(420, Math.max(240, ta.clientWidth * 0.72))
    const taRect = ta.getBoundingClientRect()
    const caretYViewport = taRect.top + (coords.top - ta.scrollTop)
    const caretXViewport = taRect.left + coords.left
    const lineHeight = Math.max(18, coords.height || 0)
    const viewportPad = 8
    const spaceBelow = window.innerHeight - (caretYViewport + lineHeight)
    const spaceAbove = caretYViewport
    const preferUp = spaceBelow < panelHeight + 8 && spaceAbove > panelHeight + 8

    const top = preferUp
      ? Math.max(viewportPad, caretYViewport - panelHeight - 6)
      : Math.min(window.innerHeight - panelHeight - viewportPad, caretYViewport + lineHeight + 6)
    const left = Math.min(
      Math.max(viewportPad, caretXViewport - 18),
      Math.max(viewportPad, window.innerWidth - panelWidth - viewportPad)
    )

    nameSuggestDirection.value = preferUp ? 'up' : 'down'
    nameSuggestStyle.value = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${panelWidth}px`,
    }
  }

  function applyNameSuggestion(name: string): void {
    const chapter = selectedChapter.value
    const ta = chapterTextareaRef.value
    const range = nameSuggestRange.value
    if (!chapter || !ta || !range) return

    const current = ta.value ?? ''
    const nextValue = current.slice(0, range.start) + name + current.slice(range.end)
    const nextCaret = range.start + name.length

    updateChapter({ id: chapter.id, content: nextValue })
    const i = chapters.value.findIndex((c) => c.id === chapter.id)
    if (i >= 0) {
      chapters.value = chapters.value.map((c, j) => (j === i ? { ...c, content: nextValue } : c))
    }

    resetNameSuggest()

    void nextTick(() => {
      ta.focus()
      ta.setSelectionRange(nextCaret, nextCaret)
      scrollCaretIntoView(ta, nextCaret)
    })
  }

  return {
    nameSuggestOpen,
    nameSuggestList,
    nameSuggestIndex,
    nameSuggestRange,
    nameSuggestDirection,
    nameSuggestStyle,
    forceSuggest,
    updateNameSuggestion,
    applyNameSuggestion,
    resetNameSuggest,
  }
}
