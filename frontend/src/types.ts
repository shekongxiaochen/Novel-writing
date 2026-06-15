export type SceneSummary = {
  sceneIndex: number
  title: string
  summary: string
}

export type ArcSummary = {
  arcId: string
  level: 'volume' | 'act'
  title: string
  summary: string
  chapterRange: [number, number]
}

export type Novel = {
  id: string
  title: string
  summary: string
  /** 全书连续性摘要（长篇续写用，作者可一键生成后保存） */
  continuityBrief: string
  /** 篇章弧线摘要（卷/幕级别，长篇小说用） */
  arcSummaries: ArcSummary[]
  genre: string
  perspective: string
  tone: string
  isMultiLineNarrative: boolean
  /** AI 写作自定义风格提示词（持久注入续写/大纲 AI 的系统提示词） */
  aiStylePrompt: string
  /** 漫剧：统一视觉画风，所有角色/物品/场景形象生成时自动注入 */
  visualStyle?: string
  createdAt: string
  updatedAt: string
}

/** 预设画风列表，每项提供中文标签与注入生成 prompt 的英文描述 */
/** 分镜头 */
export type Shot = {
  id: string
  order: number
  /** 本镜头在哪个场景（已有素材） */
  sceneId?: string
  sceneViewId?: string
  /** 场景文字描述（无对应素材时，AI 自由描述） */
  sceneDescription?: string
  /** 出场角色 */
  characterIds?: string[]
  /** 每个出场角色用哪个视图（正/侧/背…） */
  assetViewIds?: string[]
  /** 出场物品 */
  itemIds?: string[]
  /** 景别 */
  shotType?: 'closeup' | 'medium' | 'wide' | 'establishing'
  /** 动作描述 */
  action?: string
  /** 台词/旁白 */
  dialogue?: string
  /** 情绪 */
  emotion?: string
  /** 后续生成的关键帧图 URL（P4） */
  keyframeUrl?: string
  /** 后续生成的视频片段 URL（P5） */
  clipUrl?: string
  /** 作画监督质检状态 */
  qcStatus?: 'pending' | 'pass' | 'retry' | 'failed'
  qcReason?: string
  retryCount?: number
}

/** 分镜表 */
export type Storyboard = {
  id: string
  novelId: string
  chapterId: string
  chapterTitle?: string
  chapterNo?: number
  shots: Shot[]
  createdAt: string
  updatedAt: string
}

export const VISUAL_STYLE_PRESETS = [
  { id: 'anime', label: '日系动漫', en: 'anime art style, cel-shaded, vibrant, clean lines, Japanese animation aesthetic' },
  { id: 'realistic', label: '写实电影感', en: 'cinematic realism, photorealistic lighting, film-like, detailed textures, epic scale' },
  { id: 'ink', label: '水墨古风', en: 'traditional Chinese ink wash painting style, soft brushstrokes, misty atmosphere, ethereal, monochrome with subtle color accents' },
  { id: 'cyberpunk', label: '赛博朋克', en: 'cyberpunk aesthetic, neon lights, rain-soaked, high-tech low-life, gritty, Blade Runner style' },
  { id: 'oil', label: '厚涂油画', en: 'digital oil painting, thick brushstrokes, rich textures, dramatic lighting, baroque composition' },
  { id: 'lineart', label: '线稿插画', en: 'clean lineart illustration, minimal shading, sketch-like, manga page style, black and white with tone' },
  { id: 'watercolor', label: '水彩', en: 'watercolor illustration, soft washes, translucent layers, dreamy, light pastel palette, poetic atmosphere' },
] as const

export type VisualStyleId = typeof VISUAL_STYLE_PRESETS[number]['id'] | ''

export type NewNovelInput = {
  title: string
  summary: string
  genre: string
  perspective: string
  tone: string
  isMultiLineNarrative: boolean
}

export type ChapterStatus = 'draft' | 'done'

export type Chapter = {
  id: string
  novelId: string
  chapterNo: number
  title: string
  notes: string
  annotation: string
  content: string
  outlineItemIds: string[]
  status: ChapterStatus
  /** 场景级摘要（章节内分场景拆分） */
  sceneSummaries: SceneSummary[]
  createdAt: string
  updatedAt: string
}

