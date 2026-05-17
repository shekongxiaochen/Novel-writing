<template>
  <section
    class="page-block chapter-hub"
    :class="{ 'chapter-hub--empty': chapters.length === 0 }"
    v-if="novel"
  >
    <template v-if="chapters.length > 0">
      <section class="chapter-hub__editor chapter-hub__editor--plain" v-if="selectedChapter">
        <ChapterHubPaperBlock
          ref="paperBlockRef"
          :content="selectedChapter.content"
          :entity-preview-lines="entityPreviewLines"
          :should-show-entity-overlay="shouldShowEntityOverlay"
          :is-chapter-textarea-focused="isChapterTextareaFocused"
          :active-flash-fs-key="activeFlashFsKey"
          :readonly="false"
          @input="onChapterContentInputWithForeshadowSync(selectedChapter.id, $event)"
          @keydown="onChapterTextareaKeydown"
          @keyup="onChapterTextareaKeyup"
          @mouseup="onChapterTextareaMouseup"
          @select="onChapterTextareaSelect"
          @focus="onChapterTextareaFocus"
          @blur="onChapterTextareaBlur"
          @entity-enter="onPaperEntityEnter"
          @faction-enter="onPaperFactionEnter"
          @item-enter="onPaperItemEnter"
          @entity-leave="onEntityNameLeave"
          @foreshadow-enter="onPaperForeshadowEnter"
          @foreshadow-leave="onForeshadowMarkLeave"
          @foreshadow-click="onPaperForeshadowClick"
          @go-character="openHubCharacterGraph"
          @go-faction="openHubFactionModal"
          @go-item="openWorkspaceItem"
        />
        <ChapterHubLegendBar v-if="!focusMode" />
        </section>
    </template>

    <ChapterHubEmptyChaptersCard v-else />

    <ChapterHubNameSuggestTeleport
      :open="nameSuggestOpen && !foreshadowModalOpen"
      :list="nameSuggestList"
      :active-index="nameSuggestIndex"
      :direction="nameSuggestDirection"
      :panel-style="nameSuggestStyle"
      @update:active-index="setNameSuggestActiveIndex"
      @apply="applyNameSuggestion"
    />

    <ChapterHubCtxMenuTeleport
      :open="ctxMenuOpen && !foreshadowModalOpen"
      :x="ctxMenuX"
      :y="ctxMenuY"
      :notice="ctxMenuNotice"
      :selected-character="ctxMenuSelectedCharacter"
      :selected-faction="ctxMenuSelectedFaction"
      :selected-item="ctxMenuSelectedItem"
      :show-add-as="ctxMenuShowAddAs"
      :bound-faction-summary="ctxMenuBoundFactionSummary"
      :character-faction-unbound="false"
      :can-add-as-faction="ctxMenuCanAddAsFaction"
      :factions="factions"
      :is-faction-current="ctxMenuFactionIsCurrent"
      :has-foreshadow-issues="openForeshadowPlants.length > 0"
      @close="closeCtxMenu"
      @add-character="addSelectionAsCharacter"
      @add-faction="addSelectionAsFaction"
      @add-item="addSelectionAsItem"
      @toggle-faction="toggleFactionMembershipForSelectedCharacter"
      @set-foreshadow="openForeshadowPlantModal"
      @resolve-foreshadow="openForeshadowFulfillModal"
    />

    <ChapterHubEntityTooltipTeleport
      :open="entityTooltipOpen && !foreshadowModalOpen"
      :character="entityTooltipCharacter"
      :tooltip-faction="entityTooltipFaction"
      :item="entityTooltipItem"
      :item-owner-label="entityTooltipItemOwnerLabel"
      :character-faction-lines="entityTooltipCharacterFactionLines"
      :character-category-lines="entityTooltipCharacterCategoryLines"
      :character-held-item-lines="entityTooltipCharacterHeldItemLines"
      :faction-category-lines="entityTooltipFactionCategoryLines"
      :faction-held-item-lines="entityTooltipFactionHeldItemLines"
      :faction-member-rows="entityTooltipFactionMembers.rows"
      :faction-member-total="entityTooltipFactionMembers.total"
      :anchor-rect="entityTooltipAnchorRect"
      :tooltip-x="entityTooltipX"
      :tooltip-y="entityTooltipY"
      :hover-text-range="entityTooltipTextRange"
      :current-chapter-id="selectedChapterId"
      :textarea-focused="isChapterTextareaFocused"
      :textarea-has-selection="hasTextareaSelection"
    />

    <ChapterHubForeshadowTooltip
      :open="foreshadowTooltipOpen && !isChapterTextareaFocused && !hasTextareaSelection && !foreshadowModalOpen"
      :x="foreshadowTooltipX"
      :anchor-top="foreshadowTooltipTop"
      :anchor-bottom="foreshadowTooltipBottom"
      :plant="foreshadowTooltipPlant"
      :segment="foreshadowTooltipSegment"
      :fulfillment-id="foreshadowTooltipFulfillmentId"
      :jump-token="foreshadowTooltipJumpToken"
      @tooltip-enter="onForeshadowTooltipEnter"
      @tooltip-leave="onForeshadowTooltipLeave"
      @jump-to-fulfill="onJumpToFulfillFromTooltip"
      @jump-to-plant="onJumpToPlantFromTooltip"
      @edit-plant="onEditPlantFromTooltip"
      @edit-fulfill="onEditFulfillFromTooltip"
    />

    <ChapterHubCharacterGraphModal
      :open="hubCharacterGraphOpen"
      :novel-id="novelId"
      :characters="characters"
      :items="items"
      :categories="categories"
      :focus-character-id="hubGraphFocusCharacterId"
      :chapter-id="selectedChapterId"
      :source-text-range="hubGraphSourceRange"
      @close="closeHubCharacterGraph"
      @saved="reload"
    />

    <ChapterHubFactionDetailModal
      :open="hubFactionModalOpen"
      :novel-id="novelId"
      :characters="characters"
      :items="items"
      :categories="categories"
      :faction="hubFactionModalTarget"
      :chapter-id="selectedChapterId"
      :source-text-range="hubFactionSourceRange"
      @close="closeHubFactionModal"
      @saved="onFactionModalSaved"
    />

    <ChapterHubForeshadowModal
      :open="foreshadowModalOpen"
      :mode="foreshadowModalMode"
      :selected-text="pendingForeshadowSelection?.text ?? ''"
      :chapter-id="selectedChapter?.id ?? ''"
      :chapter-no="selectedChapter?.chapterNo ?? 0"
      :chapter-title="selectedChapter?.title ?? ''"
      :open-plants="openForeshadowPlants"
      :editing-plant="editingForeshadowPlant"
      :editing-fulfillment="editingForeshadowFulfillment"
      @close="closeForeshadowModal"
      @plant="onForeshadowPlant"
      @fulfill="onForeshadowFulfill"
      @edit-plant="onForeshadowPlantEdit"
      @edit-fulfill="onForeshadowFulfillEdit"
      @remove-plant="onForeshadowPlantRemove"
      @remove-fulfill="onForeshadowFulfillRemove"
    />
    <SaveToast :open="chapterHubSaveToastOpen" title="保存成功" message="修改已保存。" />
  </section>

  <section v-else class="page-block">
    <div class="card">
      <h2>作品不存在</h2>
      <p class="muted">这个作品可能已被删除，或链接无效。</p>
      <RouterLink class="link-back" to="/">← 返回作品列表</RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { focusMode } from '../../composables/useFocusMode'
