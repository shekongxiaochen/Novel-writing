import type { Character, Faction } from '../../types'
import type { EntityToken } from './types'

export function buildEntityPreviewLines(
  content: string,
  characters: Character[],
  factions: Faction[]
): EntityToken[][] {
  const lines = content.split('\n')
  const chars = [...characters]
    .filter((c) => !!c.name)
    .sort((a, b) => b.name.length - a.name.length)
  const facs = [...factions]
    .filter((f) => !!f.name)
    .sort((a, b) => b.name.length - a.name.length)

  const entities = [
    ...chars.map((c) => ({ kind: 'character' as const, name: c.name, obj: c })),
    ...facs.map((f) => ({ kind: 'faction' as const, name: f.name, obj: f })),
  ].sort((a, b) => b.name.length - a.name.length)

  const tokenize = (line: string): EntityToken[] => {
    if (!line) return [{ text: '', character: null, faction: null }]
    const tokens: EntityToken[] = []
    let i = 0
    while (i < line.length) {
      let matchedChar: Character | null = null
      let matchedFaction: Faction | null = null
      let matchedLen = 0

      for (const e of entities) {
        if (line.startsWith(e.name, i)) {
          matchedLen = e.name.length
          if (e.kind === 'character') matchedChar = e.obj as Character
          else matchedFaction = e.obj as Faction
          break
        }
      }

      if (matchedLen > 0) {
        tokens.push({
          text: line.slice(i, i + matchedLen),
          character: matchedChar,
          faction: matchedFaction,
        })
        i += matchedLen
      } else {
        tokens.push({ text: line[i], character: null, faction: null })
        i += 1
      }
    }
    return tokens
  }

  return lines.map((l) => tokenize(l))
}
