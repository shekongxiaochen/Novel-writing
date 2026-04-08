import { computed, onUnmounted, ref, type Ref } from 'vue'
import type { Category, Character, CharacterFactionMembership, Faction } from '../../../types'

export function useChapterHubEntityTooltip(deps: {
  factions: Ref<Faction[]>
  categories: Ref<Category[]>
  characterFactionMemberships: Ref<CharacterFactionMembership[]>
}) {
  const { factions, categories, characterFactionMemberships } = deps

  const entityTooltipOpen = ref(false)
  const entityTooltipCharacter = ref<Character | null>(null)
  const entityTooltipFaction = ref<Faction | null>(null)
  const entityTooltipX = ref(0)
  const entityTooltipY = ref(0)
  let entityTooltipTimer: number | null = null

  /** 角色悬停：多势力及在各方势力中的描述 */
  const entityTooltipCharacterFactionLines = computed(() => {
    const c = entityTooltipCharacter.value
    if (!c) return [] as string[]
    return characterFactionMemberships.value
      .filter((m) => m.characterId === c.id)
      .map((m) => {
        const name = factions.value.find((f) => f.id === m.factionId)?.name ?? '未知势力'
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

  function onEntityNameEnter(e: MouseEvent, c: Character): void {
    if (entityTooltipTimer) clearTimeout(entityTooltipTimer)
    entityTooltipTimer = window.setTimeout(() => {
      entityTooltipFaction.value = null
      entityTooltipCharacter.value = c
      entityTooltipOpen.value = true
      entityTooltipX.value = Math.min(e.clientX + 12, window.innerWidth - 320)
      entityTooltipY.value = Math.max(12, e.clientY + 12)
    }, 300)
  }

  function onFactionNameEnter(e: MouseEvent, f: Faction): void {
    if (entityTooltipTimer) clearTimeout(entityTooltipTimer)
    entityTooltipTimer = window.setTimeout(() => {
      entityTooltipCharacter.value = null
      entityTooltipFaction.value = f
      entityTooltipOpen.value = true
      entityTooltipX.value = Math.min(e.clientX + 12, window.innerWidth - 320)
      entityTooltipY.value = Math.max(12, e.clientY + 12)
    }, 300)
  }

  function onEntityNameLeave(): void {
    if (entityTooltipTimer) {
      clearTimeout(entityTooltipTimer)
      entityTooltipTimer = null
    }
    entityTooltipOpen.value = false
    entityTooltipCharacter.value = null
    entityTooltipFaction.value = null
  }

  onUnmounted(() => {
    if (entityTooltipTimer) clearTimeout(entityTooltipTimer)
  })

  return {
    entityTooltipOpen,
    entityTooltipCharacter,
    entityTooltipFaction,
    entityTooltipX,
    entityTooltipY,
    entityTooltipCharacterFactionLines,
    entityTooltipCharacterCategoryLines,
    entityTooltipFactionCategoryLines,
    onEntityNameEnter,
    onFactionNameEnter,
    onEntityNameLeave,
  }
}