import type {
  Character,
  Faction,
  ForeshadowFulfillment,
  Item,
  ForeshadowPlant,
  NewForeshadowFulfillmentInput,
  NewForeshadowPlantInput,
} from '../../types'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  createForeshadowPlant,
  addForeshadowFulfillment,
  deleteForeshadowPlant,
  getForeshadowsByNovelId,
  getCharacterChangeHistory,
  getFactionChangeHistory,
  type CharacterChangeEvent,
  type FactionChangeEvent,
  removeForeshadowFulfillment,
  updateChapter,
  updateForeshadowFulfillment,
  updateForeshadowPlant,
} from '../../lib/storage'
import { useChapterHubChapterMutations } from '../../features/chapter-hub/composables/useChapterHubChapterMutations'
import { useChapterHubCtxMenu } from '../../features/chapter-hub/composables/useChapterHubCtxMenu'
import { useChapterHubData } from '../../features/chapter-hub/composables/useChapterHubData'
import { useChapterHubDomRefs } from '../../features/chapter-hub/composables/useChapterHubDomRefs'
import {
  useChapterHubForeshadowTooltip,
  type ForeshadowHoverMeta,
} from '../../features/chapter-hub/composables/useChapterHubForeshadowTooltip'
import { useChapterHubEntityTooltip } from '../../features/chapter-hub/composables/useChapterHubEntityTooltip'
import { useChapterHubNameSuggest } from '../../features/chapter-hub/composables/useChapterHubNameSuggest'
import { useChapterHubForeshadowDeepLink } from '../../features/chapter-hub/composables/useChapterHubForeshadowDeepLink'
import { useChapterHubTextareaEditor } from '../../features/chapter-hub/composables/useChapterHubTextareaEditor'
import { scrollCaretIntoView } from '../../features/chapter-hub/caretGeometry'
import ChapterHubCharacterGraphModal from './components/ChapterHubCharacterGraphModal.vue'
import ChapterHubCtxMenuTeleport from './components/ChapterHubCtxMenuTeleport.vue'
import ChapterHubFactionDetailModal from './components/ChapterHubFactionDetailModal.vue'
import ChapterHubForeshadowModal from './components/ChapterHubForeshadowModal.vue'
import ChapterHubForeshadowTooltip from './components/ChapterHubForeshadowTooltip.vue'
import ChapterHubEmptyChaptersCard from './components/ChapterHubEmptyChaptersCard.vue'
import ChapterHubEntityTooltipTeleport from './components/ChapterHubEntityTooltipTeleport.vue'
import ChapterHubNameSuggestTeleport from './components/ChapterHubNameSuggestTeleport.vue'
import ChapterHubLegendBar from './components/ChapterHubLegendBar.vue'
import ChapterHubPaperBlock from './components/ChapterHubPaperBlock.vue'
import SaveToast from '../../components/SaveToast.vue'

