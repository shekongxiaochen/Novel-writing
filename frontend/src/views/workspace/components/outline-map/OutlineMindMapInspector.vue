<template>
  <aside class="outline-map-inspector outline-map-inspector--simple">
    <template v-if="item">
      <header class="outline-map-inspector__head">
        <span class="outline-map-inspector__eyebrow">情节点 #{{ item.order }} · {{ outlineLevelText(item.level) }}</span>
        <h3>{{ item.title || '未命名情节点' }}</h3>
        <p class="muted">{{ outlineStatusText(item.status) }} · 已绑定 {{ linkedChapters.length }} 章</p>
      </header>

      <div class="outline-map-inspector__actions outline-map-inspector__actions--simple">
        <button type="button" class="btn-secondary" @click="emit('aiExpand', item.id)">AI 扩展</button>
        <button type="button" class="btn-secondary" @click="emit('cycleStatus', item.id)">状态：{{ outlineStatusText(item.status) }}</button>
        <button type="button" class="outline-map-inspector__danger" @click="emit('deleteNode', item.id)">删除</button>
      </div>

      <div class="outline-map-inspector__fields">
        <label>
          <span>标题</span>
          <input :value="item.title" maxlength="80" @change="onTextFieldChange('title', $event)" />
        </label>

        <label>
          <span>简介</span>
          <textarea
            :value="item.summary"
            maxlength="240"
            rows="4"
            placeholder="一句话说明这段情节发生什么"
            @change="onTextFieldChange('summary', $event)"
          />
        </label>

        <label v-if="showGoalField">
          <span>{{ goalFieldLabel }}</span>
          <input
            :value="item.goal ?? ''"
            maxlength="120"
            :placeholder="goalPlaceholder"
            @change="onTextFieldChange('goal', $event)"
          />
        </label>

        <details v-if="showBeatToggle" class="oi-section">
          <summary class="oi-section__summary">
            <span class="oi-section__title">节拍细节</span>
            <span v-if="item && hasBeatContent(item)" class="oi-section__badge">已填</span>
            <span class="oi-section__chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="oi-section__body">
            <p class="muted outline-map-inspector__beat-hint">冲突、转折等可留空；需要 AI 续写时再补全即可。</p>
            <div class="outline-map-inspector__grid outline-map-inspector__grid--beats">
              <label>
                <span>冲突</span>
                <input :value="item.conflict ?? ''" maxlength="120" @change="onTextFieldChange('conflict', $event)" />
              </label>
              <label>
                <span>转折</span>
                <input :value="item.twist ?? ''" maxlength="120" @change="onTextFieldChange('twist', $event)" />
              </label>
              <label>
                <span>结果</span>
                <input :value="item.result ?? ''" maxlength="120" @change="onTextFieldChange('result', $event)" />
              </label>
              <label>
                <span>悬念</span>
                <input :value="item.suspense ?? ''" maxlength="120" @change="onTextFieldChange('suspense', $event)" />
              </label>
              <label v-if="isSceneLevel">
                <span>情绪转折</span>
                <input :value="item.emotionalTurn ?? ''" maxlength="120" @change="onTextFieldChange('emotionalTurn', $event)" />
              </label>
              <label v-if="isSceneLevel">
                <span>写作提示</span>
                <input :value="item.proseHint ?? ''" maxlength="120" @change="onTextFieldChange('proseHint', $event)" />
              </label>
              <label v-if="isSceneLevel">
                <span>张力</span>
                <select :value="String(item.tension ?? 3)" @change="onTensionChange($event)">
                  <option value="1">1 · 低潮</option>
                  <option value="2">2 · 铺垫</option>
                  <option value="3">3 · 推进</option>
                  <option value="4">4 · 紧张</option>
                  <option value="5">5 · 爆点</option>
                </select>
              </label>
            </div>
          </div>
        </details>

        <details v-if="storylines.length > 0" class="oi-section">
          <summary class="oi-section__summary">
            <span class="oi-section__title">故事线</span>
            <span v-if="activeStorylineCount > 0" class="oi-section__badge">{{ activeStorylineCount }}</span>
            <span class="oi-section__chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="oi-section__body">
            <div class="outline-map-inspector__storyline-chips">
              <button
                v-for="storyline in storylines"
                :key="storyline.id"
                type="button"
                class="outline-map-inspector__storyline-chip"
                :class="{ 'is-active': isStorylineActive(storyline.id) }"
                :style="{ '--storyline-color': storyline.color }"
                @click="toggleStoryline(storyline.id)"
              >
                {{ storyline.name }}
              </button>
            </div>
          </div>
        </details>

        <details class="oi-section">
          <summary class="oi-section__summary">
            <span class="oi-section__title">章节绑定</span>
            <span v-if="assocStart || assocEnd" class="oi-section__badge">已设</span>
            <span class="oi-section__chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="oi-section__body">
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
          </div>
        </details>

        <details class="oi-section">
          <summary class="oi-section__summary">
            <span class="oi-section__title">已绑定章节</span>
            <span v-if="linkedChapters.length > 0" class="oi-section__badge">{{ linkedChapters.length }}</span>
            <span class="oi-section__chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="oi-section__body">
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
          </div>
        </details>
      </div>
    </template>

    <div v-else class="outline-map-inspector__empty muted">
      <h3>选择一个节点</h3>
      <p>点选左侧节点即可编辑标题、简介与章节绑定；节拍与故事线为可选项。</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Chapter, OutlineItem, OutlineNodeLevel, OutlineStatus, OutlineStoryline, OutlineTension } from '../../../../types'

