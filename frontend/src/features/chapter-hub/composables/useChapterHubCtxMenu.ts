import { computed, ref, type ComputedRef, type Ref } from 'vue'
import {
  createCharacter,
  createCharacterFactionMembership,
  createFaction,
  deleteCharacterFactionMembership,
  getCharacterFactionMembershipsByNovelId,
  getCharactersByNovelId,
  getFactionsByNovelId,
} from '../../../lib/storage'
import { getCaretPixelOffset } from '../caretGeometry'
import {
  resolveCharacterCoveringSelection,
  resolveFactionCoveringSelection,
  trimSelectionRange,
} from '../entitySelectionResolve'
import type { Character, CharacterFactionMembership, Faction, Novel } from '../../../types'

export function useChapterHubCtxMenu(deps: {
  novelId: ComputedRef<string>
  novel: ComputedRef<Novel | null>
  selectedChapter: ComputedRef<{ id: string; chapterNo: number } | null>
  characters: Ref<Character[]>
  factions: Ref<Faction[]>
  characterFactionMemberships: Ref<CharacterFactionMembership[]>
  chapterTextareaRef: Ref<HTMLTextAreaElement | null>
}) {
  const { novelId, novel, selectedChapter, characters, factions, characterFactionMemberships, chapterTextareaRef } =
    deps

  const ctxMenuOpen = ref(false)
  const ctxMenuX = ref(0)
  const ctxMenuY = ref(0)
  const ctxMenuSelection = ref('')
  /** 去掉首尾空白后的选区，用于解析「落在某次完整角色/势力名内」 */
  const ctxMenuRange = ref<{ start: number; end: number } | null>(null)
  const ctxMenuNotice = ref('')

  function closeCtxMenu(): void {
    ctxMenuOpen.value = false
    ctxMenuNotice.value = ''
    ctxMenuRange.value = null
  }

  function openCtxMenuForSelection(selStart: number, selEnd: number): void {
    const ta = chapterTextareaRef.value
    if (!ta) return

    const tr = trimSelectionRange(ta.value, selStart, selEnd)
    if (!tr) {
      closeCtxMenu()
      return
    }

    ctxMenuRange.value = tr
    ctxMenuSelection.value = ta.value.slice(tr.start, tr.end)
    ctxMenuNotice.value = ''

    const coords = getCaretPixelOffset(ta, tr.end)
    if (!coords) return

    const taRect = ta.getBoundingClientRect()
    const caretYViewport = taRect.top + (coords.top - ta.scrollTop)
    const caretXViewport = taRect.left + coords.left

    const menuWidth = 180
    const menuHeight = 96
    const pad = 8

    let x = caretXViewport + 6
    let y = caretYViewport + (coords.height || 18) + 6
    if (x + menuWidth > window.innerWidth - pad) x = window.innerWidth - menuWidth - pad
    if (y + menuHeight > window.innerHeight - pad) {
      y = caretYViewport - menuHeight - 6
      if (y < pad) y = pad
    }

    ctxMenuX.value = x
    ctxMenuY.value = y
    ctxMenuOpen.value = true
  }

  function openCtxMenuAtPoint(selStart: number, selEnd: number, x0: number, y0: number): void {
    const ta = chapterTextareaRef.value
    if (!ta) return

    const tr = trimSelectionRange(ta.value, selStart, selEnd)
    if (!tr) {
      closeCtxMenu()
      return
    }

    ctxMenuRange.value = tr
    ctxMenuSelection.value = ta.value.slice(tr.start, tr.end)
    ctxMenuNotice.value = ''

    const menuWidth = 180
    const menuHeight = 96
    const pad = 8

    let x = x0
    let y = y0
    if (x + menuWidth > window.innerWidth - pad) x = window.innerWidth - menuWidth - pad
    if (y + menuHeight > window.innerHeight - pad) y = window.innerHeight - menuHeight - pad
    if (x < pad) x = pad
    if (y < pad) y = pad

    ctxMenuX.value = x
    ctxMenuY.value = y
    ctxMenuOpen.value = true
  }

  function openCtxMenuFromSelection(): void {
    const ta = chapterTextareaRef.value
    if (!ta || !selectedChapter.value) return

    const start = ta.selectionStart ?? 0
    const end = ta.selectionEnd ?? start

    if (end > start) {
      openCtxMenuForSelection(start, end)
      return
    }

    const text = ta.value ?? ''
    const pos = start
    const left = text.slice(0, pos)
    const right = text.slice(pos)
    const leftMatch = left.match(/([\p{Script=Han}A-Za-z0-9_]+)$/u)
    const rightMatch = right.match(/^([\p{Script=Han}A-Za-z0-9_]+)/u)
    const leftPart = leftMatch?.[1] ?? ''
    const rightPart = rightMatch?.[1] ?? ''
    if (!leftPart && !rightPart) {
      closeCtxMenu()
      return
    }

    const wordStart = pos - leftPart.length
    const wordEnd = pos + rightPart.length
    openCtxMenuForSelection(wordStart, wordEnd)
  }

  function openCtxMenuForExplicitSelection(): void {
    const ta = chapterTextareaRef.value
    if (!ta || !selectedChapter.value) return

    const start = ta.selectionStart ?? 0
    const end = ta.selectionEnd ?? start
    if (end <= start) {
      closeCtxMenu()
      return
    }

    openCtxMenuForSelection(start, end)
  }

  function addSelectionAsCharacter(): void {
    if (!novel.value) return
    const name = ctxMenuSelection.value.trim()
    if (!name) return

    const ta = chapterTextareaRef.value
    const r = ctxMenuRange.value
    if (ta && r && r.end > r.start) {
      const text = ta.value
      const ch = resolveCharacterCoveringSelection(text, r.start, r.end, characters.value)
      if (ch) {
        ctxMenuNotice.value = `该选区已属于角色「${ch.name}」`
        return
      }
      const fc = resolveFactionCoveringSelection(text, r.start, r.end, factions.value)
      if (fc) {
        ctxMenuNotice.value = `该选区已在势力名称「${fc.name ?? ''}」内`
        return
      }
    }

    createCharacter({
      novelId: novel.value.id,
      name,
      firstAppearanceChapterNo: selectedChapter.value?.chapterNo ?? null,
      age: '',
      gender: '',
      goal: '',
      secret: '',
      arc: '',
      notes: '',
    })
    characters.value = getCharactersByNovelId(novelId.value)
    closeCtxMenu()
  }

  function addSelectionAsFaction(): void {
    if (!novel.value) return
    const name = ctxMenuSelection.value.trim()
    if (!name) return

    const ta = chapterTextareaRef.value
    const r = ctxMenuRange.value
    if (ta && r && r.end > r.start) {
      const text = ta.value
      const ch = resolveCharacterCoveringSelection(text, r.start, r.end, characters.value)
      if (ch) {
        ctxMenuNotice.value = '该选区已属于角色，不能创建为势力'
        return
      }
      const fc = resolveFactionCoveringSelection(text, r.start, r.end, factions.value)
      if (fc) {
        ctxMenuNotice.value = '该选区已在势力名称内，不能重复创建'
        return
      }
    }

    const isCharacter = characters.value.some((c) => c.name.trim() === name)
    if (isCharacter) {
      ctxMenuNotice.value = '该名称已是角色，不能创建为势力'
      return
    }

    const existed = factions.value.some((f) => (f.name ?? '').trim() === name)
    if (existed) {
      ctxMenuNotice.value = '已存在此势力'
      return
    }

    createFaction({
      novelId: novel.value.id,
      name,
      leader: '',
      notes: '',
    })
    factions.value = getFactionsByNovelId(novelId.value)
    closeCtxMenu()
  }

  const ctxMenuSelectedCharacter = computed(() => {
    const ta = chapterTextareaRef.value
    const r = ctxMenuRange.value
    if (ta && r && r.end > r.start) {
      const resolved = resolveCharacterCoveringSelection(ta.value, r.start, r.end, characters.value)
      if (resolved) return resolved
    }
    const name = ctxMenuSelection.value.trim()
    if (!name) return null
    return characters.value.find((c) => c.name.trim() === name) ?? null
  })

  const ctxMenuSelectedFaction = computed(() => {
    const ta = chapterTextareaRef.value
    const r = ctxMenuRange.value
    if (ta && r && r.end > r.start) {
      const resolved = resolveFactionCoveringSelection(ta.value, r.start, r.end, factions.value)
      if (resolved) return resolved
    }
    const name = ctxMenuSelection.value.trim()
    if (!name) return null
    return factions.value.find((f) => (f.name ?? '').trim() === name) ?? null
  })

  /** 选区已落在已有角色或势力名内时不展示「添加为」 */
  const ctxMenuShowAddAs = computed(() => {
    return !ctxMenuSelectedCharacter.value && !ctxMenuSelectedFaction.value
  })

  const ctxMenuBoundFactionSummary = computed(() => {
    const c = ctxMenuSelectedCharacter.value
    if (!c) return ''
    const names = characterFactionMemberships.value
      .filter((m) => m.characterId === c.id)
      .map((m) => factions.value.find((f) => f.id === m.factionId)?.name)
      .filter(Boolean) as string[]
    return names.length ? names.join('、') : ''
  })

  /** 选区与已有角色同名时，不允许再「添加为势力」 */
  const ctxMenuCanAddAsFaction = computed(() => {
    const ta = chapterTextareaRef.value
    const r = ctxMenuRange.value
    if (ta && r && r.end > r.start) {
      if (resolveCharacterCoveringSelection(ta.value, r.start, r.end, characters.value)) return false
    }
    const name = ctxMenuSelection.value.trim()
    if (!name) return true
    return !characters.value.some((c) => c.name.trim() === name)
  })

  function ctxMenuFactionIsCurrent(factionId: string): boolean {
    const c = ctxMenuSelectedCharacter.value
    if (!c) return false
    return characterFactionMemberships.value.some((m) => m.characterId === c.id && m.factionId === factionId)
  }

  function toggleFactionMembershipForSelectedCharacter(factionId: string): void {
    const c = ctxMenuSelectedCharacter.value
    if (!c || !novel.value) return
    const ex = characterFactionMemberships.value.find(
      (m) => m.characterId === c.id && m.factionId === factionId
    )
    if (ex) {
      deleteCharacterFactionMembership(ex.id)
      ctxMenuNotice.value = '已退出该势力'
    } else {
      try {
        createCharacterFactionMembership({
          novelId: novelId.value,
          characterId: c.id,
          factionId,
          description: '',
        })
        ctxMenuNotice.value = '已加入该势力'
      } catch (e) {
        ctxMenuNotice.value = e instanceof Error ? e.message : '操作失败'
        return
      }
    }
    characterFactionMemberships.value = getCharacterFactionMembershipsByNovelId(novelId.value)
  }

  return {
    ctxMenuOpen,
    ctxMenuX,
    ctxMenuY,
    ctxMenuSelection,
    ctxMenuNotice,
    ctxMenuSelectedCharacter,
    ctxMenuSelectedFaction,
    ctxMenuShowAddAs,
    ctxMenuBoundFactionSummary,
    ctxMenuCanAddAsFaction,
    openCtxMenuFromSelection,
    openCtxMenuForExplicitSelection,
    openCtxMenuAtPoint,
    closeCtxMenu,
    addSelectionAsCharacter,
    addSelectionAsFaction,
    ctxMenuFactionIsCurrent,
    toggleFactionMembershipForSelectedCharacter,
  }
}
