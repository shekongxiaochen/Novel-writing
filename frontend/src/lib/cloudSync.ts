import { getCurrentSession } from './auth'
import {
  buildNovelWorkspacePayload,
  clearDeletedNovelTracking,
  getDeletedNovelIds,
  getNovels,
  hydrateNovelWorkspaceFromPayload,
  upsertNovelRecord,
} from './storage'
import type { WorkspaceSnapshotPayload } from './storage'
import type { Novel } from '../types'

type RemoteNovel = {
  id: string
  title: string
  summary: string
  genre: string
  perspective: string
  tone: string
  is_multi_line_narrative: boolean
  ai_style_prompt: string
  created_at: string
  updated_at: string
}

type RemoteWorkspaceResponse = {
  novel_id: string
  snapshot_version: number
  payload: WorkspaceSnapshotPayload
  updated_at: string
}

type RemoteSnapshotResponse = {
  novel_id: string
  version: number
  payload: WorkspaceSnapshotPayload
  updated_at: string
}

export type CloudSyncSummary = {
  uploaded: number
  downloaded: number
  pushed: number
  pulled: number
  deleted: number
  message: string
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '')

function mapRemoteNovel(novel: RemoteNovel): Novel {
  return {
    id: String(novel.id),
    title: String(novel.title ?? ''),
    summary: String(novel.summary ?? ''),
    continuityBrief: String((novel as any).continuity_brief ?? ''),
    arcSummaries: Array.isArray((novel as any).arc_summaries) ? (novel as any).arc_summaries : [],
    genre: String(novel.genre ?? ''),
    perspective: String(novel.perspective ?? ''),
    tone: String(novel.tone ?? ''),
    isMultiLineNarrative: Boolean(novel.is_multi_line_narrative),
    aiStylePrompt: String((novel as any).ai_style_prompt ?? ''),
    createdAt: String(novel.created_at ?? ''),
    updatedAt: String(novel.updated_at ?? ''),
  }
}

function toRemoteNovelPayload(novel: Novel, includeId = false): Record<string, unknown> {
  return {
    ...(includeId ? { id: novel.id } : {}),
    title: novel.title,
    summary: novel.summary,
    genre: novel.genre,
    perspective: novel.perspective,
    tone: novel.tone,
    is_multi_line_narrative: novel.isMultiLineNarrative,
    ai_style_prompt: novel.aiStylePrompt,
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getCurrentSession()
  if (!session?.token) throw new Error('未登录，无法同步')

  const resp = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })

  const text = await resp.text()
  const payload = text ? (JSON.parse(text) as unknown) : null

  if (!resp.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail?: unknown }).detail ?? '')
        : ''
    throw new Error(detail || `同步失败（${resp.status}）`)
  }

  return payload as T
}

async function listRemoteNovels(): Promise<Novel[]> {
  const rows = await request<RemoteNovel[]>('/novels')
  return rows.map(mapRemoteNovel)
}

async function createRemoteNovel(novel: Novel): Promise<Novel> {
  const row = await request<RemoteNovel>('/novels', {
    method: 'POST',
    body: JSON.stringify(toRemoteNovelPayload(novel, true)),
  })
  return mapRemoteNovel(row)
}

async function updateRemoteNovel(novel: Novel): Promise<Novel> {
  const row = await request<RemoteNovel>(`/novels/${novel.id}`, {
    method: 'PUT',
    body: JSON.stringify(toRemoteNovelPayload(novel, false)),
  })
  return mapRemoteNovel(row)
}

async function getRemoteWorkspace(novelId: string): Promise<RemoteWorkspaceResponse> {
  return request<RemoteWorkspaceResponse>(`/novels/${novelId}/workspace`)
}

async function putRemoteSnapshot(novelId: string, payload: WorkspaceSnapshotPayload): Promise<RemoteSnapshotResponse> {
  return request<RemoteSnapshotResponse>(`/novels/${novelId}/snapshot`, {
    method: 'PUT',
    body: JSON.stringify({ payload }),
  })
}

