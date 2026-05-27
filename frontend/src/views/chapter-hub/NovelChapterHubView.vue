<template>
  <div
    class="chapter-hub"
    :class="{ 'chapter-hub--empty': chapters.length === 0 }"
    v-if="novel"
  >
    <template v-if="chapters.length > 0">
      <div class="chapter-hub__workspace" :style="aiWorkspaceStyle">
        <section class="chapter-hub__editor-shell" aria-label="正文编辑区">
          <header class="chapter-hub__tabs-region" aria-label="打开的章节">
            <div class="chapter-hub__tabs-left">
              <div
                class="chapter-hub__open-tabs"
                role="tablist"
                aria-label="打开的章节"
                @wheel="props.onChapterTabsWheel?.($event)"
              >
                <button
                  v-for="ch in openedChapterTabs"
                  :key="ch.id"
                  type="button"
                  class="chapter-hub__open-tab"
                  :class="{ 'is-active': props.activeChapterId === ch.id }"
                  :title="`第${ch.chapterNo}章 ${ch.title || '未命名章节'}`"
                  @click="props.onOpenChapter?.(ch.id)"
                >
                  <span class="chapter-hub__open-tab-title">第{{ ch.chapterNo }}章 {{ ch.title || '未命名章节' }}</span>
                  <span
                    class="chapter-hub__open-tab-close"
                    role="button"
                    tabindex="0"
                    @click.stop="props.onCloseChapterTab?.(ch.id)"
                    @keydown.enter.stop.prevent="props.onCloseChapterTab?.(ch.id)"
                  >
                    ×
                  </span>
                </button>
              </div>
              <button
                type="button"
                class="chapter-hub__search-button"
                :title="'搜索 Ctrl+F'"
                @click="toggleChapterSearch()"
              >
                <span class="chapter-hub__search-icon" aria-hidden="true">🔍</span>
              </button>
            </div>

            <transition name="chapter-hub-search">
              <form
                v-if="chapterSearchVisible"
                class="chapter-hub__search-bar"
                role="search"
                @submit.prevent
              >
                <input
                  ref="chapterSearchInputRef"
                  v-model="chapterSearchQuery"
                  class="chapter-hub__search-input"
                  type="search"
                  spellcheck="false"
                  autocomplete="off"
                  placeholder="查找"
                  @keydown.stop
                />
                <span v-if="chapterSearchQuery" class="chapter-hub__search-status">{{ chapterSearchStatusLabel }}</span>
                <button
                  type="button"
                  class="chapter-hub__search-btn"
                  :disabled="!chapterSearchQuery"
                  @click="jumpChapterSearch(-1)"
                  title="上一个"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="chapter-hub__search-btn"
                  :disabled="!chapterSearchQuery"
                  @click="jumpChapterSearch(1)"
                  title="下一个"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="chapter-hub__search-btn chapter-hub__search-btn--close"
                  @click="hideChapterSearch()"
                  title="关闭"
                >
                  ×
                </button>
              </form>
            </transition>
          </header>

          <section class="chapter-hub__content-region">
            <section class="chapter-hub__editor chapter-hub__editor--plain">
              <ChapterHubPaperBlock
                v-if="selectedChapter"
                ref="paperBlockRef"
                :content="selectedChapter.content"
                :entity-preview-lines="entityPreviewLines"
                :should-show-entity-overlay="shouldShowEntityOverlay"
                :is-chapter-textarea-focused="isChapterTextareaFocused"
                :pinned-quote-range="pinnedQuoteRangeForPaper"
                :active-flash-fs-key="activeFlashFsKey"
                :readonly="false"
                :search-query="chapterSearchQuery"
                :search-active-match-index="chapterSearchActiveMatchIndex"
                @input="onChapterContentInputWithForeshadowSync(selectedChapter.id, $event)"
                @keydown="onChapterTextareaKeydown"
                @beforeinput="onChapterTextareaBeforeInput"
                @keyup="onChapterTextareaKeyup"
                @mouseup="onChapterTextareaMouseup"
                @select="onChapterTextareaSelect"
                @paper-interact="onChapterPaperPointerDown"
                @focus="onChapterTextareaFocus"
                @blur="onChapterTextareaBlur($event)"
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
            </section>
          </section>

          <Transition name="chapter-hub-legend-toggle">
            <footer
              v-if="!focusMode && !isChapterTextareaFocused"
              class="chapter-hub__legend-region"
              aria-label="标记说明"
            >
              <ChapterHubLegendBar />
            </footer>
          </Transition>
        </section>

        <aside
          v-if="!focusMode"
          id="chapter-hub-ai-studio"
          class="chapter-hub__ai-studio"
          :class="{ 'chapter-hub__ai-studio--open': aiStudioOpen }"
          aria-label="AI 阅读台"
          @pointerdown.capture="onAiStudioPointerDown"
          @focusin.capture="onAiStudioPointerDown"
        >
          <div class="chapter-hub__ai-studio-resizer" @pointerdown="onAiStudioResizerPointerDown" @dblclick="resetAiStudioWidth" />
          <ChapterHubAiEntityPanel
            :open="aiStudioOpen"
            :loading="aiExtractLoading"
            :chat-loading="aiChatLoading"
            :chat-thinking="aiChatThinking"
            :error="aiExtractError"
            :result="aiExtractResult"
            :foreshadow-result="aiForeshadowResult"
            :classification-result="aiClassificationResult"
            :applied-actions="aiAppliedActions"
            :extract-runs="aiExtractRuns"
            :chat-sessions="aiChatSessionSummaries"
            :chat-history-sessions="aiChatHistorySummaries"
            :active-chat-id="activeAiChatSessionId"
            :target-chapter="selectedChapter"
            :has-run="aiExtractHasRun"
            :chat-messages="aiChatMessages"
            :selection-quote="aiSelectionQuote"
            :desk-mode="aiDeskMode"
            :composer-draft="aiComposerDraft"
            :active-direction-preset="aiActiveDirectionPreset"
            :continue-draft="aiContinueDraft"
            :continue-thinking-text="aiContinueThinkingText"
            :continue-outline-hint="continueOutlineHint"
            :chapter-summary-draft="aiChapterSummaryDraft"
            :ask-context-meta="aiAskContextMeta"
            :pending-tool-actions="aiPendingToolActions"
            @run="runCurrentAiExtract"
            @update:composer-draft="(value) => (aiComposerDraft = value)"
            @update:active-direction-preset="(value) => (aiActiveDirectionPreset = value)"
            @toggle-desk-mode="toggleAiDeskMode"
            @ask="askAiReadingDesk"
            @continue-run="runAiContinue"
            @continue-stop="stopAiContinue"
            @continue-adopt="applyContinueDraft"
            @continue-ignore="ignoreContinueDraft"
            @chapter-summary-adopt="applyChapterSummaryDraft"
            @chapter-summary-ignore="ignoreChapterSummaryDraft"
            @chapter-summary-stop="stopChapterSummaryDraft"
            @stop-ask="stopAiReadingDesk"
            @new-chat="startNewAiChat"
            @switch-chat="switchAiChatSession"
            @close-chat="closeAiChatSession"
            @delete-chat="deleteAiChatSession"
            @collapse="toggleAiStudio"
            @clear-selection-quote="clearChapterQuoteSelection"
            @apply="applyAiSuggestion"
            @open-editor="openAiSuggestionEditor"
            @pending-tool-adopt-all="applyAiPendingToolActions"
            @pending-tool-adopt-one="applyOneAiPendingToolAction"
            @pending-tool-ignore-all="ignoreAiPendingToolActions"
          />
        </aside>
      </div>
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
  </div>

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
import { requestAiAccess } from '../../composables/useAiAccess'
import { focusMode } from '../../composables/useFocusMode'
import type {
  AiDeskChatMessage,
  AiAnalysisKind,
  AiContinueDraft,
  AiContinuePosition,
  AiAskContextMeta,
  AiChapterSummaryDraft,
  AiContinuePrevSummaryCount,
  AiContinueTargetChars,
  AiDeskMode,
  AiExtractMode,
  AiMessage,
  AiPendingToolAction,
  Chapter,
  Character,
  CharacterAttribute,
  Faction,
  ForeshadowFulfillment,
  Item,
  NovelChapterClassificationResult,
  NovelEntityExtractResult,
  NovelForeshadowAnalysisResult,
  ForeshadowPlant,
  NewForeshadowFulfillmentInput,
  NewForeshadowPlantInput,
} from '../../types'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  createForeshadowPlant,
  addForeshadowFulfillment,
  buildNovelWorkspacePayload,
  createChapter,
  createCharacter,
  createCharacterFactionMembership,
  createCharacterRelation,
  createFaction,
  createItem,
  deleteForeshadowPlant,
  getCharacterRelationsByNovelId,
  getForeshadowsByNovelId,
  getCharacterChangeHistory,
  getFactionChangeHistory,
  type CharacterChangeEvent,
  type FactionChangeEvent,
  removeForeshadowFulfillment,
  upsertNovelRecord,
  updateChapter,
  updateCharacter,
  updateCharacterFactionMembership,
  updateCharacterRelation,
  updateForeshadowFulfillment,
  updateForeshadowPlant,
  updateFaction,
  updateItem,
} from '../../lib/storage'
import {
  analyzeNovelForeshadowsFromWorkspace,
  askAiAboutWorkspace,
  askAiWithToolsStream,
  classifyNovelChapterFromWorkspace,
  continueChapterFromWorkspaceStream,
  extractNovelEntitiesFromWorkspace,
  summarizeNovelChapterFromWorkspaceStream,
  summarizeNovelContinuityBriefFromWorkspaceStream,
} from '../../lib/localAi'
import { executeToolCall } from '../../lib/aiTools'
import { formatChapterSummaryText } from '../../lib/chapterSummary'
import { fetchWalletBalance } from '../../lib/backendAi'
import { normalizeCharacterAliases, replaceCharacterLabelsInText } from '../../lib/characterLabels'
import { useChapterHubChapterMutations } from '../../features/chapter-hub/composables/useChapterHubChapterMutations'
import { useChapterHubCtxMenu } from '../../features/chapter-hub/composables/useChapterHubCtxMenu'
import { useChapterHubData } from '../../features/chapter-hub/composables/useChapterHubData'
import { buildChapterContinueOutlineHint } from '../../lib/outlineContinueHint'
import {
  inferContinueOptionsFromDirection,
  isNextChapterIntent,
} from '../../lib/inferContinueFromDirection'
import { suggestNextChapterOutlineBinding } from '../../lib/outlineBeatPack'
import {
  emptyAiDeskSessionUiState,
  hydrateContinueDraft,
  normalizeAiDeskSessionUiState,
  serializeContinueDraft,
  type AiDeskSessionUiState,
} from '../../features/chapter-hub/lib/aiDeskSessionUi'
import { useChapterHubDomRefs } from '../../features/chapter-hub/composables/useChapterHubDomRefs'
import {
  useChapterHubForeshadowTooltip,
  type ForeshadowHoverMeta,
} from '../../features/chapter-hub/composables/useChapterHubForeshadowTooltip'
import { useChapterHubEntityTooltip } from '../../features/chapter-hub/composables/useChapterHubEntityTooltip'
import { useChapterHubNameSuggest } from '../../features/chapter-hub/composables/useChapterHubNameSuggest'
import { useChapterHubForeshadowDeepLink } from '../../features/chapter-hub/composables/useChapterHubForeshadowDeepLink'
import { useChapterHubTextareaEditor } from '../../features/chapter-hub/composables/useChapterHubTextareaEditor'
import {
  normalizeQuoteRange,
  type ChapterPinnedQuoteSelection,
} from '../../features/chapter-hub/lib/chapterQuoteSelection'
import { scrollCaretIntoView } from '../../features/chapter-hub/caretGeometry'
import { findTextSearchMatches } from '../../features/chapter-hub/lib/chapterTextSearch'
import ChapterHubCharacterGraphModal from './components/ChapterHubCharacterGraphModal.vue'
import ChapterHubCtxMenuTeleport from './components/ChapterHubCtxMenuTeleport.vue'
import ChapterHubFactionDetailModal from './components/ChapterHubFactionDetailModal.vue'
import ChapterHubForeshadowModal from './components/ChapterHubForeshadowModal.vue'
import ChapterHubForeshadowTooltip from './components/ChapterHubForeshadowTooltip.vue'
import ChapterHubAiEntityPanel from './components/ChapterHubAiEntityPanel.vue'
import ChapterHubEmptyChaptersCard from './components/ChapterHubEmptyChaptersCard.vue'
import ChapterHubEntityTooltipTeleport from './components/ChapterHubEntityTooltipTeleport.vue'
import ChapterHubNameSuggestTeleport from './components/ChapterHubNameSuggestTeleport.vue'
import ChapterHubLegendBar from './components/ChapterHubLegendBar.vue'
import ChapterHubPaperBlock from './components/ChapterHubPaperBlock.vue'
import SaveToast from '../../components/SaveToast.vue'

type ChapterHubShellProps = {
  openChapterIds?: string[]
  activeChapterId?: string
  onOpenChapter?: (chapterId: string) => void
  onCloseChapterTab?: (chapterId: string) => void
  onChapterTabsWheel?: (event: WheelEvent) => void
}

const props = withDefaults(defineProps<ChapterHubShellProps>(), {
  openChapterIds: () => [],
  activeChapterId: '',
})

const route = useRoute()
const router = useRouter()
const emptyAiExtractResult = (): NovelEntityExtractResult => ({
  characters: [],
  factions: [],
  items: [],
  memberships: [],
  relations: [],
  warnings: [],
})

const emptyAiForeshadowResult = (): NovelForeshadowAnalysisResult => ({
  newPlants: [],
  fulfillments: [],
  danglingThreads: [],
  warnings: [],
})

const emptyAiClassificationResult = (): NovelChapterClassificationResult => ({
  chapterType: '',
  pacing: '',
  tensionLevel: 0,
  storyFunctions: [],
  informationGain: [],
  activeForeshadows: [],
  tags: [],
  mainConflict: '',
  summary: '',
  rationale: '',
  warnings: [],
})

