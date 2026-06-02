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
  createdAt: string
  updatedAt: string
}

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
  /** 设定分类（引用 Category.id） */
  categoryIds?: string[]
  createdAt: string
  updatedAt: string
}

export type NewWorldSettingInput = {
  novelId: string
  name: string
  content: string
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
export type AiContinuePosition = 'cursor' | 'end'
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
}

/** AI 整理时对该条角色身份的确信度 */
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

export type NovelEntityExtractResult = {
  characters: ExtractedCharacter[]
  factions: ExtractedFaction[]
  items: ExtractedItem[]
  memberships: ExtractedMembership[]
  relations: ExtractedRelation[]
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