async function deleteRemoteNovel(novelId: string): Promise<void> {
  await request<{ message: string }>(`/novels/${novelId}`, {
    method: 'DELETE',
  })
}

function applyLocalNovelUpdate(base: Novel, remote: Novel | null, updatedAt: string): Novel {
  return {
    ...base,
    createdAt: remote?.createdAt || base.createdAt,
    updatedAt: updatedAt || remote?.updatedAt || base.updatedAt,
  }
}

function buildSummaryMessage(summary: Omit<CloudSyncSummary, 'message'>): string {
  const parts: string[] = []
  if (summary.deleted) parts.push(`删除云端作品 ${summary.deleted}`)
  if (summary.uploaded) parts.push(`上传新作品 ${summary.uploaded}`)
  if (summary.downloaded) parts.push(`下载新作品 ${summary.downloaded}`)
  if (summary.pushed) parts.push(`上传更新 ${summary.pushed}`)
  if (summary.pulled) parts.push(`拉取更新 ${summary.pulled}`)
  return parts.length > 0 ? `云同步完成：${parts.join('，')}` : '云同步完成，数据已是最新'
}

export async function syncAllNovelsWithCloud(): Promise<CloudSyncSummary> {
  const remoteNovels = await listRemoteNovels()
  const deletedNovelIds = getDeletedNovelIds()
  const localNovels = getNovels()
  const remoteById = new Map(remoteNovels.map((novel) => [novel.id, novel]))
  const localById = new Map(localNovels.map((novel) => [novel.id, novel]))

  const summaryBase = {
    deleted: 0,
    uploaded: 0,
    downloaded: 0,
    pushed: 0,
    pulled: 0,
  }

  const clearedDeletedIds: string[] = []
  for (const deletedNovelId of deletedNovelIds) {
    if (remoteById.has(deletedNovelId)) {
      await deleteRemoteNovel(deletedNovelId)
      summaryBase.deleted += 1
      remoteById.delete(deletedNovelId)
    }
    clearedDeletedIds.push(deletedNovelId)
  }
  if (clearedDeletedIds.length > 0) clearDeletedNovelTracking(clearedDeletedIds)

  for (const localNovel of localNovels) {
    const remoteNovel = remoteById.get(localNovel.id)
    if (!remoteNovel) {
      const createdRemote = await createRemoteNovel(localNovel)
      const snapshot = await putRemoteSnapshot(localNovel.id, buildNovelWorkspacePayload(localNovel.id))
      upsertNovelRecord(applyLocalNovelUpdate(localNovel, createdRemote, snapshot.updated_at))
      summaryBase.uploaded += 1
      continue
    }

    if (localNovel.updatedAt > remoteNovel.updatedAt) {
      const updatedRemote = await updateRemoteNovel(localNovel)
      const snapshot = await putRemoteSnapshot(localNovel.id, buildNovelWorkspacePayload(localNovel.id))
      upsertNovelRecord(applyLocalNovelUpdate(localNovel, updatedRemote, snapshot.updated_at))
      summaryBase.pushed += 1
    }
  }

  for (const remoteNovel of remoteById.values()) {
    const localNovel = localById.get(remoteNovel.id)
    if (!localNovel) {
      const workspace = await getRemoteWorkspace(remoteNovel.id)
      upsertNovelRecord(remoteNovel)
      hydrateNovelWorkspaceFromPayload(remoteNovel.id, workspace.payload)
      summaryBase.downloaded += 1
      continue
    }

    if (remoteNovel.updatedAt > localNovel.updatedAt) {
      const workspace = await getRemoteWorkspace(remoteNovel.id)
      upsertNovelRecord(remoteNovel)
      hydrateNovelWorkspaceFromPayload(remoteNovel.id, workspace.payload)
      summaryBase.pulled += 1
    }
  }

  return {
    ...summaryBase,
    message: buildSummaryMessage(summaryBase),
  }
}