const aiExtractLoading = ref(false)
const aiChatLoading = ref(false)
const aiChatThinking = ref(false)
const aiExtractError = ref('')
const aiAnalysisKind = ref<AiAnalysisKind>('entities')
const aiExtractResult = ref<NovelEntityExtractResult>(emptyAiExtractResult())
const aiForeshadowResult = ref<NovelForeshadowAnalysisResult>(emptyAiForeshadowResult())
const aiClassificationResult = ref<NovelChapterClassificationResult>(emptyAiClassificationResult())
const aiAppliedActions = ref<Array<{ id: string; text: string; tone: 'applied' | 'ignored' }>>([])
type AiExtractRun = {
  id: string
  createdAt: string
  kind: AiAnalysisKind
  mode: AiExtractMode | null
  chapterId: string
  result: NovelEntityExtractResult
  entityResult?: NovelEntityExtractResult
  foreshadowResult?: NovelForeshadowAnalysisResult
  classificationResult?: NovelChapterClassificationResult
  appliedActions: Array<{ id: string; text: string; tone: 'applied' | 'ignored' }>
}
const aiExtractRuns = ref<AiExtractRun[]>([])
const aiPendingAppliedDetail = ref('')
const aiPendingToolActions = ref<AiPendingToolAction[]>([])
const aiExtractHasRun = ref(false)
const aiExtractLastMode = ref<AiExtractMode | null>(null)
const aiChatMessages = ref<AiDeskChatMessage[]>([])
const conversationHistory = ref<AiMessage[]>([])
type AiDeskChatSession = {
  id: string
  title: string
  updatedAt: string
  lastQuestionAt: string
  kind: AiDeskMode
  messages: AiDeskChatMessage[]
  history: AiMessage[]
  extractState?: {
    hasRun: boolean
    analysisKind: AiAnalysisKind
    lastMode: AiExtractMode | null
    chapterId: string
    result: NovelEntityExtractResult
    foreshadowResult: NovelForeshadowAnalysisResult
    classificationResult: NovelChapterClassificationResult
    appliedActions: Array<{ id: string; text: string; tone: 'applied' | 'ignored' }>
    runs?: AiExtractRun[]
    pendingAppliedDetail: string
    error: string
  }
  uiState?: AiDeskSessionUiState
  pendingToolActions?: AiPendingToolAction[]
}
const aiChatSessions = ref<AiDeskChatSession[]>([])
const aiDeskMode = ref<AiDeskMode>('write')
const activeAiChatSessionId = ref('')
const activeAskSessionId = ref('')
const activeWriteSessionId = ref('')
const openAiChatSessionIds = ref<string[]>([])
const aiSelectionQuote = ref('')
const chapterPinnedQuoteSelection = ref<ChapterPinnedQuoteSelection | null>(null)
const chapterSearchVisible = ref(false)
const chapterSearchQuery = ref('')
const chapterSearchActiveMatchIndex = ref(-1)
const chapterSearchInputRef = ref<HTMLInputElement | null>(null)

const chapterSearchMatches = computed(() =>
  findTextSearchMatches(selectedChapter.value?.content ?? '', chapterSearchQuery.value),
)

const chapterSearchStatusLabel = computed(() => {
  const query = chapterSearchQuery.value.trim()
  if (!query) return ''
  const total = chapterSearchMatches.value.length
  if (total === 0) return '无结果'
  const current = chapterSearchActiveMatchIndex.value >= 0 ? chapterSearchActiveMatchIndex.value + 1 : 1
  return `${current}/${total}`
})

const pinnedQuoteRangeForPaper = computed(() => {
  const pin = chapterPinnedQuoteSelection.value
  const chapter = selectedChapter.value
  if (!pin || !chapter || pin.chapterId !== chapter.id) return null
  return normalizeQuoteRange(pin.start, pin.end, (chapter.content ?? '').length)
})
let aiChatAbortController: AbortController | null = null
let aiContinueAbortController: AbortController | null = null

function emptyAiContinueDraft(): AiContinueDraft {
  return {
    text: '',
    loading: false,
    status: 'idle',
    position: 'end',
    targetChars: 1500,
    prevSummaryCount: 3,
    afterAdoptSummary: true,
    afterAdoptExtract: true,
    enableRag: true,
    insertOffset: null,
    warnings: [],
    droppedLayers: [],
    usedLayers: [],
    usedChars: 0,
    ragHits: [],
  }
}

const aiContinueDraft = ref<AiContinueDraft>(emptyAiContinueDraft())
const aiContinueThinkingText = ref('')
const aiComposerDraft = ref('')
const aiActiveDirectionPreset = ref('')
const aiContinuityBriefLoading = ref(false)
let aiDeskUiPersistTimer: number | null = null
let aiContinuityBriefAbortController: AbortController | null = null

function emptyChapterSummaryDraft(): AiChapterSummaryDraft {
  return { chapterId: '', text: '', loading: false, status: 'idle' }
}

const aiChapterSummaryDraft = ref<AiChapterSummaryDraft>(emptyChapterSummaryDraft())
let aiChapterSummaryAbortController: AbortController | null = null

function emptyAiAskContextMeta(): AiAskContextMeta {
  return { warnings: [], droppedLayers: [], usedLayers: [], usedChars: 0, ragHits: [] }
}

const aiAskContextMeta = ref<AiAskContextMeta>(emptyAiAskContextMeta())
const AI_STUDIO_STORAGE_KEY = 'novel-writing.ai-studio-open'
const AI_TOGGLE_TOP_STORAGE_KEY = 'novel-writing.ai-toggle-top'
const AI_STUDIO_WIDTH_STORAGE_KEY = 'novel-writing.ai-studio-width'
const AI_CHAT_STORAGE_KEY_PREFIX = 'novel-writing.ai-chat.'
const AI_DESK_STATE_STORAGE_KEY_PREFIX = 'novel-writing.ai-desk-state.'
const AI_CHAT_SESSIONS_STORAGE_KEY_PREFIX = 'novel-writing.ai-chat-sessions.'
const aiStudioOpen = ref(readInitialAiStudioOpen())
const aiToggleTop = ref(readInitialAiToggleTop())
const aiStudioWidth = ref(readInitialAiStudioWidth())
const suppressAiToggleClick = ref(false)
let aiTogglePointerId: number | null = null
let aiToggleDragStartY = 0
let aiToggleDragOriginTop = 0
let aiStudioResizerPointerId: number | null = null
let aiStudioResizeStartX = 0
let aiStudioResizeOriginWidth = 0

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

function jumpToCharacterEditorById(characterId: string | null | undefined): void {
  const id = String(characterId ?? '').trim()
  if (!id) return
  const character = characters.value.find((item) => item.id === id)
  if (!character) return
  openHubCharacterGraph(character)
}

function jumpToFactionEditorById(factionId: string | null | undefined): void {
  const id = String(factionId ?? '').trim()
  if (!id) return
  const faction = factions.value.find((item) => item.id === id)
  if (!faction) return
  openHubFactionModal(faction)
}

function jumpToItemEditorById(itemId: string | null | undefined): void {
  const id = String(itemId ?? '').trim()
  if (!id) return
  const item = items.value.find((entry) => entry.id === id)
  if (!item) return
  openWorkspaceItem(item)
}

function openAiSuggestionEditor(payload: {
  section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations'
  index: number
}): void {
  const list = aiExtractResult.value[payload.section]
  const item = Array.isArray(list) ? list[payload.index] : null
  const editorType = item?.uiState?.editorEntityType
  const editorTargetId = item?.uiState?.editorTargetId
  if (!editorType || !editorTargetId) return
  if (editorType === 'character') return jumpToCharacterEditorById(editorTargetId)
  if (editorType === 'faction') return jumpToFactionEditorById(editorTargetId)
  jumpToItemEditorById(editorTargetId)
}

function readInitialAiStudioOpen(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(AI_STUDIO_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function persistAiStudioOpen(open: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AI_STUDIO_STORAGE_KEY, open ? '1' : '0')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('novel-writing:ai-open', { detail: { open } }))
}

function onSetAiStudioOpenEvent(event: Event): void {
  const open = Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open)
  if (open && !requestAiAccess()) {
    aiStudioOpen.value = false
    return
  }
  aiStudioOpen.value = open
}

function clampAiToggleTop(raw: number): number {
  if (typeof window === 'undefined') return Math.max(72, raw)
  const min = 72
  const max = Math.max(min, window.innerHeight - 112)
  return Math.min(max, Math.max(min, raw))
}

function readInitialAiToggleTop(): number {
  if (typeof window === 'undefined') return 96
  try {
    const raw = Number(localStorage.getItem(AI_TOGGLE_TOP_STORAGE_KEY))
    if (Number.isFinite(raw)) return clampAiToggleTop(raw)
  } catch {
    /* ignore */
  }
  return clampAiToggleTop(window.innerHeight * 0.22)
}

function persistAiToggleTop(top: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AI_TOGGLE_TOP_STORAGE_KEY, String(Math.round(top)))
  } catch {
    /* ignore */
  }
}

function clampAiStudioWidth(raw: number): number {
  if (typeof window === 'undefined') return Math.max(360, raw)
  const min = 360
  const max = Math.min(720, Math.max(min + 40, Math.floor(window.innerWidth * 0.56)))
  return Math.min(max, Math.max(min, raw))
}

function readInitialAiStudioWidth(): number {
  if (typeof window === 'undefined') return 420
  try {
    const raw = Number(localStorage.getItem(AI_STUDIO_WIDTH_STORAGE_KEY))
    if (Number.isFinite(raw)) return clampAiStudioWidth(raw)
  } catch {
    /* ignore */
  }
  return clampAiStudioWidth(Math.round(window.innerWidth * 0.28))
}

function defaultAiStudioWidth(): number {
  if (typeof window === 'undefined') return 420
  return clampAiStudioWidth(Math.round(window.innerWidth * 0.28))
}

function dispatchAiStudioWidth(width: number): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('novel-writing:ai-width', { detail: { width } }))
}

function persistAiStudioWidth(width: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AI_STUDIO_WIDTH_STORAGE_KEY, String(Math.round(width)))
  } catch {
    /* ignore */
  }
  dispatchAiStudioWidth(width)
}

function aiChatStorageKey(id: string): string {
  return `${AI_CHAT_STORAGE_KEY_PREFIX}${id}`
}

function aiChatSessionsStorageKey(id: string): string {
  return `${AI_CHAT_SESSIONS_STORAGE_KEY_PREFIX}${id}`
}

function aiDeskStateStorageKey(id: string): string {
  return `${AI_DESK_STATE_STORAGE_KEY_PREFIX}${id}`
}

