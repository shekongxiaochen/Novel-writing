<template>
  <section class="page-block novel-list-shell">
    <header ref="listChromeAnchorRef" class="page-hero novel-list-hero">
      <div class="novel-list-hero__copy">
        <p class="novel-list-hero__eyebrow">Novel Workbench</p>
        <h1>我的作品</h1>
        <p class="muted novel-list-hero__summary">
          在一个工作台里管理作品、章节、大纲和写作进度，保持每本书的结构与写作状态一目了然。
        </p>
      </div>
      <div class="novel-list-hero__stats" aria-label="作品统计">
        <article class="novel-list-hero__stat">
          <span class="novel-list-hero__stat-label">作品</span>
          <strong>{{ sortedNovels.length }}</strong>
        </article>
        <article class="novel-list-hero__stat">
          <span class="novel-list-hero__stat-label">有正文章节</span>
          <strong>{{ chapterStats.written }}</strong>
        </article>
        <article class="novel-list-hero__stat">
          <span class="novel-list-hero__stat-label">近期活跃</span>
          <strong>{{ chapterStats.activeNovels }}</strong>
        </article>
      </div>
    </header>

    <section class="novel-list-layout">
      <form ref="createCardRef" class="card form-grid novel-list-create" @submit.prevent="handleCreate">
        <div class="novel-list-create__head">
          <h2>新建作品</h2>
        </div>

        <label>
          作品标题 *
          <input v-model="form.title" required maxlength="60" placeholder="输入作品标题" />
        </label>

        <label>
          简介
          <textarea
            v-model="form.summary"
            rows="4"
            maxlength="500"
            class="scrollbar-paper novel-list__summary-input"
            placeholder="输入简介"
          />
        </label>

        <div class="grid-2">
          <label>
            题材
            <input v-model="form.genre" maxlength="30" placeholder="输入题材" />
          </label>
          <label>
            叙事视角
            <select v-model="form.perspective">
              <option value="">未设置</option>
              <option value="第一人称">第一人称</option>
              <option value="第三人称-有限">第三人称-有限</option>
              <option value="第三人称-全知">第三人称-全知</option>
              <option value="第二人称">第二人称</option>
              <option value="多视角">多视角</option>
            </select>
          </label>
        </div>

        <div class="grid-2">
          <label>
            基调
            <input v-model="form.tone" maxlength="30" placeholder="输入基调" />
          </label>
          <label class="checkbox-line novel-list-create__checkbox">
            <input v-model="form.isMultiLineNarrative" type="checkbox" />
            多线叙事
          </label>
        </div>

        <div class="action-row novel-list-create__actions">
          <button type="submit" class="btn-primary" :disabled="isCreating">
            {{ isCreating ? '创建中...' : '创建并进入作品' }}
          </button>
        </div>
      </form>

      <section class="card novel-list-library">
        <div class="novel-list-library__head">
          <div>
            <p class="novel-list-library__eyebrow">Library</p>
            <h2>作品库</h2>
          </div>
          <span class="novel-list-library__count">{{ sortedNovels.length }} 本</span>
        </div>

        <p v-if="sortedNovels.length === 0" class="muted novel-list-library__empty">
          暂无作品，先在左侧创建第一本。
        </p>

        <ul v-else class="list novel-list__list novel-list-library__list scrollbar-paper">
          <li v-for="novel in sortedNovels" :key="novel.id" class="list-item novel-card novel-list-card">
            <div class="novel-card__body">
              <div class="novel-list-card__head">
                <strong class="novel-card__title">{{ novel.title }}</strong>
                <span class="novel-list-card__badge">{{ chapterCountLabel(novel) }}</span>
              </div>
              <p class="muted novel-card__summary novel-list-card__summary">
                {{ novel.summary || '暂无简介' }}
              </p>
              <div class="novel-card__meta novel-list-card__meta">
                <span class="novel-meta-chip">创建：{{ formatDateTime(novel.createdAt) }}</span>
                <span class="novel-meta-chip">上次码字：{{ formatDateTime(novelLastWritingAt(novel)) }}</span>
              </div>
            </div>
            <div class="novel-list-card__actions">
              <button type="button" class="novel-list-card__delete" @click="handleDeleteNovel(novel)">删除</button>
              <button type="button" class="btn-primary novel-list-card__enter" @click="goNovel(novel.id)">进入</button>
            </div>
          </li>
        </ul>
      </section>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setChromeAnchor } from '../../composables/useChromeAnchor'
