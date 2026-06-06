<template>
  <section class="home-library">
    <div class="home-library__head">
      <div class="home-library__titles">
        <p class="home-library__eyebrow">Library</p>
        <h1 class="home-library__title">选择一本书</h1>
        <p class="home-library__subtitle">
          {{ sortedNovels.length ? `共 ${sortedNovels.length} 本作品` : '从这里开启你的第一本书' }}
        </p>
      </div>
      <button type="button" class="home-library__create" @click="createDialogOpen = true">
        <span class="home-library__create-icon" aria-hidden="true">+</span>
        新建书籍
      </button>
    </div>

    <button
      v-if="sortedNovels.length === 0"
      type="button"
      class="home-library__empty"
      @click="createDialogOpen = true"
    >
      <span class="home-library__empty-icon" aria-hidden="true">+</span>
      <span class="home-library__empty-title">还没有书</span>
      <span class="home-library__empty-hint">点击新建你的第一本书</span>
    </button>

    <ul v-else class="home-library__grid">
      <li
        v-for="(novel, i) in sortedNovels"
        :key="novel.id"
        class="home-library__card"
        :style="{ '--spine': spineColor(i) }"
        @click="goNovel(novel.id)"
      >
        <span class="home-library__spine" aria-hidden="true" />
        <div class="home-library__card-body">
          <div class="home-library__card-top">
            <strong class="home-library__card-title">{{ novel.title || '未命名书籍' }}</strong>
            <span class="home-library__card-badge">{{ chapterCountLabel(novel) }}</span>
          </div>
          <p class="home-library__card-summary">{{ novel.summary || '暂无简介' }}</p>
          <div class="home-library__card-foot">
            <span class="home-library__card-meta">
              <span class="home-library__meta-dot" aria-hidden="true" />
              {{ formatDateTime(novelLastWritingAt(novel)) }}
            </span>
            <span class="home-library__card-enter">进入 →</span>
          </div>
        </div>
        <button
          type="button"
          class="home-library__del"
          aria-label="删除书籍"
          title="删除"
          @click.stop="handleDeleteNovel(novel)"
        >
          删除
        </button>
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

const SPINE_COLORS = ['#c08a5c', '#7c9885', '#6c8aa6', '#b07c9b', '#a8895c', '#5f8a8b', '#9a7bb0', '#c2784f']

function spineColor(index: number): string {
  return SPINE_COLORS[index % SPINE_COLORS.length]
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
  width: min(1180px, calc(100vw - 48px));
  margin-top: 12px;
  display: grid;
  gap: 26px;
}

.home-library__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.home-library__titles {
  display: grid;
  gap: 6px;
}

.home-library__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.home-library__title {
  margin: 0;
  font-size: clamp(1.8rem, 2.6vw, 2.4rem);
  line-height: 1.05;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.home-library__subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.home-library__create {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 20px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, var(--color-accent)));
  color: #fff;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 22px color-mix(in srgb, var(--color-primary) 30%, transparent);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.home-library__create:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--color-primary) 38%, transparent);
}

.home-library__create-icon {
  font-size: 1.15rem;
  line-height: 1;
}

.home-library__empty {
  display: grid;
  justify-items: center;
  gap: 6px;
  margin: 0;
  padding: 56px 24px;
  border-radius: 24px;
  border: 1.5px dashed color-mix(in srgb, var(--color-border-strong) 55%, transparent);
  background: color-mix(in srgb, var(--color-surface) 70%, transparent);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.home-library__empty:hover {
  border-color: color-mix(in srgb, var(--color-primary) 60%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 22%, transparent);
}

.home-library__empty-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: 6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary-soft) 50%, transparent);
  color: var(--color-primary);
  font-size: 1.6rem;
  line-height: 1;
}

.home-library__empty-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text);
}

.home-library__empty-hint {
  font-size: 0.86rem;
}

.home-library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-library__card {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 16px;
  padding: 18px 18px 18px 0;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 40%, transparent);
  background: color-mix(in srgb, var(--color-surface) 96%, transparent);
  box-shadow: 0 2px 8px color-mix(in srgb, #120f0b 5%, transparent);
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.home-library__card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--spine) 50%, transparent);
  box-shadow: 0 18px 40px color-mix(in srgb, #120f0b 14%, transparent);
}

.home-library__spine {
  flex: 0 0 6px;
  align-self: stretch;
  border-radius: 0 4px 4px 0;
  background: linear-gradient(180deg, var(--spine), color-mix(in srgb, var(--spine) 65%, #000));
}

.home-library__card-body {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  gap: 10px;
  align-content: start;
}

.home-library__card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.home-library__card-title {
  font-size: 1.08rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-library__card-badge {
  flex: 0 0 auto;
  padding: 0 11px;
  line-height: 26px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--spine) 18%, transparent);
  color: color-mix(in srgb, var(--spine) 78%, var(--color-text));
  font-size: 0.78rem;
  font-weight: 700;
}

.home-library__card-summary {
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.9em;
  color: var(--color-text-muted);
  line-height: 1.55;
  font-size: 0.9rem;
}

.home-library__card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 2px;
}

.home-library__card-meta {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.home-library__meta-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--spine);
}

.home-library__card-enter {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-primary);
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.home-library__card:hover .home-library__card-enter {
  opacity: 1;
  transform: translateX(0);
}

.home-library__del {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 10px;
  border: 0;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-surface-muted) 80%, transparent);
  color: var(--color-text-muted);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.home-library__card:hover .home-library__del {
  opacity: 1;
}

.home-library__del:hover {
  background: color-mix(in srgb, var(--danger-text) 16%, transparent);
  color: var(--danger-text);
}

@media (max-width: 720px) {
  .home-library {
    width: calc(100vw - 28px);
    margin-top: 8px;
    gap: 18px;
  }

  .home-library__head {
    flex-direction: column;
    align-items: stretch;
  }

  .home-library__create {
    width: 100%;
    justify-content: center;
  }

  .home-library__grid {
    grid-template-columns: 1fr;
  }

  .home-library__del,
  .home-library__card-enter {
    opacity: 1;
  }
}
</style>
