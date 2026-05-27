<template>
  <article
    class="outline-map-node"
    :class="[
      `outline-map-node--status-${node.status}`,
      `outline-map-node--level-${node.level ?? 'scene'}`,
      `outline-map-node--stage-${node.plotStage ?? 'idea'}`,
      {
        'is-active': active,
        'is-dimmed': dimmed,
        'is-linked': linkedToActiveChapter,
        'is-chapter': mode === 'chapter',
      },
    ]"
  >
    <button type="button" class="outline-map-node__main" @click="emit('select', node.id)">
      <span class="outline-map-node__kicker">#{{ node.order }} · {{ outlineLevelText(node.level) }}</span>
      <strong>{{ node.title || '未命名情节点' }}</strong>
      <p class="outline-map-node__subtitle">{{ node.subtitle || node.summary || '暂无节拍说明' }}</p>
      <p v-if="node.summary && node.summary !== node.subtitle" class="outline-map-node__summary-muted">{{ node.summary }}</p>
      <div class="outline-map-node__meta">
        <span class="outline-map-node__meta-pill outline-map-node__meta-pill--status">{{ outlineStatusText(node.status) }}</span>
        <span class="outline-map-node__meta-pill outline-map-node__meta-pill--stage">{{ plotStageText(node.plotStage) }}</span>
        <span class="outline-map-node__meta-pill outline-map-node__meta-pill--linked">绑定 {{ node.linkedChapterCount }} 章</span>
      </div>
    </button>

    <button
      type="button"
      class="outline-map-node__add"
      @click.stop="emit('createChild', node.id)"
    >
      ＋ 子节点
    </button>
    <button
      v-if="mode === 'chapter'"
      type="button"
      class="outline-map-node__toggle"
      :class="{ 'is-linked': linkedToActiveChapter }"
      :aria-pressed="linkedToActiveChapter"
      @click.stop="emit('toggleLink', node.id)"
    >
      {{ linkedToActiveChapter ? '解除本章关联' : '关联到本章' }}
    </button>
  </article>
</template>

<script setup lang="ts">
import type { OutlineNodeLevel, OutlinePlotStage, OutlineStatus } from '../../../../types'
import type { OutlineMindMapNodeView } from '../../../../features/outline-map/composables/useOutlineMindMapLayout'

withDefaults(defineProps<{
  node: OutlineMindMapNodeView
  active?: boolean
  dimmed?: boolean
  linkedToActiveChapter?: boolean
  mode?: 'workspace' | 'chapter'
}>(), {
  active: false,
  dimmed: false,
  linkedToActiveChapter: false,
  mode: 'workspace',
})

const emit = defineEmits<{
  select: [outlineId: string]
  createChild: [outlineId: string]
  toggleLink: [outlineId: string]
}>()

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

function plotStageText(stage?: OutlinePlotStage): string {
  if (stage === 'drafted') return '已成型'
  if (stage === 'written') return '已写入正文'
  if (stage === 'resolved') return '已回收伏笔'
  return '待构思'
}
</script>

<style scoped>
.outline-map-node__subtitle {
  margin: 0.2rem 0 0;
}

.outline-map-node__summary-muted {
  margin: 0.15rem 0 0;
  font-size: 0.76rem;
  opacity: 0.72;
  line-height: 1.35;
}

.outline-map-node.is-dimmed {
  opacity: 0.38;
  filter: grayscale(0.15);
}

.outline-map-node.is-dimmed .outline-map-node__main {
  pointer-events: none;
}
</style>
