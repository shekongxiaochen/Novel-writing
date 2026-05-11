<template>
  <div
    v-show="visible"
    class="chapter-hub__outline chapter-hub__outline--console chapter-hub__outline--mind-map"
    :class="{ 'chapter-hub__outline--collapsed': collapsed }"
  >
    <div class="chapter-hub__outline-head chapter-hub__outline-head--map">
      <div class="chapter-hub__outline-heading">
        <p class="chapter-hub__outline-title">章节导图映射</p>
        <p class="chapter-hub__outline-subtitle muted">{{ subtitle }}</p>
      </div>
      <div class="chapter-hub__outline-map-metrics" aria-label="章节导图映射统计">
        <span :class="{ 'is-empty': linkedOutlineCount === 0 }">本章 {{ linkedOutlineCount }}</span>
        <span>全部 {{ outlineItems.length }}</span>
      </div>
      <div class="chapter-hub__outline-actions">
        <RouterLink class="chapter-hub__outline-workspace" :to="{ path: workspaceLink, query: { tab: 'outline' } }">
          完整导图
        </RouterLink>
        <button type="button" class="chapter-hub__outline-toggle" @click="emit('toggleCollapse')">
          收起
        </button>
      </div>
    </div>

    <div v-if="collapsed" class="chapter-hub__outline-collapsed-bar">
      <span>章节导图映射</span>
      <button type="button" class="chapter-hub__outline-toggle" @click="emit('toggleCollapse')">
        展开
      </button>
    </div>

    <div v-else class="chapter-hub__outline-map-body">
      <div class="chapter-hub__outline-map-rail">
        <span class="chapter-hub__outline-map-rail-kicker">Plot Cartography</span>
        <strong v-if="activeOutlineItem">#{{ activeOutlineItem.order }} {{ activeOutlineItem.title || '未命名情节点' }}</strong>
        <span v-else>钉下第一张情节卡，让本章进入航图。</span>
        <div class="chapter-hub__outline-map-shortcuts" aria-label="章节导图快捷操作">
          <span>拖动移图</span>
          <span>滚轮缩放</span>
          <span>Tab 子节点</span>
          <span>Enter 同级</span>
        </div>
      </div>

      <div class="chapter-hub__outline-map-stage">
        <OutlineMindMapCanvas
          :nodes="mapNodes"
          :edges="mapEdges"
          :scene-width="mapSceneWidth"
          :scene-height="mapSceneHeight"
          :active-outline-id="activeOutlineId"
          :linked-outline-ids="chapter.outlineItemIds"
          mode="chapter"
          @select-node="activeOutlineId = $event"
          @toggle-link="emit('toggleOutlineItem', $event)"
          @create-child="emit('createOutlineNode', 'child', $event)"
          @create-sibling="emit('createOutlineNode', 'sibling', $event)"
          @create-root="emit('createOutlineNode', 'root')"
        />

        <div v-if="outlineItems.length === 0" class="chapter-hub__outline-map-empty muted">
          <strong>暂无情节点</strong>
          <span>先新建一个根节点，再把它关联到本章。</span>
          <button type="button" class="btn-primary" @click="emit('createOutlineNode', 'root')">新增根节点</button>
        </div>

        <div v-if="activeOutlineItem" class="chapter-hub__outline-focus-card chapter-hub__outline-focus-card--map">
          <span class="chapter-hub__outline-focus-label">当前情节点</span>
          <strong>#{{ activeOutlineItem.order }} {{ activeOutlineItem.title || '未命名情节点' }}</strong>
          <p class="muted">{{ activeOutlineItem.summary || '该节点暂无摘要。' }}</p>
          <div class="chapter-hub__outline-focus-actions">
            <button
              type="button"
              class="chapter-hub__outline-focus-toggle"
              :class="activeOutlineLinked ? 'btn-primary' : 'btn-secondary'"
              @click="emit('toggleOutlineItem', activeOutlineItem.id)"
            >
              {{ activeOutlineLinked ? '解除本章关联' : '关联到本章' }}
            </button>
            <RouterLink class="chapter-hub__outline-card-link" :to="{ path: workspaceLink, query: { tab: 'outline', focusOutlineId: activeOutlineItem.id } }">
              在工作台打开
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { Chapter, OutlineItem, OutlineStoryline } from '../../../types'
import { useOutlineMindMapLayout } from '../../../features/outline-map/composables/useOutlineMindMapLayout'
import { useOutlineChapterMapping } from '../../../features/outline-map/composables/useOutlineChapterMapping'
import OutlineMindMapCanvas from '../../workspace/components/outline-map/OutlineMindMapCanvas.vue'

const props = defineProps<{
  chapter: Chapter
  outlineItems: OutlineItem[]
  outlineStorylines: OutlineStoryline[]
  collapsed: boolean
  visible: boolean
  workspaceLink: string
  chapters: Chapter[]
  focusOutlineId?: string
}>()

const emit = defineEmits<{
  toggleOutlineItem: [outlineId: string]
  toggleCollapse: []
  createOutlineNode: [action: 'child' | 'sibling' | 'root', anchorId?: string]
}>()

const activeOutlineId = ref('')

const {
  linkedChapterCountByOutlineId,
  activeChapterLinkedOutlineIdSet,
} = useOutlineChapterMapping({
  chapters: computed(() => props.chapters),
  activeChapterId: computed(() => props.chapter.id),
})

const {
  nodes: mapNodes,
  edges: mapEdges,
  sceneWidth: mapSceneWidth,
  sceneHeight: mapSceneHeight,
} = useOutlineMindMapLayout({
  outlineItems: computed(() => props.outlineItems),
  linkedChapterCountByOutlineId,
  activeChapterLinkedOutlineIdSet,
})

const activeOutlineItem = computed(() =>
  props.outlineItems.find((item) => item.id === activeOutlineId.value) ?? null,
)

const activeOutlineLinked = computed(() => {
  const activeId = activeOutlineItem.value?.id
  if (!activeId) return false
  return (props.chapter.outlineItemIds ?? []).includes(activeId)
})

const linkedOutlineCount = computed(() => props.chapter.outlineItemIds.length)

const subtitle = computed(() => {
  const linkedCount = props.chapter.outlineItemIds.length
  if (linkedCount === 0) return '本章尚未承载情节点，建议先关联 1 个主节点。'
  return `本章已承载 ${linkedCount} 个情节点，可继续补充或解除映射。`
})

watch(
  () => [props.focusOutlineId ?? '', props.chapter.id, props.outlineItems.length],
  () => {
    if (!props.outlineItems.length) {
      activeOutlineId.value = ''
      return
    }

    const focusId = String(props.focusOutlineId ?? '').trim()
    if (focusId && props.outlineItems.some((item) => item.id === focusId)) {
      activeOutlineId.value = focusId
      return
    }

    if (!props.outlineItems.some((item) => item.id === activeOutlineId.value)) {
      const firstLinked = props.outlineItems.find((item) => (props.chapter.outlineItemIds ?? []).includes(item.id))
      activeOutlineId.value = firstLinked?.id ?? props.outlineItems[0].id
    }
  },
  { immediate: true },
)
</script>
