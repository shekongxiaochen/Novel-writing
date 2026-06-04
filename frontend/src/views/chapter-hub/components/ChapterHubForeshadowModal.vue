<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="open"
        ref="overlayRef"
        class="confirm-overlay"
        role="presentation"
        tabindex="-1"
        @keydown.escape.prevent="requestClose"
      >
        <div class="confirm-dialog chapter-hub__foreshadow-dialog" role="dialog" aria-modal="true">
          <div class="confirm-dialog__accent" aria-hidden="true" />
          <div class="confirm-dialog__body chapter-hub__foreshadow-body">
            <header class="chapter-hub__foreshadow-header">
              <h2 class="confirm-dialog__title">{{ modalTitle }}</h2>
              <p class="chapter-hub__foreshadow-meta muted">
                当前章节：第 {{ chapterNo }} 章 · {{ chapterTitle || '未命名章节' }}
              </p>
            </header>

            <div class="chapter-hub__foreshadow-scroll scrollbar-paper" @click="onForeshadowScrollClick">
              <section v-if="mode === 'plant' || mode === 'fulfill'" class="chapter-hub__foreshadow-block">
                <p class="chapter-hub__foreshadow-label muted">选中文本</p>
                <div class="chapter-hub__foreshadow-quote scrollbar-paper">
                  {{ selectedText || '（无选区）' }}
                </div>
              </section>

              <template v-if="mode === 'plant' || mode === 'edit-plant'">
                <div class="chapter-hub__foreshadow-fields">
                  <div class="form-grid">
                    <label>
                      伏笔标题 *
                      <input v-model="plantTitle" maxlength="60" />
                    </label>
                  </div>

                  <label class="chapter-hub__foreshadow-field">
                    伏笔描述（可选）
                    <textarea v-model="plantDescription" class="chapter-hub__foreshadow-textarea" maxlength="600" rows="3" />
                  </label>
                  <label v-if="mode === 'edit-plant'" class="chapter-hub__foreshadow-field">
                    伏笔原文
                    <textarea v-model="plantText" class="chapter-hub__foreshadow-textarea" maxlength="2000" rows="3" />
                  </label>

                </div>
              </template>

              <template v-else-if="mode === 'fulfill'">
                <div class="chapter-hub__foreshadow-fields">
                  <label class="chapter-hub__foreshadow-field">
                    选择要完成的伏笔 *
                    <div class="workspace-dd chapter-hub__foreshadow-dd">
                      <button
                        ref="fulfillDdBtnRef"
                        type="button"
                        class="workspace-dd__btn workspace-dd__btn--compact"
                        :class="{ 'workspace-dd__btn--open': fulfillPlantDdOpen }"
                        @click.stop="toggleFulfillPlantDd"
                      >
                        <span class="workspace-dd__btn-text">{{ fulfillPlantDdLabel }}</span>
                        <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                      </button>
                    </div>
                  </label>

                  <label class="chapter-hub__foreshadow-field">
                    填坑说明（可选）
                    <textarea v-model="fulfillNotes" class="chapter-hub__foreshadow-textarea" maxlength="600" rows="3" />
                  </label>
                </div>
              </template>
              <template v-else>
                <div class="chapter-hub__foreshadow-fields">
                  <label class="chapter-hub__foreshadow-field">
                    照应文本
                    <textarea v-model="fulfillText" class="chapter-hub__foreshadow-textarea" maxlength="2000" rows="3" />
                  </label>
                  <label class="chapter-hub__foreshadow-field">
                    填坑说明（可选）
                    <textarea v-model="fulfillNotes" class="chapter-hub__foreshadow-textarea" maxlength="600" rows="3" />
                  </label>
                </div>
              </template>
            </div>

            <div class="confirm-dialog__actions chapter-hub__foreshadow-actions">
              <div class="chapter-hub__foreshadow-actions-left">
                <button
                  v-if="mode === 'edit-plant'"
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--ghost chapter-hub__foreshadow-btn-delete"
                  :disabled="!canRemovePlant"
                  @click="requestRemovePlant"
                >
                  删除伏笔
                </button>
                <button
                  v-if="mode === 'edit-fulfill'"
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--ghost chapter-hub__foreshadow-btn-delete"
                  :disabled="!canRemoveFulfill"
                  @click="requestRemoveFulfill"
                >
                  删除照应
                </button>
              </div>
              <div class="chapter-hub__foreshadow-actions-right">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="requestClose">
                  取消
                </button>
                <button
                  v-if="mode === 'plant'"
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--danger"
                  :disabled="!canPlant"
                  :title="!canPlant ? '请先选中文本并填写标题' : undefined"
                  @click="doPlantWithFeedback"
                >
                  确认
                </button>
                <button
                  v-else-if="mode === 'fulfill'"
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--danger"
                  :disabled="!canFulfill"
                  :title="!canFulfill ? '请选择一个伏笔' : undefined"
                  @click="doFulfillWithFeedback"
                >
                  标记完成
                </button>
                <button
                  v-else-if="mode === 'edit-plant'"
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--danger"
                  :disabled="!canEditPlant"
                  @click="doEditPlantWithFeedback"
                >
                  保存修改
                </button>
                <button
                  v-else
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--danger"
                  :disabled="!canEditFulfill"
                  @click="doEditFulfillWithFeedback"
                >
                  保存修改
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <ConfirmDialog
    v-model="cancelConfirmOpen"
    title="确认取消"
    message="你有未保存的修改，确定取消吗？"
    confirm-label="确定取消"
    cancel-label="继续编辑"
    danger
    @confirm="confirmCancelClose"
  />

  <ConfirmDialog
    v-model="removePlantConfirmOpen"
    title="删除伏笔"
    message="确定删除该伏笔吗？该伏笔下的所有照应也会一并删除。"
    confirm-label="删除"
    cancel-label="取消"
    danger
    @confirm="confirmRemovePlant"
  />

  <ConfirmDialog
    v-model="removeFulfillConfirmOpen"
    title="删除照应"
    message="确定删除这条照应吗？删除后该区域将不再标记为照应。"
    confirm-label="删除"
    cancel-label="取消"
    danger
    @confirm="confirmRemoveFulfill"
  />

  <SaveToast :open="saveSuccessOpen" title="保存成功" message="修改已保存。" />

  <Teleport to="body">
    <div
      v-if="open && fulfillPlantDdOpen"
      ref="fulfillDdPanelRef"
      class="workspace-dd__panel scrollbar-paper chapter-hub__foreshadow-dd-panel"
      role="listbox"
      :style="fulfillDdPanelStyle"
    >
      <button
        type="button"
        class="workspace-dd__item"
        :class="{ 'workspace-dd__item--active': fulfillPlantId === '' }"
        @click="selectFulfillPlant('')"
      >
        请选择
      </button>
      <button
        v-for="p in openPlants"
        :key="p.id"
        type="button"
        class="workspace-dd__item"
        :class="{ 'workspace-dd__item--active': fulfillPlantId === p.id }"
        @click="selectFulfillPlant(p.id)"
      >
        {{ p.title }}（植入：第 {{ p.plantChapterNo }} 章）
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import SaveToast from '../../../components/SaveToast.vue'
import type {
  ForeshadowFulfillment,
  ForeshadowPlant,
  NewForeshadowFulfillmentInput,
  NewForeshadowPlantInput,
} from '../../../types'

