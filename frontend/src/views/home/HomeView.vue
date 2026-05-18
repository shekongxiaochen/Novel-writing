<template>
  <section class="home-library">
    <div class="home-library__head">
      <div class="home-library__titles">
        <p class="home-library__eyebrow">Library</p>
        <h1 class="home-library__title">选择一本书</h1>
      </div>
      <button type="button" class="btn-primary home-library__create" @click="createDialogOpen = true">
        新建书籍
      </button>
    </div>

    <p v-if="sortedNovels.length === 0" class="home-library__empty">
      还没有书。
    </p>

    <ul v-else class="home-library__grid">
      <li v-for="novel in sortedNovels" :key="novel.id" class="home-library__card">
        <button type="button" class="home-library__card-main" @click="goNovel(novel.id)">
          <div class="home-library__card-top">
            <strong class="home-library__card-title">{{ novel.title || '未命名书籍' }}</strong>
            <span class="home-library__card-badge">{{ chapterCountLabel(novel) }}</span>
          </div>
          <p class="home-library__card-summary">{{ novel.summary || '暂无简介' }}</p>
          <div class="home-library__card-meta">
            <span>{{ formatDateTime(novelLastWritingAt(novel)) }}</span>
          </div>
        </button>
        <div class="home-library__card-actions">
          <button type="button" class="home-library__ghost" @click="handleDeleteNovel(novel)">删除</button>
          <button type="button" class="btn-primary home-library__enter" @click="goNovel(novel.id)">进入</button>
        </div>
      </li>
    </ul>

    <CreateNovelDialog
      :open="createDialogOpen"
      @close="createDialogOpen = false"
      @created="handleCreated"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CreateNovelDialog from '../../components/CreateNovelDialog.vue'
import { useAuth } from '../../composables/useAuth'
import { useCloudSync } from '../../composables/useCloudSync'
import { deleteNovel, getChaptersByNovelId, getNovels } from '../../lib/storage'
import type { Novel } from '../../types'

const router = useRouter()
const { isLoggedIn } = useAuth()
const { syncNow } = useCloudSync()

const createDialogOpen = ref(false)
const novels = ref<Novel[]>(getNovels())

const sortedNovels = computed(() =>
  [...novels.value].sort((a, b) => {
    const ta = novelLastWritingAt(a)
    const tb = novelLastWritingAt(b)
    if (ta === tb) return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
    return tb.localeCompare(ta)
  }),
)

function refreshNovels(): void {
  novels.value = getNovels()
}

function goNovel(id: string): void {
  if (!id) return
  void router.push(`/novels/${id}`)
}

function handleCreated(novelId: string): void {
  createDialogOpen.value = false
  refreshNovels()
  goNovel(novelId)
}

async function handleDeleteNovel(novel: Novel): Promise<void> {
  const label = novel.title || '未命名书籍'
  const confirmed = window.confirm(`确认删除《${label}》？相关章节、大纲、角色与伏笔数据都会一起删除。`)
  if (!confirmed) return

  const deleted = deleteNovel(novel.id)
  if (!deleted) return
  refreshNovels()

  if (!isLoggedIn.value) return
  try {
    await syncNow()
  } catch {
    /* tombstone remains locally; next sync can continue deleting remotely */
  }
}

function novelLastWritingAt(novel: Novel): string {
  const chapters = getChaptersByNovelId(novel.id)
  let latest = ''
  for (const chapter of chapters) {
    if (!String(chapter.content ?? '').trim()) continue
    const ts = String(chapter.updatedAt ?? '')
    if (!ts) continue
    if (!latest || ts > latest) latest = ts
  }
  return latest || novel.createdAt
}

function chapterCountLabel(novel: Novel): string {
  return `${getChaptersByNovelId(novel.id).length} 章`
}

function formatDateTime(v: string): string {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '最近未写'
  return d.toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  window.addEventListener('novel-writing:changed', refreshNovels)
})

onUnmounted(() => {
  window.removeEventListener('novel-writing:changed', refreshNovels)
})
</script>

<style scoped>
.home-library {
  width: min(1220px, calc(100vw - 48px));
  margin-top: 28px;
  display: grid;
  gap: 22px;
}

.home-library__head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
}

.home-library__titles {
  display: grid;
  gap: 8px;
}

.home-library__eyebrow {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.home-library__title {
  margin: 0;
  font-size: clamp(2rem, 3vw, 2.8rem);
  line-height: 1.02;
  color: var(--color-text);
}

.home-library__create {
  min-width: 132px;
}

.home-library__empty {
  margin: 0;
  padding: 28px 24px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 38%, transparent);
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  color: var(--color-text-muted);
}

.home-library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-library__card {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 42%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, rgba(255,255,255,0.78)), color-mix(in srgb, var(--color-surface-muted) 90%, transparent)),
    radial-gradient(circle at top right, color-mix(in srgb, var(--color-primary-soft) 18%, transparent) 0, transparent 38%);
  box-shadow:
    0 16px 38px color-mix(in srgb, #120f0b 8%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 60%, transparent);
}

.home-library__card-main {
  display: grid;
  gap: 14px;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
}

.home-library__card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.home-library__card-title {
  font-size: 1.05rem;
  color: var(--color-text);
}

.home-library__card-badge {
  flex: 0 0 auto;
  padding: 0 10px;
  line-height: 28px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary-soft) 42%, transparent);
  color: var(--color-primary);
  font-size: 0.82rem;
  font-weight: 700;
}

.home-library__card-summary {
  margin: 0;
  min-height: 3.2em;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.home-library__card-meta {
  font-size: 0.84rem;
  color: var(--color-text-muted);
}

.home-library__card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.home-library__ghost {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font-weight: 600;
}

.home-library__ghost:hover {
  color: var(--danger-text);
}

.home-library__enter {
  min-width: 96px;
}

@media (max-width: 720px) {
  .home-library {
    width: calc(100vw - 28px);
    margin-top: 20px;
    gap: 18px;
  }

  .home-library__head {
    flex-direction: column;
    align-items: stretch;
  }

  .home-library__card-actions {
    flex-wrap: wrap;
  }

  .home-library__create,
  .home-library__enter {
    width: 100%;
  }
}
</style>