const props = defineProps<{
  item: OutlineItem | null
  chapters: Chapter[]
  linkedChapters: Chapter[]
  storylines: OutlineStoryline[]
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
  aiExpand: [outlineId: string]
}>()

const startDropdownOpen = ref(false)
const endDropdownOpen = ref(false)
const startSearch = ref('')
const endSearch = ref('')
const startTriggerRef = ref<HTMLButtonElement | null>(null)
const endTriggerRef = ref<HTMLButtonElement | null>(null)
const startDropdownDirection = ref<'up' | 'down'>('down')
const endDropdownDirection = ref<'up' | 'down'>('down')

const isSceneLevel = computed(() => (props.item?.level ?? 'scene') === 'scene')
const showGoalField = computed(() => {
  const level = props.item?.level ?? 'scene'
  return level === 'chapter' || level === 'scene'
})
const showBeatToggle = computed(() => {
  const level = props.item?.level ?? 'scene'
  return level === 'chapter' || level === 'scene'
})

const goalFieldLabel = computed(() => (isSceneLevel.value ? '本场目标' : '本章目标'))
const goalPlaceholder = computed(() =>
  isSceneLevel.value ? '可选：这场戏要达成什么' : '可选：读者读完本章应知道什么',
)

function hasBeatContent(item: OutlineItem): boolean {
  return Boolean(
    String(item.conflict ?? '').trim() ||
      String(item.twist ?? '').trim() ||
      String(item.result ?? '').trim() ||
      String(item.suspense ?? '').trim() ||
      String(item.emotionalTurn ?? '').trim() ||
      String(item.proseHint ?? '').trim() ||
      (typeof item.tension === 'number' && item.tension !== 3),
  )
}

const activeStorylineCount = computed(() => (props.item?.storylineIds ?? []).length)

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

watch(
  () => props.item?.id,
  () => {
    startDropdownOpen.value = false
    endDropdownOpen.value = false
    startSearch.value = ''
    endSearch.value = ''
    startDropdownDirection.value = 'down'
    endDropdownDirection.value = 'down'
  },
  { immediate: true },
)

type TextField =
  | 'title'
  | 'summary'
  | 'goal'
  | 'conflict'
  | 'twist'
  | 'result'
  | 'suspense'
  | 'emotionalTurn'
  | 'proseHint'

function onTextFieldChange(field: TextField, event: Event): void {
  if (!props.item) return
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | null
  const value = target?.value ?? ''
  emit('patch', props.item.id, { [field]: value } as Partial<OutlineItem>)
}

function onTensionChange(event: Event): void {
  if (!props.item) return
  const target = event.target as HTMLSelectElement | null
  const raw = Number(target?.value ?? 3)
  const tension = (raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5 ? raw : 3) as OutlineTension
  emit('patch', props.item.id, { tension })
}

function isStorylineActive(storylineId: string): boolean {
  return (props.item?.storylineIds ?? []).includes(storylineId)
}

function toggleStoryline(storylineId: string): void {
  if (!props.item) return
  const set = new Set(props.item.storylineIds ?? [])
  if (set.has(storylineId)) set.delete(storylineId)
  else set.add(storylineId)
  emit('patch', props.item.id, { storylineIds: Array.from(set) })
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

function outlineLevelText(level?: OutlineNodeLevel): string {
  if (level === 'volume') return '卷'
  if (level === 'act') return '幕'
  if (level === 'chapter') return '章'
  return '场景'
}
</script>

<style scoped>
.oi-section {
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-surface-muted) 22%, transparent);
}
.oi-section:not([open]) {
  overflow: hidden;
}
.oi-section + .oi-section {
  margin-top: 2px;
}
.oi-section__summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.oi-section__summary::-webkit-details-marker {
  display: none;
}
.oi-section__title {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text);
}
.oi-section__badge {
  font-size: 0.66rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
}
.oi-section__chevron {
  margin-left: auto;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  transition: transform 0.16s ease;
}
.oi-section[open] .oi-section__chevron {
  transform: rotate(180deg);
}
.oi-section__body {
  display: grid;
  gap: 8px;
  padding: 0 12px 12px;
}

.outline-map-inspector__beat-hint {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
}

.outline-map-inspector__grid--beats {
  display: grid;
  gap: 0.5rem;
}

.outline-map-inspector__storyline-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.outline-map-inspector__storyline-chip {
  border: 1px solid color-mix(in srgb, var(--storyline-color, #64748b) 55%, transparent);
  background: color-mix(in srgb, var(--storyline-color, #64748b) 12%, transparent);
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.78rem;
  cursor: pointer;
}

.outline-map-inspector__storyline-chip.is-active {
  background: color-mix(in srgb, var(--storyline-color, #64748b) 28%, transparent);
  font-weight: 600;
}
</style>
