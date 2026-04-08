import type { Character, Faction } from '../../types'

export type EntityToken = {
  text: string
  character: Character | null
  faction: Faction | null
}