const props = withDefaults(
  defineProps<{
    open: boolean
    mode: 'plant' | 'fulfill' | 'edit-plant' | 'edit-fulfill'
    selectedText: string
    chapterId: string
    chapterNo: number
    chapterTitle: string
    openPlants: ForeshadowPlant[]
    editingPlant?: ForeshadowPlant | null
    editingFulfillment?: ForeshadowFulfillment | null
  }>(),
  { editingPlant: null, editingFulfillment: null },
)

const emit = defineEmits<{
  close: []
  plant: [input: Omit<NewForeshadowPlantInput, 'novelId' | 'plantText' | 'plantChapterId' | 'plantChapterNo' | 'plantChapterTitle'> & { title: string; description: string }]
  fulfill: [plantId: string, input: NewForeshadowFulfillmentInput]
  editPlant: [plantId: string, input: { title: string; description: string; plantText: string }]
  editFulfill: [plantId: string, fulfillmentId: string, input: { fulfillText: string; notes: string }]
  removePlant: [plantId: string]
  removeFulfill: [plantId: string, fulfillmentId: string]
}>()

const overlayRef = ref<HTMLElement | null>(null)
const fulfillDdBtnRef = ref<HTMLButtonElement | null>(null)
const fulfillDdPanelRef = ref<HTMLElement | null>(null)