function createAiChatSession(title = '新聊天', kind: AiDeskMode = 'ask'): AiDeskChatSession {
  const now = new Date().toISOString()
  return {
    id: `chat-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title,
    updatedAt: now,
    lastQuestionAt: '',
    kind,
    messages: [],
    history: [],
    uiState: emptyAiDeskSessionUiState(),
  }
}

function aiChapterUiKey(chapterId = selectedChapterId.value): string {
  return String(chapterId ?? '').trim() || '__novel__'
}

function saveActiveSessionUiState(): void {
  const activeId = activeAiChatSessionId.value
  if (!activeId) return
  const chapterKey = aiChapterUiKey()
  const continueSnapshot = serializeContinueDraft(aiContinueDraft.value)
  aiChatSessions.value = aiChatSessions.value.map((session) => {
    if (session.id !== activeId) return session
    const continueByChapter = { ...(session.uiState?.continueByChapter ?? {}) }
    continueByChapter[chapterKey] = continueSnapshot
    return {
      ...session,
      extractState: currentAiExtractState(),
      uiState: {
        composerDraft: aiComposerDraft.value,
        activeDirectionPreset: aiActiveDirectionPreset.value,
        continueByChapter,
      },
    }
  })
  if (novelId.value) persistAiChatSessions(novelId.value, aiChatSessions.value)
}

function restoreSessionUiState(session: AiDeskChatSession | null | undefined): void {
  const ui = session?.uiState
  aiComposerDraft.value = ui?.composerDraft ?? ''
  aiActiveDirectionPreset.value = ui?.activeDirectionPreset ?? ''
  const chapterKey = aiChapterUiKey()
  aiContinueDraft.value = hydrateContinueDraft(ui?.continueByChapter?.[chapterKey], emptyAiContinueDraft)
}

function schedulePersistActiveSessionUi(): void {
  if (typeof window === 'undefined') return
  if (aiDeskUiPersistTimer != null) window.clearTimeout(aiDeskUiPersistTimer)
  aiDeskUiPersistTimer = window.setTimeout(() => {
    aiDeskUiPersistTimer = null
    saveActiveSessionUiState()
  }, 280)
}

function flushActiveSessionUiState(): void {
  if (aiDeskUiPersistTimer != null) {
    window.clearTimeout(aiDeskUiPersistTimer)
    aiDeskUiPersistTimer = null
  }
  saveActiveSessionUiState()
}

function defaultAiChatSessionTitle(kind: AiDeskMode): string {
  if (selectedChapter.value) {
    return kind === 'write' ? `第${selectedChapter.value.chapterNo}章写作` : `第${selectedChapter.value.chapterNo}章提问`
  }
  return kind === 'write' ? '新写作' : '新提问'
}

function sessionsForDeskMode(kind: AiDeskMode): AiDeskChatSession[] {
  return aiChatSessions.value.filter((session) => session.kind === kind)
}

function rememberActiveSessionForMode(mode: AiDeskMode, sessionId: string): void {
  if (!sessionId) return
  if (mode === 'write') activeWriteSessionId.value = sessionId
  else activeAskSessionId.value = sessionId
}

function resolveActiveSessionIdForMode(mode: AiDeskMode): string {
  const preferred = mode === 'write' ? activeWriteSessionId.value : activeAskSessionId.value
  if (preferred && aiChatSessions.value.some((session) => session.id === preferred && session.kind === mode)) {
    return preferred
  }
  return sessionsForDeskMode(mode)[0]?.id ?? ''
}

function deriveAiChatSessionTitle(messages: AiDeskChatMessage[], fallback = '新聊天'): string {
  const firstUser = messages.find((item) => item.role === 'user')?.content?.trim() || ''
  const base = firstUser.split('\n').map((line) => line.trim()).find(Boolean) || fallback
  return base.length > 18 ? `${base.slice(0, 18)}…` : base
}

function lastQuestionAtFromMessages(messages: AiDeskChatMessage[]): string {
  return messages.filter((msg) => msg.role === 'user').slice(-1)[0]?.createdAt || ''
}

function normalizePendingToolActions(raw: unknown): AiPendingToolAction[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const toolCall = item?.toolCall
      const id = String(item?.id ?? toolCall?.id ?? '').trim()
      if (!id || !toolCall?.function?.name) return null
      return {
        id,
        toolCall,
        label: String(item?.label ?? '').trim() || id,
        status: item?.status === 'applied' || item?.status === 'ignored' ? item.status : 'pending',
      } satisfies AiPendingToolAction
    })
    .filter((row): row is AiPendingToolAction => !!row)
    .filter((row) => row.status === 'pending')
    .slice(0, 24)
}

function normalizeAiHistory(raw: unknown): AiMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => ({
      role: item?.role === 'system' || item?.role === 'tool' || item?.role === 'assistant' ? item.role : 'user',
      content: typeof item?.content === 'string' || item?.content === null ? item.content : String(item?.content ?? ''),
      tool_calls: Array.isArray(item?.tool_calls) ? item.tool_calls : undefined,
      tool_call_id: typeof item?.tool_call_id === 'string' ? item.tool_call_id : undefined,
      name: typeof item?.name === 'string' ? item.name : undefined,
      reasoning_content: typeof item?.reasoning_content === 'string' ? item.reasoning_content : undefined,
    }))
    .slice(-60)
}

function loadAiChatMessages(novelId: string): AiDeskChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(aiChatStorageKey(novelId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => ({
        id: String(item?.id ?? ''),
        role: item?.role === 'user' ? 'user' : 'assistant',
        content: String(item?.content ?? '').trim(),
        mode: item?.mode === 'recent' || item?.mode === 'all' ? item.mode : 'current',
        createdAt: String(item?.createdAt ?? ''),
      }))
      .filter((item) => item.id && item.content)
      .slice(-200)
  } catch {
    return []
  }
}

function normalizeOpenAiChatSessionIds(ids: string[], sessions: AiDeskChatSession[], activeSessionId = ''): string[] {
  const sessionIds = new Set(sessions.map((session) => session.id))
  const next = ids.filter((id, index) => !!id && sessionIds.has(id) && ids.indexOf(id) === index).slice(0, 12)
  if (activeSessionId && sessionIds.has(activeSessionId) && !next.includes(activeSessionId)) next.unshift(activeSessionId)
  return next.slice(0, 12)
}

function loadAiDeskState(
  novelId: string,
): {
  deskMode: AiDeskMode
  activeSessionId: string
  activeAskSessionId: string
  activeWriteSessionId: string
  openSessionIds: string[]
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(aiDeskStateStorageKey(novelId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const deskMode: AiDeskMode = parsed?.deskMode === 'write' ? 'write' : 'ask'
    const activeSessionId = String(parsed?.activeSessionId ?? '').trim()
    const activeAskSessionId = String(parsed?.activeAskSessionId ?? '').trim()
    const activeWriteSessionId = String(parsed?.activeWriteSessionId ?? '').trim()
    const openSessionIds = Array.isArray(parsed?.openSessionIds)
      ? parsed.openSessionIds.map((id: unknown) => String(id ?? '').trim()).filter(Boolean)
      : []
    return activeSessionId || activeAskSessionId || activeWriteSessionId || openSessionIds.length > 0
      ? { deskMode, activeSessionId, activeAskSessionId, activeWriteSessionId, openSessionIds }
      : null
  } catch {
    return null
  }
}

function persistAiDeskState(novelId: string, activeSessionId: string, openSessionIds: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      aiDeskStateStorageKey(novelId),
      JSON.stringify({
        deskMode: aiDeskMode.value,
        activeSessionId,
        activeAskSessionId: activeAskSessionId.value,
        activeWriteSessionId: activeWriteSessionId.value,
        openSessionIds: openSessionIds.slice(0, 12),
      }),
    )
  } catch {
    /* ignore */
  }
}

function loadAiChatSessions(novelId: string): AiDeskChatSession[] {
  if (typeof window === 'undefined') return [createAiChatSession()]
  try {
    const raw = localStorage.getItem(aiChatSessionsStorageKey(novelId))
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const sessions = parsed
          .map((item) => ({
            id: String(item?.id ?? '').trim(),
            title: String(item?.title ?? '新聊天').trim() || '新聊天',
            updatedAt: String(item?.updatedAt ?? new Date().toISOString()),
            lastQuestionAt: String(item?.lastQuestionAt ?? '').trim(),
            kind: item?.kind === 'write' ? 'write' : 'ask',
            messages: Array.isArray(item?.messages) ? item.messages : [],
            history: normalizeAiHistory(item?.history),
            extractState: item?.extractState ? normalizeAiExtractState(item.extractState) : undefined,
            uiState: normalizeAiDeskSessionUiState(item?.uiState),
            pendingToolActions: normalizePendingToolActions(item?.pendingToolActions),
          }))
          .filter((item) => item.id)
          .map((item) => ({
            ...item,
            messages: item.messages
              .map((msg: any) => ({
                id: String(msg?.id ?? ''),
                role: msg?.role === 'user' ? 'user' : 'assistant',
                content: String(msg?.content ?? '').trim(),
                mode: msg?.mode === 'recent' || msg?.mode === 'all' ? msg.mode : 'current',
                createdAt: String(msg?.createdAt ?? ''),
              }))
              .filter((msg: AiDeskChatMessage) => msg.id && msg.content)
              .slice(-200),
          }))
          .map((item) => ({
            ...item,
            lastQuestionAt: item.lastQuestionAt || lastQuestionAtFromMessages(item.messages),
          }))
          .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        if (sessions.length > 0) return ensureDeskModeSessions(sessions.slice(0, 24))
      }
    }
  } catch {
    /* ignore */
  }

  const legacyMessages = loadAiChatMessages(novelId)
  if (legacyMessages.length > 0) {
    return [
      {
        id: `chat-legacy-${Date.now()}`,
        title: deriveAiChatSessionTitle(legacyMessages, '最近聊天'),
        updatedAt: legacyMessages[legacyMessages.length - 1]?.createdAt || new Date().toISOString(),
        lastQuestionAt: lastQuestionAtFromMessages(legacyMessages),
        kind: 'ask',
        messages: legacyMessages,
        history: [],
      },
    ]
  }
  return [createAiChatSession('新提问', 'ask'), createAiChatSession('新写作', 'write')]
}

function ensureDeskModeSessions(sessions: AiDeskChatSession[]): AiDeskChatSession[] {
  const next = [...sessions]
  if (!next.some((session) => session.kind === 'ask')) next.unshift(createAiChatSession('新提问', 'ask'))
  if (!next.some((session) => session.kind === 'write')) next.unshift(createAiChatSession('新写作', 'write'))
  return next.slice(0, 24)
}

function persistAiChatSessions(novelId: string, sessions: AiDeskChatSession[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(aiChatSessionsStorageKey(novelId), JSON.stringify(sessions.slice(0, 24)))
  } catch {
    /* ignore */
  }
}

function persistAiChatMessages(novelId: string, messages: AiDeskChatMessage[]): void {
  const activeId = activeAiChatSessionId.value
  if (!activeId) return
  const updatedAt = messages[messages.length - 1]?.createdAt || new Date().toISOString()
  const nextLastQuestionAt = lastQuestionAtFromMessages(messages)
  aiChatSessions.value = aiChatSessions.value
    .map((session) =>
      session.id === activeId
        ? (() => {
            const chapterKey = aiChapterUiKey()
            const continueByChapter = { ...(session.uiState?.continueByChapter ?? {}) }
            continueByChapter[chapterKey] = serializeContinueDraft(aiContinueDraft.value)
            return {
              ...session,
              title: deriveAiChatSessionTitle(messages, session.title),
              updatedAt,
              lastQuestionAt: messages.length === 0 ? '' : nextLastQuestionAt || session.lastQuestionAt,
              messages: messages.slice(-200),
              history: conversationHistory.value.slice(-60),
              pendingToolActions: aiPendingToolActions.value.filter((row) => row.status === 'pending'),
              extractState: currentAiExtractState(),
              uiState: {
                composerDraft: aiComposerDraft.value,
                activeDirectionPreset: aiActiveDirectionPreset.value,
                continueByChapter,
              },
            }
          })()
        : session,
    )
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  persistAiChatSessions(novelId, aiChatSessions.value)
  openAiChatSessionIds.value = normalizeOpenAiChatSessionIds(openAiChatSessionIds.value, aiChatSessions.value, activeId)
  rememberActiveSessionForMode(aiDeskMode.value, activeId)
  persistAiDeskState(novelId, activeId, openAiChatSessionIds.value)
}

function toggleAiStudio(): void {
  if (suppressAiToggleClick.value) {
    suppressAiToggleClick.value = false
    return
  }
  if (!aiStudioOpen.value && !requestAiAccess()) return
  aiStudioOpen.value = !aiStudioOpen.value
}

async function generateContinuityBrief(): Promise<void> {
  const id = novelId.value
  const currentNovel = novel.value
  if (!id || !currentNovel) return
  if (!requestAiAccess()) return

  aiContinuityBriefAbortController?.abort()
  aiContinuityBriefAbortController = new AbortController()
  aiContinuityBriefLoading.value = true
  aiExtractError.value = ''
  appendAiSystemNote('正在生成全书连续性摘要…')

  try {
    const snapshot = buildNovelWorkspacePayload(id)
    const text = await summarizeNovelContinuityBriefFromWorkspaceStream(
      snapshot,
      {
        novel: {
          title: currentNovel.title,
          summary: currentNovel.summary,
          continuityBrief: currentNovel.continuityBrief,
        },
      },
      {
        onChunk: () => {
          /* 全书摘要一次性展示，无需流式 UI */
        },
        onError: (err: Error) => {
          if (err.name === 'AbortError') return
          aiExtractError.value = err.message || '生成全书摘要失败'
        },
      },
      aiContinuityBriefAbortController.signal,
    )
    const brief = String(text ?? '').trim()
    if (!brief) return
    upsertNovelRecord({
      ...currentNovel,
      continuityBrief: brief,
      updatedAt: new Date().toISOString(),
    })
    appendAiSystemNote(`全书连续性摘要已更新（约 ${brief.length} 字），后续续写将优先引用。`)
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') return
    aiExtractError.value = e instanceof Error ? e.message : '生成全书摘要失败'
  } finally {
    aiContinuityBriefLoading.value = false
    aiContinuityBriefAbortController = null
    void fetchWalletBalance().catch(() => {
      /* ignore */
    })
  }
}

function stopChapterSummaryDraft(): void {
  aiChapterSummaryAbortController?.abort()
}

function ignoreChapterSummaryDraft(): void {
  stopChapterSummaryDraft()
  aiChapterSummaryDraft.value = { ...aiChapterSummaryDraft.value, text: '', loading: false, status: 'ignored' }
  appendAiSystemNote('已忽略章总结草稿')
  window.setTimeout(() => {
    if (aiChapterSummaryDraft.value.status === 'ignored') {
      aiChapterSummaryDraft.value = emptyChapterSummaryDraft()
    }
  }, 800)
}

function applyChapterSummaryDraft(): void {
  const draft = aiChapterSummaryDraft.value
  const summary = formatChapterSummaryText(draft.text).trim()
  if (!draft.chapterId || !summary) return
  updateChapter({ id: draft.chapterId, annotation: summary })
  reload()
  triggerChapterHubSaveToast()
  aiChapterSummaryDraft.value = { ...draft, status: 'applied' }
  appendAiSystemNote('章总结已写入本章「总结」字段')
}

async function runChapterSummaryAfterContinue(
  chapterId: string,
  options?: { autoApply?: boolean },
): Promise<void> {
  const id = novelId.value
  if (!id || !requestAiAccess()) return

  aiChapterSummaryAbortController?.abort()
  aiChapterSummaryAbortController = new AbortController()
  aiChapterSummaryDraft.value = {
    chapterId,
    text: '',
    loading: true,
    status: 'idle',
  }
  appendAiSystemNote('正在生成本章总结草稿，完成后可预览并采用…')

  try {
    const snapshot = buildNovelWorkspacePayload(id)
    const text = await summarizeNovelChapterFromWorkspaceStream(
      snapshot,
      { mode: 'current', chapterIds: [chapterId] },
      {
        onChunk: (chunk: string) => {
          aiChapterSummaryDraft.value = {
            ...aiChapterSummaryDraft.value,
            text: formatChapterSummaryText(aiChapterSummaryDraft.value.text + chunk),
          }
        },
        onError: (err: Error) => {
          if (err.name === 'AbortError') return
          aiExtractError.value = err.message || '章总结生成失败'
        },
      },
      aiChapterSummaryAbortController.signal,
    )
    const summary = formatChapterSummaryText(text || aiChapterSummaryDraft.value.text).trim()
    if (!summary) {
      aiChapterSummaryDraft.value = emptyChapterSummaryDraft()
      appendAiSystemNote('章总结生成结果为空。')
      return
    }
    if (options?.autoApply) {
      updateChapter({ id: chapterId, annotation: summary })
      reload()
      aiChapterSummaryDraft.value = {
        chapterId,
        text: summary,
        loading: false,
        status: 'applied',
      }
      appendAiSystemNote('章总结已自动写入本章「总结」字段')
      return
    }
    aiChapterSummaryDraft.value = {
      chapterId,
      text: summary,
      loading: false,
      status: 'ready',
    }
    appendAiSystemNote('章总结草稿已就绪，请在下方预览后采用或忽略。')
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      aiChapterSummaryDraft.value = {
        ...aiChapterSummaryDraft.value,
        loading: false,
        status: aiChapterSummaryDraft.value.text.trim() ? 'ready' : 'idle',
      }
    } else {
      aiExtractError.value = e instanceof Error ? e.message : '章总结生成失败'
      aiChapterSummaryDraft.value = emptyChapterSummaryDraft()
    }
  } finally {
    aiChapterSummaryAbortController = null
    void fetchWalletBalance().catch(() => {
      /* ignore */
    })
  }
}

const aiChatSessionSummaries = computed(() =>
  openAiChatSessionIds.value
    .map((id) => aiChatSessions.value.find((session) => session.id === id))
    .filter((session): session is AiDeskChatSession => !!session && session.kind === aiDeskMode.value)
    .map((session) => ({
      id: session.id,
      title: session.title || (session.kind === 'write' ? '新写作' : '新提问'),
      updatedAt: session.updatedAt,
    })),
)

const aiChatHistorySummaries = computed(() =>
  sessionsForDeskMode(aiDeskMode.value)
    .slice()
    .sort((a, b) => String(b.lastQuestionAt || b.updatedAt).localeCompare(String(a.lastQuestionAt || a.updatedAt)))
    .map((session) => ({
      id: session.id,
      title: session.title || (session.kind === 'write' ? '新写作' : '新提问'),
      updatedAt: session.updatedAt,
      lastQuestionAt: session.lastQuestionAt || lastQuestionAtFromMessages(session.messages),
    })),
)

function switchAiChatSession(sessionId: string): void {
  flushActiveSessionUiState()
  const target = aiChatSessions.value.find((session) => session.id === sessionId)
  if (!target) return
  aiDeskMode.value = target.kind
  activeAiChatSessionId.value = target.id
  openAiChatSessionIds.value = normalizeOpenAiChatSessionIds([target.id, ...openAiChatSessionIds.value], aiChatSessions.value, target.id)
  aiChatMessages.value = target.messages.slice(-200)
  conversationHistory.value = target.history.slice(-60)
  aiPendingToolActions.value = (target.pendingToolActions ?? []).filter((row) => row.status === 'pending')
  restoreAiExtractStateFromSession(target)
  restoreSessionUiState(target)
  rememberActiveSessionForMode(target.kind, target.id)
  if (novelId.value) persistAiDeskState(novelId.value, target.id, openAiChatSessionIds.value)
}

function startNewAiChat(): void {
  const kind = aiDeskMode.value
  const session = createAiChatSession(defaultAiChatSessionTitle(kind), kind)
  aiChatSessions.value = [session, ...aiChatSessions.value].slice(0, 24)
  switchAiChatSession(session.id)
  aiChatMessages.value = []
  conversationHistory.value = []
  aiPendingToolActions.value = []
  aiAskContextMeta.value = emptyAiAskContextMeta()
  clearChapterQuoteSelection()
  resetAiExtractState()
  if (novelId.value) {
    persistAiChatSessions(novelId.value, aiChatSessions.value)
    persistAiDeskState(novelId.value, session.id, openAiChatSessionIds.value)
  }
}

function switchToAiDeskMode(nextMode: AiDeskMode): void {
  if (aiDeskMode.value === nextMode) return
  rememberActiveSessionForMode(aiDeskMode.value, activeAiChatSessionId.value)
  aiDeskMode.value = nextMode
  const targetId = resolveActiveSessionIdForMode(nextMode)
  if (targetId) {
    switchAiChatSession(targetId)
    return
  }
  const session = createAiChatSession(defaultAiChatSessionTitle(nextMode), nextMode)
  aiChatSessions.value = [session, ...aiChatSessions.value].slice(0, 24)
  switchAiChatSession(session.id)
  if (novelId.value) persistAiChatSessions(novelId.value, aiChatSessions.value)
}

function toggleAiDeskMode(): void {
  const nextMode: AiDeskMode = aiDeskMode.value === 'ask' ? 'write' : 'ask'
  switchToAiDeskMode(nextMode)
}

function closeAiChatSession(sessionId: string): void {
  const filtered = openAiChatSessionIds.value.filter((id) => id !== sessionId)
  if (filtered.length === openAiChatSessionIds.value.length) return
  openAiChatSessionIds.value = normalizeOpenAiChatSessionIds(filtered, aiChatSessions.value)
  if (activeAiChatSessionId.value === sessionId) {
    const fallbackId = openAiChatSessionIds.value[0] || aiChatSessions.value.find((session) => session.id !== sessionId)?.id || ''
    if (fallbackId) {
      switchAiChatSession(fallbackId)
      return
    }
  }
  if (novelId.value) persistAiDeskState(novelId.value, activeAiChatSessionId.value, openAiChatSessionIds.value)
}

function deleteAiChatSession(sessionId: string): void {
  const currentSessions = aiChatSessions.value
  const target = currentSessions.find((session) => session.id === sessionId)
  if (!target) return

  const remaining = currentSessions.filter((session) => session.id !== sessionId)
  let nextSessions = [...remaining]
  if (!nextSessions.some((session) => session.kind === 'ask')) {
    nextSessions = [createAiChatSession('新提问', 'ask'), ...nextSessions]
  }
  if (!nextSessions.some((session) => session.kind === 'write')) {
    nextSessions = [createAiChatSession('新写作', 'write'), ...nextSessions]
  }
  aiChatSessions.value = nextSessions.slice(0, 24)
  openAiChatSessionIds.value = normalizeOpenAiChatSessionIds(openAiChatSessionIds.value.filter((id) => id !== sessionId), aiChatSessions.value)

  if (activeAiChatSessionId.value === sessionId) {
    const nextActive = aiChatSessions.value.find((session) => openAiChatSessionIds.value.includes(session.id)) ?? aiChatSessions.value[0]
    activeAiChatSessionId.value = nextActive.id
    openAiChatSessionIds.value = normalizeOpenAiChatSessionIds([nextActive.id, ...openAiChatSessionIds.value], aiChatSessions.value, nextActive.id)
    aiChatMessages.value = nextActive.messages.slice(-200)
    conversationHistory.value = nextActive.history.slice(-60)
    clearChapterQuoteSelection()
    restoreAiExtractStateFromSession(nextActive)
  }

  if (novelId.value) {
    persistAiChatSessions(novelId.value, aiChatSessions.value)
    persistAiDeskState(novelId.value, activeAiChatSessionId.value || aiChatSessions.value[0]?.id || '', openAiChatSessionIds.value)
  }
}

const aiToggleStyle = computed(() => ({
  top: `${Math.round(aiToggleTop.value)}px`,
}))

const aiWorkspaceStyle = computed(() => ({
  '--chapter-hub-ai-width': `${Math.round(aiStudioWidth.value)}px`,
  '--chapter-hub-ai-column-width': aiStudioOpen.value && !focusMode.value ? `${Math.round(aiStudioWidth.value)}px` : '0px',
}))

function onAiTogglePointerDown(event: PointerEvent): void {
  aiTogglePointerId = event.pointerId
  aiToggleDragStartY = event.clientY
  aiToggleDragOriginTop = aiToggleTop.value
  suppressAiToggleClick.value = false
  const target = event.currentTarget as HTMLElement | null
  target?.setPointerCapture(event.pointerId)
}

function onWindowPointerMove(event: PointerEvent): void {
  if (aiTogglePointerId == null || event.pointerId !== aiTogglePointerId) return
  const delta = event.clientY - aiToggleDragStartY
  if (Math.abs(delta) > 4) suppressAiToggleClick.value = true
  aiToggleTop.value = clampAiToggleTop(aiToggleDragOriginTop + delta)
  return
}

function onWindowPointerMoveForAiStudioResize(event: PointerEvent): void {
  if (aiStudioResizerPointerId == null || event.pointerId !== aiStudioResizerPointerId) return
  const delta = aiStudioResizeStartX - event.clientX
  aiStudioWidth.value = clampAiStudioWidth(aiStudioResizeOriginWidth + delta)
  dispatchAiStudioWidth(aiStudioWidth.value)
}

function clearAiTogglePointerDrag(): void {
  if (aiTogglePointerId == null) return
  aiTogglePointerId = null
  persistAiToggleTop(aiToggleTop.value)
  window.setTimeout(() => {
    suppressAiToggleClick.value = false
  }, 0)
}

function onWindowPointerUp(event: PointerEvent): void {
  if (aiTogglePointerId != null && event.pointerId === aiTogglePointerId) clearAiTogglePointerDrag()
  if (aiStudioResizerPointerId != null && event.pointerId === aiStudioResizerPointerId) clearAiStudioResize()
}

function onWindowPointerCancel(event: PointerEvent): void {
  if (aiTogglePointerId != null && event.pointerId === aiTogglePointerId) clearAiTogglePointerDrag()
  if (aiStudioResizerPointerId != null && event.pointerId === aiStudioResizerPointerId) clearAiStudioResize()
}

function onWindowResize(): void {
  aiToggleTop.value = clampAiToggleTop(aiToggleTop.value)
  aiStudioWidth.value = clampAiStudioWidth(aiStudioWidth.value)
  dispatchAiStudioWidth(aiStudioWidth.value)
}

function onAiStudioResizerPointerDown(event: PointerEvent): void {
  aiStudioResizerPointerId = event.pointerId
  aiStudioResizeStartX = event.clientX
  aiStudioResizeOriginWidth = aiStudioWidth.value
  document.body.classList.add('is-resizing-ai-studio')
  document.body.style.userSelect = 'none'
  const target = event.currentTarget as HTMLElement | null
  target?.setPointerCapture(event.pointerId)
}

function clearAiStudioResize(): void {
  if (aiStudioResizerPointerId == null) return
  aiStudioResizerPointerId = null
  document.body.classList.remove('is-resizing-ai-studio')
  document.body.style.userSelect = ''
  persistAiStudioWidth(aiStudioWidth.value)
}

function resetAiStudioWidth(): void {
  aiStudioWidth.value = defaultAiStudioWidth()
  persistAiStudioWidth(aiStudioWidth.value)
}

function appendAiAppliedAction(text: string, tone: 'applied' | 'ignored' = 'applied'): void {
  const content = String(text ?? '').trim()
  if (!content) return
  aiAppliedActions.value = [
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      text: content,
      tone,
    },
    ...aiAppliedActions.value,
  ].slice(0, 8)
  syncLatestAiExtractRun()
}

function appendAiSystemNote(content: string): void {
  const extra = aiPendingAppliedDetail.value
  aiPendingAppliedDetail.value = ''
  appendAiAppliedAction(`${content}${extra}`, content.includes('忽略') ? 'ignored' : 'applied')
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
  outlineItems,
  selectedChapterId,
  selectedChapter,
  selectedChapterCtx,
  chapterForm,
  reload,
} = useChapterHubData()

const continueOutlineHint = computed(() =>
  buildChapterContinueOutlineHint(
    outlineItems.value,
    selectedChapter.value,
    characters.value.map((row) => ({ id: row.id, name: row.name, goal: row.goal, arc: row.arc })),
  ),
)

const openedChapterTabs = computed(() =>
  props.openChapterIds
    .map((id) => chapters.value.find((chapter) => chapter.id === id))
    .filter((chapter): chapter is (typeof chapters.value)[number] => !!chapter),
)

function preferExisting(existing: string, incoming: string): string {
  const left = String(existing ?? '').trim()
  const right = String(incoming ?? '').trim()
  return left || right
}

function mergeAliases(existing: string[] | undefined, incoming: string[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [...(existing ?? []), ...(incoming ?? [])]) {
    const text = String(raw ?? '').trim()
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function mergeCharacterAttributes(
  existing: CharacterAttribute[] | undefined,
  incoming: CharacterAttribute[] | undefined,
): CharacterAttribute[] {
  const seen = new Set<string>()
  const out: CharacterAttribute[] = []
  for (const raw of [...(existing ?? []), ...(incoming ?? [])]) {
    const key = String(raw?.key ?? '').trim()
    const value = String(raw?.value ?? '').trim()
    const dedupeKey = `${key.toLowerCase()}::${value.toLowerCase()}`
    if (!key || !value || seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    out.push({
      id: String(raw?.id ?? '').trim() || `ai-attr-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      key,
      value,
    })
  }
  return out
}

