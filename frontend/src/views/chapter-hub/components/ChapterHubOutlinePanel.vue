<template>
  <div v-show="visible" class="chapter-hub__outline chapter-hub__outline--console" :class="{ 'chapter-hub__outline--collapsed': collapsed }">
    <div class="chapter-hub__outline-head">
      <div>
        <p class="chapter-hub__outline-title">章节结构</p>
        <p class="chapter-hub__outline-subtitle muted">{{ guideSubtitle }}</p>
      </div>
      <div class="chapter-hub__outline-actions">
        <button type="button" class="chapter-hub__outline-mode" @click="emit('toggleGuidedMode')">
          {{ guidedMode ? '关闭引导' : '开启引导' }}
        </button>
        <RouterLink class="chapter-hub__outline-workspace" :to="{ path: workspaceLink, query: { tab: 'outline' } }">
          完整大纲
        </RouterLink>
        <button type="button" class="chapter-hub__outline-toggle" @click="emit('toggleCollapse')">
          收起
        </button>
      </div>
    </div>

    <div v-if="collapsed" class="chapter-hub__outline-collapsed-bar">
      <span>章节结构</span>
      <button type="button" class="chapter-hub__outline-toggle" @click="emit('toggleCollapse')">
        展开结构
      </button>
    </div>

    <template v-else>
      <section v-if="guidedMode && activeGuideStep" class="chapter-hub__outline-guide" aria-label="大纲填写引导">
        <div class="chapter-hub__outline-guide-main">
          <span>下一步</span>
          <strong>{{ activeGuideStep.label }}</strong>
          <p>{{ activeGuideStep.description }}</p>
        </div>
        <div class="chapter-hub__outline-guide-actions">
          <RouterLink
            v-if="activeGuideStep.key === 'link' && outlineItems.length === 0"
            class="chapter-hub__outline-guide-primary"
            :to="{ path: workspaceLink, query: { tab: 'outline' } }"
          >
            去添加情节点
          </RouterLink>
          <RouterLink
            v-else-if="activeGuideStep.key === 'details' && guideTargetOutlineItem"
            class="chapter-hub__outline-guide-primary"
            :to="{ path: workspaceLink, query: { tab: 'outline', focusOutlineId: guideTargetOutlineItem.id } }"
          >
            补关键要素
          </RouterLink>
          <button v-else type="button" class="chapter-hub__outline-guide-primary" @click="handleGuidePrimaryAction">
            {{ guideActionText }}
          </button>
        </div>
        <ol class="chapter-hub__outline-guide-steps">
          <li
            v-for="(step, index) in guideSteps"
            :key="step.key"
            :class="{
              'is-done': step.done,
              'is-current': index === safeCurrentStepIndex,
            }"
          >
            <span>{{ index + 1 }}</span>
            <small>{{ step.label }}</small>
          </li>
        </ol>
      </section>

      <div v-if="outlineItems.length > 0" class="chapter-hub__outline-grid">
        <article
          v-for="o in linkedOutlineItems"
          :key="`linked-${o.id}`"
          class="chapter-hub__outline-card chapter-hub__outline-card--linked"
        >
          <div class="chapter-hub__outline-card-head">
            <span class="chapter-hub__outline-card-kicker">#{{ o.order }} · {{ outlineLevelText(o.level) }}</span>
            <strong>{{ o.title }}</strong>
            <span class="chapter-hub__outline-status" :class="`chapter-hub__outline-status--${o.status}`">
              {{ outlineStatusText(o.status) }}
            </span>
            <button type="button" @click="emit('toggleOutlineItem', o.id)">解除</button>
          </div>

          <p class="chapter-hub__outline-card-summary" :class="{ 'is-empty': !o.summary }">
            {{ o.summary || '还没有一句话摘要。先写清“这一节点发生什么”。' }}
          </p>

          <div class="chapter-hub__outline-card-focus">
            <span>{{ outlineCompletionText(o) }}</span>
            <RouterLink
              class="chapter-hub__outline-card-link"
              :to="{ path: workspaceLink, query: { tab: 'outline', focusOutlineId: o.id } }"
            >
              补全
            </RouterLink>
          </div>

          <details class="chapter-hub__outline-card-details" :open="isDetailsOpen(o.id)" @toggle="onDetailsToggle(o.id, $event)">
            <summary>时间、地点、冲突等细节</summary>
            <div class="chapter-hub__outline-card-lines">
              <span>{{ storylineNames(o) }}</span>
              <span>{{ o.timeLabel || '未设时间' }} / {{ o.location || '未设地点' }}</span>
              <span>{{ plotStageText(o.plotStage) }}</span>
            </div>
            <div class="chapter-hub__outline-card-plot">
              <span>目标：{{ o.goal || '未填写' }}</span>
              <span>冲突：{{ o.conflict || '未填写' }}</span>
              <span>悬念：{{ o.suspense || '未填写' }}</span>
              <span v-if="o.twist">转折：{{ o.twist }}</span>
              <span v-if="o.result">结果：{{ o.result }}</span>
            </div>
          </details>
        </article>

        <article v-if="linkedOutlineItems.length === 0" class="chapter-hub__outline-empty-card">
          <strong>先别急着填一堆字段。</strong>
          <span>从下面选 1 个最贴近本章的情节点，系统会带你继续补关键要素。</span>
        </article>

        <details class="chapter-hub__outline-more" :open="pickerOpen" @toggle="onPickerToggle">
          <summary>选择本章要承载的情节点（{{ unlinkedOutlineItems.length }}）</summary>
          <div v-if="unlinkedOutlineItems.length > 0" class="chapter-hub__outline-pick-list">
            <button
              v-for="o in visibleUnlinkedOutlineItems"
              :key="`unlinked-${o.id}`"
              type="button"
              class="chapter-hub__outline-pick"
              @click="emit('toggleOutlineItem', o.id)"
            >
              <span>#{{ o.order }} · {{ outlineLevelText(o.level) }}</span>
              <strong>{{ o.title }}</strong>
              <small>{{ o.summary || '暂无摘要，关联后可慢慢补。' }}</small>
            </button>
            <p v-if="hiddenUnlinkedCount > 0" class="chapter-hub__outline-pick-more muted">
              还有 {{ hiddenUnlinkedCount }} 个情节点，可到完整大纲里筛选。
            </p>
          </div>
          <p v-else class="chapter-hub__outline-empty muted">所有情节点都已关联到本章。</p>
        </details>
      </div>
      <p v-else class="chapter-hub__outline-empty muted">暂无情节点。先去完整大纲添加 1 个节点即可，不需要一次填完。</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { Chapter, OutlineItem, OutlineNodeLevel, OutlinePlotStage, OutlineStatus, OutlineStoryline } from '../../../types'