export type NewChapterInput = {
  novelId: string
  title: string
  notes: string
  annotation: string
}

export type CharacterAttribute = {
  id: string
  key: string
  value: string
}

export type CharacterRelation = {
  id: string
  novelId: string
  fromCharacterId: string
  toCharacterId: string
  relationType: string
  note?: string
  createdAt: string
  updatedAt: string
}

export type NewCharacterRelationInput = {
  novelId: string
  fromCharacterId: string
  toCharacterId: string
  relationType: string
  note?: string
}

export type OutlineStatus = 'todo' | 'doing' | 'done'
export type OutlineNodeLevel = 'volume' | 'act' | 'chapter' | 'scene'
export type OutlinePlotStage = 'idea' | 'drafted' | 'written' | 'resolved'
export type OutlineStorylineType = 'main' | 'subplot' | 'character' | 'romance' | 'antagonist' | 'world' | 'custom'
export type OutlineTension = 1 | 2 | 3 | 4 | 5

export type OutlineStoryline = {
  id: string
  novelId: string
  name: string
  type: OutlineStorylineType
  color: string
  description: string
  order: number
  createdAt: string
  updatedAt: string
}

export type NewOutlineStorylineInput = {
  novelId: string
  name: string
  type?: OutlineStorylineType
  color?: string
  description?: string
}

export type OutlineItem = {
  id: string
  novelId: string
  order: number
  title: string
  summary: string
  status: OutlineStatus
  level?: OutlineNodeLevel
  goal?: string
  conflict?: string
  twist?: string
  result?: string
  suspense?: string
  plotStage?: OutlinePlotStage
  storylineIds?: string[]
  parentId?: string | null
  location?: string
  timeLabel?: string
  povCharacterId?: string | null
  tension?: OutlineTension
  characterIds?: string[]
  factionIds?: string[]
  foreshadowIds?: string[]
  issueIds?: string[]
  /** 本场情绪转折（写作节拍，可选） */
  emotionalTurn?: string
  /** 语气/意象/禁忌等写作提示（可选） */
  proseHint?: string
  /** 写后实际场景内容摘要（场景写完后从正文回填，与 summary=写前细纲 区分） */
  proseSummary?: string
  createdAt: string
  updatedAt: string
}

export type NewOutlineInput = {
  novelId: string
  title: string
  summary: string
  level?: OutlineNodeLevel
  goal?: string
  conflict?: string
  twist?: string
  result?: string
  suspense?: string
  plotStage?: OutlinePlotStage
  storylineIds?: string[]
  parentId?: string | null
  afterId?: string | null
  location?: string
  timeLabel?: string
  povCharacterId?: string | null
  tension?: OutlineTension
  characterIds?: string[]
  factionIds?: string[]
  foreshadowIds?: string[]
  issueIds?: string[]
  emotionalTurn?: string
  proseHint?: string
  proseSummary?: string
}

/** 角色与势力的从属关系（多对多）；描述为该角色在此势力中的身份/立场等 */
export type CharacterFactionMembership = {
  id: string
  novelId: string
  characterId: string
  factionId: string
  description: string
  createdAt: string
  updatedAt: string
}

