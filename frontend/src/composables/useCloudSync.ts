import { ref } from 'vue'
import type { CloudSyncSummary } from '../lib/cloudSync'
import { syncAllNovelsWithCloud } from '../lib/cloudSync'

const syncing = ref(false)
const lastSummary = ref<CloudSyncSummary | null>(null)
const syncError = ref('')
let syncPromise: Promise<CloudSyncSummary> | null = null

async function syncNow(): Promise<CloudSyncSummary> {
  if (syncPromise) return syncPromise
  syncing.value = true
  syncError.value = ''
  syncPromise = syncAllNovelsWithCloud()
    .then((summary) => {
      lastSummary.value = summary
      return summary
    })
    .catch((error: unknown) => {
      syncError.value = error instanceof Error ? error.message : '云同步失败'
      throw error
    })
    .finally(() => {
      syncing.value = false
      syncPromise = null
    })
  return syncPromise
}

function clearSyncState(): void {
  lastSummary.value = null
  syncError.value = ''
}

export function useCloudSync() {
  return {
    syncing,
    lastSummary,
    syncError,
    syncNow,
    clearSyncState,
  }
}
