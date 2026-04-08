import { type ComputedRef } from 'vue'
import { useRouter } from 'vue-router'
import type { Character, Faction } from '../../../types'

export function useChapterHubWorkspaceNav(
  novelId: ComputedRef<string>,
  onBeforeCharacterNav?: () => void
) {
  const router = useRouter()

  function goToCharacter(c: Character): void {
    onBeforeCharacterNav?.()
    void router.push({
      name: 'novel-workspace',
      params: { id: novelId.value },
      query: { tab: 'characters', focusCharacterId: c.id, scrollTo: 'characters-bottom' },
    })
  }

  function goToFaction(f: Faction): void {
    void router.push({
      name: 'novel-workspace',
      params: { id: novelId.value },
      query: { tab: 'factions', focusFactionId: f.id, scrollTo: 'factions-item' },
    })
  }

  return { goToCharacter, goToFaction }
}