const route = useRoute()
const router = useRouter()

const hubCharacterGraphOpen = ref(false)
const hubGraphFocusCharacterId = ref('')
const hubGraphSourceRange = ref<{ start: number; end: number } | null>(null)

function openHubCharacterGraph(c: Character, textRange: { start: number; end: number } | null = null): void {
  onEntityNameLeave()
  closeForeshadowTooltipImmediate()
  hubGraphFocusCharacterId.value = c.id
  hubGraphSourceRange.value = textRange
  hubCharacterGraphOpen.value = true
}

function closeHubCharacterGraph(): void {
  hubCharacterGraphOpen.value = false
  hubGraphSourceRange.value = null
}

const hubFactionModalOpen = ref(false)
const hubFactionModalTarget = ref<Faction | null>(null)
const hubFactionSourceRange = ref<{ start: number; end: number } | null>(null)
const chapterHubSaveToastOpen = ref(false)
let chapterHubSaveToastTimer: number | null = null

function openHubFactionModal(f: Faction, textRange: { start: number; end: number } | null = null): void {
  onEntityNameLeave()
  closeForeshadowTooltipImmediate()
  hubFactionModalTarget.value = f
  hubFactionSourceRange.value = textRange
  hubFactionModalOpen.value = true
}

function closeHubFactionModal(): void {
  hubFactionModalOpen.value = false
  hubFactionModalTarget.value = null
  hubFactionSourceRange.value = null
}

function triggerChapterHubSaveToast(): void {
  chapterHubSaveToastOpen.value = true
  if (chapterHubSaveToastTimer != null) window.clearTimeout(chapterHubSaveToastTimer)
  chapterHubSaveToastTimer = window.setTimeout(() => {
    chapterHubSaveToastOpen.value = false
    chapterHubSaveToastTimer = null
  }, 1200)
}

function onFactionModalSaved(): void {
  reload()
  triggerChapterHubSaveToast()
}

const {
  novelId,
  novel,
  chapters,
  characters,
  factions,
  items,
  categories,
  characterFactionMemberships,
  selectedChapterId,
  selectedChapter,
  selectedChapterCtx,
  chapterForm,
  reload,
} = useChapterHubData()

const { paperBlockRef, chapterTextareaRef } = useChapterHubDomRefs()

useChapterHubForeshadowDeepLink({
  novelId,
  chapters,
  selectedChapterId,
  chapterTextareaRef,
  route,
  router,
  onForeshadowFocused: syncForeshadowFlashTarget,
})

