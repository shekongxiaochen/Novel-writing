import { reactive, ref } from 'vue'
import type { CharacterAttribute, OutlineStorylineType } from '../types'

/**
 * 工作台「世界观生成」「大纲设计器」的进行中状态，模块级单例（按 novelId 分桶）。
 *
 * 与 useWorkspaceAiChat / useChapterAiDesk 同一范式：状态脱离组件生命周期，
 * 切到章节页（跨路由组件销毁）再切回来时——
 *   - 世界观流式生成不中断（AbortController 只在用户主动停止时 abort），流式文本继续累积；
 *   - 大纲设计器的一次性生成结果（方案/骨架/草稿）落在单例里，切回后仍停在正确步骤、内容不丢。
 *
 * 注意：DOM 元素 ref（滚动容器）和 setTimeout 句柄属于组件实例，不放进单例，仍由视图局部持有。
 */

export type WorldSettingAiStep = 'input' | 'result'

export type OutlineAiDesignerStep =
  | 'intro'
  | 'expand'
  | 'brief'
  | 'interview'
  | 'options'
  | 'skeleton'
  | 'preview'
export type OutlineAiMode = 'expand' | 'create'
export type OutlineAiExpandPreset = 'auto' | 'next_chapters' | 'split_scenes' | 'subplot'

export type OutlineAiInterviewQuestion = {
  label: string
  prompt: string
  options: string[]
  placeholder: string
}

export type OutlineAiOption = {
  id: string
  title: string
  premise: string
  structure: string
  narrativeShape?: string
  coreQuestion?: string
  forbiddenCliche?: string
  highlights: string[]
  endingTone: string
  beats: string[]
  characterRoster?: Array<{ name: string; role: string; hook: string }>
}

export type OutlineAiFollowupTurn = {
  label: string
  prompt: string
  answer: string
}

export type OutlineAiDraft = {
  title: string
  summary: string
  storylines?: Array<{
    name: string
    type: OutlineStorylineType
    description: string
    colorHint: string
  }>
  characterCast?: Array<{
    name: string
    role: string
    voice: string
    personality: string
    desire: string
    fear: string
    secret: string
    arc: string
  }>
  relationCast?: Array<{
    fromName: string
    toName: string
    relationType: string
    note: string
    dynamic?: string
  }>
  items: Array<{
    tempId: string
    parentTempId: string
    title: string
    summary: string
    level: 'volume' | 'act' | 'chapter' | 'scene'
    goal: string
    conflict: string
    twist: string
    result: string
    suspense: string
    plotStage: 'idea' | 'drafted' | 'written' | 'resolved'
    storylineNames: string[]
    tension: 1 | 2 | 3 | 4 | 5
    location: string
    timeLabel: string
    characterNames?: string[]
    povCharacterName?: string
    emotionalTurn?: string
    proseHint?: string
  }>
  critiqueNotes?: string
}

type WorkspaceGenAbortHolder = {
  worldSetting: AbortController | null
  outlineDesigner: AbortController | null
}

function createStore(novelId: string) {
  return {
    novelId,
    // ── 世界观生成 ──
    worldSettingAiOpen: ref(false),
    worldSettingAiStep: ref<WorldSettingAiStep>('input'),
    worldSettingAiLoading: ref(false),
    worldSettingAiError: ref(''),
    worldSettingAiTargetId: ref(''),
    worldSettingAiBrief: ref(''),
    worldSettingAiUseNovelInfo: ref(true),
    worldSettingAiFeedback: ref(''),
    worldSettingAiStreaming: ref(''),
    worldSettingAiVersion: ref(0),
    worldSettingAiDraftName: ref(''),
    worldSettingAiDraftContent: ref(''),
    worldSettingAiDraftCards: ref<CharacterAttribute[]>([]),
    worldSettingAiDraftCategoryIds: ref<string[]>([]),
    // ── 大纲设计器 ──
    outlineAiDesignerOpen: ref(false),
    outlineAiMode: ref<OutlineAiMode>('create'),
    outlineAiDesignerStep: ref<OutlineAiDesignerStep>('interview'),
    outlineAiDraftIsSkeletonOnly: ref(false),
    outlineAiAppendMode: ref(false),
    outlineAiLintDismissed: ref(false),
    outlineAiExpandAnchorId: ref(''),
    outlineAiExpandNote: ref(''),
    outlineAiExpandPreset: ref<OutlineAiExpandPreset>('auto'),
    outlineAiDesignerLoading: ref(false),
    outlineAiDesignerStreaming: ref(''),
    outlineAiDesignerWriting: ref(false),
    outlineAiDesignerError: ref(''),
    outlineAiDesignerRationale: ref(''),
    outlineAiDesignerBrief: ref(''),
    outlineAiDesignerOptions: ref<OutlineAiOption[]>([]),
    outlineAiDesignerSelectedOptionId: ref(''),
    outlineAiDesignerDraft: ref<OutlineAiDraft | null>(null),
    outlineAiWriteToast: ref(''),
    outlineAiInterviewHistory: ref<OutlineAiFollowupTurn[]>([]),
    outlineAiCurrentQuestion: ref<OutlineAiInterviewQuestion | null>(null),
    outlineAiBrief: ref(''),
    outlineAiUseNovelInfo: ref(true),
    outlineAiGuideConflict: ref(''),
    outlineAiGuideProtagonist: ref(''),
    outlineAiGuideEnding: ref(''),
    outlineAiCurrentAnswer: ref(''),
    outlineAiCurrentCustom: ref(''),
    outlineAiOptionNotes: ref<Record<string, string>>({}),
    outlineAiOptionRevisionHistory: ref<
      Array<{ selectedOptionId: string; selectedTitle: string; note: string }>
    >([]),
    outlineAiCoveredDimensions: ref<string[]>([]),
    outlineAiLoadingById: reactive<Record<string, boolean>>({}),
    // 进行中的 AbortController（目前仅世界观流式可被主动停止）
    aborts: { worldSetting: null, outlineDesigner: null } as WorkspaceGenAbortHolder,
  }
}

type WorkspaceGenStore = ReturnType<typeof createStore>

const stores = new Map<string, WorkspaceGenStore>()

export function useWorkspaceGenAi(novelId: string): WorkspaceGenStore {
  let store = stores.get(novelId)
  if (!store) {
    store = createStore(novelId)
    stores.set(novelId, store)
  }
  return store
}