const fulfillDdPanelStyle = ref<Record<string, string>>({})

const fulfillPlantDdOpen = ref(false)

const DD_PANEL_Z = 5000

function layoutDdPanel(
  btn: HTMLElement | null,
  styleRef: typeof fulfillDdPanelStyle,
  opts?: { preferUp?: boolean },
): void {
  if (!btn) return
  const r = btn.getBoundingClientRect()
  const pad = 8
  const maxH = Math.min(320, window.innerHeight * 0.46)
  const below = window.innerHeight - r.bottom - pad
  const above = r.top - pad
  const openUp = opts?.preferUp ?? (below < 100 && above > below)
  const left = Math.min(Math.max(8, r.left), window.innerWidth - r.width - 8)
  const width = Math.min(r.width, window.innerWidth - 16)
  if (openUp) {
    styleRef.value = {
      position: 'fixed',
      left: `${left}px`,
      width: `${width}px`,
      bottom: `${window.innerHeight - r.top + pad}px`,
      maxHeight: `${Math.min(maxH, above)}px`,
      zIndex: String(DD_PANEL_Z),
      overflowY: 'auto',
    }
  } else {
    styleRef.value = {
      position: 'fixed',
      top: `${r.bottom + pad}px`,
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `${Math.min(maxH, below)}px`,
      zIndex: String(DD_PANEL_Z),
      overflowY: 'auto',
    }
  }
}

async function syncDdLayouts(): Promise<void> {
  await nextTick()
  if (props.open && fulfillPlantDdOpen.value) {
    layoutDdPanel(fulfillDdBtnRef.value, fulfillDdPanelStyle)
  }
}

function onDocPointerDown(e: MouseEvent): void {
  const t = e.target
  if (!(t instanceof Node)) return
  if (fulfillDdBtnRef.value?.contains(t)) return
  if (fulfillDdPanelRef.value?.contains(t)) return
  fulfillPlantDdOpen.value = false
}

function onWinOrScroll(): void {
  void syncDdLayouts()
}

function detachDdGlobalListeners(): void {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  window.removeEventListener('resize', onWinOrScroll)
  window.removeEventListener('scroll', onWinOrScroll, true)
}

function attachDdGlobalListenersIfNeeded(): void {
  detachDdGlobalListeners()
  const active =
    props.open && fulfillPlantDdOpen.value
  if (!active) return
  document.addEventListener('pointerdown', onDocPointerDown, true)
  window.addEventListener('resize', onWinOrScroll)
  window.addEventListener('scroll', onWinOrScroll, true)
}

watch([fulfillPlantDdOpen, () => props.open], () => {
  attachDdGlobalListenersIfNeeded()
  void syncDdLayouts()
})

onUnmounted(() => {
  detachDdGlobalListeners()
})

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      fulfillPlantDdOpen.value = false
      return
    }
    await nextTick()
    overlayRef.value?.focus({ preventScroll: true })
  },
)

const plantTitle = ref('')
const plantDescription = ref('')
const plantText = ref('')

const fulfillPlantId = ref('')
const fulfillNotes = ref('')
const fulfillText = ref('')
const initialSnapshot = ref('')
const cancelConfirmOpen = ref(false)
const removePlantConfirmOpen = ref(false)
const removeFulfillConfirmOpen = ref(false)
const saveSuccessOpen = ref(false)
let saveSuccessTimer: number | null = null

const modalTitle = computed(() => {
  if (props.mode === 'plant') return '设为伏笔'
  if (props.mode === 'fulfill') return '对应伏笔（标记完成）'
  if (props.mode === 'edit-plant') return '修改伏笔'
  return '修改照应'
})