const {
  nameSuggestOpen,
  nameSuggestList,
  nameSuggestIndex,
  nameSuggestDirection,
  nameSuggestStyle,
  forceSuggest,
  updateNameSuggestion,
  applyNameSuggestion,
  resetNameSuggest,
} = useChapterHubNameSuggest({
  characters,
  factions,
  items,
  selectedChapter,
  chapters,
  chapterTextareaRef,
})

const foreshadowModalOpen = ref(false)
const foreshadowModalMode = ref<'plant' | 'fulfill' | 'edit-plant' | 'edit-fulfill'>('plant')
const editingForeshadowPlantId = ref('')
const editingForeshadowFulfillmentId = ref('')

const {
  ctxMenuOpen,
  ctxMenuX,
  ctxMenuY,
  ctxMenuNotice,
  ctxMenuSelection,
  ctxMenuRange,
  ctxMenuSelectedCharacter,
  ctxMenuSelectedFaction,
  ctxMenuSelectedItem,
  ctxMenuShowAddAs,
  ctxMenuBoundFactionSummary,
  ctxMenuCanAddAsFaction,
  openCtxMenuFromSelection,
  openCtxMenuForExplicitSelection,
  openCtxMenuAtPoint,
  closeCtxMenu,
  addSelectionAsCharacter,
  addSelectionAsFaction,
  addSelectionAsItem,
  ctxMenuFactionIsCurrent,
  toggleFactionMembershipForSelectedCharacter,
} = useChapterHubCtxMenu({
  novelId,
  novel,
  selectedChapter: selectedChapterCtx,
  characters,
  factions,
  items,
  characterFactionMemberships,
  chapterTextareaRef,
  foreshadowModalOpen,
})

// ── Foreshadow：localStorage 变更后需 bump tick，overlay 才会重新计算 ────────
const foreshadowDataTick = ref(0)
const activeFlashFsKey = ref('')
let foreshadowFlashTimer: number | null = null
function clearForeshadowFlash(): void {
  activeFlashFsKey.value = ''
  if (foreshadowFlashTimer != null) {
    window.clearTimeout(foreshadowFlashTimer)
    foreshadowFlashTimer = null
  }
}

function triggerForeshadowFlash(fsKey: string): void {
  const nextKey = String(fsKey ?? '').trim()
  if (!nextKey) return
  clearForeshadowFlash()
  void nextTick(() => {
    activeFlashFsKey.value = nextKey
    foreshadowFlashTimer = window.setTimeout(() => {
      activeFlashFsKey.value = ''
      foreshadowFlashTimer = null
    }, 3000)
  })
}

