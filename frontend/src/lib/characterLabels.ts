import type { Character } from '../types'

/** 规范化别名列表：去空、trim、按小写去重（保留首次出现的写法） */
export function normalizeCharacterAliases(raw: string[] | undefined | null): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of raw) {
    const t = (a ?? '').trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

/** 正文匹配 / 提示用：主名 + 别名；与主名同字的别名条目会省略 */
export function characterMatchLabels(c: Character): string[] {
  const name = (c.name ?? '').trim()
  const aliases = normalizeCharacterAliases(c.aliases)
  const seen = new Set<string>()
  const out: string[] = []
  if (name) {
    seen.add(name.toLowerCase())
    out.push(name)
  }
  for (const a of aliases) {
    const key = a.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a)
  }
  return out
}

export function findCharacterByLabel(characters: Character[], needle: string): Character | null {
  const t = needle.trim()
  if (!t) return null
  return characters.find((c) => characterMatchLabels(c).some((l) => l === t)) ?? null
}

export function someCharacterHasLabel(characters: Character[], needle: string): boolean {
  return findCharacterByLabel(characters, needle) != null
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 将文本中命中的旧角色标签（主名/别名）统一替换成新主名。
 * 注意：这里按“纯文本子串”替换，不做分词边界判断，和正文实体命中策略保持一致。
 */
export function replaceCharacterLabelsInText(
  content: string,
  oldLabels: string[],
  nextName: string,
): string {
  const base = String(content ?? '')
  const target = String(nextName ?? '').trim()
  if (!target) return base
  const labels = normalizeCharacterAliases(oldLabels)
    .map((x) => x.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  if (labels.length === 0) return base
  const pattern = new RegExp(labels.map((x) => escapeRegExp(x)).join('|'), 'g')
  return base.replace(pattern, target)
}

/** 仅依赖 id/name/createdAt 的最小实体形状；角色与势力通用 */
type DisplayNameEntity = { id: string; name?: string | null; createdAt?: string | null }

/**
 * 同名实体自动编号(作者视图用,不进正文)。
 * 同一组(name trim 后相同)内若有 ≥2 个实体,按 createdAt 升序编号「名+序号」(张三1/张三2);
 * 组内仅 1 个则显示名 == 底名。createdAt 相同时用 id 兜底排序,保证稳定。
 * 后缀实时计算、不持久化:删除其一后重新算,剩一个即自动收回后缀。
 */
export function buildDisplayNameMap(entities: DisplayNameEntity[]): Map<string, string> {
  const groups = new Map<string, DisplayNameEntity[]>()
  for (const e of entities) {
    const base = (e.name ?? '').trim()
    if (!base) continue
    const arr = groups.get(base)
    if (arr) arr.push(e)
    else groups.set(base, [e])
  }
  const out = new Map<string, string>()
  for (const [base, arr] of groups) {
    if (arr.length <= 1) {
      if (arr[0]) out.set(arr[0].id, base)
      continue
    }
    const sorted = [...arr].sort((a, b) => {
      const ta = String(a.createdAt ?? '')
      const tb = String(b.createdAt ?? '')
      if (ta !== tb) return ta < tb ? -1 : 1
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    sorted.forEach((e, i) => out.set(e.id, `${base}${i + 1}`))
  }
  return out
}

/** 取单个实体的显示名;传入同 novel 的全体集合(角色或势力)。 */
export function displayNameOf(entity: DisplayNameEntity, all: DisplayNameEntity[]): string {
  const base = (entity.name ?? '').trim()
  if (!base) return base
  return buildDisplayNameMap(all).get(entity.id) ?? base
}

