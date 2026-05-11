<template>
  <aside class="outline-map-inspector outline-map-inspector--simple">
    <template v-if="item">
      <header class="outline-map-inspector__head">
        <span class="outline-map-inspector__eyebrow">情节点 #{{ item.order }}</span>
        <h3>{{ item.title || '未命名情节点' }}</h3>
        <p class="muted">{{ outlineStatusText(item.status) }} · 已绑定 {{ linkedChapters.length }} 章</p>
      </header>

      <div class="outline-map-inspector__actions outline-map-inspector__actions--simple">
        <button type="button" class="btn-secondary" @click="emit('cycleStatus', item.id)">状态：{{ outlineStatusText(item.status) }}</button>
        <button type="button" class="outline-map-inspector__danger" @click="emit('deleteNode', item.id)">删除</button>
      </div>

      <div class="outline-map-inspector__fields">
        <label>
          <span>标题</span>
          <input :value="item.title" maxlength="80" @change="onTextFieldChange('title', $event)" />
        </label>

        <label>
          <span>目标</span>
          <input :value="item.goal ?? ''" maxlength="120" @change="onTextFieldChange('goal', $event)" />
        </label>

        <label>
          <span>简介</span>
          <textarea :value="item.summary" maxlength="240" rows="4" @change="onTextFieldChange('summary', $event)" />
        </label>

        <section class="outline-map-inspector__binding-card">
          <span class="outline-map-inspector__label">章节绑定</span>
          <div class="outline-map-inspector__grid outline-map-inspector__grid--binding">
            <div class="outline-map-chapter-picker" :class="{ 'is-open': startDropdownOpen, 'is-upward': startDropdownDirection === 'up' }">
              <span class="outline-map-chapter-picker__label">开始章节</span>
              <button ref="startTriggerRef" type="button" class="outline-map-chapter-picker__trigger" @click="toggleStartDropdown">
                <span>{{ selectedStartLabel }}</span>
                <span class="outline-map-chapter-picker__chevron">⌄</span>
              </button>
              <div v-if="startDropdownOpen" class="outline-map-chapter-picker__panel">
                <input v-model="startSearch" class="outline-map-chapter-picker__search" placeholder="搜索章节" @keydown.stop />
                <button type="button" class="outline-map-chapter-picker__option" :class="{ 'is-active': assocStart === '' }" @click="selectStart('')">不设置</button>
                <button
                  v-for="chapter in filteredStartChapters"
                  :key="`start-${item.id}-${chapter.id}`"
                  type="button"
                  class="outline-map-chapter-picker__option"
                  :class="{ 'is-active': assocStart === String(chapter.chapterNo) }"
                  @click="selectStart(String(chapter.chapterNo))"
                >
                  {{ chapterDisplayLabel(chapter) }}
                </button>
                <p v-if="filteredStartChapters.length === 0" class="outline-map-chapter-picker__empty">没有符合条件的章节</p>
              </div>
            </div>
            <div class="outline-map-chapter-picker" :class="{ 'is-open': endDropdownOpen, 'is-upward': endDropdownDirection === 'up' }">
              <span class="outline-map-chapter-picker__label">结束章节</span>
              <button ref="endTriggerRef" type="button" class="outline-map-chapter-picker__trigger" @click="toggleEndDropdown">
                <span>{{ selectedEndLabel }}</span>
                <span class="outline-map-chapter-picker__chevron">⌄</span>
              </button>
              <div v-if="endDropdownOpen" class="outline-map-chapter-picker__panel">
                <input v-model="endSearch" class="outline-map-chapter-picker__search" placeholder="搜索章节" @keydown.stop />
                <button type="button" class="outline-map-chapter-picker__option" :class="{ 'is-active': assocEnd === '' }" @click="selectEnd('')">不设置</button>
                <button
                  v-for="chapter in filteredEndChapters"
                  :key="`end-${item.id}-${chapter.id}`"
                  type="button"
                  class="outline-map-chapter-picker__option"
                  :class="{ 'is-active': assocEnd === String(chapter.chapterNo) }"
                  @click="selectEnd(String(chapter.chapterNo))"
                >
                  {{ chapterDisplayLabel(chapter) }}
                </button>
                <p v-if="filteredEndChapters.length === 0" class="outline-map-chapter-picker__empty">没有符合条件的章节</p>
              </div>
            </div>
          </div>
          <div class="outline-map-inspector__binding-actions">
            <button type="button" class="btn-secondary" :disabled="!assocDirty" @click="emit('cancelAssoc', item.id)">取消</button>
            <button type="button" class="btn-primary" :disabled="!assocDirty" @click="emit('applyAssoc', item.id)">确认绑定</button>
          </div>
        </section>

        <section>
          <span class="outline-map-inspector__label">已绑定章节（{{ linkedChapters.length }}）</span>
          <div v-if="linkedChapters.length > 0" class="outline-map-inspector__chapter-list">
            <button
              v-for="chapter in linkedChapters"
              :key="`ins-ch-${item.id}-${chapter.id}`"
              type="button"
              class="outline-map-inspector__chapter-btn"
              @click="emit('jumpChapter', chapter.id)"
            >
              {{ chapterDisplayLabel(chapter) }}
            </button>
          </div>
          <p v-else class="muted">尚未绑定章节。</p>
        </section>
      </div>
    </template>

    <div v-else class="outline-map-inspector__empty muted">
      <h3>选择一个节点</h3>
      <p>在左侧思维导图点击情节点后，可编辑标题、状态、目标、简介与章节绑定。</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Chapter, OutlineItem, OutlineStatus } from '../../../../types'

