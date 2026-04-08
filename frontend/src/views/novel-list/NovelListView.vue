<template>
  <section class="page-block">
    <header ref="listChromeAnchorRef" class="page-hero">
      <h1>我的作品</h1>
    </header>

    <form class="card form-grid" @submit.prevent="handleCreate">
      <h2>新建作品</h2>
      <label>
        作品标题 *
        <input v-model="form.title" required maxlength="60" />
      </label>

      <label>
        简介
        <textarea v-model="form.summary" rows="3" maxlength="500" />
      </label>

      <div class="grid-3">
        <label>
          题材
          <input v-model="form.genre" maxlength="30" />
        </label>
        <label>
          叙事视角
          <select v-model="form.perspective">
            <option value="">请选择视角</option>
            <option v-for="item in perspectiveOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label>
          基调
          <input v-model="form.tone" maxlength="30" />
        </label>
      </div>

      <label class="checkbox-line">
        <input v-model="form.isMultiLineNarrative" type="checkbox" />
        多线叙事
      </label>

      <div class="action-row">
        <button type="submit">创建并进入作品</button>
      </div>
    </form>

    <section class="card">
      <h2>作品列表</h2>
      <p v-if="novels.length === 0" class="muted">暂无作品，先在上方创建第一本。</p>
      <ul v-else class="list">
        <li v-for="novel in novels" :key="novel.id" class="list-item novel-card">
          <div>
            <strong>{{ novel.title }}</strong>
            <p class="muted one-line">{{ novel.summary || '暂无简介' }}</p>
            <small class="muted">
              {{ novel.genre || '未设置题材' }} · {{ novel.perspective || '未设置视角' }} ·
              {{ novel.tone || '未设置基调' }}
            </small>
          </div>
          <button type="button" class="btn-primary" @click="goNovel(novel.id)">进入</button>
        </li>
      </ul>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { setChromeAnchor } from '../../composables/useChromeAnchor'
import { createNovel, getNovels } from '../../lib/storage'
import type { NewNovelInput, Novel } from '../../types'

const router = useRouter()
const listChromeAnchorRef = ref<HTMLElement | null>(null)
watch(listChromeAnchorRef, (el) => setChromeAnchor(el), { immediate: true })
onUnmounted(() => setChromeAnchor(null))

const novels = ref<Novel[]>(getNovels())
const perspectiveOptions = ['第一人称', '第三人称-限知', '第三人称-全知', '双视角', '多视角']

const form = reactive<NewNovelInput>({
  title: '',
  summary: '',
  genre: '',
  perspective: '',
  tone: '',
  isMultiLineNarrative: false,
})

function resetForm() {
  form.title = ''
  form.summary = ''
  form.genre = ''
  form.perspective = ''
  form.tone = ''
  form.isMultiLineNarrative = false
}

function handleCreate() {
  if (!form.title.trim()) return
  const novel = createNovel(form)
  novels.value = getNovels()
  resetForm()
  void router.push(`/novels/${novel.id}`)
}

function goNovel(id: string) {
  void router.push(`/novels/${id}`)
}
</script>