function syncForeshadowFlashTarget(meta: { chapterId: string; fsKey: string; range: { start: number; end: number } }): void {
  if (meta.chapterId !== selectedChapterId.value) return
  const key = String(meta.fsKey ?? '').trim()
  if (!key) return
  void nextTick(() => {
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-fs-key="${CSS.escape(key)}"]`)
      if (!target) {
        triggerForeshadowFlash(key)
        return
      }
      triggerForeshadowFlash(key)
    })
  })
}

const allForeshadowsForHub = computed<ForeshadowPlant[]>(() => {
  void foreshadowDataTick.value
  void chapters.value
  const id = novelId.value
  if (!id) return []
  return getForeshadowsByNovelId(id)
})

const openForeshadowPlants = computed<ForeshadowPlant[]>(() =>
  allForeshadowsForHub.value.filter((p) => p.status === 'open'),
)

const {
  foreshadowTooltipOpen,
  foreshadowTooltipX,
  foreshadowTooltipTop,
  foreshadowTooltipBottom,
  foreshadowTooltipPlant,
  foreshadowTooltipSegment,
  foreshadowTooltipFulfillmentId,
  foreshadowTooltipContextDescription,
  foreshadowTooltipJumpToken,
  foreshadowTooltipMarkText,
  onForeshadowMarkEnter,
  onForeshadowMarkLeave,
  onForeshadowTooltipEnter,
  onForeshadowTooltipLeave,
  closeForeshadowTooltipImmediate,
} = useChapterHubForeshadowTooltip({ foreshadows: allForeshadowsForHub })

/** 打开弹窗瞬间快照选区：失焦后 ctxMenuRange 会被清空，不能再依赖它点「确认」 */
const pendingForeshadowSelection = ref<{ start: number; end: number; text: string } | null>(null)

function snapshotForeshadowSelectionFromCtxMenu(): void {
  const r = ctxMenuRange.value
  const ch = selectedChapter.value
  if (!r || !ch || r.end <= r.start) {
    pendingForeshadowSelection.value = null
    return
  }
  const content = ch.content ?? ''
  pendingForeshadowSelection.value = {
    start: r.start,
    end: r.end,
    text: content.slice(r.start, r.end),
  }
}

function openForeshadowPlantModal(): void {
  editingForeshadowPlantId.value = ''
  editingForeshadowFulfillmentId.value = ''
  snapshotForeshadowSelectionFromCtxMenu()
  closeCtxMenu()
  onEntityNameLeave()
  closeForeshadowTooltipImmediate()
  foreshadowModalMode.value = 'plant'
  foreshadowModalOpen.value = true
  releaseChapterTextareaAfterForeshadowModal()
}

function openForeshadowFulfillModal(): void {
  editingForeshadowPlantId.value = ''
  editingForeshadowFulfillmentId.value = ''
  snapshotForeshadowSelectionFromCtxMenu()
  closeCtxMenu()
  onEntityNameLeave()
  closeForeshadowTooltipImmediate()
  foreshadowModalMode.value = 'fulfill'
  foreshadowModalOpen.value = true
  releaseChapterTextareaAfterForeshadowModal()
}

const editingForeshadowPlant = computed<ForeshadowPlant | null>(() => {
  const id = editingForeshadowPlantId.value.trim()
  if (!id) return null
  return allForeshadowsForHub.value.find((p) => p.id === id) ?? null
})

const editingForeshadowFulfillment = computed<ForeshadowFulfillment | null>(() => {
  const ffId = editingForeshadowFulfillmentId.value.trim()
  if (!ffId) return null
  return editingForeshadowPlant.value?.fulfillments?.find((ff) => ff.id === ffId) ?? null
})

function closeForeshadowModal(): void {
  foreshadowModalOpen.value = false
  pendingForeshadowSelection.value = null
  editingForeshadowPlantId.value = ''
  editingForeshadowFulfillmentId.value = ''
}

/** 弹窗关闭后浏览器常把焦点还原文本区且保留选区，会再次打开右键菜单；折叠选区并 blur，恢复「未编辑」态 */
function releaseChapterTextareaAfterForeshadowModal(): void {
  void nextTick(() => {
    requestAnimationFrame(() => {
  const ta = chapterTextareaRef.value
  if (!ta) return
      const pos = ta.selectionEnd ?? ta.value.length
      ta.setSelectionRange(pos, pos)
      ta.blur()
    })
  })
}

function clearJumpEndQuery(): void {
  const nextQuery = { ...route.query } as Record<string, unknown>
  if (!('jumpEnd' in nextQuery)) return
  delete nextQuery.jumpEnd
  void router.replace({ path: route.path, query: nextQuery })
}

async function applyJumpEndFromRoute(): Promise<void> {
  if (String(route.query.jumpEnd ?? '').trim() !== '1') return
  await nextTick()
  await nextTick()
  requestAnimationFrame(() => {
    const ta = chapterTextareaRef.value
    if (!ta) return
    const pos = ta.value.length
    ta.focus()
    ta.setSelectionRange(pos, pos)
    scrollCaretIntoView(ta, pos)
    clearJumpEndQuery()
  })
}

function onForeshadowPlant(input: Pick<NewForeshadowPlantInput, 'title' | 'description'>): void {
  const snap = pendingForeshadowSelection.value
  if (!novel.value || !selectedChapter.value || !snap || snap.end <= snap.start) {
    closeForeshadowModal()
    closeCtxMenu()
    return
  }
  createForeshadowPlant({
    novelId: novelId.value,
    title: input.title,
    plantText: snap.text,
    plantChapterId: selectedChapter.value.id,
    plantChapterNo: selectedChapter.value.chapterNo,
    plantChapterTitle: selectedChapter.value.title,
    plantStart: snap.start,
    plantEnd: snap.end,
    description: input.description ?? '',
  })
  foreshadowDataTick.value += 1
  closeForeshadowModal()
}

function onForeshadowFulfill(plantId: string, input: NewForeshadowFulfillmentInput): void {
  const snap = pendingForeshadowSelection.value
  if (!snap || !snap.text.trim()) {
    closeForeshadowModal()
    closeCtxMenu()
    return
  }
  addForeshadowFulfillment(plantId, {
    ...input,
    fulfillText: snap.text,
    fulfillChapterId: selectedChapter.value?.id ?? input.fulfillChapterId,
    fulfillChapterNo: selectedChapter.value?.chapterNo ?? input.fulfillChapterNo,
    fulfillChapterTitle: selectedChapter.value?.title ?? input.fulfillChapterTitle,
    fulfillStart: snap.start,
    fulfillEnd: snap.end,
  })
  foreshadowDataTick.value += 1
  closeForeshadowModal()
}

function onForeshadowPlantEdit(
  plantId: string,
  input: { title: string; description: string; plantText: string },
): void {
  const plant = allForeshadowsForHub.value.find((p) => p.id === plantId) ?? null
  if (
    plant &&
    typeof plant.plantStart === 'number' &&
    typeof plant.plantEnd === 'number' &&
    plant.plantEnd > plant.plantStart
  ) {
    replaceChapterRangeContent(plant.plantChapterId, plant.plantStart, plant.plantEnd, input.plantText)
  }
  updateForeshadowPlant({
    id: plantId,
    title: input.title.trim(),
    description: input.description.trim(),
    plantText: input.plantText.trim(),
  })
  foreshadowDataTick.value += 1
  closeForeshadowModal()
}

function onForeshadowFulfillEdit(
  plantId: string,
  fulfillmentId: string,
  input: { fulfillText: string; notes: string },
): void {
  const plant = allForeshadowsForHub.value.find((p) => p.id === plantId) ?? null
  const ff = plant?.fulfillments.find((x) => x.id === fulfillmentId) ?? null
  if (
    ff &&
    typeof ff.fulfillStart === 'number' &&
    typeof ff.fulfillEnd === 'number' &&
    ff.fulfillEnd > ff.fulfillStart
  ) {
    replaceChapterRangeContent(ff.fulfillChapterId, ff.fulfillStart, ff.fulfillEnd, input.fulfillText)
  }
  updateForeshadowFulfillment(plantId, fulfillmentId, {
    fulfillText: input.fulfillText.trim(),
    notes: input.notes.trim(),
  })
  foreshadowDataTick.value += 1
  closeForeshadowModal()
}

function onForeshadowFulfillRemove(plantId: string, fulfillmentId: string): void {
  removeForeshadowFulfillment(plantId, fulfillmentId)
  foreshadowDataTick.value += 1
  closeForeshadowModal()
}

function onForeshadowPlantRemove(plantId: string): void {
  deleteForeshadowPlant(plantId)
  foreshadowDataTick.value += 1
  closeForeshadowModal()
}

function replaceChapterRangeContent(chapterId: string, start: number, end: number, replacementText: string): void {
  const ch = chapters.value.find((x) => x.id === chapterId)
  if (!ch) return
  const content = ch.content ?? ''
  const s = Math.max(0, Math.min(content.length, Math.floor(start)))
  const e = Math.max(s, Math.min(content.length, Math.floor(end)))
  const nextContent = `${content.slice(0, s)}${replacementText}${content.slice(e)}`
  if (nextContent === content) return
  updateChapter({ id: chapterId, content: nextContent })
  chapters.value = chapters.value.map((item) =>
    item.id === chapterId ? { ...item, content: nextContent } : item,
  )
}

const {
  entityTooltipOpen,
  entityTooltipCharacter,
  entityTooltipFaction,
  entityTooltipItem,
  entityTooltipItemOwnerLabel,
  entityTooltipAnchorRect,
  entityTooltipTextRange,
  entityTooltipX,
  entityTooltipY,
  entityTooltipCharacterFactionLines,
  entityTooltipCharacterCategoryLines,
  entityTooltipCharacterHeldItemLines,
  entityTooltipFactionCategoryLines,
  entityTooltipFactionHeldItemLines,
  entityTooltipFactionMembers,
  onEntityNameEnter,
  onFactionNameEnter,
  onItemNameEnter,
  onEntityNameLeave,
} = useChapterHubEntityTooltip({
  factions,
  categories,
  characters,
  items,
  chapters,
  currentChapterId: selectedChapterId,
})

function onPaperEntityEnter(
  e: MouseEvent,
  c: Character,
  anchorRect: DOMRect | null,
  textRange: { start: number; end: number } | null,
): void {
  closeForeshadowTooltipImmediate()
  onEntityNameEnter(e, c, anchorRect, textRange)
}

function onPaperFactionEnter(
  e: MouseEvent,
  f: Faction,
  anchorRect: DOMRect | null,
  textRange: { start: number; end: number } | null,
): void {
  closeForeshadowTooltipImmediate()
  onFactionNameEnter(e, f, anchorRect, textRange)
}

function onPaperItemEnter(
  e: MouseEvent,
  item: Item,
  anchorRect: DOMRect | null,
  textRange: { start: number; end: number } | null,
): void {
  closeForeshadowTooltipImmediate()
  onItemNameEnter(e, item, anchorRect, textRange)
}

function openWorkspaceItem(item: Item): void {
  onEntityNameLeave()
  closeForeshadowTooltipImmediate()
  void router.push({
    path: `/novels/${novelId.value}`,
    query: { tab: 'items', focusItemId: item.id, scrollTo: 'items-item' },
  })
}

function onPaperForeshadowEnter(e: MouseEvent, meta: ForeshadowHoverMeta): void {
  onEntityNameLeave()
  onForeshadowMarkEnter(e, meta)
}

function onPaperForeshadowClick(meta: ForeshadowHoverMeta): void {
  closeForeshadowTooltipImmediate()
  const plantId = String(meta.id ?? '').trim()
  const plant = allForeshadowsForHub.value.find((p) => p.id === plantId)
  if (!plant) return
  pendingForeshadowSelection.value = null
  editingForeshadowPlantId.value = plant.id
  if (meta.segment === 'fulfill') {
    const ffId = String(meta.fulfillmentId ?? '').trim()
    const ff = plant.fulfillments.find((x) => x.id === ffId) ?? plant.fulfillments[0]
    if (!ff) return
    editingForeshadowFulfillmentId.value = ff.id
    foreshadowModalMode.value = 'edit-fulfill'
  } else {
    editingForeshadowFulfillmentId.value = ''
    foreshadowModalMode.value = 'edit-plant'
  }
  foreshadowModalOpen.value = true
}

function navigateToForeshadowAnchor(args: {
  chapterId: string
  plantId: string
  kind: 'plant' | 'fulfill'
  fulfillmentId?: string
  token?: string
  start?: number
  end?: number
  text?: string
}): void {
  const chapterId = String(args.chapterId ?? '').trim()
  const plantId = String(args.plantId ?? '').trim()
  if (!chapterId || !plantId || !novelId.value) return

  const nextQuery = {
    ...route.query,
    chapterId,
    focusChapter: chapterId,
    focusForeshadow: plantId,
    focusForeshadowKind: args.kind,
    focusForeshadowToken: args.token ?? `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  }
  if (args.fulfillmentId?.trim()) nextQuery.focusFulfillmentId = args.fulfillmentId.trim()
  else delete nextQuery.focusFulfillmentId
  if (typeof args.start === 'number' && typeof args.end === 'number' && args.end > args.start) {
    nextQuery.focusForeshadowStart = String(args.start)
    nextQuery.focusForeshadowEnd = String(args.end)
  } else {
    delete nextQuery.focusForeshadowStart
    delete nextQuery.focusForeshadowEnd
  }
  const focusText = String(args.text ?? '').trim()
  if (focusText) nextQuery.focusForeshadowText = focusText
  else delete nextQuery.focusForeshadowText

  const targetPath = `/novels/${novelId.value}/chapter-writing`
  if (route.path === targetPath) {
    // 同页跳转只更新 query，避免整页切换感造成闪烁
    void router.replace({ path: route.path, query: nextQuery })
    return
  }
  void router.push({ path: targetPath, query: nextQuery })
}

