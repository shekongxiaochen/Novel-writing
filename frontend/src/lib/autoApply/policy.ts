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
export const AUTO_FORESHADOW_MIN_CONF = 0.5

/** 大纲节点自动入库的最低置信度 */
export const AUTO_OUTLINE_MIN_CONF = 0.7

/** 大纲只有这两层自动新建(scene/chapter);volume/act 影响骨架,留确认 */
const AUTO_OUTLINE_LEVELS = new Set(['scene', 'chapter'])

/** possible_duplicate 自动合并的最低置信度 */
export const AUTO_DUPLICATE_MERGE_MIN_CONF = 0.6

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
      return decideEntityWithMerge(matchType, opts?.negligible, opts?.confidence)


    case 'outlineItems':
      // 大纲:全部自动建
      return 'auto-create'

    case 'foreshadows':
      // 伏笔:全部自动建
      return 'auto-create'

    case 'classification':
      // 章节分类只写 annotation,自动 merge(覆盖前已存快照)
      return 'auto-merge'

    case 'memberships':
    case 'relations':
      // 自动落库:端点命中就建,用户可通过冲突面板事后纠正
      return 'auto-create'

    default:
      return 'needs-confirm'
  }
}

/** 角色/势力/物品:有 merge 保护(preferExisting)的实体 */
function decideEntityWithMerge(
  matchType: EntityMatchType | null,
  negligible?: boolean,
  confidence?: number,
): AutoApplyDecision {
  if (matchType === 'new') return 'auto-create'
  if (matchType === 'update') return negligible ? 'skip' : 'auto-merge'
  if (matchType === 'possible_duplicate') return 'auto-merge'
  if (matchType === 'conflict') return 'auto-merge'
  return 'auto-create'
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
