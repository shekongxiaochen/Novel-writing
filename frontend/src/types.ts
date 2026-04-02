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

export type Character = {
  id: string
  novelId: string
  name: string
  // 角色首次出场章节（按 chapterNo 记录；null/undefined 表示未设置）
  firstAppearanceChapterNo?: number | null
  /** 绑定势力（仅可选择已存在势力）；空表示未绑定 */
  factionId?: string | null
  age: string
  gender: string
  goal: string
  secret: string
  arc: string
  notes: string
  // 知识图谱式的可扩展属性（MVP：额外属性）
  attributes?: CharacterAttribute[]
  createdAt: string
  updatedAt: string
}

export type NewCharacterInput = {
  novelId: string
  name: string
  firstAppearanceChapterNo?: number | null
  factionId?: string | null
  age: string
  gender: string
  goal: string
  secret: string
  arc: string
  notes: string
  /** 自定义字段（字段名 / 字段说明）；新建时可选 */
  attributes?: CharacterAttribute[]
}

export type Faction = {
  id: string
  novelId: string
  name: string
  leader: string
  goal: string
  resource: string
  relationToProtagonist: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type NewFactionInput = {
  novelId: string
  name: string
  leader: string
  goal: string
  resource: string
  relationToProtagonist: string
  notes: string
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