export type Category = {
  id: string
  novelId: string
  name: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type Character = {
  id: string
  novelId: string
  name: string
  /** 若由写作页右键在某章内创建，则记录来源章节 id */
  createdInChapterId?: string | null
  // 角色首次出场章节（按 chapterNo 记录；null/undefined 表示未设置）
  firstAppearanceChapterNo?: number | null
  age: string
  gender: string
  goal: string
  secret: string
  arc: string
  notes: string
  // 知识图谱式的可扩展属性（MVP：额外属性）
  attributes?: CharacterAttribute[]
  /** 可选别名（多个）；正文中与主名同等参与高亮与识别 */
  aliases?: string[]
  /** 角色分类（引用 Category.id） */
  categoryIds?: string[]
  /** 漫剧：多视图形象（正面/侧面/背面/表情…），每视图带描述 */
  views?: AssetView[]
  /** 漫剧：画风/外貌补充提示词 */
  stylePrompt?: string
  /** AI 自动整理生成,用户确认/编辑后清除 */
  autoGenerated?: boolean
  createdAt: string
  updatedAt: string
}

export type NewCharacterInput = {
  novelId: string
  name: string
  createdInChapterId?: string | null
  firstAppearanceChapterNo?: number | null
  age: string
  gender: string
  goal: string
  secret: string
  arc: string
  notes: string
  /** 自定义字段（字段名 / 字段说明）；新建时可选 */
  attributes?: CharacterAttribute[]
  /** 可选别名（多个） */
  aliases?: string[]
  /** 角色分类（引用 Category.id） */
  categoryIds?: string[]
}

export type Faction = {
  id: string
  novelId: string
  name: string
  /** 若由写作页右键在某章内创建，则记录来源章节 id */
  createdInChapterId?: string | null
  leader: string
  notes: string
  /** 势力自定义字段（名称 + 内容） */
  attributes?: CharacterAttribute[]
  /** 势力分类（引用 Category.id） */
  categoryIds?: string[]
  /** AI 自动整理生成,用户确认/编辑后清除 */
  autoGenerated?: boolean
  createdAt: string
  updatedAt: string
}

export type NewFactionInput = {
  novelId: string
  name: string
  createdInChapterId?: string | null
  leader: string
  notes: string
  attributes?: CharacterAttribute[]
  /** 势力分类（引用 Category.id） */
  categoryIds?: string[]
}

export type WorldSetting = {
  id: string
  novelId: string
  name: string
  content: string
  /** 结构化卡片（标题+内容），如 力量体系/地理/历史。新版主用此字段 */
  attributes?: CharacterAttribute[]
  /** 设定分类（引用 Category.id） */
  categoryIds?: string[]
  createdAt: string
  updatedAt: string
}

export type NewWorldSettingInput = {
  novelId: string
  name: string
  content: string
  attributes?: CharacterAttribute[]
  categoryIds?: string[]
}

export type ItemOwnerType = 'character' | 'faction'

export type Item = {
  id: string
  novelId: string
  name: string
  summary: string
  ownerType?: ItemOwnerType | null
  ownerId?: string | null
  firstAppearanceChapterNo?: number | null
  attributes?: CharacterAttribute[]
  /** 漫剧：形象视图（通常只需一张主视图） */
  views?: AssetView[]
  /** 漫剧：画风/外貌补充提示词 */
  stylePrompt?: string
  /** AI 自动整理生成,用户确认/编辑后清除 */
  autoGenerated?: boolean
  createdAt: string
  updatedAt: string
}

export type NewItemInput = {
  novelId: string
  name: string
  summary: string
  ownerType?: ItemOwnerType | null
  ownerId?: string | null
  attributes?: CharacterAttribute[]
}

/**
 * 素材视图（角色/物品/场景共用）：一张形象图 + 描述。
 * 漫剧用：每个素材一套多视图，分镜按镜头指定用哪个视图。
 * P1 阶段 views 可为空（仅文字描述），后续接 AI 生图再填充。
 */
export type AssetView = {
  id: string
  /** 角度/类型：front/side/back/detail/establishing/expression 等，自由字符串 */
  kind: string
  /** 形象图 URL（AI 生成或上传）；P1 阶段可为空 */
  imageUrl?: string
  /** 这是谁/什么物/什么地、角度、特征，供分镜与视频对应 */
  description: string
  /** 生成此视图所用的提示词（便于重生成/微调） */
  prompt?: string
  /** 角色表情视图用 */
  emotion?: string
}

/** 场景档案：漫剧素材层的一等公民，与角色/物品平级 */
export type Scene = {
  id: string
  novelId: string
  name: string
  /** 场景文字描述（环境、时代、氛围等） */
  description: string
  /** 多视图形象（全景/门口/内院…）；P1 阶段可为空 */
  views?: AssetView[]
  /** 画风/外貌补充提示词 */
  stylePrompt?: string
  /** 形象是否已定妆锁定 */
  locked?: boolean
  /** AI 自动整理生成,用户确认/编辑后清除 */
  autoGenerated?: boolean
  createdAt: string
  updatedAt: string
}

export type NewSceneInput = {
  novelId: string
  name: string
  description: string
  stylePrompt?: string
}

/** 单条"填坑"记录 — 对应某处正文解决了该伏笔 */
export type ForeshadowFulfillment = {
  id: string
  /** 正文中"填坑"的引用文本（来自选区或手动输入） */
  fulfillText: string
  fulfillChapterId: string
  fulfillChapterNo: number
  fulfillChapterTitle: string
  /** 填坑选区在章节正文中的偏移（用于叠加层标记）；旧数据或工作台手填可无 */
  fulfillStart?: number
  fulfillEnd?: number
  /** 说明此处如何解决了该伏笔 */
  notes: string
  createdAt: string
}

/** 伏笔植入记录 */
export type ForeshadowPlant = {
  id: string
  novelId: string
  /** 简短标签（通常截取自 plantText，用户可改） */
  title: string
  /** 正文中植入伏笔的引用文本（来自选区） */
  plantText: string
  plantChapterId: string
  plantChapterNo: number
  plantChapterTitle: string
  /** 正文选区范围（用于下划线标记）；兼容旧数据可缺省 */
  plantStart?: number
  plantEnd?: number
  /** 详细描述：这个伏笔想说明什么、需要怎样收尾 */
  description: string
  /** 预计填坑位置（可选） */
  expectedFulfillChapterNo?: number | null
  expectedFulfillNotes?: string
  status: 'open' | 'fulfilled'
  fulfillments: ForeshadowFulfillment[]
  /** AI 自动整理生成,用户确认/编辑后清除 */
  autoGenerated?: boolean
  createdAt: string
  updatedAt: string
}

export type NewForeshadowPlantInput = {
  novelId: string
  title: string
  plantText: string
  plantChapterId: string
  plantChapterNo: number
  plantChapterTitle: string
  plantStart?: number
  plantEnd?: number
  description: string
  expectedFulfillChapterNo?: number | null
  expectedFulfillNotes?: string
}

export type NewForeshadowFulfillmentInput = {
  fulfillText: string
  fulfillChapterId: string
  fulfillChapterNo: number
  fulfillChapterTitle: string
  fulfillStart?: number
  fulfillEnd?: number
  notes: string
}

/** 故事时间线节点：按 order 自上而下展示，可标注故事内时间与关联章节/大纲 */
export type TimelineEvent = {
  id: string
  novelId: string
  order: number
  /** 故事内时间标签（如「三年前」「卷一末」） */
  storyLabel: string
  title: string
  summary: string
  /** 关联章节范围（可只填开始，不填结束） */
  chapterNoStart: number | null
  chapterNoEnd: number | null
  /** 兼容旧数据：早期单章关联字段 */
  chapterNo?: number | null
  outlineItemId: string | null
  /** AI 自动整理生成,用户确认/编辑后清除 */
  autoGenerated?: boolean
  createdAt: string
  updatedAt: string
}

export type NewTimelineEventInput = {
  novelId: string
  storyLabel: string
  title: string
  summary: string
  chapterNoStart?: number | null
  chapterNoEnd?: number | null
  /** 兼容旧调用：早期单章关联字段 */
  chapterNo?: number | null
  outlineItemId?: string | null
}

export type AiAnalysisKind = 'entities' | 'foreshadows' | 'classification'
export type AiExtractMode = 'current' | 'recent' | 'all'
export type AiDeskMode = 'ask' | 'write'
export type AiContinuePosition = 'cursor' | 'end' | 'replace'
export type AiContinueTargetChars = 800 | 1500 | 3000
export type AiContinuePrevSummaryCount = 2 | 3 | 5

export type ContinueRagSnippetHit = {
  chapterId: string
  chapterNo: number
  chapterTitle: string
  excerpt: string
  matchedTerms: string[]
  source: 'character' | 'foreshadow' | 'location'
}

export type AiChapterSummaryDraft = {
  chapterId: string
  text: string
  loading: boolean
  status: 'idle' | 'ready' | 'applied' | 'ignored'
}

export type AiContinueDraft = {
  text: string
  loading: boolean
  status: 'idle' | 'ready' | 'applied' | 'ignored'
  position: AiContinuePosition
  targetChars: AiContinueTargetChars
  prevSummaryCount: AiContinuePrevSummaryCount
  afterAdoptSummary: boolean
  afterAdoptExtract: boolean
  enableRag: boolean
  /** 生成时记录的光标插入点（光标续写） */
  insertOffset: number | null
  warnings: string[]
  droppedLayers: string[]
  usedLayers: string[]
  usedChars: number
  ragHits: ContinueRagSnippetHit[]
}

export type AiAskContextMeta = {
  warnings: string[]
  droppedLayers: string[]
  usedLayers: string[]
  usedChars: number
  ragHits: ContinueRagSnippetHit[]
}

export type ContinueChapterResult = {
  text: string
  warnings: string[]
  droppedLayers: string[]
  usedLayers: string[]
  usedChars: number
  ragHits: ContinueRagSnippetHit[]
}

export type AiChatRole = 'user' | 'assistant'

export type AiDeskChatMessage = {
  id: string
  role: AiChatRole
  content: string
  mode: AiExtractMode
  createdAt: string
}

export type AiToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
}

