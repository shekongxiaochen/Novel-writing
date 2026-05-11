import { nextTick, ref, type ComputedRef, type Ref } from 'vue'
import { updateChapter } from '../../../lib/storage'
import { characterMatchLabels } from '../../../lib/characterLabels'
import { getCaretPixelOffset, scrollCaretIntoView } from '../caretGeometry'
import { getTypingPrefixInfo, resolveNamePrefix } from '../nameSuggestUtils'
import type { Chapter, Character, Faction, Item } from '../../../types'

type NameSuggestRow = { id: string; name: string; kind: 'character' | 'faction' | 'item' }

function sortNameSuggestRows(rows: NameSuggestRow[]): NameSuggestRow[] {
  return [...rows].sort((a, b) => {
    const ld = b.name.length - a.name.length
    if (ld !== 0) return ld
    return a.name.localeCompare(b.name, 'zh-Hans')
  })
}

export function useChapterHubNameSuggest(deps: {
  characters: Ref<Character[]>
  factions: Ref<Faction[]>
  items: Ref<Item[]>
  selectedChapter: ComputedRef<Chapter | null>
  chapters: Ref<Chapter[]>
  chapterTextareaRef: Ref<HTMLTextAreaElement | null>
}) {
  const { characters, factions, items, selectedChapter, chapters, chapterTextareaRef } = deps

  const nameSuggestOpen = ref(false)
  const nameSuggestList = ref<NameSuggestRow[]>([])
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

    const characterNames = characters.value.flatMap((c) => characterMatchLabels(c)).filter(Boolean)
    const factionNames = factions.value.map((f) => f.name).filter(Boolean)
    const itemNames = items.value.map((item) => item.name).filter(Boolean)
    const allNames = [...characterNames, ...factionNames, ...itemNames]
    const resolved = prefixRaw ? resolveNamePrefix(prefixRaw, allNames) : null
    const prefix = resolved?.prefix ?? prefixRaw

    if (!forceSuggest.value && allNames.includes(prefix)) {
      resetNameSuggest()
      return
    }

    const normalizedPrefix = prefix.toLowerCase()
    const startsWithMatches: NameSuggestRow[] = []
    for (const c of characters.value) {
      for (const label of characterMatchLabels(c)) {
        if (!label) continue
        if (label.toLowerCase().startsWith(normalizedPrefix)) {
          startsWithMatches.push({ id: `ch:${c.id}:${label}`, name: label, kind: 'character' })
        }
      }
    }
    for (const f of factions.value) {
      if (f.name && f.name.toLowerCase().startsWith(normalizedPrefix)) {
        startsWithMatches.push({ id: f.id, name: f.name, kind: 'faction' })
      }
    }
    for (const item of items.value) {
      if (item.name && item.name.toLowerCase().startsWith(normalizedPrefix)) {
        startsWithMatches.push({ id: `item:${item.id}`, name: item.name, kind: 'item' })
      }
    }

    const includeMatches: NameSuggestRow[] = []
    for (const c of characters.value) {
      for (const label of characterMatchLabels(c)) {
        if (!label) continue
        if (!label.toLowerCase().startsWith(normalizedPrefix) && label.includes(prefix)) {
          includeMatches.push({ id: `ch:${c.id}:${label}`, name: label, kind: 'character' })
        }
      }
    }
    for (const f of factions.value) {
      if (f.name && !f.name.toLowerCase().startsWith(normalizedPrefix) && f.name.includes(prefix)) {
        includeMatches.push({ id: f.id, name: f.name, kind: 'faction' })
      }
    }
    for (const item of items.value) {
      if (item.name && !item.name.toLowerCase().startsWith(normalizedPrefix) && item.name.includes(prefix)) {
        includeMatches.push({ id: `item:${item.id}`, name: item.name, kind: 'item' })
      }
    }

    const allCharacterRows: NameSuggestRow[] = characters.value.flatMap((c) =>
      characterMatchLabels(c).map((label) => ({
        id: `ch:${c.id}:${label}`,
        name: label,
        kind: 'character' as const,
      })),
    )
    const allFactionRows: NameSuggestRow[] = factions.value.map((f) => ({
      id: f.id,
      name: f.name,
      kind: 'faction' as const,
    }))
    const allItemRows: NameSuggestRow[] = items.value.map((item) => ({
      id: `item:${item.id}`,
      name: item.name,
      kind: 'item' as const,
    }))

    const list = sortNameSuggestRows(
      prefix ? [...startsWithMatches, ...includeMatches] : [...allCharacterRows, ...allFactionRows, ...allItemRows],
    ).slice(0, 10)

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

    const taRect = ta.getBoundingClientRect()
    const caretYViewport = taRect.top + (coords.top - ta.scrollTop)
    const caretXViewport = taRect.left + coords.left
    const lineHeight = Math.max(18, coords.height || 0)
    const caretBottom = caretYViewport + lineHeight

    const viewportPad = 8
    const edgePad = 8
    const gap = 6
    const maxPanelH = 240
    const rowEstimate = 44
    const gridGap = 6
    const panelPad = 16
    const maxRowsBeforeScroll = 4

    function listPanelHeightForRows(rows: number): number {
      if (rows <= 0) return panelPad
      return rows * rowEstimate + (rows - 1) * gridGap + panelPad
    }

    const visibleRowCount = list.length > maxRowsBeforeScroll ? maxRowsBeforeScroll : list.length
    const contentCapHeight = listPanelHeightForRows(visibleRowCount)
    const naturalHeight = Math.min(maxPanelH, contentCapHeight)

    const panelWidth = Math.min(420, Math.max(240, ta.clientWidth * 0.72))

    // 以正文 textarea 可视区域为边界，避免提示列表伸出写作区底部/顶部
    const spaceBelowTa = taRect.bottom - caretBottom - edgePad
    const spaceAboveTa = caretYViewport - taRect.top - edgePad
    const vSpaceBelow = window.innerHeight - caretBottom - viewportPad
    const vSpaceAbove = caretYViewport - viewportPad

    let preferUp = false
    let panelHeight = naturalHeight

    if (spaceBelowTa >= naturalHeight + gap) {
      preferUp = false
      panelHeight = Math.min(naturalHeight, spaceBelowTa - gap, vSpaceBelow - gap)
    } else if (spaceAboveTa >= naturalHeight + gap) {
      preferUp = true
      panelHeight = Math.min(naturalHeight, spaceAboveTa - gap, vSpaceAbove - gap)
    } else if (spaceAboveTa > spaceBelowTa) {
      preferUp = true
      panelHeight = Math.max(96, Math.min(naturalHeight, spaceAboveTa - gap, vSpaceAbove - gap))
    } else {
      preferUp = false
      panelHeight = Math.max(96, Math.min(naturalHeight, spaceBelowTa - gap, vSpaceBelow - gap))
    }

    panelHeight = Math.min(panelHeight, maxPanelH, contentCapHeight)
    if (preferUp) {
      panelHeight = Math.min(panelHeight, Math.max(96, vSpaceAbove - gap))
    } else {
      panelHeight = Math.min(panelHeight, Math.max(96, vSpaceBelow - gap))
    }

    let top: number
    if (preferUp) {
      top = Math.min(caretYViewport - gap - panelHeight, taRect.bottom - edgePad - panelHeight)
      top = Math.max(viewportPad, taRect.top + edgePad, top)
    } else {
      top = caretBottom + gap
      top = Math.min(top, taRect.bottom - edgePad - panelHeight, window.innerHeight - viewportPad - panelHeight)
      top = Math.max(viewportPad, taRect.top + edgePad, top)
    }

    const left = Math.min(
      Math.max(viewportPad, taRect.left + edgePad, caretXViewport - 18),
      Math.max(viewportPad, taRect.right - panelWidth - edgePad, window.innerWidth - panelWidth - viewportPad)
    )

    nameSuggestDirection.value = preferUp ? 'up' : 'down'
    nameSuggestStyle.value = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${panelWidth}px`,
      maxHeight: `${Math.max(96, Math.min(panelHeight, contentCapHeight))}px`,
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