function pickEarlierChapter(existing?: number | null, incoming?: number | null): number | null {
  const left = typeof existing === 'number' && existing > 0 ? existing : null
  const right = typeof incoming === 'number' && incoming > 0 ? incoming : null
  if (left == null) return right
  if (right == null) return left
  return Math.min(left, right)
}

function updateAiSuggestion(
  section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations',
  index: number,
  patch: Record<string, any>,
): void {
  const next = { ...aiExtractResult.value }
  const list = Array.isArray(next[section]) ? [...next[section]] : []
  if (index >= 0 && index < list.length) {
    list[index] = {
      ...list[index],
      ...patch,
    }
  }
  ;(next as any)[section] = list
  aiExtractResult.value = next
  syncLatestAiExtractRun()
  persistActiveAiSessionState()
}

function syncLatestAiExtractRun(): void {
  if (aiExtractRuns.value.length === 0) return
  const [latest, ...rest] = aiExtractRuns.value
  aiExtractRuns.value = [
    {
      ...latest,
      result: aiExtractResult.value,
      entityResult: aiExtractResult.value,
      foreshadowResult: aiForeshadowResult.value,
      classificationResult: aiClassificationResult.value,
      appliedActions: aiAppliedActions.value,
      mode: aiExtractLastMode.value,
      chapterId: selectedChapterId.value,
    },
    ...rest,
  ]
}

function pushAiExtractRun(
  kind: AiAnalysisKind,
  mode: AiExtractMode,
  payload: {
    entityResult?: NovelEntityExtractResult
    foreshadowResult?: NovelForeshadowAnalysisResult
    classificationResult?: NovelChapterClassificationResult
  },
): void {
  aiExtractRuns.value = [
    {
      id: `extract-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      kind,
      mode,
      chapterId: selectedChapterId.value,
      result: payload.entityResult ?? emptyAiExtractResult(),
      entityResult: payload.entityResult,
      foreshadowResult: payload.foreshadowResult,
      classificationResult: payload.classificationResult,
      appliedActions: [],
    },
    ...aiExtractRuns.value,
  ].slice(0, 12)
}

function setAiSuggestionState(
  section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations',
  index: number,
  status: 'pending' | 'applied' | 'ignored',
  action: 'create' | 'merge' | 'ignore' | null = null,
  editorMeta: { editorEntityType?: 'character' | 'faction' | 'item' | null; editorTargetId?: string | null } = {},
): void {
  updateAiSuggestion(section, index, {
    uiState: {
      status,
      action,
      editorEntityType: editorMeta.editorEntityType ?? null,
      editorTargetId: editorMeta.editorTargetId ?? null,
    },
  })
}

function setAiForeshadowSuggestionState(index: number, status: 'pending' | 'applied' | 'ignored', action: 'create' | 'ignore' | null = null): void {
  const next = { ...aiForeshadowResult.value }
  const list = [...next.newPlants]
  const item = list[index]
  if (!item) return
  list[index] = {
    ...item,
    uiState: {
      status,
      action,
      editorEntityType: null,
      editorTargetId: null,
    },
  }
  aiForeshadowResult.value = { ...next, newPlants: list }
  syncLatestAiExtractRun()
  persistActiveAiSessionState()
}

function setAiClassificationState(status: 'pending' | 'applied' | 'ignored', action: 'merge' | 'ignore' | null = null): void {
  aiClassificationResult.value = {
    ...aiClassificationResult.value,
    uiState: {
      status,
      action,
      editorEntityType: null,
      editorTargetId: selectedChapterId.value || null,
    },
  }
  syncLatestAiExtractRun()
  persistActiveAiSessionState()
}

function findCharacterIdByName(name: string): string | null {
  const needle = String(name ?? '').trim()
  if (!needle) return null
  return characters.value.find((item) => item.name.trim() === needle || (item.aliases ?? []).some((alias) => alias.trim() === needle))?.id ?? null
}

function findFactionIdByName(name: string): string | null {
  const needle = String(name ?? '').trim()
  if (!needle) return null
  return factions.value.find((item) => item.name.trim() === needle)?.id ?? null
}

function resolveItemOwner(item: NovelEntityExtractResult['items'][number]): { ownerType: 'character' | 'faction' | null; ownerId: string | null } {
  if (item.ownerType === 'character') return { ownerType: 'character', ownerId: item.ownerId || findCharacterIdByName(item.ownerName) }
  if (item.ownerType === 'faction') return { ownerType: 'faction', ownerId: item.ownerId || findFactionIdByName(item.ownerName) }
  if (item.ownerName) {
    const characterId = findCharacterIdByName(item.ownerName)
    if (characterId) return { ownerType: 'character', ownerId: characterId }
    const factionId = findFactionIdByName(item.ownerName)
    if (factionId) return { ownerType: 'faction', ownerId: factionId }
  }
  return { ownerType: null, ownerId: null }
}

function finishAiSuggestionApply(
  section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations',
  index: number,
  action: 'create' | 'merge',
  editorMeta: { editorEntityType?: 'character' | 'faction' | 'item' | null; editorTargetId?: string | null } = {},
): void {
  reload()
  triggerChapterHubSaveToast()
  setAiSuggestionState(section, index, 'applied', action, editorMeta)
}

function rewriteCurrentChapterCharacterLabels(oldLabels: string[], nextName: string): boolean {
  const chapter = selectedChapter.value
  if (!chapter) return false
  const content = chapter.content ?? ''
  const nextContent = replaceCharacterLabelsInText(content, oldLabels, nextName)
  if (nextContent === content) return false
  updateChapter({ id: chapter.id, content: nextContent })
  chapters.value = chapters.value.map((item) =>
    item.id === chapter.id ? { ...item, content: nextContent } : item,
  )
  return true
}

function applyCharacterSuggestion(index: number, action: 'create' | 'merge' | 'ignore'): void {
  const item = aiExtractResult.value.characters[index]
  if (!item || item.uiState?.status === 'applied') return
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略角色建议：${item.name}`)
    setAiSuggestionState('characters', index, 'ignored', 'ignore')
    return
  }
  let nextCharacterId = ''
  if (action === 'create') {
    const created = createCharacter({
      novelId: novelId.value,
      name: item.name,
      firstAppearanceChapterNo: item.firstAppearanceChapterNo ?? null,
      age: item.age,
      gender: item.gender,
      goal: item.goal,
      secret: item.secret,
      arc: item.arc,
      notes: item.notes,
      attributes: item.attributes,
      aliases: item.aliases,
    })
    nextCharacterId = created.id
    appendAiSystemNote(`已确认添加角色：${item.name}`)
  } else {
    const targetId = String(item.match.targetId ?? '').trim()
    if (!targetId) return
    const current = characters.value.find((row) => row.id === targetId)
    if (!current) return
    nextCharacterId = current.id
    const rewritten = rewriteCurrentChapterCharacterLabels(normalizeCharacterAliases([item.name, ...item.aliases]), current.name)
    aiPendingAppliedDetail.value = rewritten ? '，并已回写当前章正文' : ''
    updateCharacter({
      id: targetId,
      age: preferExisting(current.age, item.age),
      gender: preferExisting(current.gender, item.gender),
      goal: preferExisting(current.goal, item.goal),
      secret: preferExisting(current.secret, item.secret),
      arc: preferExisting(current.arc, item.arc),
      notes: preferExisting(current.notes, item.notes),
      attributes: mergeCharacterAttributes(current.attributes, item.attributes),
      aliases: mergeAliases(current.aliases, [item.name, ...item.aliases]),
      firstAppearanceChapterNo: pickEarlierChapter(current.firstAppearanceChapterNo, item.firstAppearanceChapterNo),
    })
    appendAiSystemNote(`已确认合并角色：${item.name} -> ${current.name}`)
  }
  finishAiSuggestionApply('characters', index, action, { editorEntityType: 'character', editorTargetId: nextCharacterId })
}