export type AiToolCall = {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export type AiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: AiToolCall[]
  tool_call_id?: string
  name?: string
  reasoning_content?: string
}

export type AiToolResult = {
  success: boolean
  message: string
  data?: Record<string, any>
}

export type AiPendingToolAction = {
  id: string
  toolCall: AiToolCall
  label: string
  previewText?: string
  status: 'pending' | 'applied' | 'ignored'
}

export type AiToolExecutionContext = {
  defaultChapterId?: string
  selectionRange?: { chapterId: string; start: number; end: number }
  focusEntity?: { kind: string; id: string; label: string }
}

export type EntityMatchType = 'new' | 'update' | 'possible_duplicate' | 'conflict'

export type EntityEvidence = {
  chapterId: string
  chapterNo?: number | null
  quote: string
}

export type EntityMatch = {
  type: EntityMatchType
  targetId?: string | null
  targetName?: string | null
}

export type AiSuggestionUiState = {
  status: 'pending' | 'applied' | 'ignored'
  action?: 'create' | 'merge' | 'ignore' | null
  editorEntityType?: 'character' | 'faction' | 'item' | null
  editorTargetId?: string | null
  /** true=AI 自动入库(非用户手动点采用),供面板显示"已自动录入"徽标与撤销入口 */
  auto?: boolean
}

