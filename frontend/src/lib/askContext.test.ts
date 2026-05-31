import { describe, expect, it } from 'vitest'
import { buildAskFollowUpPrompt, buildAskUserPrompt, trimAskConversationHistory } from './askContext'
import type { Chapter } from '../types'
import type { WorkspaceSnapshotPayload } from './storage'

function chapter(no: number, content: string, annotation = ''): Chapter {
  return {
    id: `ch-${no}`,
    novelId: 'n1',
    chapterNo: no,
    title: `第${no}章`,
    notes: '',
    annotation,
    content,
    outlineItemIds: [],
    sceneSummaries: [],
    status: 'draft',
    createdAt: '',
    updatedAt: '',
  }
}

function payload(chapters: Chapter[]): WorkspaceSnapshotPayload {
  return {
    chapters,
    characters: [
      { id: 'c1', name: '陈平安', aliases: [], gender: '', age: '', goal: '', secret: '', arc: '', notes: '', attributes: [], firstAppearanceChapterNo: 1, categoryIds: [] },
      { id: 'c2', name: '姚老头', aliases: [], gender: '', age: '', goal: '', secret: '', arc: '', notes: '', attributes: [], firstAppearanceChapterNo: 2, categoryIds: [] },
    ],
    factions: [],
    items: [],
    categories: [],
    characterRelations: [],
    characterFactionMemberships: [],
    timelineEvents: [],
    foreshadows: [],
    outline: [],
  } as WorkspaceSnapshotPayload
}

describe('buildAskUserPrompt', () => {
  it('packs current chapter and stays under budget', () => {
    const built = buildAskUserPrompt(payload([chapter(1, '开篇'), chapter(2, '陈平安遇见姚老头。')]), {
      mode: 'current',
      chapterIds: ['ch-2'],
      question: '陈平安和姚老头是什么关系？',
      enableRag: true,
    })
    expect(built.prompt).toContain('陈平安')
    expect(built.prompt).toContain('作者提问')
    expect(built.usedChars).toBeGreaterThan(0)
    expect(built.usedChars).toBeLessThanOrEqual(32000)
  })
})

describe('buildAskFollowUpPrompt', () => {
  it('adds session note for follow-up', () => {
    const built = buildAskFollowUpPrompt(payload([chapter(1, 'x'), chapter(2, 'y')]), {
      mode: 'current',
      chapterIds: ['ch-2'],
      question: '那后来呢？',
    })
    expect(built.prompt).toContain('追问')
    expect(built.usedLayers).toContain('session_note')
  })
})

describe('trimAskConversationHistory', () => {
  it('keeps system and recent messages', () => {
    const history = [
      { role: 'system', content: 'sys' },
      ...Array.from({ length: 20 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `m${i}` })),
    ]
    const trimmed = trimAskConversationHistory(history, 6)
    expect(trimmed[0].role).toBe('system')
    expect(trimmed.length).toBeLessThanOrEqual(7)
  })
})