const fulfillPlantDdLabel = computed(() => {
  const id = fulfillPlantId.value
  if (!id) return '请选择'
  const p = props.openPlants.find((x) => x.id === id)
  return p ? `${p.title}（植入：第 ${p.plantChapterNo} 章）` : '请选择'
})

function toggleFulfillPlantDd(): void {
  fulfillPlantDdOpen.value = !fulfillPlantDdOpen.value
}

function selectFulfillPlant(id: string): void {
  fulfillPlantId.value = id
  fulfillPlantDdOpen.value = false
}

function onForeshadowScrollClick(e: MouseEvent): void {
  const el = e.target
  if (el instanceof Element && el.closest('.workspace-dd')) return
  fulfillPlantDdOpen.value = false
}

watch(
  () => [props.open, props.mode, props.selectedText] as const,
  ([open, mode, sel]) => {
    if (!open) return
    fulfillPlantDdOpen.value = false
    if (mode === 'plant') {
      plantTitle.value = (sel || '').trim().slice(0, 20)
      plantDescription.value = ''
      plantText.value = (sel || '').trim()
      void nextTick(() => {
        initialSnapshot.value = currentSnapshot.value
      })
      return
    }
    if (mode === 'fulfill') {
      fulfillPlantId.value = props.openPlants[0]?.id ?? ''
      fulfillNotes.value = ''
      fulfillText.value = (sel || '').trim()
      void nextTick(() => {
        initialSnapshot.value = currentSnapshot.value
      })
      return
    }
    if (mode === 'edit-plant') {
      const p = props.editingPlant
      plantTitle.value = (p?.title ?? '').trim()
      plantDescription.value = (p?.description ?? '').trim()
      plantText.value = (p?.plantText ?? '').trim()
      void nextTick(() => {
        initialSnapshot.value = currentSnapshot.value
      })
      return
    }
    const ff = props.editingFulfillment
    fulfillText.value = (ff?.fulfillText ?? '').trim()
    fulfillNotes.value = (ff?.notes ?? '').trim()
    void nextTick(() => {
      initialSnapshot.value = currentSnapshot.value
    })
  }
)

const canPlant = computed(() => !!props.selectedText.trim() && !!plantTitle.value.trim())
const canFulfill = computed(() => !!fulfillPlantId.value.trim() && !!props.selectedText.trim())
const canEditPlant = computed(() => !!props.editingPlant?.id && !!plantTitle.value.trim())
const canRemovePlant = computed(() => !!props.editingPlant?.id)
const canEditFulfill = computed(
  () => !!props.editingPlant?.id && !!props.editingFulfillment?.id && !!fulfillText.value.trim(),
)
const canRemoveFulfill = computed(() => !!props.editingPlant?.id && !!props.editingFulfillment?.id)

const currentSnapshot = computed(() => {
  if (props.mode === 'plant' || props.mode === 'edit-plant') {
    return JSON.stringify({
      mode: props.mode,
      title: plantTitle.value.trim(),
      description: plantDescription.value.trim(),
      plantText: plantText.value.trim(),
    })
  }
  if (props.mode === 'fulfill') {
    return JSON.stringify({
      mode: props.mode,
      fulfillPlantId: fulfillPlantId.value,
      fulfillNotes: fulfillNotes.value.trim(),
      fulfillText: props.selectedText.trim(),
    })
  }
  return JSON.stringify({
    mode: props.mode,
    fulfillText: fulfillText.value.trim(),
    fulfillNotes: fulfillNotes.value.trim(),
  })
})

const hasUnsavedChanges = computed(
  () => props.open && initialSnapshot.value.length > 0 && currentSnapshot.value !== initialSnapshot.value,
)

function requestClose(): void {
  if (hasUnsavedChanges.value) {
    cancelConfirmOpen.value = true
    return
  }
  emit('close')
}

function confirmCancelClose(): void {
  cancelConfirmOpen.value = false
  emit('close')
}