function applyFactionSuggestion(index: number, action: 'create' | 'merge' | 'ignore'): void {
  const item = aiExtractResult.value.factions[index]
  if (!item || item.uiState?.status === 'applied') return
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略势力建议：${item.name}`)
    setAiSuggestionState('factions', index, 'ignored', 'ignore')
    return
  }
  let nextFactionId = ''
  if (action === 'create') {
    const created = createFaction({
      novelId: novelId.value,
      name: item.name,
      leader: item.leader,
      notes: item.notes,
      attributes: item.attributes ?? [],
    })
    nextFactionId = created.id
    appendAiSystemNote(`已确认添加势力：${item.name}`)
  } else {
    const targetId = String(item.match.targetId ?? '').trim()
    if (!targetId) return
    const current = factions.value.find((row) => row.id === targetId)
    if (!current) return
    nextFactionId = current.id
    updateFaction({
      id: targetId,
      leader: preferExisting(current.leader, item.leader),
      notes: preferExisting(current.notes, item.notes),
      attributes: mergeCharacterAttributes(current.attributes, item.attributes ?? []),
    })
    appendAiSystemNote(`已确认合并势力：${item.name} -> ${current.name}`)
  }
  finishAiSuggestionApply('factions', index, action, { editorEntityType: 'faction', editorTargetId: nextFactionId })
}

function applyItemSuggestion(index: number, action: 'create' | 'merge' | 'ignore'): void {
  const item = aiExtractResult.value.items[index]
  if (!item || item.uiState?.status === 'applied') return
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略物品建议：${item.name}`)
    setAiSuggestionState('items', index, 'ignored', 'ignore')
    return
  }
  const owner = resolveItemOwner(item)
  let nextItemId = ''
  if (action === 'create') {
    const created = createItem({
      novelId: novelId.value,
      name: item.name,
      summary: item.summary,
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
    })
    nextItemId = created.id
    appendAiSystemNote(`已确认添加物品：${item.name}`)
  } else {
    const targetId = String(item.match.targetId ?? '').trim()
    if (!targetId) return
    const current = items.value.find((row) => row.id === targetId)
    if (!current) return
    nextItemId = current.id
    updateItem({
      id: targetId,
      summary: preferExisting(current.summary, item.summary),
      ownerType: current.ownerType ?? owner.ownerType,
      ownerId: current.ownerId ?? owner.ownerId,
    })
    appendAiSystemNote(`已确认合并物品：${item.name} -> ${current.name}`)
  }
  finishAiSuggestionApply('items', index, action, { editorEntityType: 'item', editorTargetId: nextItemId })
}

function applyMembershipSuggestion(index: number, action: 'create' | 'merge' | 'ignore'): void {
  const item = aiExtractResult.value.memberships[index]
  if (!item || item.uiState?.status === 'applied') return
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略所属势力建议：${item.characterName} -> ${item.factionName}`)
    setAiSuggestionState('memberships', index, 'ignored', 'ignore')
    return
  }
  const characterId = findCharacterIdByName(item.characterName)
  const factionId = findFactionIdByName(item.factionName)
  if (!characterId || !factionId) {
    aiExtractError.value = '角色所属势力建议缺少可匹配的角色或势力，请先确认实体档案'
    return
  }
  if (action === 'create') {
    createCharacterFactionMembership({
      novelId: novelId.value,
      characterId,
      factionId,
      description: item.description,
    })
    appendAiSystemNote(`已确认添加所属势力：${item.characterName} -> ${item.factionName}`)
  } else {
    const targetId = String(item.match.targetId ?? '').trim()
    if (!targetId) return
    const current = characterFactionMemberships.value.find((row) => row.id === targetId)
    if (!current) return
    updateCharacterFactionMembership({
      id: targetId,
      description: preferExisting(current.description, item.description),
    })
    appendAiSystemNote(`已确认合并所属势力：${item.characterName} -> ${item.factionName}`)
  }
  finishAiSuggestionApply('memberships', index, action, { editorEntityType: 'character', editorTargetId: characterId })
}

function applyRelationSuggestion(index: number, action: 'create' | 'merge' | 'ignore'): void {
  const item = aiExtractResult.value.relations[index]
  if (!item || item.uiState?.status === 'applied') return
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略角色关系建议：${item.fromCharacterName} ↔ ${item.toCharacterName}`)
    setAiSuggestionState('relations', index, 'ignored', 'ignore')
    return
  }
  const fromCharacterId = findCharacterIdByName(item.fromCharacterName)
  const toCharacterId = findCharacterIdByName(item.toCharacterName)
  if (!fromCharacterId || !toCharacterId) {
    aiExtractError.value = '角色关系建议缺少可匹配的角色，请先确认角色档案'
    return
  }
  const exactRelation = getCharacterRelationsByNovelId(novelId.value).find(
    (row) => row.fromCharacterId === fromCharacterId && row.toCharacterId === toCharacterId,
  )
  const reverseRelation = getCharacterRelationsByNovelId(novelId.value).find(
    (row) => row.fromCharacterId === toCharacterId && row.toCharacterId === fromCharacterId,
  )
  if (action === 'create') {
    createCharacterRelation({
      novelId: novelId.value,
      fromCharacterId,
      toCharacterId,
      relationType: item.relationType || '关系',
      note: item.note,
    })
    appendAiSystemNote(`已确认添加角色关系：${item.fromCharacterName} ↔ ${item.toCharacterName}`)
  } else {
    if (exactRelation) {
      updateCharacterRelation({
        id: exactRelation.id,
        relationType: preferExisting(exactRelation.relationType, item.relationType),
        note: preferExisting(exactRelation.note ?? '', item.note),
      })
      appendAiSystemNote(`已确认合并角色关系：${item.fromCharacterName} ↔ ${item.toCharacterName}`)
    } else {
      createCharacterRelation({
        novelId: novelId.value,
        fromCharacterId,
        toCharacterId,
        relationType: item.relationType || reverseRelation?.relationType || '关系',
        note: item.note,
      })
      appendAiSystemNote(`已按识别方向补充角色关系：${item.fromCharacterName} ↔ ${item.toCharacterName}`)
    }
  }
  finishAiSuggestionApply('relations', index, action, { editorEntityType: 'character', editorTargetId: fromCharacterId })
}

