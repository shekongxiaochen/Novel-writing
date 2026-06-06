import type {
  AutoApplyDecision,
  AutoApplyModule,
  EntityMatchType,
  ExtractedOutlineItem,
  ForeshadowCandidate,
} from '../../types'

/**
 * 自动入库分级策略(保守版,纯函数无副作用)。
 *
 * 设计见计划文件:只有"全新实体"和"非无意义的字段补全"才自动入库;
 * 疑似重复 / 冲突 / 改已有设定的高风险更新一律留用户确认(needs-confirm)。
 * possible_duplicate / conflict 永不自动,是去重翻车的高发区。
 */

/** 伏笔自动入库的最低置信度;低于此值留用户确认 */
export const AUTO_FORESHADOW_MIN_CONF = 0.75

/** 大纲节点自动入库的最低置信度 */
export const AUTO_OUTLINE_MIN_CONF = 0.7

/** 大纲只有这两层自动新建(scene/chapter);volume/act 影响骨架,留确认 */
const AUTO_OUTLINE_LEVELS = new Set(['scene', 'chapter'])

/**
 * 判定某条提案在当前策略下应如何处理。
 * @param negligible 仅 update 档有意义:该更新是否被判为"无实质变化"(由调用方用现有 isNegligibleXUpdate 算好传入)
 */
export function decideAutoAction(
  module: AutoApplyModule,
  matchType: EntityMatchType | null,
  opts?: { negligible?: boolean; confidence?: number; level?: string; relationSafe?: boolean },
): AutoApplyDecision {
  switch (module) {
    case 'characters':
    case 'factions':
    case 'items':
      return decideEntityWithMerge(matchType, opts?.negligible)

    case 'outlineItems':
      // 大纲无 merge,只新建;仅 scene/chapter 且置信度达标自动建
      if ((opts?.confidence ?? 0) < AUTO_OUTLINE_MIN_CONF) return 'needs-confirm'
      if (!opts?.level || !AUTO_OUTLINE_LEVELS.has(String(opts.level).toLowerCase())) {
        return 'needs-confirm'
      }
      return 'auto-create'

    case 'foreshadows':
      // 伏笔无 match,按置信度阈值
      return (opts?.confidence ?? 0) >= AUTO_FORESHADOW_MIN_CONF ? 'auto-create' : 'needs-confirm'

    case 'classification':
      // 章节分类只写 annotation,自动 merge(覆盖前已存快照)
      return 'auto-merge'

    case 'memberships':
    case 'relations':
      // 仅当端点角色/势力都唯一精确命中(relationSafe=true)时才自动新建;
      // 反向新建、缺命中等高风险情况由调用方判定为 false → 留用户确认
      return opts?.relationSafe ? 'auto-create' : 'needs-confirm'

    default:
      return 'needs-confirm'
  }
}

/** 角色/势力/物品:有 merge 保护(preferExisting)的实体 */
function decideEntityWithMerge(
  matchType: EntityMatchType | null,
  negligible?: boolean,
): AutoApplyDecision {
  if (matchType === 'new') return 'auto-create'
  if (matchType === 'update') return negligible ? 'skip' : 'auto-merge'
  // possible_duplicate / conflict / 未知 → 留用户确认
  return 'needs-confirm'
}

/** 给定提案是否应被自动处理(auto-create 或 auto-merge) */
export function isAutoDecision(decision: AutoApplyDecision): boolean {
  return decision === 'auto-create' || decision === 'auto-merge'
}

/** 类型守卫辅助:从大纲提案取 policy 需要的输入 */
export function outlinePolicyOpts(item: ExtractedOutlineItem): {
  confidence: number
  level: string
} {
  return { confidence: item.confidence ?? 0, level: item.level ?? '' }
}

/** 从伏笔候选取 policy 需要的输入 */
export function foreshadowPolicyOpts(item: ForeshadowCandidate): { confidence: number } {
  return { confidence: item.confidence ?? 0 }
}
