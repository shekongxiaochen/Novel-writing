<template>
  <div v-show="visible" class="chapter-hub__outline chapter-hub__outline--console" :class="{ 'chapter-hub__outline--collapsed': collapsed }">
    <div v-if="collapsed" class="chapter-hub__outline-collapsed-bar">
      <span>章节结构</span>
      <button type="button" class="chapter-hub__outline-toggle" @click="emit('toggleCollapse')">
        展开 · Alt+5
      </button>
    </div>

    <template v-else>
      <div class="chapter-hub__outline-head">
      <div>
        <p class="chapter-hub__outline-title">章节结构</p>
        <p class="chapter-hub__outline-subtitle muted">
          {{ linkedOutlineItems.length > 0 ? `当前章节已承载 ${linkedOutlineItems.length} 个情节点` : '当前章节还没有落地任何情节点' }}
        </p>
      </div>
      <RouterLink class="chapter-hub__outline-workspace" :to="{ path: workspaceLink, query: { tab: 'outline' } }">
        回到大纲
      </RouterLink>
      <button type="button" class="chapter-hub__outline-toggle" @click="emit('toggleCollapse')">
        收起结构 · Alt+5
      </button>
    </div>

    <div v-if="outlineItems.length > 0" class="chapter-hub__outline-grid">
      <article
        v-for="o in linkedOutlineItems"
        :key="`linked-${o.id}`"
        class="chapter-hub__outline-card chapter-hub__outline-card--linked"
      >
        <div class="chapter-hub__outline-card-head">
          <span>#{{ o.order }} · {{ outlineLevelText(o.level) }}</span>
          <strong>{{ o.title }}</strong>
          <button type="button" @click="emit('toggleOutlineItem', o.id)">解除</button>
        </div>
        <p v-if="o.summary" class="chapter-hub__outline-card-summary">{{ o.summary }}</p>
        <div class="chapter-hub__outline-card-lines">
          <span>{{ storylineNames(o) }}</span>
          <span>{{ o.timeLabel || '未设时间' }} / {{ o.location || '未设地点' }}</span>
          <span>{{ outlineStatusText(o.status) }} · {{ plotStageText(o.plotStage) }}</span>
        </div>
        <div class="chapter-hub__outline-card-plot">
          <span v-if="o.goal">目标：{{ o.goal }}</span>
          <span v-if="o.conflict">冲突：{{ o.conflict }}</span>
          <span v-if="o.suspense">悬念：{{ o.suspense }}</span>
        </div>
        <RouterLink
          class="chapter-hub__outline-card-link"
          :to="{ path: workspaceLink, query: { tab: 'outline', focusOutlineId: o.id } }"
        >
          在大纲中打开
        </RouterLink>
      </article>

      <details class="chapter-hub__outline-more" :open="linkedOutlineItems.length === 0">
        <summary>可关联情节点（{{ unlinkedOutlineItems.length }}）</summary>
        <div class="chapter-hub__outline-pick-list">
          <button
            v-for="o in unlinkedOutlineItems"
            :key="`unlinked-${o.id}`"
            type="button"
            class="chapter-hub__outline-pick"
            @click="emit('toggleOutlineItem', o.id)"
          >
            <span>#{{ o.order }} · {{ outlineLevelText(o.level) }}</span>
            <strong>{{ o.title }}</strong>
            <small>{{ storylineNames(o) }} · {{ o.summary || '无摘要' }}</small>
          </button>
        </div>
      </details>
    </div>
    <p v-else class="chapter-hub__outline-empty muted">暂无节点，请在工作台大纲中添加。</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Chapter, OutlineItem, OutlineNodeLevel, OutlinePlotStage, OutlineStatus, OutlineStoryline } from '../../../types'

const props = defineProps<{
  chapter: Chapter
  outlineItems: OutlineItem[]
  outlineStorylines: OutlineStoryline[]
  collapsed: boolean
  visible: boolean
  workspaceLink: string
}>()

const emit = defineEmits<{
  toggleOutlineItem: [outlineId: string]
  toggleCollapse: []
}>()

const linkedOutlineItems = computed(() =>
  props.outlineItems.filter((o) => (props.chapter.outlineItemIds ?? []).includes(o.id)),
)

const unlinkedOutlineItems = computed(() =>
  props.outlineItems.filter((o) => !(props.chapter.outlineItemIds ?? []).includes(o.id)),
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
</script>