import { useAuth } from '../../composables/useAuth'
import { useCloudSync } from '../../composables/useCloudSync'
import { createNovel, deleteNovel, getChaptersByNovelId, getNovels } from '../../lib/storage'
import type { NewNovelInput, Novel } from '../../types'

const router = useRouter()
const route = useRoute()
const { isLoggedIn } = useAuth()
const { syncNow } = useCloudSync()
const listChromeAnchorRef = ref<HTMLElement | null>(null)
const createCardRef = ref<HTMLElement | null>(null)
watch(listChromeAnchorRef, (el) => setChromeAnchor(el), { immediate: true })
onUnmounted(() => setChromeAnchor(null))

const novels = ref<Novel[]>(getNovels())
const isCreating = ref(false)
const sortedNovels = computed(() =>
  [...novels.value].sort((a, b) => {
    const ta = novelLastWritingAt(a)
    const tb = novelLastWritingAt(b)
    if (ta === tb) return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
    return tb.localeCompare(ta)
  }),
)
const chapterStats = computed(() => {
  let written = 0
  let activeNovels = 0
  for (const novel of sortedNovels.value) {
    const chapters = getChaptersByNovelId(novel.id)
    const nonEmpty = chapters.filter((chapter) => String(chapter.content ?? '').trim().length > 0)
    written += nonEmpty.length
    if (nonEmpty.length > 0) activeNovels += 1
  }
  return { written, activeNovels }
})
const form = reactive<Pick<NewNovelInput, 'title' | 'summary' | 'genre' | 'perspective' | 'tone' | 'isMultiLineNarrative'>>({
  title: '',
  summary: '',
  genre: '',
  perspective: '',
  tone: '',
  isMultiLineNarrative: false,
})

function refreshNovels(): void {
  novels.value = getNovels()
}

function resetForm() {
  form.title = ''
  form.summary = ''
  form.genre = ''
  form.perspective = ''
  form.tone = ''
  form.isMultiLineNarrative = false
}

async function handleCreate() {
  if (!form.title.trim()) return
  if (isCreating.value) return
  isCreating.value = true
  try {
    const novel = createNovel({
      title: form.title,
      summary: form.summary,
      genre: form.genre,
      perspective: form.perspective,
      tone: form.tone,
      isMultiLineNarrative: form.isMultiLineNarrative,
    })
    refreshNovels()
    resetForm()
    void router.push(`/novels/${novel.id}`)
  } finally {
    isCreating.value = false
  }
}

function formatDateTime(v: string): string {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
}

function goNovel(id: string) {
  void router.push(`/novels/${id}`)
}

async function handleDeleteNovel(novel: Novel): Promise<void> {
  const label = novel.title || '未命名作品'
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
  const count = getChaptersByNovelId(novel.id).length
  return `${count} 章`
}

function scrollToCreate(): void {
  createCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(
  () => route.query.focus,
  (focus) => {
    if (String(focus ?? '') !== 'create') return
    void Promise.resolve().then(() => {
      scrollToCreate()
      const nextQuery = { ...route.query }
      delete nextQuery.focus
      void router.replace({ query: nextQuery })
    })
  },
  { immediate: true },
)

watch(
  () => route.fullPath,
  () => {
    refreshNovels()
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('novel-writing:changed', refreshNovels)
})

onUnmounted(() => {
  window.removeEventListener('novel-writing:changed', refreshNovels)
})
</script>