function notifySavedAndClose(): void {
  emit('close')
  saveSuccessOpen.value = true
  if (saveSuccessTimer != null) window.clearTimeout(saveSuccessTimer)
  saveSuccessTimer = window.setTimeout(() => {
    saveSuccessOpen.value = false
    saveSuccessTimer = null
  }, 1200)
}

onUnmounted(() => {
  if (saveSuccessTimer != null) {
    window.clearTimeout(saveSuccessTimer)
    saveSuccessTimer = null
  }
})

function doPlant(): void {
  const title = plantTitle.value.trim()
  if (!title) return
  emit('plant', {
    title,
    description: plantDescription.value.trim(),
  })
}

function doFulfill(): void {
  const id = fulfillPlantId.value.trim()
  if (!id) return
  emit('fulfill', id, {
    fulfillText: props.selectedText,
    fulfillChapterId: props.chapterId,
    fulfillChapterNo: props.chapterNo,
    fulfillChapterTitle: props.chapterTitle,
    notes: fulfillNotes.value.trim(),
  })
}

function doEditPlant(): void {
  const id = props.editingPlant?.id ?? ''
  if (!id) return
  emit('editPlant', id, {
    title: plantTitle.value.trim(),
    description: plantDescription.value.trim(),
    plantText: plantText.value.trim(),
  })
}

function doEditFulfill(): void {
  const plantId = props.editingPlant?.id ?? ''
  const ffId = props.editingFulfillment?.id ?? ''
  if (!plantId || !ffId) return
  emit('editFulfill', plantId, ffId, {
    fulfillText: fulfillText.value.trim(),
    notes: fulfillNotes.value.trim(),
  })
}

function doRemoveFulfill(): void {
  const plantId = props.editingPlant?.id ?? ''
  const ffId = props.editingFulfillment?.id ?? ''
  if (!plantId || !ffId) return
  emit('removeFulfill', plantId, ffId)
}

function doRemovePlant(): void {
  const plantId = props.editingPlant?.id ?? ''
  if (!plantId) return
  emit('removePlant', plantId)
}

function doPlantWithFeedback(): void {
  if (!canPlant.value) return
  doPlant()
  notifySavedAndClose()
}

function doFulfillWithFeedback(): void {
  if (!canFulfill.value) return
  doFulfill()
  notifySavedAndClose()
}

function doEditPlantWithFeedback(): void {
  if (!canEditPlant.value) return
  doEditPlant()
  notifySavedAndClose()
}

function doEditFulfillWithFeedback(): void {
  if (!canEditFulfill.value) return
  doEditFulfill()
  notifySavedAndClose()
}

function doRemoveFulfillWithFeedback(): void {
  if (!canRemoveFulfill.value) return
  doRemoveFulfill()
  notifySavedAndClose()
}

function requestRemovePlant(): void {
  if (!canRemovePlant.value) return
  removePlantConfirmOpen.value = true
}

function requestRemoveFulfill(): void {
  if (!canRemoveFulfill.value) return
  removeFulfillConfirmOpen.value = true
}

function confirmRemovePlant(): void {
  removePlantConfirmOpen.value = false
  doRemovePlant()
  notifySavedAndClose()
}

function confirmRemoveFulfill(): void {
  removeFulfillConfirmOpen.value = false
  doRemoveFulfill()
  notifySavedAndClose()
}
</script>

<style scoped>
.chapter-hub__foreshadow-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chapter-hub__foreshadow-actions-left,
.chapter-hub__foreshadow-actions-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chapter-hub__foreshadow-actions-left {
  min-width: 120px;
}

.chapter-hub__foreshadow-actions-right {
  justify-content: flex-end;
  margin-left: auto;
}

.chapter-hub__foreshadow-btn-delete {
  color: #b42318;
  border-color: color-mix(in srgb, #b42318 35%, var(--color-border-strong) 65%);
}

@media (max-width: 640px) {
  .chapter-hub__foreshadow-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .chapter-hub__foreshadow-actions-left,
  .chapter-hub__foreshadow-actions-right {
    width: 100%;
    justify-content: flex-end;
    min-width: 0;
  }
}
</style>
