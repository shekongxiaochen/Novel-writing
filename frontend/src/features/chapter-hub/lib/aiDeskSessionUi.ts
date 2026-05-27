import type {
  AiContinueDraft,
  AiContinuePosition,
  AiContinuePrevSummaryCount,
  AiContinueTargetChars,
  ContinueRagSnippetHit,
} from '../../../types'

export type AiDeskSessionUiState = {
  composerDraft: string
  activeDirectionPreset: string
  continueByChapter: Record<string, PersistedContinueDraft>
}

export type PersistedContinueDraft = {
  text: string
  status: AiContinueDraft['status']
  position: AiContinuePosition
  targetChars: AiContinueTargetChars
  prevSummaryCount: AiContinuePrevSummaryCount
  afterAdoptSummary: boolean
  afterAdoptExtract: boolean
  enableRag: boolean
  insertOffset: number | null
  warnings: string[]
  droppedLayers: string[]
  usedLayers: string[]
  usedChars: number
  ragHits: ContinueRagSnippetHit[]
}

export function emptyAiDeskSessionUiState(): AiDeskSessionUiState {
  return { composerDraft: '', activeDirectionPreset: '', continueByChapter: {} }
}

export function normalizeAiDeskSessionUiState(raw: unknown): AiDeskSessionUiState | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  const continueByChapter: Record<string, PersistedContinueDraft> = {}
  if (source.continueByChapter && typeof source.continueByChapter === 'object') {
    for (const [chapterId, value] of Object.entries(source.continueByChapter as Record<string, unknown>)) {
      const normalized = normalizePersistedContinueDraft(value)
      if (normalized) continueByChapter[String(chapterId).trim()] = normalized
    }
  }
  return {
    composerDraft: String(source.composerDraft ?? ''),
    activeDirectionPreset: String(source.activeDirectionPreset ?? ''),
    continueByChapter,
  }
}

function normalizePersistedContinueDraft(raw: unknown): PersistedContinueDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const targetChars = Number(source.targetChars)
  const prevSummaryCount = Number(source.prevSummaryCount)
  const position = source.position === 'cursor' ? 'cursor' : 'end'
  const status =
    source.status === 'ready' || source.status === 'applied' || source.status === 'ignored' ? source.status : 'idle'
  return {
    text: String(source.text ?? ''),
    status,
    position,
    targetChars: targetChars === 800 || targetChars === 3000 ? targetChars : 1500,
    prevSummaryCount: prevSummaryCount === 2 || prevSummaryCount === 5 ? prevSummaryCount : 3,
    afterAdoptSummary: Boolean(source.afterAdoptSummary),
    afterAdoptExtract: Boolean(source.afterAdoptExtract),
    enableRag: source.enableRag !== false,
    insertOffset: Number.isFinite(Number(source.insertOffset)) ? Number(source.insertOffset) : null,
    warnings: Array.isArray(source.warnings) ? source.warnings.map((row) => String(row)).slice(0, 12) : [],
    droppedLayers: Array.isArray(source.droppedLayers) ? source.droppedLayers.map((row) => String(row)).slice(0, 12) : [],
    usedLayers: Array.isArray(source.usedLayers) ? source.usedLayers.map((row) => String(row)).slice(0, 12) : [],
    usedChars: Math.max(0, Math.trunc(Number(source.usedChars ?? 0))),
    ragHits: Array.isArray(source.ragHits)
      ? (source.ragHits as ContinueRagSnippetHit[]).slice(0, 12)
      : [],
  }
}

export function serializeContinueDraft(draft: AiContinueDraft): PersistedContinueDraft {
  const status: AiContinueDraft['status'] = draft.loading
    ? draft.text.trim()
      ? 'ready'
      : 'idle'
    : draft.status
  return {
    text: draft.text,
    status,
    position: draft.position,
    targetChars: draft.targetChars,
    prevSummaryCount: draft.prevSummaryCount,
    afterAdoptSummary: draft.afterAdoptSummary,
    afterAdoptExtract: draft.afterAdoptExtract,
    enableRag: draft.enableRag,
    insertOffset: draft.insertOffset,
    warnings: draft.warnings.slice(0, 12),
    droppedLayers: draft.droppedLayers.slice(0, 12),
    usedLayers: draft.usedLayers.slice(0, 12),
    usedChars: draft.usedChars,
    ragHits: draft.ragHits.slice(0, 12),
  }
}

export function hydrateContinueDraft(
  persisted: PersistedContinueDraft | undefined,
  buildEmpty: () => AiContinueDraft,
): AiContinueDraft {
  if (!persisted) return buildEmpty()
  return {
    ...buildEmpty(),
    ...persisted,
    loading: false,
  }
}
