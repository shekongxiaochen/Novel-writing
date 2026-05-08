import { computed, onUnmounted, ref, type Ref } from 'vue'
import {
  getCharacterStateAtPosition,
  getFactionStateAtPosition,
  type EntityMembershipSnapshot,
} from '../../../lib/storage'
import type { Category, Chapter, Character, Faction } from '../../../types'

export type FactionTooltipMemberRow = {
  name: string
  /** 该角色在此势力中的身份/立场（与势力编辑里「描述」一致） */
  description: string
}

/** 势力悬停提示中最多展示的成员条数 */
export const FACTION_TOOLTIP_MEMBER_LIMIT = 10

export function useChapterHubEntityTooltip(deps: {
  factions: Ref<Faction[]>
  categories: Ref<Category[]>
  characters: Ref<Character[]>
  chapters: Ref<Chapter[]>
  currentChapterId: Ref<string>
}) {
  const { factions, categories, characters, chapters, currentChapterId } = deps

  const entityTooltipOpen = ref(false)
  const entityTooltipCharacter = ref<Character | null>(null)
  const entityTooltipFaction = ref<Faction | null>(null)
  const entityTooltipAnchorRect = ref<DOMRect | null>(null)
  const entityTooltipTextRange = ref<{ start: number; end: number } | null>(null)
  const entityTooltipCharacterMemberships = ref<EntityMembershipSnapshot[]>([])
  const entityTooltipFactionMemberships = ref<EntityMembershipSnapshot[]>([])
  const entityTooltipX = ref(0)
  const entityTooltipY = ref(0)
  let openTimer: number | null = null
  let closeTimer: number | null = null

  function resolveFactionNameAtHover(factionId: string): string {
    const range = entityTooltipTextRange.value
    const chId = currentChapterId.value
    if (range && chId) {
      const resolved = getFactionStateAtPosition(factionId, chId, range.start, chapters.value)?.faction
      if (resolved?.name?.trim()) return resolved.name
    }
    return factions.value.find((f) => f.id === factionId)?.name ?? '未知势力'
  }

  function resolveCharacterNameAtHover(characterId: string): string {
    const range = entityTooltipTextRange.value
    const chId = currentChapterId.value
    if (range && chId) {
      const resolved = getCharacterStateAtPosition(characterId, chId, range.start, chapters.value)?.character
      if (resolved?.name?.trim()) return resolved.name
    }
    return characters.value.find((c) => c.id === characterId)?.name ?? '未命名角色'
  }

  /** 角色悬停：多势力及在各方势力中的描述 */
  const entityTooltipCharacterFactionLines = computed(() => {
    if (!entityTooltipCharacter.value) return [] as string[]
    return entityTooltipCharacterMemberships.value.map((m) => {
      const name = resolveFactionNameAtHover(m.factionId)
      const d = (m.description ?? '').trim()
      return d ? `${name}：${d}` : name
    })
  })

  const entityTooltipCharacterCategoryLines = computed(() => {
    const c = entityTooltipCharacter.value
    if (!c) return [] as string[]
    const ids = c.categoryIds ?? []
    if (ids.length === 0) return []
    return ids
      .map((id) => categories.value.find((x) => x.id === id)?.name ?? '')
      .filter((name) => name.trim())
  })

  const entityTooltipFactionCategoryLines = computed(() => {
    const f = entityTooltipFaction.value
    if (!f) return [] as string[]
    const ids = f.categoryIds ?? []
    if (ids.length === 0) return []
    return ids
      .map((id) => categories.value.find((x) => x.id === id)?.name ?? '')
      .filter((name) => name.trim())
  })

  /** 势力悬停：成员总数 + 仅前 N 条（见 FACTION_TOOLTIP_MEMBER_LIMIT） */
  const entityTooltipFactionMembers = computed((): { total: number; rows: FactionTooltipMemberRow[] } => {
    const f = entityTooltipFaction.value
    if (!f) return { total: 0, rows: [] }
    const rows = entityTooltipFactionMemberships.value.map((m) => ({
      name: resolveCharacterNameAtHover(m.characterId),
      description: (m.description ?? '').trim(),
    }))
    rows.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans'))
    const total = rows.length
    return { total, rows: rows.slice(0, FACTION_TOOLTIP_MEMBER_LIMIT) }
  })

  function onEntityNameEnter(
    e: MouseEvent,
    c: Character,
    anchorRect: DOMRect | null,
    textRange: { start: number; end: number } | null,
  ): void {
    if (openTimer) clearTimeout(openTimer)
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    openTimer = window.setTimeout(() => {
      const resolved =
        textRange && currentChapterId.value
          ? getCharacterStateAtPosition(c.id, currentChapterId.value, textRange.start, chapters.value)
          : null
      entityTooltipFaction.value = null
      entityTooltipFactionMemberships.value = []
      entityTooltipCharacter.value = resolved?.character ?? c
      entityTooltipCharacterMemberships.value = resolved?.memberships ?? []
      entityTooltipOpen.value = true
      entityTooltipAnchorRect.value = anchorRect
      entityTooltipTextRange.value = textRange
      entityTooltipX.value = e.clientX
      entityTooltipY.value = e.clientY
    }, 140)
  }

  function onFactionNameEnter(
    e: MouseEvent,
    f: Faction,
    anchorRect: DOMRect | null,
    textRange: { start: number; end: number } | null = null,
  ): void {
    if (openTimer) clearTimeout(openTimer)
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    openTimer = window.setTimeout(() => {
      const resolved =
        textRange && currentChapterId.value
          ? getFactionStateAtPosition(f.id, currentChapterId.value, textRange.start, chapters.value)
          : null
      entityTooltipCharacter.value = null
      entityTooltipCharacterMemberships.value = []
      entityTooltipFaction.value = resolved?.faction ?? f
      entityTooltipFactionMemberships.value = resolved?.memberships ?? []
      entityTooltipOpen.value = true
      entityTooltipAnchorRect.value = anchorRect
      entityTooltipTextRange.value = textRange
      entityTooltipX.value = e.clientX
      entityTooltipY.value = e.clientY
    }, 140)
  }

  function onEntityNameLeave(): void {
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = null
    }
    if (closeTimer) clearTimeout(closeTimer)
    // 软换行边界处 hover 很容易抖动；延迟关闭以避免“永远打不开”
    closeTimer = window.setTimeout(() => {
      entityTooltipOpen.value = false
      entityTooltipCharacter.value = null
      entityTooltipFaction.value = null
      entityTooltipCharacterMemberships.value = []
      entityTooltipFactionMemberships.value = []
      entityTooltipAnchorRect.value = null
      entityTooltipTextRange.value = null
      closeTimer = null
    }, 120)
  }

  onUnmounted(() => {
    if (openTimer) clearTimeout(openTimer)
    if (closeTimer) clearTimeout(closeTimer)
  })

  return {
    entityTooltipOpen,
    entityTooltipCharacter,
    entityTooltipFaction,
    entityTooltipAnchorRect,
    entityTooltipTextRange,
    entityTooltipX,
    entityTooltipY,
    entityTooltipCharacterFactionLines,
    entityTooltipCharacterCategoryLines,
    entityTooltipFactionCategoryLines,
    entityTooltipFactionMembers,
    onEntityNameEnter,
    onFactionNameEnter,
    onEntityNameLeave,
  }
}