function onJumpToFulfillFromTooltip(ff: ForeshadowFulfillment): void {
  const plantId = foreshadowTooltipPlant.value?.id ?? ''
  closeForeshadowTooltipImmediate()
  navigateToForeshadowAnchor({
    chapterId: ff.fulfillChapterId,
    plantId,
    kind: 'fulfill',
    fulfillmentId: ff.id,
    token: `${ff.id}-${Date.now()}`,
    start: ff.fulfillStart,
    end: ff.fulfillEnd,
    text: ff.fulfillText,
  })
}

function onJumpToPlantFromTooltip(plant: ForeshadowPlant): void {
  closeForeshadowTooltipImmediate()
  navigateToForeshadowAnchor({
    chapterId: plant.plantChapterId,
    plantId: plant.id,
    kind: 'plant',
    token: `${plant.id}-${Date.now()}`,
    start: plant.plantStart,
    end: plant.plantEnd,
    text: plant.plantText,
  })
}

function onEditPlantFromTooltip(plant: ForeshadowPlant): void {
  closeForeshadowTooltipImmediate()
  editingForeshadowPlantId.value = plant.id
  editingForeshadowFulfillmentId.value = ''
  pendingForeshadowSelection.value = null
  foreshadowModalMode.value = 'edit-plant'
  foreshadowModalOpen.value = true
}

