import { describe, expect, it } from 'vitest'
import { hydrateContinueDraft, normalizeAiDeskSessionUiState, serializeContinueDraft } from './aiDeskSessionUi'
import type { AiContinueDraft } from '../../../types'

function emptyDraft(): AiContinueDraft {
  return {
    text: '',
    loading: false,
    status: 'idle',
    position: 'end',
    targetChars: 1500,
    prevSummaryCount: 3,
    afterAdoptSummary: false,
    afterAdoptExtract: false,
    enableRag: true,
    insertOffset: null,
    warnings: [],
    droppedLayers: [],
    usedLayers: [],
    usedChars: 0,
    ragHits: [],
  }
}

describe('aiDeskSessionUi', () => {
  it('round-trips composer and continue state', () => {
    const ui = normalizeAiDeskSessionUiState({
      composerDraft: '继续写对峙',
      activeDirectionPreset: 'tension',
      continueByChapter: {
        ch1: serializeContinueDraft({
          ...emptyDraft(),
          text: '生成的段落',
          status: 'ready',
          position: 'cursor',
        }),
      },
    })
    expect(ui?.composerDraft).toBe('继续写对峙')
    const restored = hydrateContinueDraft(ui?.continueByChapter.ch1, emptyDraft)
    expect(restored.text).toBe('生成的段落')
    expect(restored.position).toBe('cursor')
    expect(restored.loading).toBe(false)
  })
})