type OutlineGuideStepKey = 'chapter' | 'link' | 'details' | 'write'

type OutlineGuideStep = {
  key: OutlineGuideStepKey
  label: string
  description: string
  done: boolean
}

const props = withDefaults(defineProps<{
  chapter: Chapter
  outlineItems: OutlineItem[]
  outlineStorylines: OutlineStoryline[]
  collapsed: boolean
  visible: boolean
  workspaceLink: string
  guidedMode?: boolean
  guideSteps?: OutlineGuideStep[]
  currentStepIndex?: number
}>(), {
  guidedMode: true,
  guideSteps: () => [],
  currentStepIndex: 0,
})

const emit = defineEmits<{
  toggleOutlineItem: [outlineId: string]
  toggleCollapse: []
  toggleGuidedMode: []
  guideNext: []
}>()

const pickerOpen = ref(false)
const openDetailsByOutlineId = ref<Record<string, boolean>>({})

const linkedOutlineItems = computed(() =>
  props.outlineItems.filter((o) => (props.chapter.outlineItemIds ?? []).includes(o.id)),
)

const unlinkedOutlineItems = computed(() =>
  props.outlineItems.filter((o) => !(props.chapter.outlineItemIds ?? []).includes(o.id)),
)

const visibleUnlinkedOutlineItems = computed(() => (props.guidedMode ? unlinkedOutlineItems.value.slice(0, 6) : unlinkedOutlineItems.value))
const hiddenUnlinkedCount = computed(() => Math.max(0, unlinkedOutlineItems.value.length - visibleUnlinkedOutlineItems.value.length))

const safeCurrentStepIndex = computed(() => {
  if (props.guideSteps.length === 0) return 0
  return Math.max(0, Math.min(props.currentStepIndex, props.guideSteps.length - 1))
})