const props = defineProps<{
  item: OutlineItem | null
  chapters: Chapter[]
  linkedChapters: Chapter[]
  assocStart: string
  assocEnd: string
  assocDirty: boolean
}>()

const emit = defineEmits<{
  patch: [outlineId: string, patch: Partial<OutlineItem>]
  cycleStatus: [outlineId: string]
  deleteNode: [outlineId: string]
  jumpChapter: [chapterId: string]
  setAssocStart: [outlineId: string, value: string]
  setAssocEnd: [outlineId: string, value: string]
  applyAssoc: [outlineId: string]
  cancelAssoc: [outlineId: string]
}>()

const startDropdownOpen = ref(false)
const endDropdownOpen = ref(false)
const startSearch = ref('')
const endSearch = ref('')
const startTriggerRef = ref<HTMLButtonElement | null>(null)
const endTriggerRef = ref<HTMLButtonElement | null>(null)
const startDropdownDirection = ref<'up' | 'down'>('down')
const endDropdownDirection = ref<'up' | 'down'>('down')

const startChapterNo = computed(() => Number(props.assocStart || 0))
const endChapterNo = computed(() => Number(props.assocEnd || 0))

const selectedStartLabel = computed(() => selectedChapterLabel(props.assocStart))
const selectedEndLabel = computed(() => selectedChapterLabel(props.assocEnd))

const filteredStartChapters = computed(() => {
  const q = startSearch.value.trim().toLowerCase()
  return props.chapters.filter((chapter) => {
    if (endChapterNo.value > 0 && chapter.chapterNo >= endChapterNo.value) return false
    return chapterMatchesQuery(chapter, q)
  })
})

const filteredEndChapters = computed(() => {
  const q = endSearch.value.trim().toLowerCase()
  return props.chapters.filter((chapter) => {
    if (startChapterNo.value > 0 && chapter.chapterNo <= startChapterNo.value) return false
    return chapterMatchesQuery(chapter, q)
  })
})

watch(() => props.item?.id, () => {
  startDropdownOpen.value = false
  endDropdownOpen.value = false
  startSearch.value = ''
  endSearch.value = ''
  startDropdownDirection.value = 'down'
  endDropdownDirection.value = 'down'
})

function onTextFieldChange(
  field: 'title' | 'summary' | 'goal',
  event: Event,
): void {
  if (!props.item) return
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | null
  const value = target?.value ?? ''
  emit('patch', props.item.id, { [field]: value } as Partial<OutlineItem>)
}

function toggleStartDropdown(): void {
  const willOpen = !startDropdownOpen.value
  startDropdownOpen.value = willOpen
  endDropdownOpen.value = false
  if (willOpen) {
    startSearch.value = ''
    startDropdownDirection.value = resolveDropdownDirection(startTriggerRef.value)
  }
}

function toggleEndDropdown(): void {
  const willOpen = !endDropdownOpen.value
  endDropdownOpen.value = willOpen
  startDropdownOpen.value = false
  if (willOpen) {
    endSearch.value = ''
    endDropdownDirection.value = resolveDropdownDirection(endTriggerRef.value)
  }
}

function selectStart(value: string): void {
  if (!props.item) return
  emit('setAssocStart', props.item.id, value)
  startDropdownOpen.value = false
  startSearch.value = ''
}

function selectEnd(value: string): void {
  if (!props.item) return
  emit('setAssocEnd', props.item.id, value)
  endDropdownOpen.value = false
  endSearch.value = ''
}

function resolveDropdownDirection(trigger: HTMLElement | null): 'up' | 'down' {
  if (!trigger || typeof window === 'undefined') return 'down'
  const rect = trigger.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  const expectedPanelHeight = Math.min(260, 48 + Math.max(props.chapters.length, 1) * 36)
  return spaceBelow < expectedPanelHeight && spaceAbove > spaceBelow ? 'up' : 'down'
}

function selectedChapterLabel(value: string): string {
  if (!value) return '不设置'
  const chapter = props.chapters.find((item) => String(item.chapterNo) === value)
  return chapter ? chapterDisplayLabel(chapter) : `第 ${value} 章`
}

function chapterMatchesQuery(chapter: Chapter, query: string): boolean {
  if (!query) return true
  return chapterDisplayLabel(chapter).toLowerCase().includes(query)
}

function chapterDisplayLabel(chapter: Chapter): string {
  return `第 ${chapter.chapterNo} 章${chapter.title ? ` · ${chapter.title}` : ''}`
}

function outlineStatusText(status: OutlineStatus): string {
  if (status === 'doing') return '进行中'
  if (status === 'done') return '已完成'
  return '待写'
}
</script>