function onEditFulfillFromTooltip(plant: ForeshadowPlant, ff: ForeshadowFulfillment): void {
  closeForeshadowTooltipImmediate()
  editingForeshadowPlantId.value = plant.id
  editingForeshadowFulfillmentId.value = ff.id
  pendingForeshadowSelection.value = null
  foreshadowModalMode.value = 'edit-fulfill'
  foreshadowModalOpen.value = true
}

const {
  onChapterContentInput,
} = useChapterHubChapterMutations({
  novel,
  chapters,
  selectedChapterId,
  chapterForm,
  reload,
  updateNameSuggestion,
})

function onChapterContentInputWithForeshadowSync(chapterId: string, event: Event): void {
  onChapterContentInput(chapterId, event)
  foreshadowDataTick.value += 1
}

// 角色变更历史 Map：characterId -> CharacterChangeEvent[]
// 用于正文叠加层底色区间计算（哪些角色在当前章节之前发生了属性修改）
const characterHistories = computed(() => {
  const map = new Map<string, CharacterChangeEvent[]>()
  for (const c of characters.value) {
    const history = getCharacterChangeHistory(c.id)
    if (history.length > 0) map.set(c.id, history)
  }
  return map
})

const factionHistories = computed(() => {
  const map = new Map<string, FactionChangeEvent[]>()
  for (const f of factions.value) {
    const history = getFactionChangeHistory(f.id)
    if (history.length > 0) map.set(f.id, history)
  }
  return map
})