const activeGuideStep = computed(() => props.guideSteps[safeCurrentStepIndex.value] ?? null)
const guideTargetOutlineItem = computed(() => linkedOutlineItems.value.find(outlineNeedsCoreDetails) ?? linkedOutlineItems.value[0] ?? null)

const guideSubtitle = computed(() => {
  if (linkedOutlineItems.value.length === 0) return '先选 1 个情节点，本章就有方向了'
  const missingCount = linkedOutlineItems.value.filter(outlineNeedsCoreDetails).length
  if (missingCount > 0) return `${linkedOutlineItems.value.length} 个情节点，${missingCount} 个还缺关键要素`
  return `${linkedOutlineItems.value.length} 个情节点已够用，可以开始写正文`
})

const guideActionText = computed(() => {
  if (activeGuideStep.value?.key === 'link') return unlinkedOutlineItems.value.length > 0 ? '选择情节点' : '去添加情节点'
  if (activeGuideStep.value?.key === 'details') return '补关键要素'
  if (activeGuideStep.value?.key === 'write') return '开始写正文'
  return '继续'
})

watch(
  () => props.chapter.id,
  () => {
    openDetailsByOutlineId.value = {}
    pickerOpen.value = linkedOutlineItems.value.length === 0
  },
  { immediate: true },
)

watch(
  () => linkedOutlineItems.value.length,
  (nextLength, previousLength) => {
    if (nextLength === 0) pickerOpen.value = true
    else if (previousLength === 0) pickerOpen.value = false
  },
)

function outlineLevelText(level?: OutlineNodeLevel): string {
  if (level === 'volume') return '卷'
  if (level === 'act') return '幕'
  if (level === 'chapter') return '章'
  return '场景'
}

function outlineStatusText(status: OutlineStatus): string {
  if (status === 'doing') return '进行中'
  if (status === 'done') return '已完成'
  return '待写'
}

function plotStageText(stage?: OutlinePlotStage): string {
  if (stage === 'drafted') return '已成型'
  if (stage === 'written') return '已写入正文'
  if (stage === 'resolved') return '已回收伏笔'
  return '待构思'
}

function storylineNames(item: OutlineItem): string {
  const names = (item.storylineIds ?? [])
    .map((id) => props.outlineStorylines.find((line) => line.id === id)?.name ?? '')
    .filter(Boolean)
  return names.length ? names.join('、') : '未归线'
}

function outlineNeedsCoreDetails(item: OutlineItem): boolean {
  const hasSummary = Boolean(item.summary?.trim())
  const hasDrive = Boolean(item.goal?.trim() || item.conflict?.trim() || item.suspense?.trim())
  return !hasSummary || !hasDrive
}

function outlineCompletionText(item: OutlineItem): string {
  if (!outlineNeedsCoreDetails(item)) return '关键要素已够用'
  const missing: string[] = []
  if (!item.summary?.trim()) missing.push('摘要')
  if (!item.goal?.trim() && !item.conflict?.trim() && !item.suspense?.trim()) missing.push('推动点')
  return `待补：${missing.join('、')}`
}

function isDetailsOpen(outlineId: string): boolean {
  return Boolean(openDetailsByOutlineId.value[outlineId])
}

function onDetailsToggle(outlineId: string, event: Event): void {
  const details = event.currentTarget as HTMLDetailsElement | null
  openDetailsByOutlineId.value = {
    ...openDetailsByOutlineId.value,
    [outlineId]: Boolean(details?.open),
  }
}

function onPickerToggle(event: Event): void {
  const details = event.currentTarget as HTMLDetailsElement | null
  pickerOpen.value = Boolean(details?.open)
}

function handleGuidePrimaryAction(): void {
  if (activeGuideStep.value?.key === 'link') {
    pickerOpen.value = true
    return
  }
  if (activeGuideStep.value?.key === 'details') {
    const target = linkedOutlineItems.value.find(outlineNeedsCoreDetails) ?? linkedOutlineItems.value[0]
    if (target) {
      openDetailsByOutlineId.value = {
        ...openDetailsByOutlineId.value,
        [target.id]: true,
      }
    }
    return
  }
  emit('guideNext')
}
</script>