/** 自动入库涉及的数据模块 */
export type AutoApplyModule =
  | 'characters'
  | 'factions'
  | 'items'
  | 'memberships'
  | 'relations'
  | 'outlineItems'
  | 'foreshadows'
  | 'classification'

/** 自动入库的操作类型 */
export type AutoApplyAction = 'create' | 'merge'

/** decideAutoAction 的判定结果 */
export type AutoApplyDecision = 'auto-create' | 'auto-merge' | 'needs-confirm' | 'skip'

/** 一条可撤销的自动入库操作日志 */
export type AutoApplyLogEntry = {
  id: string
  novelId: string
  /** 触发本次入库的来源章节 */
  chapterId: string
  chapterNo: number | null
  module: AutoApplyModule
  action: AutoApplyAction
  /** create=新建实体 id;merge=被更新的已有实体 id */
  entityId: string
  /** 展示用标签(角色名/势力名/大纲标题等) */
  entityLabel: string
  /** 抽取阶段的匹配类型,留痕用 */
  matchType: EntityMatchType
  /** merge 前被更新实体的深拷贝快照(create 为 null),撤销时整体还原 */
  beforeSnapshot: unknown | null
  /** 入库后内容摘要(展示用) */
  afterSummary?: string
  /** 本次实际改动的字段名(merge 时供面板显示 diff) */
  changedFields?: string[]
  createdAt: string
  /** 是否已被撤销(标记不物删,保留审计) */
  undone: boolean
  undoneAt?: string | null
}

/** 整理时该条角色身份的确信度 */
export type ExtractedIdentityStatus = 'certain' | 'uncertain' | 'possible_same_person'