const {
  isChapterTextareaFocused,
  hasTextareaSelection,
  entityPreviewLines,
  shouldShowEntityOverlay,
  onChapterTextareaKeydown,
  onChapterTextareaKeyup,
  onChapterTextareaFocus,
  onChapterTextareaBlur,
  onChapterTextareaMouseup,
  onChapterTextareaSelect,
} = useChapterHubTextareaEditor({
  selectedChapterId,
  selectedChapter,
  chapters,
  characters,
  factions,
  items,
  foreshadows: allForeshadowsForHub,
  characterHistories,
  factionHistories,
  chapterTextareaRef,
  nameSuggestOpen,
  nameSuggestList,
  nameSuggestIndex,
  forceSuggest,
  updateNameSuggestion,
  applyNameSuggestion,
  resetNameSuggest,
  openCtxMenuFromSelection,
  openCtxMenuForExplicitSelection,
  openCtxMenuAtPoint,
  closeCtxMenu,
  onEntityNameLeave,
})

/** 伏笔弹窗打开/关闭时：清选区浮层（菜单、联想、实体/伏笔提示），折叠选区避免关窗后仍冒出小窗 */
watch(foreshadowModalOpen, () => {
  resetNameSuggest()
  closeCtxMenu()
  closeForeshadowTooltipImmediate()
  onEntityNameLeave()
  releaseChapterTextareaAfterForeshadowModal()
})

watch(
  [() => String(route.query.jumpEnd ?? ''), selectedChapterId, () => selectedChapter.value?.content ?? ''],
  () => {
    void applyJumpEndFromRoute()
  },
  { flush: 'post' },
)

function setNameSuggestActiveIndex(i: number) {
  nameSuggestIndex.value = i
}

onUnmounted(() => {
  clearForeshadowFlash()
  if (chapterHubSaveToastTimer != null) {
    window.clearTimeout(chapterHubSaveToastTimer)
    chapterHubSaveToastTimer = null
  }
})
</script>
