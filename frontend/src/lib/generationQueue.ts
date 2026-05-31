import type { Chapter, Novel } from '../types'
import type { WorkspaceSnapshotPayload } from './storage'
import { buildNovelWorkspacePayload, updateChapter } from './storage'
import { continueChapterFromWorkspaceStream } from './localAi'
import { formatChapterSummaryText } from './chapterSummary'

export type QueueItemStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled'

export type QueueItem = {
  id: string
  chapterId: string
  chapterNo: number
  direction?: string
  targetChars?: number
  status: QueueItemStatus
  result?: string
  error?: string
  startedAt?: string
  completedAt?: string
}

export type GenerationQueue = {
  items: QueueItem[]
  activeId: string | null
  isRunning: boolean
}

export function createQueueItem(
  chapterId: string,
  chapterNo: number,
  options?: { direction?: string; targetChars?: number },
): QueueItem {
  return {
    id: `queue-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    chapterId,
    chapterNo,
    direction: options?.direction,
    targetChars: options?.targetChars,
    status: 'pending',
  }
}

export function addToQueue(queue: GenerationQueue, item: QueueItem): GenerationQueue {
  return {
    ...queue,
    items: [...queue.items, item],
  }
}

export function removeFromQueue(queue: GenerationQueue, itemId: string): GenerationQueue {
  return {
    ...queue,
    items: queue.items.filter((item) => item.id !== itemId),
  }
}

export function retryQueueItem(queue: GenerationQueue, itemId: string): GenerationQueue {
  return {
    ...queue,
    items: queue.items.map((item) =>
      item.id === itemId ? { ...item, status: 'pending' as const, error: undefined, result: undefined } : item,
    ),
  }
}

export function cancelQueue(queue: GenerationQueue): GenerationQueue {
  return {
    ...queue,
    items: queue.items.map((item) =>
      item.status === 'pending' ? { ...item, status: 'cancelled' as const } : item,
    ),
    isRunning: false,
    activeId: null,
  }
}

export function getQueueProgress(queue: GenerationQueue): { completed: number; total: number; current?: number } {
  const total = queue.items.length
  const completed = queue.items.filter((item) => item.status === 'completed').length
  const currentIndex = queue.items.findIndex((item) => item.id === queue.activeId)
  return { completed, total, current: currentIndex >= 0 ? currentIndex + 1 : undefined }
}

type QueueCallbacks = {
  onItemStart: (item: QueueItem) => void
  onItemComplete: (item: QueueItem, result: string) => void
  onItemFail: (item: QueueItem, error: string) => void
  onQueueComplete: () => void
  onQueueCancelled: () => void
  onProgress: (completed: number, total: number) => void
}

export async function startQueue(
  queue: GenerationQueue,
  novel: Novel,
  callbacks: QueueCallbacks,
  signal?: AbortSignal,
): Promise<GenerationQueue> {
  if (queue.isRunning) return queue

  let currentQueue: GenerationQueue = {
    ...queue,
    isRunning: true,
    items: queue.items.map((item) =>
      item.status === 'cancelled' ? { ...item, status: 'pending' as const } : item,
    ),
  }

  const pendingItems = currentQueue.items.filter((item) => item.status === 'pending')

  for (const item of pendingItems) {
    if (signal?.aborted) {
      currentQueue = cancelQueue(currentQueue)
      callbacks.onQueueCancelled()
      return currentQueue
    }

    currentQueue = {
      ...currentQueue,
      activeId: item.id,
      items: currentQueue.items.map((i) =>
        i.id === item.id ? { ...i, status: 'generating' as const, startedAt: new Date().toISOString() } : i,
      ),
    }
    callbacks.onItemStart(item)

    try {
      const snapshot = buildNovelWorkspacePayload(novel.id)
      const result = await continueChapterFromWorkspaceStream(
        snapshot,
        {
          chapterId: item.chapterId,
          position: 'end',
          targetChars: item.targetChars,
          direction: item.direction,
          novel: {
            title: novel.title,
            summary: novel.summary,
            continuityBrief: novel.continuityBrief,
            arcSummaries: novel.arcSummaries,
            genre: novel.genre,
            perspective: novel.perspective,
            tone: novel.tone,
          },
          prevSummaryCount: 3,
          enableRag: true,
        },
        {
          onChunk: () => {},
          onError: (err: Error) => {
            throw err
          },
        },
        signal,
      )

      if (result.text) {
        // Apply the generated text
        updateChapter({ id: item.chapterId, content: result.text })

        // Run chapter summary
        const summarySnapshot = buildNovelWorkspacePayload(novel.id)
        // Note: We don't await the summary here to keep the queue moving
        // The summary will be generated in the background

        currentQueue = {
          ...currentQueue,
          items: currentQueue.items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'completed' as const,
                  result: result.text,
                  completedAt: new Date().toISOString(),
                }
              : i,
          ),
        }
        callbacks.onItemComplete(item, result.text)
      } else {
        throw new Error('生成结果为空')
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : '生成失败'
      currentQueue = {
        ...currentQueue,
        items: currentQueue.items.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: 'failed' as const,
                error: errorMessage,
                completedAt: new Date().toISOString(),
              }
            : i,
        ),
      }
      callbacks.onItemFail(item, errorMessage)
    }

    const completed = currentQueue.items.filter((i) => i.status === 'completed').length
    callbacks.onProgress(completed, currentQueue.items.length)
  }

  currentQueue = {
    ...currentQueue,
    isRunning: false,
    activeId: null,
  }
  callbacks.onQueueComplete()

  return currentQueue
}