function applyForeshadowSuggestion(index: number, action: 'create' | 'ignore'): void {
  const item = aiForeshadowResult.value.newPlants[index]
  if (!item || item.uiState?.status === 'applied') return
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略伏笔建议：${item.title}`)
    setAiForeshadowSuggestionState(index, 'ignored', 'ignore')
    return
  }
  const chapter = selectedChapter.value
  if (!chapter || !novelId.value) return
  const evidence = item.evidences.find((ev) => String(ev.chapterId ?? '').trim() === chapter.id) ?? item.evidences[0]
  const plantText = String(evidence?.quote ?? item.summary ?? item.title).trim()
  createForeshadowPlant({
    novelId: novelId.value,
    title: item.title,
    plantText,
    plantChapterId: String(evidence?.chapterId ?? '').trim() || chapter.id,
    plantChapterNo: Number.isFinite(Number(evidence?.chapterNo)) ? Number(evidence?.chapterNo) : chapter.chapterNo,
    plantChapterTitle: chapter.title,
    description: item.summary,
    expectedFulfillNotes: item.payoffHint,
  })
  reload()
  triggerChapterHubSaveToast()
  appendAiSystemNote(`已确认添加伏笔：${item.title}`)
  setAiForeshadowSuggestionState(index, 'applied', 'create')
}

function classificationSummaryText(result: NovelChapterClassificationResult): string {
  const parts = [
    result.summary,
    result.chapterType ? `类型：${result.chapterType}` : '',
    result.pacing ? `节奏：${result.pacing}` : '',
    result.mainConflict ? `核心冲突：${result.mainConflict}` : '',
    result.storyFunctions.length > 0 ? `章节功能：${result.storyFunctions.join('、')}` : '',
    result.informationGain.length > 0 ? `新增信息：${result.informationGain.join('、')}` : '',
    result.activeForeshadows.length > 0 ? `活跃伏笔：${result.activeForeshadows.join('、')}` : '',
    result.tags.length > 0 ? `标签：${result.tags.join('、')}` : '',
  ]
  return parts.filter(Boolean).join('\n')
}

function applyClassificationSuggestion(action: 'merge' | 'ignore'): void {
  const result = aiClassificationResult.value
  if (result.uiState?.status === 'applied') return
  if (action === 'ignore') {
    appendAiSystemNote('已忽略章节分类建议')
    setAiClassificationState('ignored', 'ignore')
    return
  }
  const chapter = selectedChapter.value
  if (!chapter) return
  const nextAnnotation = classificationSummaryText(result)
  if (!nextAnnotation.trim()) return
  updateChapter({ id: chapter.id, annotation: nextAnnotation })
  reload()
  triggerChapterHubSaveToast()
  appendAiSystemNote('已将章节分类写入本章总结')
  setAiClassificationState('applied', 'merge')
}

function reopenAiSuggestion(
  section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations' | 'foreshadows' | 'classification',
  index: number,
): void {
  if (section === 'foreshadows') {
    const item = aiForeshadowResult.value.newPlants[index]
    if (!item) return
    setAiForeshadowSuggestionState(index, 'pending', null)
    return
  }
  if (section === 'classification') {
    setAiClassificationState('pending', null)
    return
  }
  setAiSuggestionState(section, index, 'pending', null)
}

function applyAiSuggestion(payload: { section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations' | 'foreshadows' | 'classification'; index: number; action: 'create' | 'merge' | 'ignore' | 'reopen' }): void {
  aiExtractError.value = ''
  if (payload.action === 'reopen') {
    reopenAiSuggestion(payload.section, payload.index)
    return
  }
  if (payload.section === 'characters') return applyCharacterSuggestion(payload.index, payload.action)
  if (payload.section === 'factions') return applyFactionSuggestion(payload.index, payload.action)
  if (payload.section === 'items') return applyItemSuggestion(payload.index, payload.action)
  if (payload.section === 'memberships') return applyMembershipSuggestion(payload.index, payload.action)
  if (payload.section === 'foreshadows') return applyForeshadowSuggestion(payload.index, payload.action === 'ignore' ? 'ignore' : 'create')
  if (payload.section === 'classification') return applyClassificationSuggestion(payload.action === 'ignore' ? 'ignore' : 'merge')
  applyRelationSuggestion(payload.index, payload.action)
}

const aiSuggestionCount = computed(
  () =>
    aiExtractResult.value.characters.length +
    aiExtractResult.value.factions.length +
    aiExtractResult.value.items.length +
    aiExtractResult.value.memberships.length +
    aiExtractResult.value.relations.length,
)

const aiConflictCount = computed(() => {
  const groups = [
    aiExtractResult.value.characters,
    aiExtractResult.value.factions,
    aiExtractResult.value.items,
    aiExtractResult.value.memberships,
    aiExtractResult.value.relations,
  ]
  return groups.reduce((total, rows) => total + rows.filter((item) => item.match.type === 'conflict').length, 0)
})

function aiRecentChapterIds(): string[] {
  const current = selectedChapter.value
  if (!current) return []
  return chapters.value
    .filter((chapter) => chapter.chapterNo <= current.chapterNo)
    .sort((a, b) => b.chapterNo - a.chapterNo)
    .slice(0, 3)
    .sort((a, b) => a.chapterNo - b.chapterNo)
    .map((chapter) => chapter.id)
}

function appendAiConversationTurn(role: 'user' | 'assistant', content: string): void {
  const text = String(content ?? '').trim()
  if (!text) return
  conversationHistory.value = [...conversationHistory.value, { role, content: text }].slice(-60)
}

function appendAiChatMessage(role: 'user' | 'assistant', content: string, mode: AiExtractMode): void {
  const text = String(content ?? '').trim()
  if (!text) return
  aiChatMessages.value = [
    ...aiChatMessages.value,
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      role,
      content: text,
      mode,
      createdAt: new Date().toISOString(),
    },
  ]
  appendAiConversationTurn(role, text)
  if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)
}

function scopeLabel(mode: AiExtractMode): string {
  if (mode === 'current') return '当前章'
  if (mode === 'recent') return '最近 3 章'
  return '全书'
}

function buildExtractSummary(result: NovelEntityExtractResult, mode: AiExtractMode): string {
  const suggestionTotal =
    result.characters.length + result.factions.length + result.items.length + result.memberships.length + result.relations.length
  const conflictTotal = [...result.characters, ...result.factions, ...result.items, ...result.memberships, ...result.relations].filter(
    (item) => item.match.type === 'conflict',
  ).length
  const lines = [
    `${scopeLabel(mode)}扫描完成。`,
    `建议 ${suggestionTotal} 条，提醒 ${result.warnings.length} 条，冲突 ${conflictTotal} 条。`,
  ]
  if (result.characters.length > 0) lines.push(`角色建议 ${result.characters.length} 条。`)
  if (result.factions.length > 0) lines.push(`势力建议 ${result.factions.length} 条。`)
  if (result.items.length > 0) lines.push(`物品建议 ${result.items.length} 条。`)
  if (result.memberships.length + result.relations.length > 0) lines.push(`关系建议 ${result.memberships.length + result.relations.length} 条。`)
  if (result.characters.some((item) => item.aliases.length > 0)) {
    lines.push('我也尝试把前文的无名指代并回后文确认的真名角色。')
  }
  return lines.join('\n')
}

function buildForeshadowSummary(result: NovelForeshadowAnalysisResult, mode: AiExtractMode): string {
  const lines = [
    `${scopeLabel(mode)}伏笔检查完成。`,
    `新增伏笔候选 ${result.newPlants.length} 条，疑似回收 ${result.fulfillments.length} 条，待回收线索 ${result.danglingThreads.length} 条。`,
  ]
  if (result.warnings.length > 0) lines.push(`另有 ${result.warnings.length} 条提醒需要留意。`)
  return lines.join('\n')
}

function buildClassificationSummary(result: NovelChapterClassificationResult, mode: AiExtractMode): string {
  const parts = [
    `${scopeLabel(mode)}章节分类完成。`,
    result.chapterType ? `类型偏向“${result.chapterType}”。` : '',
    result.pacing ? `节奏判断为“${result.pacing}”。` : '',
    result.storyFunctions.length > 0 ? `本章功能：${result.storyFunctions.join('、')}。` : '',
    result.mainConflict ? `核心冲突：${result.mainConflict}。` : '',
  ].filter(Boolean)
  if (result.warnings.length > 0) parts.push(`另有 ${result.warnings.length} 条提醒。`)
  return parts.join('\n')
}

function buildCombinedExtractSummary(
  entityResult: NovelEntityExtractResult,
  foreshadowResult: NovelForeshadowAnalysisResult,
  classificationResult: NovelChapterClassificationResult,
  mode: AiExtractMode,
): string {
  const entityTotal =
    entityResult.characters.length + entityResult.factions.length + entityResult.items.length + entityResult.memberships.length + entityResult.relations.length
  const lines = [
    `${scopeLabel(mode)}整理完成。`,
    `实体建议 ${entityTotal} 条，新增伏笔候选 ${foreshadowResult.newPlants.length} 条，分类结果 ${classificationResult.chapterType || '未给出'}。`,
  ]
  const warningTotal = entityResult.warnings.length + foreshadowResult.warnings.length + classificationResult.warnings.length
  if (warningTotal > 0) lines.push(`提醒 ${warningTotal} 条。`)
  return lines.join('\n')
}

function resetAiReadingDesk(): void {
  aiExtractHasRun.value = false
  aiExtractLastMode.value = null
  aiExtractError.value = ''
  aiAnalysisKind.value = 'entities'
  aiExtractResult.value = emptyAiExtractResult()
  aiForeshadowResult.value = emptyAiForeshadowResult()
  aiClassificationResult.value = emptyAiClassificationResult()
  aiAppliedActions.value = []
  aiExtractRuns.value = []
  aiPendingAppliedDetail.value = ''
  aiPendingToolActions.value = []
  aiChatMessages.value = []
  persistActiveAiSessionState()
  if (novelId.value) persistAiChatMessages(novelId.value, [])
}

function resetAiExtractState(): void {
  aiExtractHasRun.value = false
  aiExtractLastMode.value = null
  aiExtractError.value = ''
  aiAnalysisKind.value = 'entities'
  aiExtractResult.value = emptyAiExtractResult()
  aiForeshadowResult.value = emptyAiForeshadowResult()
  aiClassificationResult.value = emptyAiClassificationResult()
  aiAppliedActions.value = []
  aiExtractRuns.value = []
  aiPendingAppliedDetail.value = ''
  persistActiveAiSessionState()
}

async function runAiExtract(mode: AiExtractMode): Promise<void> {
  const id = novelId.value
  if (!id) return
  if ((mode === 'current' || mode === 'recent') && !selectedChapter.value) {
    aiExtractError.value = '请先选择一个章节，再整理当前章。'
    return
  }
  aiExtractLoading.value = true
  aiExtractError.value = ''
  aiExtractHasRun.value = true
  aiExtractLastMode.value = mode
  aiAppliedActions.value = []
  aiPendingAppliedDetail.value = ''
  aiAnalysisKind.value = 'entities'
  aiExtractResult.value = emptyAiExtractResult()
  aiForeshadowResult.value = emptyAiForeshadowResult()
  aiClassificationResult.value = emptyAiClassificationResult()
  persistActiveAiSessionState()
  try {
    const snapshot = buildNovelWorkspacePayload(id)
    const chapterIds =
      mode === 'current' && selectedChapter.value
        ? [selectedChapter.value.id]
        : mode === 'recent'
          ? aiRecentChapterIds()
          : []
    const focusQuote = aiSelectionQuote.value.trim() || undefined
    const [entityResult, foreshadowResult, classificationResult] = await Promise.all([
      extractNovelEntitiesFromWorkspace(snapshot, { mode, chapterIds }),
      analyzeNovelForeshadowsFromWorkspace(snapshot, { mode, chapterIds, focusQuote }),
      classifyNovelChapterFromWorkspace(snapshot, { mode, chapterIds, focusQuote }),
    ])
    aiExtractResult.value = entityResult
    aiForeshadowResult.value = foreshadowResult
    aiClassificationResult.value = classificationResult
    pushAiExtractRun('entities', mode, {
      entityResult: aiExtractResult.value,
      foreshadowResult: aiForeshadowResult.value,
      classificationResult: aiClassificationResult.value,
    })
    appendAiChatMessage('assistant', buildCombinedExtractSummary(aiExtractResult.value, aiForeshadowResult.value, aiClassificationResult.value, mode), mode)
    persistActiveAiSessionState()
  } catch (e: unknown) {
    aiExtractError.value = e instanceof Error ? e.message : 'AI 分析失败，请稍后重试'
    persistActiveAiSessionState()
  } finally {
    aiExtractLoading.value = false
  }
}

function runCurrentAiExtract(): void {
  void runAiExtract('current')
}

function stopAiReadingDesk(): void {
  aiChatAbortController?.abort()
  aiChatThinking.value = false
  aiChatLoading.value = false
}

function resolveContinueCursorOffset(): number {
  const chapter = selectedChapter.value
  const ta = chapterTextareaRef.value
  if (!chapter) return 0
  const content = chapter.content ?? ''
  if (!ta) return content.length
  const start = ta.selectionStart ?? content.length
  return Math.max(0, Math.min(content.length, start))
}

function stopAiContinue(): void {
  aiContinueAbortController?.abort()
  if (aiContinueDraft.value.loading) {
    aiContinueDraft.value = {
      ...aiContinueDraft.value,
      loading: false,
      status: aiContinueDraft.value.text.trim() ? 'ready' : 'idle',
    }
  }
}

async function runAiContinue(payload: { direction: string }): Promise<void> {
  const id = novelId.value
  if (!id) return
  if (!requestAiAccess()) return

  const rawDirection = String(payload.direction ?? '').trim()
  const nextChapterSetup = isNextChapterIntent(rawDirection)
    ? suggestNextChapterOutlineBinding(outlineItems.value, chapters.value, selectedChapter.value)
    : null

  if (isNextChapterIntent(rawDirection)) {
    if (rawDirection) appendAiChatMessage('user', rawDirection, 'current')
    prepareNextChapterForContinue(rawDirection, nextChapterSetup)
  } else if (rawDirection) {
    appendAiChatMessage('user', rawDirection, 'current')
  }

  applyInferredContinueOptions(rawDirection)

  const chapter = selectedChapter.value
  if (!chapter) return

  const direction = buildEffectiveContinueDirection(rawDirection, nextChapterSetup)
  const position: AiContinuePosition = aiContinueDraft.value.position
  const cursorOffset = position === 'cursor' ? resolveContinueCursorOffset() : chapter.content?.length ?? 0

  aiContinueAbortController?.abort()
  aiContinueAbortController = new AbortController()
  aiExtractError.value = ''
  aiContinueThinkingText.value = ''
  aiContinueDraft.value = {
    ...aiContinueDraft.value,
    text: '',
    loading: true,
    status: 'idle',
    insertOffset: position === 'cursor' ? cursorOffset : null,
    warnings: [],
    droppedLayers: [],
    usedLayers: [],
    usedChars: 0,
    ragHits: [],
  }

  if (!aiStudioOpen.value) aiStudioOpen.value = true
  switchToAiDeskMode('write')

  try {
    const snapshot = buildNovelWorkspacePayload(id)
    const result = await continueChapterFromWorkspaceStream(
      snapshot,
      {
        chapterId: chapter.id,
        position,
        cursorOffset,
        targetChars: aiContinueDraft.value.targetChars,
        direction,
        selectionQuote: aiSelectionQuote.value.trim() || undefined,
        prevSummaryCount: aiContinueDraft.value.prevSummaryCount,
        enableRag: aiContinueDraft.value.enableRag,
        novel: novel.value
          ? {
              title: novel.value.title,
              summary: novel.value.summary,
              continuityBrief: novel.value.continuityBrief,
              genre: novel.value.genre,
              perspective: novel.value.perspective,
              tone: novel.value.tone,
            }
          : undefined,
      },
      {
        onChunk: (text: string) => {
          aiContinueDraft.value = {
            ...aiContinueDraft.value,
            text: aiContinueDraft.value.text + text,
          }
        },
        onReasoningChunk: (text: string) => {
          aiContinueThinkingText.value += text
        },
        onError: (err: Error) => {
          if (err.name === 'AbortError') return
          aiExtractError.value = err.message || '续写失败'
        },
      },
      aiContinueAbortController.signal,
    )

    const finalText = (result.text || aiContinueDraft.value.text).trim()
    if (!finalText) {
      aiExtractError.value =
        aiContinueThinkingText.value.trim().length > 0
          ? '模型只返回了思考过程，未生成可写入的正文。请换用对话模型（非纯推理模型）、缩短要求后重试，或改用「提问」模式查看「待确认的修改」。'
          : '续写未生成正文。请确认当前章有大纲绑定或章末有锚点正文，并检查余额与网络后重试。'
      aiContinueDraft.value = {
        ...aiContinueDraft.value,
        loading: false,
        text: '',
        status: 'idle',
        warnings: result.warnings,
        droppedLayers: result.droppedLayers,
        usedLayers: result.usedLayers,
        usedChars: result.usedChars,
        ragHits: result.ragHits,
      }
      return
    }

    aiContinueDraft.value = {
      ...aiContinueDraft.value,
      loading: false,
      text: finalText,
      status: 'ready',
      warnings: result.warnings,
      droppedLayers: result.droppedLayers,
      usedLayers: result.usedLayers,
      usedChars: result.usedChars,
      ragHits: result.ragHits,
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      aiContinueDraft.value = {
        ...aiContinueDraft.value,
        loading: false,
        status: aiContinueDraft.value.text.trim() ? 'ready' : 'idle',
      }
    } else {
      aiExtractError.value = e instanceof Error ? e.message : '续写失败，请稍后重试'
      aiContinueDraft.value = { ...aiContinueDraft.value, loading: false, status: 'idle' }
    }
  } finally {
    aiContinueAbortController = null
    aiContinueThinkingText.value = ''
    if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)
    void fetchWalletBalance().catch(() => {
      /* ignore */
    })
  }
}

async function applyContinueDraft(): Promise<void> {
  const chapter = selectedChapter.value
  const text = aiContinueDraft.value.text.trim()
  if (!chapter || !text) return

  const content = chapter.content ?? ''
  let nextContent = content
  if (aiContinueDraft.value.position === 'end') {
    const gap = content.length > 0 && !content.endsWith('\n') ? '\n\n' : ''
    nextContent = `${content}${gap}${text}`
  } else {
    const offset =
      aiContinueDraft.value.insertOffset ?? resolveContinueCursorOffset()
    nextContent = `${content.slice(0, offset)}${text}${content.slice(offset)}`
  }

  updateChapter({ id: chapter.id, content: nextContent })
  chapters.value = chapters.value.map((item) => (item.id === chapter.id ? { ...item, content: nextContent } : item))
  triggerChapterHubSaveToast()
  aiContinueDraft.value = { ...aiContinueDraft.value, status: 'applied' }
  appendAiSystemNote(`已采用续写内容（约 ${text.length} 字）写入正文；将自动更新章总结并整理人物档案…`)
  appendAiChatMessage('assistant', `【已采用续写】${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`, 'current')
  if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)

  void runChapterSummaryAfterContinue(chapter.id, { autoApply: true })
  switchToAiDeskMode('ask')
  void runAiExtract('current')
}

function ignoreContinueDraft(): void {
  aiContinueDraft.value = { ...aiContinueDraft.value, status: 'ignored', text: '' }
  appendAiSystemNote('已忽略本次续写草稿')
}

function aiToolExecutionContext() {
  return { defaultChapterId: selectedChapterId.value || selectedChapter.value?.id }
}

function openChapterById(chapterId: string): void {
  const id = String(chapterId ?? '').trim()
  if (!id) return
  selectedChapterId.value = id
  props.onOpenChapter?.(id)
}

function createAndOpenNextChapter(titleHint = '', outlineItemIds: string[] = []): Chapter | null {
  const id = novelId.value
  if (!id) return null
  const chapter = createChapter({
    novelId: id,
    title: titleHint.trim(),
    notes: '',
    annotation: '',
  })
  if (outlineItemIds.length > 0) {
    updateChapter({ id: chapter.id, outlineItemIds })
  }
  reload()
  openChapterById(chapter.id)
  return chapter
}

function applyInferredContinueOptions(direction: string): void {
  const inferred = inferContinueOptionsFromDirection(direction)
  aiContinueDraft.value = {
    ...aiContinueDraft.value,
    position: inferred.position,
    targetChars: inferred.targetChars,
    prevSummaryCount: inferred.prevSummaryCount,
    afterAdoptSummary: true,
    afterAdoptExtract: true,
    enableRag: true,
  }
}

function buildEffectiveContinueDirection(
  userDirection: string,
  setup: ReturnType<typeof suggestNextChapterOutlineBinding>,
): string {
  const base = String(userDirection ?? '').trim()
  const outlinePart = setup?.suggestedDirection || setup?.beatLine || ''
  if (base && outlinePart) return `${base}\n（大纲节拍：${outlinePart}）`
  return base || outlinePart
}

function prepareNextChapterForContinue(
  userDirection: string,
  setup: ReturnType<typeof suggestNextChapterOutlineBinding>,
): boolean {
  if (!isNextChapterIntent(userDirection)) return false
  const created = createAndOpenNextChapter(setup?.title ?? '', setup?.outlineItemIds ?? [])
  if (!created) return true
  aiContinueDraft.value = emptyAiContinueDraft()
  const beatNote = setup?.beatLine ? `\n${setup.beatLine}` : ''
  appendAiChatMessage(
    'assistant',
    `已新建第 ${created.chapterNo} 章${setup?.title ? `「${setup.title}」` : ''}，正在按你的要求与大纲生成正文草稿（见下方，采用后写入稿纸）。${beatNote}`,
    'current',
  )
  return true
}

function applyAiPendingToolActions(): void {
  const pending = aiPendingToolActions.value.filter((row) => row.status === 'pending')
  if (!novelId.value || pending.length === 0) return
  const messages: string[] = []
  const appliedRows: AiMessage[] = []
  let createdChapterId = ''
  for (const action of pending) {
    const result = executeToolCall(novelId.value, action.toolCall, aiToolExecutionContext())
    messages.push(result.message)
    if (action.toolCall.function.name === 'create_chapter' && result.success) {
      createdChapterId = String(result.data?.chapterId ?? '').trim()
    }
    appliedRows.push({
      role: 'tool',
      tool_call_id: action.toolCall.id,
      content: JSON.stringify(result),
    })
    action.status = result.success ? 'applied' : 'pending'
  }
  conversationHistory.value = [...conversationHistory.value, ...appliedRows].slice(-60)
  aiPendingToolActions.value = []
  reload()
  triggerChapterHubSaveToast()
  if (createdChapterId) openChapterById(createdChapterId)
  appendAiChatMessage('assistant', `【已采用】${messages.join('；')}`, 'current')
  if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)
}

function applyOneAiPendingToolAction(actionId: string): void {
  const action = aiPendingToolActions.value.find((row) => row.id === actionId && row.status === 'pending')
  if (!action || !novelId.value) return
  const result = executeToolCall(novelId.value, action.toolCall, aiToolExecutionContext())
  action.status = result.success ? 'applied' : 'pending'
  conversationHistory.value = [
    ...conversationHistory.value,
    { role: 'tool', tool_call_id: action.toolCall.id, content: JSON.stringify(result) },
  ].slice(-60)
  aiPendingToolActions.value = aiPendingToolActions.value.filter((row) => row.status === 'pending')
  reload()
  triggerChapterHubSaveToast()
  if (action.toolCall.function.name === 'create_chapter' && result.success) {
    const chapterId = String(result.data?.chapterId ?? '').trim()
    if (chapterId) openChapterById(chapterId)
  }
  appendAiChatMessage('assistant', `【已采用】${result.message}`, 'current')
  if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)
}

function ignoreAiPendingToolActions(silent = false): void {
  const pending = aiPendingToolActions.value.filter((row) => row.status === 'pending')
  if (pending.length === 0) return
  for (const action of pending) {
    conversationHistory.value = [
      ...conversationHistory.value,
      {
        role: 'tool',
        tool_call_id: action.toolCall.id,
        content: JSON.stringify({ success: false, message: '作者未采用此修改' }),
      },
    ].slice(-60)
    action.status = 'ignored'
  }
  aiPendingToolActions.value = []
  if (!silent) {
    appendAiChatMessage('assistant', '【已忽略】本次修改提案未写入作品。', 'current')
    if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)
  }
}

const WRITE_BODY_INTENT_RE =
  /(续写|写下一章|下一章内容|按大纲写|根据大纲写|撰写本章|生成正文|写出本章|写本章|按节拍写)/

async function askAiReadingDesk(payload: { question: string; mode?: AiDeskMode }): Promise<void> {
  const id = novelId.value
  if (!id) return
  if (!selectedChapter.value) {
    aiExtractError.value = '请先选择章节后再使用 AI。'
    return
  }
  const deskMode = payload.mode ?? aiDeskMode.value
  const question = String(payload.question ?? '').trim()
  if (deskMode === 'write' || (deskMode === 'ask' && WRITE_BODY_INTENT_RE.test(question))) {
    const switchedFromAsk = deskMode === 'ask'
    if (switchedFromAsk) switchToAiDeskMode('write')

    if (isNextChapterIntent(question)) {
      await runAiContinue({ direction: question })
      return
    }

    if (switchedFromAsk) {
      appendAiChatMessage(
        'assistant',
        '已识别为生成正文任务：请在下方「续写草稿」中预览，点「采用」后才会写入稿纸。',
        'current',
      )
    }
    await runAiContinue({ direction: question })
    return
  }

  const quoted = aiSelectionQuote.value.trim()
  const composedQuestion = quoted
    ? `请结合以下引用片段回答：\n「${quoted}」\n\n作者问题：${question}`
    : question
  if (aiPendingToolActions.value.some((row) => row.status === 'pending')) {
    ignoreAiPendingToolActions(true)
  }
  appendAiChatMessage('user', quoted ? `引用：${quoted}\n${question}` : question, 'current')
  aiChatLoading.value = true
  aiChatThinking.value = true
  aiExtractError.value = ''
  aiChatAbortController?.abort()
  aiChatAbortController = new AbortController()
  const msgId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const msg: AiDeskChatMessage = {
    id: msgId,
    role: 'assistant' as const,
    content: '',
    mode: 'current' as const,
    createdAt: new Date().toISOString(),
  }
  aiChatMessages.value = [...aiChatMessages.value, msg]
  try {
    const snapshot = buildNovelWorkspacePayload(id)
    const streamCallbacks = {
      onChunk: (text: string) => {
        if (aiChatThinking.value) aiChatThinking.value = false
        msg.content += text
      },
      onError: (err: Error) => {
        if (err.name === 'AbortError') return
        aiExtractError.value = err.message || 'AI 请求失败'
      },
    }
    const { history, contextMeta, pendingToolActions, text } = await askAiWithToolsStream(
      snapshot,
      {
        mode: 'current',
        question: composedQuestion,
        chapterIds: selectedChapter.value ? [selectedChapter.value.id] : [],
        novelId: id,
        selectionQuote: quoted || undefined,
        prevSummaryCount: 3,
        enableRag: true,
        novel: novel.value
          ? {
              title: novel.value.title,
              summary: novel.value.summary,
              continuityBrief: novel.value.continuityBrief,
              genre: novel.value.genre,
              perspective: novel.value.perspective,
              tone: novel.value.tone,
            }
          : undefined,
      },
      streamCallbacks,
      conversationHistory.value.length > 0 ? conversationHistory.value : undefined,
      aiChatAbortController.signal,
      {
        alwaysEnableTools: true,
        confirmBeforeApply: true,
        toolContext: aiToolExecutionContext(),
      },
    )
    conversationHistory.value = history
    aiAskContextMeta.value = {
      warnings: contextMeta.warnings,
      droppedLayers: contextMeta.droppedLayers,
      usedLayers: contextMeta.usedLayers,
      usedChars: contextMeta.usedChars,
      ragHits: contextMeta.ragHits,
    }
    if (pendingToolActions && pendingToolActions.length > 0) {
      aiPendingToolActions.value = pendingToolActions
      const hasChapterDraft = pendingToolActions.some((row) => row.toolCall.function.name === 'update_chapter_content')
      msg.content = hasChapterDraft
        ? `${text}\n\n正文已写入上方「待确认的修改」卡片（显示开头预览），请点「采用」后才会出现在稿纸。`
        : text
      aiChatThinking.value = false
    } else if (!msg.content.trim()) {
      msg.content = text?.trim() || '已回答完毕，但这次没有生成可显示的内容。'
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      if (!msg.content.trim()) msg.content = '已停止回答。'
    } else if (!msg.content.trim()) {
      aiChatMessages.value = aiChatMessages.value.filter((m) => m.id !== msgId)
      aiExtractError.value = e instanceof Error ? e.message : 'AI 请求失败，请稍后重试'
    }
  } finally {
    aiChatLoading.value = false
    aiChatThinking.value = false
    aiChatAbortController = null
    if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)
    void fetchWalletBalance().catch(() => {
      /* ignore */
    })
  }
}

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

function snapshotSelectionFromCtxMenu(): { start: number; end: number; text: string } | null {
  const r = ctxMenuRange.value
  const ch = selectedChapter.value
  if (!r || !ch || r.end <= r.start) return null
  const content = ch.content ?? ''
  return {
    start: r.start,
    end: r.end,
    text: content.slice(r.start, r.end),
  }
}

function excerptForAiQuote(text: string, limit = 220): string {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}...`
}

function snapshotForeshadowSelectionFromCtxMenu(): void {
  pendingForeshadowSelection.value = snapshotSelectionFromCtxMenu()
}

function clearChapterQuoteSelection(): void {
  aiSelectionQuote.value = ''
  chapterPinnedQuoteSelection.value = null
  const ta = chapterTextareaRef.value
  if (ta) {
    const pos = ta.selectionEnd ?? ta.value.length
    ta.setSelectionRange(pos, pos)
  }
}

function syncAiSelectionQuoteFromTextarea(): void {
  const ta = chapterTextareaRef.value
  const chapter = selectedChapter.value
  if (!ta || !chapter) {
    clearChapterQuoteSelection()
    return
  }
  const start = ta.selectionStart ?? 0
  const end = ta.selectionEnd ?? start
  const range = normalizeQuoteRange(start, end, (chapter.content ?? '').length)
  if (!range) {
    clearChapterQuoteSelection()
    return
  }
  chapterPinnedQuoteSelection.value = { chapterId: chapter.id, start: range.start, end: range.end }
  aiSelectionQuote.value = excerptForAiQuote((chapter.content ?? '').slice(range.start, range.end))
  closeCtxMenu()
  engageChapterWritingView()
  if (aiSelectionQuote.value && !focusMode.value) {
    if (!requestAiAccess()) return
    aiStudioOpen.value = true
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

function normalizeAiSuggestionUiState(raw: any) {
  if (raw?.status !== 'applied' && raw?.status !== 'ignored' && raw?.status !== 'pending') return undefined
  return {
    status: raw.status,
    action: raw?.action === 'create' || raw?.action === 'merge' || raw?.action === 'ignore' ? raw.action : null,
    editorEntityType: raw?.editorEntityType === 'character' || raw?.editorEntityType === 'faction' || raw?.editorEntityType === 'item' ? raw.editorEntityType : null,
    editorTargetId: String(raw?.editorTargetId ?? '').trim() || null,
  }
}

function normalizeForeshadowResult(raw: any): NovelForeshadowAnalysisResult {
  return {
    newPlants: Array.isArray(raw?.newPlants)
      ? raw.newPlants
          .map((item: any) => ({
            title: String(item?.title ?? '').trim(),
            summary: String(item?.summary ?? '').trim(),
            payoffHint: String(item?.payoffHint ?? '').trim(),
            confidence: Number.isFinite(Number(item?.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : 0,
            evidences: Array.isArray(item?.evidences) ? item.evidences : [],
            warnings: Array.isArray(item?.warnings) ? item.warnings.map((value: unknown) => String(value ?? '').trim()).filter(Boolean) : [],
            uiState: normalizeAiSuggestionUiState(item?.uiState),
          }))
          .filter((item: { title: string }) => item.title)
      : [],
    fulfillments: Array.isArray(raw?.fulfillments)
      ? raw.fulfillments
          .map((item: any) => ({
            title: String(item?.title ?? '').trim(),
            summary: String(item?.summary ?? '').trim(),
            relatedPlantTitle: String(item?.relatedPlantTitle ?? '').trim(),
            status: item?.status === 'implicit' ? 'implicit' : 'existing',
            confidence: Number.isFinite(Number(item?.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : 0,
            evidences: Array.isArray(item?.evidences) ? item.evidences : [],
            warnings: Array.isArray(item?.warnings) ? item.warnings.map((value: unknown) => String(value ?? '').trim()).filter(Boolean) : [],
          }))
          .filter((item: { title: string }) => item.title)
      : [],
    danglingThreads: Array.isArray(raw?.danglingThreads)
      ? raw.danglingThreads
          .map((item: any) => ({
            title: String(item?.title ?? '').trim(),
            summary: String(item?.summary ?? '').trim(),
            lastMentionChapterNo: Number.isFinite(Number(item?.lastMentionChapterNo)) ? Math.trunc(Number(item.lastMentionChapterNo)) : null,
            suggestedPayoff: String(item?.suggestedPayoff ?? '').trim(),
            confidence: Number.isFinite(Number(item?.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : 0,
            evidences: Array.isArray(item?.evidences) ? item.evidences : [],
            warnings: Array.isArray(item?.warnings) ? item.warnings.map((value: unknown) => String(value ?? '').trim()).filter(Boolean) : [],
          }))
          .filter((item: { title: string }) => item.title)
      : [],
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.map((value: unknown) => String(value ?? '').trim()).filter(Boolean) : [],
  }
}

function normalizeClassificationResult(raw: any): NovelChapterClassificationResult {
  const tensionLevel = Number(raw?.tensionLevel)
  return {
    chapterType: String(raw?.chapterType ?? '').trim(),
    pacing: String(raw?.pacing ?? '').trim(),
    tensionLevel: Number.isFinite(tensionLevel) ? Math.max(1, Math.min(5, Math.trunc(tensionLevel))) : 0,
    storyFunctions: Array.isArray(raw?.storyFunctions) ? raw.storyFunctions.map((value: unknown) => String(value ?? '').trim()).filter(Boolean) : [],
    informationGain: Array.isArray(raw?.informationGain) ? raw.informationGain.map((value: unknown) => String(value ?? '').trim()).filter(Boolean) : [],
    activeForeshadows: Array.isArray(raw?.activeForeshadows) ? raw.activeForeshadows.map((value: unknown) => String(value ?? '').trim()).filter(Boolean) : [],
    tags: Array.isArray(raw?.tags) ? raw.tags.map((value: unknown) => String(value ?? '').trim()).filter(Boolean) : [],
    mainConflict: String(raw?.mainConflict ?? '').trim(),
    summary: String(raw?.summary ?? '').trim(),
    rationale: String(raw?.rationale ?? '').trim(),
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.map((value: unknown) => String(value ?? '').trim()).filter(Boolean) : [],
    uiState: normalizeAiSuggestionUiState(raw?.uiState),
  }
}

function normalizeAiExtractState(raw: any) {
  const normalized = {
    hasRun: !!raw?.hasRun,
    analysisKind: raw?.analysisKind === 'foreshadows' || raw?.analysisKind === 'classification' ? raw.analysisKind : 'entities',
    lastMode: raw?.lastMode === 'recent' || raw?.lastMode === 'all' ? raw.lastMode : raw?.lastMode === 'current' ? 'current' : null,
    chapterId: String(raw?.chapterId ?? ''),
    result: {
      characters: Array.isArray(raw?.result?.characters) ? raw.result.characters : [],
      factions: Array.isArray(raw?.result?.factions) ? raw.result.factions : [],
      items: Array.isArray(raw?.result?.items) ? raw.result.items : [],
      memberships: Array.isArray(raw?.result?.memberships) ? raw.result.memberships : [],
      relations: Array.isArray(raw?.result?.relations) ? raw.result.relations : [],
      warnings: Array.isArray(raw?.result?.warnings) ? raw.result.warnings.map((item: unknown) => String(item ?? '').trim()).filter(Boolean) : [],
    } as NovelEntityExtractResult,
    appliedActions: Array.isArray(raw?.appliedActions)
      ? raw.appliedActions
          .map((item: any) => ({
            id: String(item?.id ?? '').trim(),
            text: String(item?.text ?? '').trim(),
            tone: item?.tone === 'ignored' ? 'ignored' : 'applied',
          }))
          .filter((item: { id: string; text: string; tone: 'applied' | 'ignored' }) => item.id && item.text)
      : [],
    foreshadowResult: normalizeForeshadowResult(raw?.foreshadowResult),
    classificationResult: normalizeClassificationResult(raw?.classificationResult),
    runs: Array.isArray(raw?.runs)
      ? raw.runs
          .map((item: any) => ({
            id: String(item?.id ?? '').trim(),
            createdAt: String(item?.createdAt ?? '').trim() || new Date().toISOString(),
            kind: item?.kind === 'foreshadows' || item?.kind === 'classification' ? item.kind : 'entities',
            mode: item?.mode === 'recent' || item?.mode === 'all' ? item.mode : item?.mode === 'current' ? 'current' : null,
            chapterId: String(item?.chapterId ?? '').trim(),
            result: {
              characters: Array.isArray(item?.result?.characters) ? item.result.characters : [],
              factions: Array.isArray(item?.result?.factions) ? item.result.factions : [],
              items: Array.isArray(item?.result?.items) ? item.result.items : [],
              memberships: Array.isArray(item?.result?.memberships) ? item.result.memberships : [],
              relations: Array.isArray(item?.result?.relations) ? item.result.relations : [],
              warnings: Array.isArray(item?.result?.warnings) ? item.result.warnings.map((value: unknown) => String(value ?? '').trim()).filter(Boolean) : [],
            } as NovelEntityExtractResult,
            entityResult: {
              characters: Array.isArray(item?.entityResult?.characters)
                ? item.entityResult.characters
                : Array.isArray(item?.result?.characters)
                  ? item.result.characters
                  : [],
              factions: Array.isArray(item?.entityResult?.factions)
                ? item.entityResult.factions
                : Array.isArray(item?.result?.factions)
                  ? item.result.factions
                  : [],
              items: Array.isArray(item?.entityResult?.items)
                ? item.entityResult.items
                : Array.isArray(item?.result?.items)
                  ? item.result.items
                  : [],
              memberships: Array.isArray(item?.entityResult?.memberships)
                ? item.entityResult.memberships
                : Array.isArray(item?.result?.memberships)
                  ? item.result.memberships
                  : [],
              relations: Array.isArray(item?.entityResult?.relations)
                ? item.entityResult.relations
                : Array.isArray(item?.result?.relations)
                  ? item.result.relations
                  : [],
              warnings: Array.isArray(item?.entityResult?.warnings)
                ? item.entityResult.warnings.map((value: unknown) => String(value ?? '').trim()).filter(Boolean)
                : Array.isArray(item?.result?.warnings)
                  ? item.result.warnings.map((value: unknown) => String(value ?? '').trim()).filter(Boolean)
                  : [],
            } as NovelEntityExtractResult,
            foreshadowResult: normalizeForeshadowResult(item?.foreshadowResult),
            classificationResult: normalizeClassificationResult(item?.classificationResult),
            appliedActions: Array.isArray(item?.appliedActions)
              ? item.appliedActions
                  .map((entry: any) => ({
                    id: String(entry?.id ?? '').trim(),
                    text: String(entry?.text ?? '').trim(),
                    tone: entry?.tone === 'ignored' ? 'ignored' : 'applied',
                  }))
                  .filter((entry: { id: string; text: string; tone: 'applied' | 'ignored' }) => entry.id && entry.text)
              : [],
          }))
          .filter((item: AiExtractRun) => item.id)
      : [],
    pendingAppliedDetail: String(raw?.pendingAppliedDetail ?? ''),
    error: String(raw?.error ?? ''),
  }
  if (normalized.runs.length === 0 && normalized.hasRun) {
    normalized.runs = [
      {
        id: `extract-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        kind: normalized.analysisKind,
        mode: normalized.lastMode,
        chapterId: normalized.chapterId,
        result: normalized.result,
        entityResult: normalized.result,
        foreshadowResult: normalized.foreshadowResult,
        classificationResult: normalized.classificationResult,
        appliedActions: normalized.appliedActions,
      },
    ]
  }
  return normalized
}

function currentAiExtractState() {
  return {
    hasRun: aiExtractHasRun.value,
    analysisKind: aiAnalysisKind.value,
    lastMode: aiExtractLastMode.value,
    chapterId: selectedChapterId.value,
    result: aiExtractResult.value,
    foreshadowResult: aiForeshadowResult.value,
    classificationResult: aiClassificationResult.value,
    appliedActions: aiAppliedActions.value,
    runs: aiExtractRuns.value,
    pendingAppliedDetail: aiPendingAppliedDetail.value,
    error: aiExtractError.value,
  }
}

function restoreAiExtractStateFromSession(session: AiDeskChatSession | null | undefined): void {
  const state = session?.extractState
  if (!state) {
    resetAiExtractState()
    return
  }
  if (state.chapterId && state.chapterId !== selectedChapterId.value) {
    resetAiExtractState()
    return
  }
  aiExtractHasRun.value = state.hasRun
  aiAnalysisKind.value = state.analysisKind ?? 'entities'
  aiExtractLastMode.value = state.lastMode
  aiExtractResult.value = state.result
  aiForeshadowResult.value = state.foreshadowResult ?? emptyAiForeshadowResult()
  aiClassificationResult.value = state.classificationResult ?? emptyAiClassificationResult()
  aiAppliedActions.value = state.appliedActions
  aiExtractRuns.value = state.runs ?? []
  aiPendingAppliedDetail.value = state.pendingAppliedDetail
  aiExtractError.value = state.error
}

function persistActiveAiSessionState(): void {
  if (!novelId.value || !activeAiChatSessionId.value) return
  saveActiveSessionUiState()
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
  const pin = chapterPinnedQuoteSelection.value
  const chapter = selectedChapter.value
  if (!pin || !chapter || pin.chapterId !== chapterId) return
  const len = (chapter.content ?? '').length
  if (pin.start >= len || pin.end > len) clearChapterQuoteSelection()
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
  onChapterTextareaBeforeInput,
  onChapterTextareaKeyup: handleChapterTextareaKeyup,
  onChapterPaperPointerDown,
  onAiStudioPointerDown,
  engageChapterWritingView,
  exitChapterWritingView,
  onChapterTextareaFocus,
  onChapterTextareaBlur: handleChapterTextareaBlur,
  onChapterTextareaMouseup: handleChapterTextareaMouseup,
  onChapterTextareaSelect: handleChapterTextareaSelect,
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
  hasPinnedQuoteSelection: () => Boolean(chapterPinnedQuoteSelection.value),
})

function onChapterTextareaKeyup(event: KeyboardEvent): void {
  handleChapterTextareaKeyup(event)
  window.setTimeout(syncAiSelectionQuoteFromTextarea, 0)
}

function onChapterTextareaMouseup(event: MouseEvent): void {
  handleChapterTextareaMouseup(event)
  window.setTimeout(syncAiSelectionQuoteFromTextarea, 0)
}

function onChapterTextareaSelect(): void {
  handleChapterTextareaSelect()
  window.setTimeout(syncAiSelectionQuoteFromTextarea, 0)
}

function onChapterTextareaBlur(event: FocusEvent): void {
  handleChapterTextareaBlur(event)
}

watch(selectedChapterId, (nextId, prevId) => {
  clearChapterQuoteSelection()
  const activeId = activeAiChatSessionId.value
  if (activeId && prevId) {
    const prevKey = String(prevId).trim() || '__novel__'
    const continueSnapshot = serializeContinueDraft(aiContinueDraft.value)
    aiChatSessions.value = aiChatSessions.value.map((session) => {
      if (session.id !== activeId) return session
      const continueByChapter = { ...(session.uiState?.continueByChapter ?? {}) }
      continueByChapter[prevKey] = continueSnapshot
      return {
        ...session,
        uiState: {
          composerDraft: aiComposerDraft.value,
          activeDirectionPreset: aiActiveDirectionPreset.value,
          continueByChapter,
        },
      }
    })
  }
  const activeSession = aiChatSessions.value.find((session) => session.id === activeId)
  restoreAiExtractStateFromSession(activeSession)
  if (activeSession) {
    const chapterKey = String(nextId ?? '').trim() || '__novel__'
    aiContinueDraft.value = hydrateContinueDraft(activeSession.uiState?.continueByChapter?.[chapterKey], emptyAiContinueDraft)
  }
})

watch(aiStudioOpen, (open) => {
  if (open && !requestAiAccess()) {
    aiStudioOpen.value = false
    return
  }
  persistAiStudioOpen(open)
})

watch(
  novelId,
  (id) => {
    const sessions = ensureDeskModeSessions(
      id ? loadAiChatSessions(id) : [createAiChatSession('新提问', 'ask'), createAiChatSession('新写作', 'write')],
    )
    aiChatSessions.value = sessions
    const savedState = id ? loadAiDeskState(id) : null
    aiDeskMode.value = savedState?.deskMode === 'write' ? 'write' : 'ask'
    activeAskSessionId.value = savedState?.activeAskSessionId ?? ''
    activeWriteSessionId.value = savedState?.activeWriteSessionId ?? ''
    let activeId =
      savedState?.activeSessionId && sessions.some((session) => session.id === savedState.activeSessionId)
        ? savedState.activeSessionId
        : ''
    if (!activeId || !sessions.some((session) => session.id === activeId && session.kind === aiDeskMode.value)) {
      activeId = resolveActiveSessionIdForMode(aiDeskMode.value) || sessions.find((session) => session.kind === aiDeskMode.value)?.id || ''
    }
    openAiChatSessionIds.value = normalizeOpenAiChatSessionIds(
      savedState?.openSessionIds ?? sessions.filter((session) => session.kind === aiDeskMode.value).slice(0, 4).map((session) => session.id),
      sessions,
      activeId,
    )
    activeAiChatSessionId.value = activeId
    const activeSession = sessions.find((session) => session.id === activeId) ?? sessions[0]
    aiChatMessages.value = activeSession?.messages.slice(-200) ?? []
    conversationHistory.value = activeSession?.history.slice(-60) ?? []
    rememberActiveSessionForMode(activeSession?.kind ?? aiDeskMode.value, activeId)
    clearChapterQuoteSelection()
    restoreAiExtractStateFromSession(activeSession)
    restoreSessionUiState(activeSession)
  },
  { immediate: true },
)

watch([aiComposerDraft, aiActiveDirectionPreset], () => {
  schedulePersistActiveSessionUi()
})

watch(
  aiContinueDraft,
  () => {
    schedulePersistActiveSessionUi()
  },
  { deep: true },
)

function onDocumentPointerDownOutsideChapterHub(e: PointerEvent): void {
  if (!chapterPinnedQuoteSelection.value) return
  const target = e.target
  if (!(target instanceof Node)) return
  const hub = document.querySelector('.chapter-hub')
  if (hub?.contains(target)) return
  clearChapterQuoteSelection()
  exitChapterWritingView()
}

onMounted(() => {
  if (typeof window === 'undefined') return
  window.addEventListener('novel-writing:set-ai-open', onSetAiStudioOpenEvent as EventListener)
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointermove', onWindowPointerMoveForAiStudioResize)
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerCancel)
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('keydown', onWindowKeydown)
  document.addEventListener('pointerdown', onDocumentPointerDownOutsideChapterHub, true)
})

onUnmounted(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('novel-writing:set-ai-open', onSetAiStudioOpenEvent as EventListener)
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointermove', onWindowPointerMoveForAiStudioResize)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerCancel)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('keydown', onWindowKeydown)
  document.removeEventListener('pointerdown', onDocumentPointerDownOutsideChapterHub, true)
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

function onWindowKeydown(e: KeyboardEvent): void {
  if (e.defaultPrevented) return
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    toggleChapterSearch(true)
  }
}

function setNameSuggestActiveIndex(i: number) {
  nameSuggestIndex.value = i
}

function toggleChapterSearch(forceOpen?: boolean): void {
  const next = forceOpen ? true : !chapterSearchVisible.value
  chapterSearchVisible.value = next
  if (next) {
    nextTick(() => {
      chapterSearchInputRef.value?.focus()
      chapterSearchInputRef.value?.select()
    })
  }
}

function hideChapterSearch(): void {
  chapterSearchVisible.value = false
  chapterSearchQuery.value = ''
  chapterSearchActiveMatchIndex.value = -1
}

function jumpChapterSearch(direction: 1 | -1): void {
  const total = chapterSearchMatches.value.length
  if (!chapterSearchQuery.value.trim() || total === 0) return

  let next = chapterSearchActiveMatchIndex.value
  if (next < 0) next = direction > 0 ? 0 : total - 1
  else next = (next + direction + total) % total

  chapterSearchActiveMatchIndex.value = next
  nextTick(() => {
    paperBlockRef.value?.goToSearchMatch?.(next, { focus: true })
  })
}

watch(chapterSearchQuery, (query) => {
  const trimmed = String(query ?? '').trim()
  if (!trimmed) {
    chapterSearchActiveMatchIndex.value = -1
    return
  }
  chapterSearchActiveMatchIndex.value = 0
  nextTick(() => {
    paperBlockRef.value?.goToSearchMatch?.(0, { focus: false })
  })
})

onUnmounted(() => {
  flushActiveSessionUiState()
  clearForeshadowFlash()
  if (chapterHubSaveToastTimer != null) {
    window.clearTimeout(chapterHubSaveToastTimer)
    chapterHubSaveToastTimer = null
  }
  if (typeof window !== 'undefined') {
    document.removeEventListener('pointerdown', onDocumentPointerDownOutsideChapterHub, true)
    window.removeEventListener('novel-writing:set-ai-open', onSetAiStudioOpenEvent as EventListener)
    window.removeEventListener('pointermove', onWindowPointerMove)
    window.removeEventListener('pointermove', onWindowPointerMoveForAiStudioResize)
    window.removeEventListener('pointerup', onWindowPointerUp)
    window.removeEventListener('pointercancel', onWindowPointerCancel)
    window.removeEventListener('resize', onWindowResize)
  }
  document.body.classList.remove('is-resizing-ai-studio')
  document.body.style.userSelect = ''
})
</script>
