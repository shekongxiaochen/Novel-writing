import type { OutlineNodeLevel } from '../types'

/** 大纲层级深度排名：卷 < 幕 < 章 < 场景。数字越小越靠上层。 */
export const OUTLINE_LEVEL_RANK: Record<OutlineNodeLevel, number> = {
  volume: 0,
  act: 1,
  chapter: 2,
  scene: 3,
}

/** 从上到下的层级顺序。 */
export const OUTLINE_LEVEL_ORDER: OutlineNodeLevel[] = ['volume', 'act', 'chapter', 'scene']

/** 顶部筛选可选的层级档（无「场景」档：场景是细纲，靠展开查看）。 */
export const OUTLINE_FILTER_LEVELS: OutlineNodeLevel[] = ['volume', 'act', 'chapter']

const LEVEL_TEXT: Record<OutlineNodeLevel, string> = {
  volume: '卷',
  act: '幕',
  chapter: '章',
  scene: '场景',
}

/** 层级中文名。无效/缺省回落到「场景」。 */
export function levelText(level?: OutlineNodeLevel | null): string {
  if (level && level in LEVEL_TEXT) return LEVEL_TEXT[level]
  return '场景'
}

/** 层级深度排名，缺省按场景（最深）处理。 */
export function levelRank(level?: OutlineNodeLevel | null): number {
  if (level && level in OUTLINE_LEVEL_RANK) return OUTLINE_LEVEL_RANK[level]
  return OUTLINE_LEVEL_RANK.scene
}

/**
 * 给定父节点的 level，推导子节点应当的 level。
 * 严格四级、幕必填、不跳级：null→卷→幕→章→场景。
 * 父已是 scene（无子层）时回落仍返回 scene（调用方应另行禁止给场景加子）。
 */
export function childLevelOf(parentLevel?: OutlineNodeLevel | null): OutlineNodeLevel {
  switch (parentLevel ?? null) {
    case null:
    case undefined:
      return 'volume'
    case 'volume':
      return 'act'
    case 'act':
      return 'chapter'
    case 'chapter':
      return 'scene'
    case 'scene':
      return 'scene'
    default:
      return 'volume'
  }
}

/**
 * 校验「子 level 挂在父 level 下」是否合法（严格相邻一级）。
 * 顶层节点（parentLevel = null）只能是 volume。
 */
export function isValidParentLevel(
  childLevel: OutlineNodeLevel,
  parentLevel?: OutlineNodeLevel | null,
): boolean {
  // 场景是末级，不能作为任何节点的父
  if (parentLevel === 'scene') return false
  return childLevelOf(parentLevel ?? null) === childLevel
}

/** 该 level 能否拥有子节点（场景为最末级，不能）。 */
export function canHaveChildren(level?: OutlineNodeLevel | null): boolean {
  return levelRank(level) < OUTLINE_LEVEL_RANK.scene
}
