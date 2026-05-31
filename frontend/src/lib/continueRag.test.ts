import { describe, expect, it } from 'vitest'
import {
  buildContinueRagHits,
  collectContinueSearchTerms,
  collectForeshadowSearchTerms,
  searchContinueRagSnippets,
} from './continueRag'
import type { Chapter } from '../types'

function chapter(no: number, content: string): Chapter {
  return {
    id: `ch-${no}`,
    novelId: 'n1',
    chapterNo: no,
    title: `第${no}章`,
    notes: '',
    annotation: '',
    content,
    outlineItemIds: [],
    sceneSummaries: [],
    status: 'draft',
    createdAt: '',
    updatedAt: '',
  }
}

describe('searchContinueRagSnippets', () => {
  it('finds excerpts in older chapters by character name', () => {
    const chapters = [
      chapter(1, '陈平安在小镇长大，学会了烧瓷。'),
      chapter(2, '姚老头教他拉坯，说火候要稳。'),
      chapter(3, '锦衣少年路过，与陈平安对视。'),
      chapter(4, '陈平安独自走在泥路上。'),
    ]
    const hits = searchContinueRagSnippets({
      chapters,
      currentChapterId: 'ch-4',
      terms: collectContinueSearchTerms({ characters: [{ name: '姚老头', aliases: [] }] }),
      maxSnippets: 3,
    })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((row) => row.chapterNo === 2 && row.excerpt.includes('姚老头'))).toBe(true)
  })

  it('returns empty when no prior chapters', () => {
    const hits = searchContinueRagSnippets({
      chapters: [chapter(1, '开篇')],
      currentChapterId: 'ch-1',
      terms: ['陈平安'],
    })
    expect(hits).toEqual([])
  })
})

describe('collectForeshadowSearchTerms', () => {
  it('includes open foreshadow titles linked to outline', () => {
    const terms = collectForeshadowSearchTerms({
      foreshadows: [
        { id: 'fs1', title: '瓷片裂纹', status: 'open', plantChapterId: 'ch-1' },
        { id: 'fs2', title: '已回收', status: 'fulfilled', plantChapterId: 'ch-1' },
      ],
      scanText: '陈平安看着瓷片裂纹发呆。',
      currentChapterId: 'ch-3',
      outlineForeshadowIds: ['fs1'],
    })
    expect(terms).toContain('瓷片裂纹')
    expect(terms).not.toContain('已回收')
  })
})

describe('buildContinueRagHits', () => {
  it('merges character and foreshadow hits', () => {
    const chapters = [
      chapter(1, '陈平安注意到瓷片裂纹，心里一沉。'),
      chapter(2, '姚老头说裂纹是窑温不对。'),
      chapter(3, '陈平安独自走在泥路上。'),
    ]
    const hits = buildContinueRagHits({
      chapters,
      currentChapterId: 'ch-3',
      characters: [{ name: '姚老头', aliases: [] }],
      foreshadows: [{ id: 'fs1', title: '瓷片裂纹', status: 'open', plantChapterId: 'ch-1' }],
      scanText: '陈平安想起瓷片裂纹。',
      outlineForeshadowIds: ['fs1'],
      outlineLocations: [],
    })
    expect(hits.some((row) => row.source === 'character')).toBe(true)
    expect(hits.some((row) => row.source === 'foreshadow')).toBe(true)
  })
})