export type ExtractedCharacter = {
  name: string
  aliases: string[]
  gender: string
  age: string
  goal: string
  secret: string
  arc: string
  notes: string
  attributes: CharacterAttribute[]
  /** certain=明确独立人物；uncertain=身份未明；possible_same_person=疑似与档案中某人为同一人 */
  identityStatus: ExtractedIdentityStatus
  firstAppearanceChapterNo?: number | null
  confidence: number
  match: EntityMatch
  evidences: EntityEvidence[]
  warnings: string[]
  uiState?: AiSuggestionUiState
}

export type ExtractedFaction = {
  name: string
  leader: string
  notes: string
  attributes: CharacterAttribute[]
  categoryNames: string[]
  confidence: number
  match: EntityMatch
  evidences: EntityEvidence[]
  warnings: string[]
  uiState?: AiSuggestionUiState
}

export type ExtractedItem = {
  name: string
  summary: string
  ownerType?: string | null
  ownerId?: string | null
  ownerName: string
  firstAppearanceChapterNo?: number | null
  confidence: number
  match: EntityMatch
  evidences: EntityEvidence[]
  warnings: string[]
  uiState?: AiSuggestionUiState
}

export type ExtractedMembership = {
  characterName: string
  factionName: string
  description: string
  confidence: number
  match: EntityMatch
  evidences: EntityEvidence[]
  warnings: string[]
  uiState?: AiSuggestionUiState
}

export type ExtractedRelation = {
  fromCharacterName: string
  toCharacterName: string
  relationType: string
  note: string
  confidence: number
  match: EntityMatch
  evidences: EntityEvidence[]
  warnings: string[]
  uiState?: AiSuggestionUiState
}

export type ExtractedOutlineItem = {
  title: string
  summary: string
  level: string
  estimatedChapters?: number | null
  confidence: number
  match: EntityMatch
  evidences: EntityEvidence[]
  warnings: string[]
  uiState?: AiSuggestionUiState
}

export type NovelEntityExtractResult = {
  characters: ExtractedCharacter[]
  factions: ExtractedFaction[]
  items: ExtractedItem[]
  memberships: ExtractedMembership[]
  relations: ExtractedRelation[]
  outlineItems: ExtractedOutlineItem[]
  warnings: string[]
}

export type ForeshadowCandidate = {
  title: string
  summary: string
  payoffHint: string
  confidence: number
  evidences: EntityEvidence[]
  warnings: string[]
  uiState?: AiSuggestionUiState
}

export type ForeshadowFulfillmentFinding = {
  title: string
  summary: string
  relatedPlantTitle: string
  status: 'existing' | 'implicit'
  confidence: number
  evidences: EntityEvidence[]
  warnings: string[]
}

export type ForeshadowDanglingFinding = {
  title: string
  summary: string
  lastMentionChapterNo?: number | null
  suggestedPayoff: string
  confidence: number
  evidences: EntityEvidence[]
  warnings: string[]
}

export type NovelForeshadowAnalysisResult = {
  newPlants: ForeshadowCandidate[]
  fulfillments: ForeshadowFulfillmentFinding[]
  danglingThreads: ForeshadowDanglingFinding[]
  warnings: string[]
}

export type OutlineRevisionSuggestion = {
  id: string
  reason: string
  title?: string
  summary?: string
  goal?: string
  conflict?: string
  twist?: string
  result?: string
  suspense?: string
  tension?: number
  uiState?: AiSuggestionUiState
}

export type OutlineAdditionSuggestion = {
  tempId: string
  afterOutlineId?: string
  parentOutlineId?: string
  title: string
  summary: string
  level: OutlineNodeLevel
  goal?: string
  conflict?: string
  twist?: string
  result?: string
  suspense?: string
  tension?: number
  uiState?: AiSuggestionUiState
}

export type OutlineRewriteResult = {
  revisions: OutlineRevisionSuggestion[]
  additions: OutlineAdditionSuggestion[]
  warnings: string[]
}

export type NovelChapterClassificationResult = {
  chapterType: string
  pacing: string
  tensionLevel: number
  storyFunctions: string[]
  informationGain: string[]
  activeForeshadows: string[]
  tags: string[]
  mainConflict: string
  summary: string
  rationale: string
  warnings: string[]
  uiState?: AiSuggestionUiState
}
