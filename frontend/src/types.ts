export type Novel = {
  id: string
  title: string
  summary: string
  genre: string
  perspective: string
  tone: string
  isMultiLineNarrative: boolean
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
  content: string
  outlineItemIds: string[]
  status: ChapterStatus
  createdAt: string
  updatedAt: string
}

export type NewChapterInput = {
  novelId: string
  title: string
  notes: string
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

export type OutlineItem = {
  id: string
  novelId: string
  order: number
  title: string
  summary: string
  status: OutlineStatus
  createdAt: string
  updatedAt: string
}

export type NewOutlineInput = {
  novelId: string
  title: string
  summary: string
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
  /** 角色分类（引用 Category.id） */
  categoryIds?: string[]
  createdAt: string
  updatedAt: string
}

export type NewCharacterInput = {
  novelId: string
  name: string
  firstAppearanceChapterNo?: number | null
  age: string
  gender: string
  goal: string
  secret: string
  arc: string
  notes: string
  /** 自定义字段（字段名 / 字段说明）；新建时可选 */
  attributes?: CharacterAttribute[]
  /** 角色分类（引用 Category.id） */
  categoryIds?: string[]
}

export type Faction = {
  id: string
  novelId: string
  name: string
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
  leader: string
  notes: string
  attributes?: CharacterAttribute[]
  /** 势力分类（引用 Category.id） */
  categoryIds?: string[]
}

export type IssueType =
  | 'foreshadow'
  | 'logic'
  | 'timeline'
  | 'motivation'
  | 'other'

export type IssueStatus = 'open' | 'in_progress' | 'resolved'

export type StoryIssue = {
  id: string
  novelId: string
  title: string
  type: IssueType
  status: IssueStatus
  plan: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type NewStoryIssueInput = {
  novelId: string
  title: string
  type: IssueType
  plan: string
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

