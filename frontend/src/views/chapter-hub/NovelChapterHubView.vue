<template>
  <div
    class="chapter-hub"
    :class="{ 'chapter-hub--empty': chapters.length === 0 }"
    v-if="novel"
  >
      <div class="chapter-hub__workspace" :style="aiWorkspaceStyle">
        <template v-if="chapters.length > 0">
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
                <svg class="chapter-hub__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
              <button
                type="button"
                class="chapter-hub__search-button"
                :title="'复制本章正文到剪贴板'"
                @click="copyCurrentChapterText()"
              >
                <svg class="chapter-hub__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>

            <transition name="chapter-hub-search">
              <form
                v-if="chapterSearchVisible"
                class="chapter-hub__search-bar"
                role="search"
                @submit.prevent
              >
                <svg class="chapter-hub__search-bar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref="chapterSearchInputRef"
                  v-model="chapterSearchQuery"
                  class="chapter-hub__search-input"
                  type="search"
                  spellcheck="false"
                  autocomplete="off"
                  placeholder="查找正文…"
                  @keydown.stop
                />
                <span v-if="chapterSearchQuery" class="chapter-hub__search-status">{{ chapterSearchStatusLabel }}</span>
                <div class="chapter-hub__search-nav">
                  <button
                    type="button"
                    class="chapter-hub__search-btn"
                    :disabled="!chapterSearchQuery"
                    @click="jumpChapterSearch(-1)"
                    title="上一个"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                  </button>
                  <button
                    type="button"
                    class="chapter-hub__search-btn"
                    :disabled="!chapterSearchQuery"
                    @click="jumpChapterSearch(1)"
                    title="下一个"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                </div>
                <div class="chapter-hub__search-sep" />
                <button
                  type="button"
                  class="chapter-hub__search-btn chapter-hub__search-btn--close"
                  @click="hideChapterSearch()"
                  title="关闭"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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
                :textarea-has-selection="hasTextareaSelection"
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
                @contextmenu="onChapterTextareaContextmenu"
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
                :diff-segments="chapterDiffSegments"
                @clear-diff="clearChapterDiff"
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
        </template>
        <ChapterHubEmptyChaptersCard v-else />

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
            :can-create-first-chapter="chapters.length === 0"
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
            :auto-apply-log="aiAutoApplyLog"
            @undo-auto="undoAutoApplyEntryById"
            @undo-auto-all="undoAllAutoApplyForChapter"
            @organize-chapter="organizeCurrentChapter"
            :conflicts="conflictPanelConflicts"
            :consistency-result="aiConsistencyResult"
            @resolve-conflict="resolveConflictItem"
          />
        </aside>
      </div>

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

    <ChapterHubSelectionActionBar
      :open="selectionActionBarOpen"
      :x="selectionActionBarX"
      :y="selectionActionBarY"
      :can-add-as-faction="selectionActionBarCanAddAsFaction"
      @add-character="selectionActionAddCharacter"
      @add-faction="selectionActionAddFaction"
      @add-foreshadow="selectionActionAddForeshadow"
      @mouseenter="cancelHideSelectionActionBar"
      @mouseleave="hideSelectionActionBar"
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
    <Teleport to="body">
      <Transition name="confirm">
        <div
          v-if="foreshadowPickerOpen"
          class="confirm-overlay"
          role="presentation"
          @keydown.escape.prevent="closeForeshadowPicker"
        >
          <div class="confirm-dialog chapter-hub__fs-picker" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body">
              <h2 class="confirm-dialog__title">这段文字有 {{ foreshadowPickerPlants.length }} 个重叠伏笔</h2>
              <p class="muted chapter-hub__fs-picker-hint">选择要修改或删除的伏笔。</p>
              <ul class="chapter-hub__fs-picker-list scrollbar-paper">
                <li v-for="p in foreshadowPickerPlants" :key="p.id" class="chapter-hub__fs-picker-item">
                  <div class="chapter-hub__fs-picker-main">
                    <strong>{{ p.title || '未命名伏笔' }}</strong>
                    <span v-if="p.description" class="muted chapter-hub__fs-picker-desc">{{ p.description }}</span>
                  </div>
                  <div class="chapter-hub__fs-picker-actions">
                    <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="onForeshadowPickerEdit(p.id)">修改</button>
                    <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="onForeshadowPickerRemove(p.id)">删除</button>
                  </div>
                </li>
              </ul>
              <div class="confirm-dialog__actions">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeForeshadowPicker">关闭</button>
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="onForeshadowPickerRemoveAll">删除全部（{{ foreshadowPickerPlants.length }}）</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <SaveToast :open="chapterHubSaveToastOpen" title="保存成功" message="修改已保存。" />
    <SaveToast :open="copyToastOpen" :title="copyToastTitle" :message="copyToastMessage" />
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
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
defineOptions({ name: 'NovelChapterHubView' })
import { requestAiAccess } from '../../composables/useAiAccess'
import { focusMode } from '../../composables/useFocusMode'
import { useChapterAiDesk } from '../../composables/useChapterAiDesk'
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
  OutlineRewriteResult,
  ForeshadowPlant,
  NewForeshadowFulfillmentInput,
  NewForeshadowPlantInput,
} from '../../types'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  createForeshadowPlant,
  addForeshadowFulfillment,
  buildNovelWorkspacePayload,
  collectCharacterNarrativeStates,
  importCharacterNarrativeStates,
  getCharactersByNovelId,
  createChapter,
  createCharacter,
  createCharacterFactionMembership,
  createCharacterRelation,
  createFaction,
  createItem,
  createOutlineItem,
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
  updateOutlineItem,
  getOutlineByNovelId,
  recordCharacterChangeFields,
  recordFactionChangeFields,
} from '../../lib/storage'
import { putRemoteCharacterStates, getRemoteCharacterStates, putRemoteAutoApplyLog, getRemoteAutoApplyLog } from '../../lib/cloudSync'
import { decideAutoAction, foreshadowPolicyOpts, outlinePolicyOpts } from '../../lib/autoApply/policy'
import { appendAutoApplyLog, getAutoApplyLogByChapter, getAutoApplyLogByNovel, replaceAutoApplyLogForNovel } from '../../lib/autoApply/log'
import { undoAutoApplyEntry } from '../../lib/autoApply/undo'
import { detectCharacterConflicts, detectFactionConflicts, detectItemConflicts } from '../../lib/autoApply/conflictDetect'
import { appendConflicts, getUnresolvedConflicts, getUnresolvedConflictCount, resolveConflict } from '../../lib/autoApply/conflictStore'
import type { ConflictItem } from '../../lib/autoApply/conflictDetect'
import type { AutoApplyModule, AutoApplyLogEntry } from '../../types'
import {
  analyzeNovelForeshadowsFromWorkspace,
  askAiAboutWorkspace,
  askAiWithToolsStream,
  classifyNovelChapterFromWorkspace,
  continueChapterFromWorkspaceStream,
  extractNovelEntitiesFromWorkspace,
  rewriteOutlineFromProgressByAi,
  summarizeNovelChapterFromWorkspaceStream,
  generateChapterTitleFromWorkspace,
  summarizeNovelContinuityBriefFromWorkspaceStream,
  summarizeChapterScenesFromWorkspaceStream,
  checkChapterConsistencyFromWorkspaceStream,
  runCharacterStateExtract,
  type ConsistencyCheckResult,
} from '../../lib/localAi'
import { computeLineDiff } from '../../lib/textDiff'
import type { DiffSegment } from '../../lib/textDiff'
import { executeToolCall } from '../../lib/aiTools'
import { formatChapterSummaryText } from '../../lib/chapterSummary'
import { copyText } from '../../lib/clipboard'
import { fetchWalletBalance } from '../../lib/backendAi'
import { normalizeCharacterAliases, replaceCharacterLabelsInText, someCharacterHasLabel } from '../../lib/characterLabels'
import { useChapterHubChapterMutations } from '../../features/chapter-hub/composables/useChapterHubChapterMutations'
import { useChapterHubCtxMenu } from '../../features/chapter-hub/composables/useChapterHubCtxMenu'
import { useChapterHubData } from '../../features/chapter-hub/composables/useChapterHubData'
import { buildChapterContinueOutlineHint } from '../../lib/outlineContinueHint'
import {
  inferContinueOptionsFromDirection,
  isNextChapterIntent,
  isRewriteIntent,
} from '../../lib/inferContinueFromDirection'
import { suggestNextChapterOutlineBinding } from '../../lib/outlineBeatPack'
import { buildOutlineRewriteToolCalls, buildPendingToolActions } from '../../features/chapter-hub/lib/aiPendingToolActions'
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
import { getCaretPixelOffset, scrollCaretIntoView } from '../../features/chapter-hub/caretGeometry'
import { findTextSearchMatches } from '../../features/chapter-hub/lib/chapterTextSearch'
import ChapterHubCharacterGraphModal from './components/ChapterHubCharacterGraphModal.vue'
import ChapterHubCtxMenuTeleport from './components/ChapterHubCtxMenuTeleport.vue'
import ChapterHubSelectionActionBar from './components/ChapterHubSelectionActionBar.vue'
import ChapterHubFactionDetailModal from './components/ChapterHubFactionDetailModal.vue'
import ChapterHubForeshadowModal from './components/ChapterHubForeshadowModal.vue'
import ChapterHubForeshadowTooltip from './components/ChapterHubForeshadowTooltip.vue'
import ChapterHubAiEntityPanel from './components/ChapterHubAiEntityPanel.vue'
import ChapterHubConflictPanel from './components/ChapterHubConflictPanel.vue'
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

// AI 进行中状态走模块级单例（按 novelId 分桶），切页/组件重挂载不丢、生成不中断。
// 这些是单例里的 ref（同名），下方所有 .value 用法保持不变；aborts 是非响应式的 AbortController 持有器。
const aiDesk = useChapterAiDesk(String(route.params.novelId ?? ''))
const {
  aiContinueDraft,
  aiContinueThinkingText,
  aiChatMessages,
  conversationHistory,
  aiChatLoading,
  aiChatThinking,
  aiExtractLoading,
  aiChapterSummaryDraft,
  aiContinuityBriefLoading,
} = aiDesk
const deskAborts = aiDesk.aborts
const emptyAiExtractResult = (): NovelEntityExtractResult => ({
  characters: [],
  factions: [],
  items: [],
  memberships: [],
  relations: [],
  outlineItems: [],
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

const aiExtractError = ref('')
const aiAnalysisKind = ref<AiAnalysisKind>('entities')
const aiExtractResult = ref<NovelEntityExtractResult>(emptyAiExtractResult())
const aiForeshadowResult = ref<NovelForeshadowAnalysisResult>(emptyAiForeshadowResult())
const aiOutlineRewriteResult = ref<OutlineRewriteResult>({ revisions: [], additions: [], warnings: [] })
const aiClassificationResult = ref<NovelChapterClassificationResult>(emptyAiClassificationResult())
const aiConsistencyResult = ref<ConsistencyCheckResult | null>(null)
const chapterDirtySinceLastOrganize = ref(false)
const conflictCount = ref(0)
const chapterDiffSegments = ref<DiffSegment[]>([])
const aiConsistencyLoading = ref(false)
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
  outlineRewriteResult?: OutlineRewriteResult
  appliedActions: Array<{ id: string; text: string; tone: 'applied' | 'ignored' }>
}
const aiExtractRuns = ref<AiExtractRun[]>([])
const aiPendingAppliedDetail = ref('')
const aiPendingToolActions = ref<AiPendingToolAction[]>([])
const aiExtractHasRun = ref(false)
const aiExtractLastMode = ref<AiExtractMode | null>(null)
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

const aiComposerDraft = ref('')
const aiActiveDirectionPreset = ref('')
let aiDeskUiPersistTimer: number | null = null

// 是否有任意 AI 任务正在进行（续写 / 提问 / 抽取）。
// 用于防止在一个请求进行中再次发起并发请求（如续写中途切到提问再提交）。
const aiBusy = computed(
  () =>
    aiContinueDraft.value.loading ||
    aiChatLoading.value ||
    aiChatThinking.value ||
    aiExtractLoading.value,
)

function emptyChapterSummaryDraft(): AiChapterSummaryDraft {
  return { chapterId: '', text: '', loading: false, status: 'idle' }
}

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

const copyToastOpen = ref(false)
const copyToastTitle = ref('已复制')
const copyToastMessage = ref('本章正文已复制到剪贴板。')
let copyToastTimer: number | null = null

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
  if (typeof window === 'undefined') return Math.max(410, raw)
  const min = 410
  const max = Math.min(920, Math.max(min + 40, Math.floor(window.innerWidth * 0.62)))
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

  deskAborts.continuityBrief?.abort()
  deskAborts.continuityBrief = new AbortController()
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
      deskAborts.continuityBrief.signal,
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
    deskAborts.continuityBrief = null
    void fetchWalletBalance().catch(() => {
      /* ignore */
    })
  }
}

function stopChapterSummaryDraft(): void {
  deskAborts.chapterSummary?.abort()
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

  deskAborts.chapterSummary?.abort()
  deskAborts.chapterSummary = new AbortController()
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
      deskAborts.chapterSummary.signal,
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
    deskAborts.chapterSummary = null
    void fetchWalletBalance().catch(() => {
      /* ignore */
    })
  }
}

async function runSceneSummaryAfterContinue(chapterId: string): Promise<void> {
  const id = novelId.value
  if (!id || !requestAiAccess()) return

  try {
    const snapshot = buildNovelWorkspacePayload(id)
    const scenes = await summarizeChapterScenesFromWorkspaceStream(
      snapshot,
      chapterId,
      {
        onChunk: () => {},
        onError: (err: Error) => {
          if (err.name !== 'AbortError') {
            console.warn('场景摘要生成失败:', err.message)
          }
        },
      },
    )
    if (scenes.length > 0) {
      updateChapter({ id: chapterId, sceneSummaries: scenes })
      const synced = syncScenesToOutline(chapterId, scenes)
      reload()
      const extra = synced > 0 ? `，并回填到大纲 ${synced} 个场景` : ''
      appendAiSystemNote(`已生成 ${scenes.length} 个场景摘要${extra}`)
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name !== 'AbortError') {
      console.warn('场景摘要生成失败:', e.message)
    }
  }
}

/**
 * 把本章拆出的场景摘要回填到大纲的 scene 节点（场景概念合并）：
 * - 找本章绑定的 chapter 级大纲节点作为父；
 * - 已有 scene 子节点按 order 逐个回填 proseSummary、标 done/written；
 * - scene 子节点不足时按 level='scene' 显式补建（防孤儿）。
 * 返回回填+新建的场景数。找不到 chapter 父节点则跳过（返回 0）。
 */
function syncScenesToOutline(chapterId: string, scenes: { title: string; summary: string }[]): number {
  const id = novelId.value
  if (!id) return 0
  const chapter = chapters.value.find((c) => c.id === chapterId)
  const boundIds = Array.isArray(chapter?.outlineItemIds) ? chapter!.outlineItemIds : []
  if (boundIds.length === 0) return 0

  const allOutline = getOutlineByNovelId(id)
  const chapterNode = boundIds
    .map((oid) => allOutline.find((o) => o.id === oid))
    .find((node): node is NonNullable<typeof node> => !!node && node.level === 'chapter')
  if (!chapterNode) return 0

  const sceneChildren = allOutline
    .filter((o) => o.parentId === chapterNode.id && o.level === 'scene')
    .sort((a, b) => a.order - b.order)

  let touched = 0
  scenes.forEach((scene, i) => {
    const proseSummary = String(scene.summary ?? scene.title ?? '').trim()
    if (!proseSummary) return
    const existing = sceneChildren[i]
    try {
      if (existing) {
        updateOutlineItem({ id: existing.id, proseSummary, status: 'done', plotStage: 'written' })
      } else {
        const created = createOutlineItem({
          novelId: id,
          title: String(scene.title ?? `场景 ${i + 1}`).trim() || `场景 ${i + 1}`,
          summary: '',
          level: 'scene',
          parentId: chapterNode.id,
          plotStage: 'written',
          proseSummary,
        })
        updateOutlineItem({ id: created.id, status: 'done' })
      }
      touched += 1
    } catch (e) {
      console.warn('场景回填大纲失败:', e)
    }
  })
  return touched
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
  // AI 任务进行中禁止切换模式，避免借切换模式绕过并发锁发起第二个请求
  if (aiBusy.value) return
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

async function copyCurrentChapterText(): Promise<void> {
  const chapter = selectedChapter.value
  if (!chapter) {
    copyToastTitle.value = '没有可复制的内容'
    copyToastMessage.value = '请先选择一个章节。'
  } else {
    const title = String(chapter.title ?? '').trim()
    const body = String(chapter.content ?? '')
    const text = title ? `${title}\n\n${body}` : body
    const ok = await copyText(text)
    copyToastTitle.value = ok ? '已复制' : '复制失败'
    copyToastMessage.value = ok ? '本章正文已复制到剪贴板。' : '浏览器拒绝了剪贴板访问,请手动选择复制。'
  }
  copyToastOpen.value = true
  if (copyToastTimer != null) window.clearTimeout(copyToastTimer)
  copyToastTimer = window.setTimeout(() => {
    copyToastOpen.value = false
    copyToastTimer = null
  }, 1600)
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

// 本章自动入库日志(横幅 + 撤销用),storage 变化或切章时刷新
const aiAutoApplyLog = ref<AutoApplyLogEntry[]>([])
function refreshAutoApplyLog(): void {
  try {
    const cid = selectedChapterId.value
    aiAutoApplyLog.value = cid ? getAutoApplyLogByChapter(cid) : []
  } catch (e) {
    console.warn('读取自动入库日志失败:', e)
    aiAutoApplyLog.value = []
  }
}
watch(selectedChapterId, refreshAutoApplyLog, { immediate: true })

function undoAutoApplyEntryById(logId: string): void {
  const entry = aiAutoApplyLog.value.find((e) => e.id === logId)
  if (!entry) return
  const res = undoAutoApplyEntry(entry)
  if (res.ok) {
    reload()
    refreshAutoApplyLog()
    pushAutoApplyLogToBackend()
    triggerChapterHubSaveToast()
    appendAiSystemNote(`已撤销自动入库：${entry.entityLabel}`)
  } else {
    aiExtractError.value = res.reason || '撤销失败'
  }
}

function undoAllAutoApplyForChapter(): void {
  const entries = [...aiAutoApplyLog.value]
  if (entries.length === 0) return
  let undone = 0
  for (const entry of entries) {
    if (undoAutoApplyEntry(entry).ok) undone += 1
  }
  reload()
  refreshAutoApplyLog()
  pushAutoApplyLogToBackend()
  triggerChapterHubSaveToast()
  appendAiSystemNote(`已撤销本章 ${undone} 项自动入库改动`)
}

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

function textSimilarity(a: string, b: string): number {
  const la = String(a ?? '').trim()
  const lb = String(b ?? '').trim()
  if (!la && !lb) return 1
  if (!la || !lb) return 0
  if (la === lb) return 1
  const shorter = Math.min(la.length, lb.length)
  const longer = Math.max(la.length, lb.length)
  if (longer === 0) return 1
  // 快速前缀检查
  const commonPrefix = [...la].findIndex((ch, i) => ch !== lb[i])
  const prefixRatio = (commonPrefix === -1 ? shorter : commonPrefix) / longer
  return prefixRatio
}

function attrsSimilarity(a: CharacterAttribute[] | undefined, b: CharacterAttribute[] | undefined): number {
  const la = (a ?? []).filter((x) => x.key && x.value)
  const lb = (b ?? []).filter((x) => x.key && x.value)
  if (la.length === 0 && lb.length === 0) return 1
  if (la.length === 0 || lb.length === 0) return 0
  const setA = new Set(la.map((x) => `${x.key}::${x.value}`))
  const setB = new Set(lb.map((x) => `${x.key}::${x.value}`))
  let overlap = 0
  for (const k of setA) if (setB.has(k)) overlap++
  return overlap / Math.max(setA.size, setB.size)
}

function isNegligibleCharacterUpdate(
  existing: (typeof characters.value)[number],
  incoming: { gender?: string; age?: string; goal?: string; secret?: string; arc?: string; notes?: string; aliases?: string[]; attributes?: CharacterAttribute[] },
): boolean {
  const THRESHOLD = 0.92
  const fields: Array<[string, string]> = [
    [existing.gender ?? '', incoming.gender ?? ''],
    [existing.age ?? '', incoming.age ?? ''],
    [existing.goal ?? '', incoming.goal ?? ''],
    [existing.secret ?? '', incoming.secret ?? ''],
    [existing.arc ?? '', incoming.arc ?? ''],
  ]
  for (const [a, b] of fields) {
    if (a && b && textSimilarity(a, b) < THRESHOLD) return false
  }
  // notes 允许追加，检查 incoming 是否以 existing 开头
  const existNotes = existing.notes ?? ''
  const incNotes = incoming.notes ?? ''
  if (incNotes && existNotes) {
    if (!incNotes.startsWith(existNotes) && textSimilarity(existNotes, incNotes) < THRESHOLD) return false
  }
  // attributes
  if (attrsSimilarity(existing.attributes, incoming.attributes) < THRESHOLD) return false
  // aliases
  const existAliases = new Set((existing.aliases ?? []).map((a) => a.toLowerCase()))
  const incAliases = (incoming.aliases ?? []).map((a) => a.toLowerCase())
  const newAliases = incAliases.filter((a) => !existAliases.has(a))
  if (newAliases.length > 0) return false
  return true
}

function isNegligibleFactionUpdate(
  existing: (typeof factions.value)[number],
  incoming: { leader?: string; notes?: string; attributes?: CharacterAttribute[] },
): boolean {
  const THRESHOLD = 0.92
  if (existing.leader && incoming.leader && textSimilarity(existing.leader, incoming.leader) < THRESHOLD) return false
  if (existing.notes && incoming.notes && textSimilarity(existing.notes, incoming.notes) < THRESHOLD) return false
  if (attrsSimilarity(existing.attributes, incoming.attributes) < THRESHOLD) return false
  return true
}

function autoSkipNegligibleExtractUpdates(): void {
  const result = aiExtractResult.value
  if (!result) return
  // 角色
  if (Array.isArray(result.characters)) {
    for (let i = 0; i < result.characters.length; i++) {
      const item = result.characters[i]
      if (item.uiState?.status || item.match?.type !== 'update') continue
      const targetId = String(item.match?.targetId ?? '').trim()
      if (!targetId) continue
      const existing = characters.value.find((c) => c.id === targetId)
      if (!existing) continue
      if (isNegligibleCharacterUpdate(existing, item)) {
        setAiSuggestionState('characters', i, 'ignored', 'ignore')
      }
    }
  }
  // 势力
  if (Array.isArray(result.factions)) {
    for (let i = 0; i < result.factions.length; i++) {
      const item = result.factions[i]
      if (item.uiState?.status || item.match?.type !== 'update') continue
      const targetId = String(item.match?.targetId ?? '').trim()
      if (!targetId) continue
      const existing = factions.value.find((f) => f.id === targetId)
      if (!existing) continue
      if (isNegligibleFactionUpdate(existing, item)) {
        setAiSuggestionState('factions', i, 'ignored', 'ignore')
      }
    }
  }
}

/** 深拷贝一个实体作为撤销快照(优先 structuredClone,回退 JSON) */
function snapshotEntity<T>(entity: T): T {
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(entity)
      : (JSON.parse(JSON.stringify(entity)) as T)
  } catch {
    return JSON.parse(JSON.stringify(entity)) as T
  }
}

/** 记一条自动入库日志(失败不抛,避免影响主流程) */
function logAutoApply(
  module: AutoApplyModule,
  action: 'create' | 'merge',
  entityId: string,
  entityLabel: string,
  matchType: 'new' | 'update' | 'possible_duplicate' | 'conflict',
  beforeSnapshot: unknown | null,
  changedFields?: string[],
): void {
  if (!entityId) return
  const chapter = selectedChapter.value
  try {
    appendAutoApplyLog({
      novelId: novelId.value,
      chapterId: selectedChapterId.value || chapter?.id || '',
      chapterNo: chapter?.chapterNo ?? null,
      module,
      action,
      entityId,
      entityLabel,
      matchType,
      beforeSnapshot,
      changedFields,
    })
  } catch (e) {
    console.warn('记录自动入库日志失败:', e)
  }
}

/**
 * 自动入库编排:写完章/整理后,高置信提案自动采用并记可撤销日志。
 * 复用现有 applyXSuggestion(它们已做 preferExisting 保护与去重),不重写入库。
 * 合并前做冲突检测:发现矛盾字段不落库,写入冲突面板供用户裁决。
 */
function autoApplyExtractResult(): void {
  const result = aiExtractResult.value
  if (!result) return
  const pendingConflicts: ConflictItem[] = []
  const chapterId = selectedChapterId.value
  const chapterNo = selectedChapter.value?.chapterNo ?? null

  // 角色:new→自动建,update(非negligible)→冲突检测后自动合并空字段
  if (Array.isArray(result.characters)) {
    for (let i = 0; i < result.characters.length; i++) {
      const item = result.characters[i]
      if (item.uiState?.status) continue
      const targetId = String(item.match?.targetId ?? '').trim()
      const existing = targetId ? characters.value.find((c) => c.id === targetId) : undefined
      const negligible =
        item.match?.type === 'update' && existing ? isNegligibleCharacterUpdate(existing, item) : false
      const confidence = item.confidence ?? 0
      const decision = decideAutoAction('characters', item.match?.type ?? null, { negligible, confidence })
      if (decision === 'skip') {
        setAiSuggestionState('characters', i, 'ignored', 'ignore')
        continue
      }
      if (decision !== 'auto-create' && decision !== 'auto-merge') continue
      if (decision === 'auto-merge' && existing) {
        const conflicts = detectCharacterConflicts(existing as any, item as any, { novelId: novelId.value, chapterId, chapterNo })
        if (conflicts.length > 0) {
          pendingConflicts.push(...conflicts)
        }
      }
      try {
        const before = decision === 'auto-merge' && existing ? snapshotEntity(existing) : null
        const action = decision === 'auto-create' ? 'create' : 'merge'
        const id = applyCharacterSuggestion(i, action)
        if (id) {
          setAiSuggestionState('characters', i, 'applied', action, { editorEntityType: 'character', editorTargetId: id, auto: true })
          logAutoApply('characters', action, id, item.name, item.match?.type ?? 'new', before)
        }
      } catch (e) {
        console.warn('自动入库角色失败:', item.name, e)
      }
    }
  }
  autoApplyEntitySection('factions', result.factions, pendingConflicts)
  autoApplyEntitySection('items', result.items, pendingConflicts)
  autoApplyOutlineSection(result.outlineItems)
  autoApplyForeshadowSection()
  autoApplyClassificationSection()
  autoApplyMembershipSection()
  autoApplyRelationSection()
  if (pendingConflicts.length > 0) {
    appendConflicts(pendingConflicts)
    appendAiSystemNote(`发现 ${pendingConflicts.length} 处档案冲突，请在一致性面板查看并裁决。`)
  }
  refreshConflictCount()
  refreshAutoApplyLog()
  pushAutoApplyLogToBackend()
}

/** 势力/物品共用:与角色同构,merge 前做冲突检测 */
function autoApplyEntitySection(
  section: 'factions' | 'items',
  list: { name: string; match: { type: string; targetId?: string | null }; uiState?: { status?: string } }[] | undefined,
  pendingConflicts: ConflictItem[],
): void {
  if (!Array.isArray(list)) return
  const chapterId = selectedChapterId.value
  const chapterNo = selectedChapter.value?.chapterNo ?? null
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (item.uiState?.status) continue
    const targetId = String(item.match?.targetId ?? '').trim()
    const existing =
      section === 'factions'
        ? targetId ? factions.value.find((f) => f.id === targetId) : undefined
        : targetId ? items.value.find((it) => it.id === targetId) : undefined
    const negligible =
      item.match?.type === 'update' && existing && section === 'factions'
        ? isNegligibleFactionUpdate(existing as any, item as any)
        : false
    const confidence = (item as any).confidence ?? 0
    const decision = decideAutoAction(section, (item.match?.type as any) ?? null, { negligible, confidence })
    if (decision === 'skip') {
      setAiSuggestionState(section, i, 'ignored', 'ignore')
      continue
    }
    if (decision !== 'auto-create' && decision !== 'auto-merge') continue
    if (decision === 'auto-merge' && existing) {
      const conflicts = section === 'factions'
        ? detectFactionConflicts(existing as any, item as any, { novelId: novelId.value, chapterId, chapterNo })
        : detectItemConflicts(existing as any, item as any, { novelId: novelId.value, chapterId, chapterNo })
      if (conflicts.length > 0) pendingConflicts.push(...conflicts)
    }
    try {
      const before = decision === 'auto-merge' && existing ? snapshotEntity(existing) : null
      const action = decision === 'auto-create' ? 'create' : 'merge'
      const id = section === 'factions' ? applyFactionSuggestion(i, action) : applyItemSuggestion(i, action)
      if (id) {
        const editorType = section === 'factions' ? 'faction' : 'item'
        setAiSuggestionState(section, i, 'applied', action, { editorEntityType: editorType, editorTargetId: id, auto: true })
        logAutoApply(section, action, id, item.name, (item.match?.type as any) ?? 'new', before)
      }
    } catch (e) {
      console.warn(`自动入库${section}失败:`, item.name, e)
    }
  }
}

/** 大纲:仅 scene/chapter 且置信达标自动建(无 merge) */
function autoApplyOutlineSection(list: typeof aiExtractResult.value.outlineItems | undefined): void {
  if (!Array.isArray(list)) return
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (item.uiState?.status) continue
    const decision = decideAutoAction('outlineItems', item.match?.type ?? null, outlinePolicyOpts(item))
    if (decision !== 'auto-create') continue
    try {
      const id = applyOutlineItemSuggestion(i, 'create')
      if (id) {
        setAiSuggestionState('outlineItems', i, 'applied', 'create', { auto: true })
        logAutoApply('outlineItems', 'create', id, item.title, item.match?.type ?? 'new', null)
      }
    } catch (e) {
      console.warn('自动入库大纲失败:', item.title, e)
    }
  }
}

/** 伏笔:按置信度阈值自动建(无 match) */
function autoApplyForeshadowSection(): void {
  const list = aiForeshadowResult.value?.newPlants
  if (!Array.isArray(list)) return
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (item.uiState?.status) continue
    const decision = decideAutoAction('foreshadows', null, foreshadowPolicyOpts(item))
    if (decision !== 'auto-create') continue
    try {
      const id = applyForeshadowSuggestion(i, 'create')
      if (id) {
        setAiForeshadowSuggestionState(i, 'applied', 'create', true)
        logAutoApply('foreshadows', 'create', id, item.title, 'new', null)
      }
    } catch (e) {
      console.warn('自动入库伏笔失败:', item.title, e)
    }
  }
}

/** 章节分类:自动写入 annotation,旧总结存快照可还原 */
function autoApplyClassificationSection(): void {
  const result = aiClassificationResult.value
  if (!result || result.uiState?.status) return
  const chapter = selectedChapter.value
  if (!chapter) return
  const next = classificationSummaryText(result)
  if (!next.trim()) return
  const decision = decideAutoAction('classification', null)
  if (decision !== 'auto-merge') return
  try {
    const before = { id: chapter.id, annotation: chapter.annotation ?? '' }
    applyClassificationSuggestion('merge')
    setAiClassificationState('applied', 'merge', true)
    logAutoApply('classification', 'merge', chapter.id, `第 ${chapter.chapterNo} 章分类`, 'update', before, ['annotation'])
  } catch (e) {
    console.warn('自动写入章节分类失败:', e)
  }
}

/** 角色名是否在档案中唯一精确命中(含别名);用于关系/归属自动入库的安全判定 */
function isCharacterNameUnique(name: string): boolean {
  const needle = String(name ?? '').trim()
  if (!needle) return false
  const hits = characters.value.filter(
    (c) => c.name.trim() === needle || (c.aliases ?? []).some((a) => a.trim() === needle),
  )
  return hits.length === 1
}

function isFactionNameUnique(name: string): boolean {
  const needle = String(name ?? '').trim()
  if (!needle) return false
  return factions.value.filter((f) => f.name.trim() === needle).length === 1
}

/** 所属势力:仅当 character+faction 都唯一命中、且尚无同组归属时自动新建 */
function autoApplyMembershipSection(): void {
  const list = aiExtractResult.value?.memberships
  if (!Array.isArray(list)) return
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (item.uiState?.status) continue
    // 仅自动处理新建(match.type 不是 new 的留确认)
    if (item.match?.type !== 'new') continue
    const safe = isCharacterNameUnique(item.characterName) && isFactionNameUnique(item.factionName)
    const decision = decideAutoAction('memberships', item.match?.type ?? null, { relationSafe: safe })
    if (decision !== 'auto-create') continue
    try {
      const id = applyMembershipSuggestion(i, 'create')
      if (id) {
        setAiSuggestionState('memberships', i, 'applied', 'create', { editorEntityType: 'character', auto: true })
        logAutoApply('memberships', 'create', id, `${item.characterName} → ${item.factionName}`, 'new', null)
      }
    } catch (e) {
      console.warn('自动入库所属势力失败:', item.characterName, e)
    }
  }
}

/** 角色关系:仅当 from/to 都唯一命中、且为正向新建(无既有正反向关系)时自动建,禁反向新建 */
function autoApplyRelationSection(): void {
  const list = aiExtractResult.value?.relations
  if (!Array.isArray(list)) return
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (item.uiState?.status) continue
    if (item.match?.type !== 'new') continue
    const bothUnique = isCharacterNameUnique(item.fromCharacterName) && isCharacterNameUnique(item.toCharacterName)
    const fromId = findCharacterIdByName(item.fromCharacterName)
    const toId = findCharacterIdByName(item.toCharacterName)
    // 已存在正向或反向关系 → 不自动(避免反向新建/重复)
    const existing = fromId && toId
      ? getCharacterRelationsByNovelId(novelId.value).some(
          (r) =>
            (r.fromCharacterId === fromId && r.toCharacterId === toId) ||
            (r.fromCharacterId === toId && r.toCharacterId === fromId),
        )
      : true
    const safe = bothUnique && !existing
    const decision = decideAutoAction('relations', item.match?.type ?? null, { relationSafe: safe })
    if (decision !== 'auto-create') continue
    try {
      const id = applyRelationSuggestion(i, 'create')
      if (id) {
        setAiSuggestionState('relations', i, 'applied', 'create', { editorEntityType: 'character', auto: true })
        logAutoApply('relations', 'create', id, `${item.fromCharacterName} ↔ ${item.toCharacterName}`, 'new', null)
      }
    } catch (e) {
      console.warn('自动入库角色关系失败:', item.fromCharacterName, e)
    }
  }
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
  section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations' | 'outlineItems',
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
    outlineRewriteResult?: OutlineRewriteResult
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
      outlineRewriteResult: payload.outlineRewriteResult,
      appliedActions: [],
    },
    ...aiExtractRuns.value,
  ].slice(0, 12)
}

function setAiSuggestionState(
  section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations' | 'outlineItems',
  index: number,
  status: 'pending' | 'applied' | 'ignored',
  action: 'create' | 'merge' | 'ignore' | null = null,
  editorMeta: { editorEntityType?: 'character' | 'faction' | 'item' | null; editorTargetId?: string | null; auto?: boolean } = {},
): void {
  updateAiSuggestion(section, index, {
    uiState: {
      status,
      action,
      editorEntityType: editorMeta.editorEntityType ?? null,
      editorTargetId: editorMeta.editorTargetId ?? null,
      auto: editorMeta.auto ?? false,
    },
  })
}

function setAiForeshadowSuggestionState(index: number, status: 'pending' | 'applied' | 'ignored', action: 'create' | 'ignore' | null = null, auto = false): void {
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
      auto,
    },
  }
  aiForeshadowResult.value = { ...next, newPlants: list }
  syncLatestAiExtractRun()
  persistActiveAiSessionState()
}

function setAiClassificationState(status: 'pending' | 'applied' | 'ignored', action: 'merge' | 'ignore' | null = null, auto = false): void {
  aiClassificationResult.value = {
    ...aiClassificationResult.value,
    uiState: {
      status,
      action,
      editorEntityType: null,
      editorTargetId: selectedChapterId.value || null,
      auto,
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
  section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations' | 'outlineItems',
  index: number,
  action: 'create' | 'merge',
  editorMeta: { editorEntityType?: 'character' | 'faction' | 'item' | null; editorTargetId?: string | null; auto?: boolean } = {},
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

function resolveQuoteAnchor(content: string, quote: string): { start: number; end: number } | undefined {
  const q = (quote ?? '').trim()
  if (!q || !content) return undefined
  const idx = content.indexOf(q)
  if (idx < 0) return undefined
  return { start: idx, end: idx + q.length }
}

function applyCharacterSuggestion(index: number, action: 'create' | 'merge' | 'ignore'): string {
  const item = aiExtractResult.value.characters[index]
  if (!item || item.uiState?.status === 'applied') return ''
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略角色建议：${item.name}`)
    setAiSuggestionState('characters', index, 'ignored', 'ignore')
    return ''
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
    }, { autoGenerated: true })
    nextCharacterId = created.id
    const _content = selectedChapter.value?.content ?? ''
    const _ev = (item.evidences ?? []).filter((e) => e.chapterId === selectedChapterId.value || !e.chapterId)
    const _anchor = resolveQuoteAnchor(_content, _ev[0]?.quote ?? '')
    const _fields = ['name', 'age', 'gender', 'goal', 'secret', 'arc', 'notes'].filter((f) => (item as any)[f])
    recordCharacterChangeFields(nextCharacterId, _fields, {
      chapterId: selectedChapterId.value,
      anchorStart: _anchor?.start,
      anchorEnd: _anchor?.end,
      fieldValues: { name: item.name, age: item.age, gender: item.gender, goal: item.goal, secret: item.secret, arc: item.arc, notes: item.notes },
    })
    appendAiSystemNote(`已确认添加角色：${item.name}`)
  } else {
    const targetId = String(item.match.targetId ?? '').trim()
    if (!targetId) return ''
    const current = characters.value.find((row) => row.id === targetId)
    if (!current) return ''
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
    const _mergeFields = ['age', 'gender', 'goal', 'secret', 'arc', 'notes'].filter((f) => (item as any)[f])
    if (_mergeFields.length > 0) {
      const _c2 = selectedChapter.value?.content ?? ''
      const _ev2 = (item.evidences ?? []).filter((e) => e.chapterId === selectedChapterId.value || !e.chapterId)
      const _a2 = resolveQuoteAnchor(_c2, _ev2[0]?.quote ?? '')
      const _fv: Record<string, string> = {}
      for (const f of _mergeFields) _fv[f] = (item as any)[f]
      recordCharacterChangeFields(nextCharacterId, _mergeFields, { chapterId: selectedChapterId.value, anchorStart: _a2?.start, anchorEnd: _a2?.end, fieldValues: _fv })
    }
    appendAiSystemNote(`已确认合并角色：${item.name} -> ${current.name}`)
  }
  finishAiSuggestionApply('characters', index, action, { editorEntityType: 'character', editorTargetId: nextCharacterId })
  return nextCharacterId
}

function applyFactionSuggestion(index: number, action: 'create' | 'merge' | 'ignore'): string {
  const item = aiExtractResult.value.factions[index]
  if (!item || item.uiState?.status === 'applied') return ''
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略势力建议：${item.name}`)
    setAiSuggestionState('factions', index, 'ignored', 'ignore')
    return ''
  }
  let nextFactionId = ''
  if (action === 'create') {
    const created = createFaction({
      novelId: novelId.value,
      name: item.name,
      leader: item.leader,
      notes: item.notes,
      attributes: item.attributes ?? [],
    }, { autoGenerated: true })
    nextFactionId = created.id
    const _fc = selectedChapter.value?.content ?? ''
    const _fev = (item.evidences ?? []).filter((e) => e.chapterId === selectedChapterId.value || !e.chapterId)
    const _fa = resolveQuoteAnchor(_fc, _fev[0]?.quote ?? '')
    const _ff = ['name', 'leader', 'notes'].filter((f) => (item as any)[f])
    recordFactionChangeFields(nextFactionId, _ff, {
      chapterId: selectedChapterId.value,
      anchorStart: _fa?.start,
      anchorEnd: _fa?.end,
      fieldValues: { name: item.name, leader: item.leader, notes: item.notes },
    })
    appendAiSystemNote(`已确认添加势力：${item.name}`)
  } else {
    const targetId = String(item.match.targetId ?? '').trim()
    if (!targetId) return ''
    const current = factions.value.find((row) => row.id === targetId)
    if (!current) return ''
    nextFactionId = current.id
    updateFaction({
      id: targetId,
      leader: preferExisting(current.leader, item.leader),
      notes: preferExisting(current.notes, item.notes),
      attributes: mergeCharacterAttributes(current.attributes, item.attributes ?? []),
    })
    const _fmergeFields = ['leader', 'notes'].filter((f) => (item as any)[f])
    if (_fmergeFields.length > 0) {
      const _fc2 = selectedChapter.value?.content ?? ''
      const _fev2 = (item.evidences ?? []).filter((e) => e.chapterId === selectedChapterId.value || !e.chapterId)
      const _fa2 = resolveQuoteAnchor(_fc2, _fev2[0]?.quote ?? '')
      const _ffv: Record<string, string> = {}
      for (const f of _fmergeFields) _ffv[f] = (item as any)[f]
      recordFactionChangeFields(nextFactionId, _fmergeFields, { chapterId: selectedChapterId.value, anchorStart: _fa2?.start, anchorEnd: _fa2?.end, fieldValues: _ffv })
    }
    appendAiSystemNote(`已确认合并势力：${item.name} -> ${current.name}`)
  }
  finishAiSuggestionApply('factions', index, action, { editorEntityType: 'faction', editorTargetId: nextFactionId })
  return nextFactionId
}

function applyItemSuggestion(index: number, action: 'create' | 'merge' | 'ignore'): string {
  const item = aiExtractResult.value.items[index]
  if (!item || item.uiState?.status === 'applied') return ''
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略物品建议：${item.name}`)
    setAiSuggestionState('items', index, 'ignored', 'ignore')
    return ''
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
    }, { autoGenerated: true })
    nextItemId = created.id
    appendAiSystemNote(`已确认添加物品：${item.name}`)
  } else {
    const targetId = String(item.match.targetId ?? '').trim()
    if (!targetId) return ''
    const current = items.value.find((row) => row.id === targetId)
    if (!current) return ''
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
  return nextItemId
}

function applyMembershipSuggestion(index: number, action: 'create' | 'merge' | 'ignore'): string {
  const item = aiExtractResult.value.memberships[index]
  if (!item || item.uiState?.status === 'applied') return ''
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略所属势力建议：${item.characterName} -> ${item.factionName}`)
    setAiSuggestionState('memberships', index, 'ignored', 'ignore')
    return ''
  }
  const characterId = findCharacterIdByName(item.characterName)
  const factionId = findFactionIdByName(item.factionName)
  if (!characterId || !factionId) {
    aiExtractError.value = '角色所属势力建议缺少可匹配的角色或势力，请先确认实体档案'
    return ''
  }
  let membershipId = ''
  if (action === 'create') {
    const createdM = createCharacterFactionMembership({
      novelId: novelId.value,
      characterId,
      factionId,
      description: item.description,
    })
    membershipId = createdM.id
    const _mc = selectedChapter.value?.content ?? ''
    const _mev = (item.evidences ?? []).filter((e) => e.chapterId === selectedChapterId.value || !e.chapterId)
    const _ma = resolveQuoteAnchor(_mc, _mev[0]?.quote ?? '')
    recordCharacterChangeFields(characterId, ['memberships'], {
      chapterId: selectedChapterId.value,
      anchorStart: _ma?.start,
      anchorEnd: _ma?.end,
      fieldValues: { memberships: `${item.characterName} → ${item.factionName}` },
    })
    appendAiSystemNote(`已确认添加所属势力：${item.characterName} -> ${item.factionName}`)
  } else {
    const targetId = String(item.match.targetId ?? '').trim()
    if (!targetId) return ''
    const current = characterFactionMemberships.value.find((row) => row.id === targetId)
    if (!current) return ''
    membershipId = current.id
    updateCharacterFactionMembership({
      id: targetId,
      description: preferExisting(current.description, item.description),
    })
    const _mc2 = selectedChapter.value?.content ?? ''
    const _mev2 = (item.evidences ?? []).filter((e) => e.chapterId === selectedChapterId.value || !e.chapterId)
    const _ma2 = resolveQuoteAnchor(_mc2, _mev2[0]?.quote ?? '')
    recordCharacterChangeFields(characterId, ['memberships'], {
      chapterId: selectedChapterId.value,
      anchorStart: _ma2?.start,
      anchorEnd: _ma2?.end,
      fieldValues: { memberships: `${item.characterName} → ${item.factionName}` },
    })
    appendAiSystemNote(`已确认合并所属势力：${item.characterName} -> ${item.factionName}`)
  }
  finishAiSuggestionApply('memberships', index, action, { editorEntityType: 'character', editorTargetId: characterId })
  return membershipId
}

function applyRelationSuggestion(index: number, action: 'create' | 'merge' | 'ignore'): string {
  const item = aiExtractResult.value.relations[index]
  if (!item || item.uiState?.status === 'applied') return ''
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略角色关系建议：${item.fromCharacterName} ↔ ${item.toCharacterName}`)
    setAiSuggestionState('relations', index, 'ignored', 'ignore')
    return ''
  }
  const fromCharacterId = findCharacterIdByName(item.fromCharacterName)
  const toCharacterId = findCharacterIdByName(item.toCharacterName)
  if (!fromCharacterId || !toCharacterId) {
    aiExtractError.value = '角色关系建议缺少可匹配的角色，请先确认角色档案'
    return ''
  }
  const exactRelation = getCharacterRelationsByNovelId(novelId.value).find(
    (row) => row.fromCharacterId === fromCharacterId && row.toCharacterId === toCharacterId,
  )
  const reverseRelation = getCharacterRelationsByNovelId(novelId.value).find(
    (row) => row.fromCharacterId === toCharacterId && row.toCharacterId === fromCharacterId,
  )
  let relationId = ''
  if (action === 'create') {
    const createdR = createCharacterRelation({
      novelId: novelId.value,
      fromCharacterId,
      toCharacterId,
      relationType: item.relationType || '关系',
      note: item.note,
    })
    relationId = createdR.id
    appendAiSystemNote(`已确认添加角色关系：${item.fromCharacterName} ↔ ${item.toCharacterName}`)
  } else {
    if (exactRelation) {
      relationId = exactRelation.id
      updateCharacterRelation({
        id: exactRelation.id,
        relationType: preferExisting(exactRelation.relationType, item.relationType),
        note: preferExisting(exactRelation.note ?? '', item.note),
      })
      appendAiSystemNote(`已确认合并角色关系：${item.fromCharacterName} ↔ ${item.toCharacterName}`)
    } else {
      const createdRev = createCharacterRelation({
        novelId: novelId.value,
        fromCharacterId,
        toCharacterId,
        relationType: item.relationType || reverseRelation?.relationType || '关系',
        note: item.note,
      })
      relationId = createdRev.id
      appendAiSystemNote(`已按识别方向补充角色关系：${item.fromCharacterName} ↔ ${item.toCharacterName}`)
    }
  }
  finishAiSuggestionApply('relations', index, action, { editorEntityType: 'character', editorTargetId: fromCharacterId })
  return relationId
}

function applyOutlineItemSuggestion(index: number, action: 'create' | 'ignore'): string {
  const item = aiExtractResult.value.outlineItems[index]
  if (!item || item.uiState?.status === 'applied') return ''
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略大纲建议：${item.title}`)
    setAiSuggestionState('outlineItems', index, 'ignored', 'ignore')
    return ''
  }
  const allowedLevels = ['volume', 'act', 'chapter', 'scene']
  const level = allowedLevels.includes(item.level) ? (item.level as 'volume' | 'act' | 'chapter' | 'scene') : 'scene'
  const created = createOutlineItem({
    novelId: novelId.value,
    title: item.title,
    summary: item.summary,
    level,
  })
  // 整理当前章模式下，把新大纲节点自动绑定到来源章节，让“已写正文”与结构对齐
  let boundNote = ''
  if (aiExtractLastMode.value === 'current' && selectedChapter.value) {
    const chapter = selectedChapter.value
    const nextIds = [...(chapter.outlineItemIds ?? [])]
    if (!nextIds.includes(created.id)) {
      nextIds.push(created.id)
      updateChapter({ id: chapter.id, outlineItemIds: nextIds })
      chapters.value = chapters.value.map((row) =>
        row.id === chapter.id ? { ...row, outlineItemIds: nextIds } : row,
      )
      boundNote = `，并绑定到第 ${chapter.chapterNo} 章`
    }
  }
  appendAiSystemNote(`已确认添加大纲节点：${item.title}${boundNote}`)
  finishAiSuggestionApply('outlineItems', index, 'create')
  return created.id
}

function applyForeshadowSuggestion(index: number, action: 'create' | 'ignore'): string {
  const item = aiForeshadowResult.value.newPlants[index]
  if (!item || item.uiState?.status === 'applied') return ''
  if (action === 'ignore') {
    appendAiSystemNote(`已忽略伏笔建议：${item.title}`)
    setAiForeshadowSuggestionState(index, 'ignored', 'ignore')
    return ''
  }
  const chapter = selectedChapter.value
  if (!chapter || !novelId.value) return ''
  const evidence = item.evidences.find((ev) => String(ev.chapterId ?? '').trim() === chapter.id) ?? item.evidences[0]
  const plantText = String(evidence?.quote ?? item.summary ?? item.title).trim()

  // 计算伏笔在正文中的位置
  const content = chapter.content || ''
  const plantTextIndex = content.indexOf(plantText)
  const plantStart = plantTextIndex >= 0 ? plantTextIndex : undefined
  const plantEnd = plantTextIndex >= 0 ? plantTextIndex + plantText.length : undefined

  const createdPlant = createForeshadowPlant({
    novelId: novelId.value,
    title: item.title,
    plantText,
    plantChapterId: String(evidence?.chapterId ?? '').trim() || chapter.id,
    plantChapterNo: Number.isFinite(Number(evidence?.chapterNo)) ? Number(evidence?.chapterNo) : chapter.chapterNo,
    plantChapterTitle: chapter.title,
    plantStart,
    plantEnd,
    description: item.summary,
    expectedFulfillNotes: item.payoffHint,
  })
  reload()
  triggerChapterHubSaveToast()
  appendAiSystemNote(`已确认添加伏笔：${item.title}`)
  setAiForeshadowSuggestionState(index, 'applied', 'create')
  return createdPlant.id
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
  section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations' | 'outlineItems' | 'foreshadows' | 'classification',
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

function applyAiSuggestion(payload: { section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations' | 'outlineItems' | 'foreshadows' | 'classification'; index: number; action: 'create' | 'merge' | 'ignore' | 'reopen' }): void {
  aiExtractError.value = ''
  if (payload.action === 'reopen') {
    reopenAiSuggestion(payload.section, payload.index)
    return
  }
  if (payload.section === 'characters') { applyCharacterSuggestion(payload.index, payload.action); return }
  if (payload.section === 'factions') { applyFactionSuggestion(payload.index, payload.action); return }
  if (payload.section === 'items') { applyItemSuggestion(payload.index, payload.action); return }
  if (payload.section === 'memberships') { applyMembershipSuggestion(payload.index, payload.action); return }
  if (payload.section === 'outlineItems') { applyOutlineItemSuggestion(payload.index, payload.action === 'ignore' ? 'ignore' : 'create'); return }
  if (payload.section === 'foreshadows') { applyForeshadowSuggestion(payload.index, payload.action === 'ignore' ? 'ignore' : 'create'); return }
  if (payload.section === 'classification') { applyClassificationSuggestion(payload.action === 'ignore' ? 'ignore' : 'merge'); return }
  applyRelationSuggestion(payload.index, payload.action)
}

const aiSuggestionCount = computed(
  () =>
    aiExtractResult.value.characters.length +
    aiExtractResult.value.factions.length +
    aiExtractResult.value.items.length +
    aiExtractResult.value.memberships.length +
    aiExtractResult.value.relations.length +
    aiExtractResult.value.outlineItems.length,
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
  outlineRewriteResult?: OutlineRewriteResult,
): string {
  const entityTotal =
    entityResult.characters.length + entityResult.factions.length + entityResult.items.length + entityResult.memberships.length + entityResult.relations.length + entityResult.outlineItems.length
  const lines = [
    `${scopeLabel(mode)}整理完成。`,
    `实体建议 ${entityTotal} 条，新增伏笔候选 ${foreshadowResult.newPlants.length} 条，分类结果 ${classificationResult.chapterType || '未给出'}。`,
  ]
  const rewriteTotal = (outlineRewriteResult?.revisions.length ?? 0) + (outlineRewriteResult?.additions.length ?? 0)
  if (rewriteTotal > 0) {
    lines.push(`大纲动态回写建议 ${rewriteTotal} 条（修订 ${outlineRewriteResult?.revisions.length ?? 0}、新增 ${outlineRewriteResult?.additions.length ?? 0}），已加入待确认。`)
  }
  const warningTotal = entityResult.warnings.length + foreshadowResult.warnings.length + classificationResult.warnings.length + (outlineRewriteResult?.warnings.length ?? 0)
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
  aiOutlineRewriteResult.value = { revisions: [], additions: [], warnings: [] }
  aiAppliedActions.value = []
  aiExtractRuns.value = []
  aiPendingAppliedDetail.value = ''
  persistActiveAiSessionState()
}

async function organizeCurrentChapter(): Promise<void> {
  if (!selectedChapter.value) return
  chapterDirtySinceLastOrganize.value = false
  appendAiSystemNote('正在整理本章…')
  await Promise.all([
    runAiExtract('current'),
    runConsistencyCheckAfterContinue(selectedChapter.value.id),
  ])
  void runCharacterStateAfterContinue(selectedChapter.value.id)
  void runSceneSummaryAfterContinue(selectedChapter.value.id)
  void runChapterSummaryAfterContinue(selectedChapter.value.id, { autoApply: true })
  refreshConflictCount()
}

function refreshConflictCount(): void {
  conflictCount.value = novelId.value ? getUnresolvedConflictCount(novelId.value) : 0
}

const conflictPanelConflicts = computed(() => {
  void conflictCount.value
  return novelId.value ? getUnresolvedConflicts(novelId.value) : []
})

function resolveConflictItem(id: string, resolution: 'keep_existing' | 'accept_incoming' | 'ignored'): void {
  const item = resolveConflict(id, resolution)
  if (!item) return
  if (resolution === 'accept_incoming') {
    const { module, entityId, field, incomingValue } = item
    if (module === 'characters') {
      updateCharacter({ id: entityId, [field]: incomingValue })
    } else if (module === 'factions') {
      updateFaction({ id: entityId, [field]: incomingValue })
    } else if (module === 'items') {
      updateItem({ id: entityId, [field]: incomingValue })
    }
  }
  refreshConflictCount()
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
  aiOutlineRewriteResult.value = { revisions: [], additions: [], warnings: [] }
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
    const novelBrief = novel.value
      ? {
          title: novel.value.title,
          summary: novel.value.summary,
          continuityBrief: novel.value.continuityBrief,
          genre: novel.value.genre,
        }
      : undefined
    const [entityResult, foreshadowResult, classificationResult, outlineRewriteResult] = await Promise.all([
      extractNovelEntitiesFromWorkspace(snapshot, { mode, chapterIds }),
      analyzeNovelForeshadowsFromWorkspace(snapshot, { mode, chapterIds, focusQuote }),
      classifyNovelChapterFromWorkspace(snapshot, { mode, chapterIds, focusQuote }),
      rewriteOutlineFromProgressByAi(snapshot, { mode, chapterIds, novel: novelBrief }),
    ])
    aiExtractResult.value = entityResult
    autoSkipNegligibleExtractUpdates()
    aiForeshadowResult.value = foreshadowResult
    aiClassificationResult.value = classificationResult
    aiOutlineRewriteResult.value = outlineRewriteResult
    autoApplyExtractResult()
    // 大纲动态回写建议转成待确认工具调用，并入现有"先预览后确认"列表
    const outlineRewriteCalls = buildOutlineRewriteToolCalls(outlineRewriteResult)
    if (outlineRewriteCalls.length > 0) {
      aiPendingToolActions.value = [
        ...aiPendingToolActions.value.filter((row) => row.status === 'pending'),
        ...buildPendingToolActions(outlineRewriteCalls),
      ]
    }
    pushAiExtractRun('entities', mode, {
      entityResult: aiExtractResult.value,
      foreshadowResult: aiForeshadowResult.value,
      classificationResult: aiClassificationResult.value,
      outlineRewriteResult: aiOutlineRewriteResult.value,
    })
    appendAiChatMessage('assistant', buildCombinedExtractSummary(aiExtractResult.value, aiForeshadowResult.value, aiClassificationResult.value, mode, aiOutlineRewriteResult.value), mode)
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

async function runConsistencyCheck(): Promise<void> {
  const id = novelId.value
  const chapter = selectedChapter.value
  if (!id || !chapter || !requestAiAccess()) return

  aiConsistencyLoading.value = true
  aiConsistencyResult.value = null

  try {
    const snapshot = buildNovelWorkspacePayload(id)
    const result = await checkChapterConsistencyFromWorkspaceStream(
      snapshot,
      chapter.id,
      {
        onChunk: () => {},
        onError: (err: Error) => {
          if (err.name !== 'AbortError') {
            console.warn('一致性检查失败:', err.message)
          }
        },
      },
    )
    aiConsistencyResult.value = result
    const issueCount = result.characterIssues.length + result.timelineIssues.length + result.foreshadowIssues.length + result.settingIssues.length
    if (issueCount > 0) {
      appendAiSystemNote(`一致性检查发现 ${issueCount} 个问题`)
    } else {
      appendAiSystemNote('一致性检查通过，未发现问题')
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name !== 'AbortError') {
      console.warn('一致性检查失败:', e.message)
    }
  } finally {
    aiConsistencyLoading.value = false
  }
}

function stopAiReadingDesk(): void {
  deskAborts.chat?.abort()
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
  deskAborts.continue?.abort()
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
  // 防止并发：提问/抽取任务进行中时，忽略续写请求。
  // （续写自身进行中时由界面将「生成」切换为「终止」按钮处理，不在此拦截，以支持重新生成。）
  if (aiChatLoading.value || aiChatThinking.value || aiExtractLoading.value) return

  const rawDirection = String(payload.direction ?? '').trim()

  // 零章节时自动创建第一章
  if (!selectedChapter.value && chapters.value.length === 0) {
    const outlineBinding = suggestNextChapterOutlineBinding(outlineItems.value, chapters.value, null)
    const firstChapter = createAndOpenNextChapter(outlineBinding?.title ?? '', outlineBinding?.outlineItemIds ?? [])
    if (!firstChapter) {
      appendAiChatMessage('assistant', '自动创建第一章失败，请手动新建章节后再试。', 'current')
      return
    }
    const beatNote = outlineBinding?.beatLine ? `\n大纲节拍：${outlineBinding.beatLine}` : ''
    appendAiChatMessage('assistant', `已自动创建第 1 章${outlineBinding?.title ? `「${outlineBinding.title}」` : ''}，正在生成正文草稿…${beatNote}`, 'current')
  }

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

  deskAborts.continue?.abort()
  deskAborts.continue = new AbortController()
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
              arcSummaries: novel.value.arcSummaries,
              genre: novel.value.genre,
              perspective: novel.value.perspective,
              tone: novel.value.tone,
            }
          : undefined,
        aiStylePrompt: novel.value?.aiStylePrompt,
      },
      {
        onChunk: (text: string) => {
          if (position === 'replace') {
            aiContinueDraft.value = {
              ...aiContinueDraft.value,
              text: aiContinueDraft.value.text + text,
            }
          } else {
            aiContinueDraft.value = {
              ...aiContinueDraft.value,
              text: aiContinueDraft.value.text + text,
            }
            const ch = selectedChapter.value
            if (ch) {
              const prev = ch.content ?? ''
              const sep = aiContinueDraft.value.text.length === text.length
                ? (prev.length > 0 && !prev.endsWith('\n\n') ? '\n\n' : '')
                : ''
              const nextContent = prev + sep + text
              updateChapter({ id: ch.id, content: nextContent })
              chapters.value = chapters.value.map((item) => (item.id === ch.id ? { ...item, content: nextContent } : item))
            }
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
      deskAborts.continue.signal,
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
      status: 'applied',
      warnings: result.warnings,
      droppedLayers: result.droppedLayers,
      usedLayers: result.usedLayers,
      usedChars: result.usedChars,
      ragHits: result.ragHits,
    }

    if (position === 'replace') {
      autoApplyRewriteWithDiff(chapter, finalText)
    } else {
      appendAiSystemNote(`续写完成（约 ${finalText.replace(/\s/g, '').length} 字），已写入正文。`)
      appendAiChatMessage('assistant', `【续写完成】${finalText.slice(0, 80)}${finalText.length > 80 ? '…' : ''}`, 'current')
      runPostContinueWorkflows(chapter.id, false)
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
    deskAborts.continue = null
    aiContinueThinkingText.value = ''
    if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)
    void fetchWalletBalance().catch(() => {
      /* ignore */
    })
  }
}

function autoApplyRewriteWithDiff(chapter: { id: string; content?: string | null; chapterNo?: number | null }, finalText: string): void {
  const oldContent = chapter.content ?? ''
  const lines = finalText.split('\n')
  const firstLine = (lines.find((l) => l.trim().length > 0) ?? '').trim()
  const firstIdx = lines.findIndex((l) => l.trim().length > 0)
  const rest = lines.slice(firstIdx + 1).join('\n').trim()
  const looksLikeTitle = firstLine.length <= 30 && !/[。！？.!?]$/.test(firstLine) && rest.length > 0
  const newContent = looksLikeTitle ? rest : finalText

  updateChapter({ id: chapter.id, content: newContent })
  chapters.value = chapters.value.map((item) => (item.id === chapter.id ? { ...item, content: newContent } : item))

  const diff = computeLineDiff(oldContent, newContent)
  chapterDiffSegments.value = diff

  appendAiSystemNote(`重写完成（约 ${newContent.replace(/\s/g, '').length} 字），已写入正文。点击正文区域可关闭 diff 高亮。`)
  appendAiChatMessage('assistant', `【重写完成】已更新正文。`, 'current')
  runPostContinueWorkflows(chapter.id, true)
}

function runPostContinueWorkflows(chapterId: string, isRewrite: boolean): void {
  void runChapterSummaryAfterContinue(chapterId, { autoApply: true })
  switchToAiDeskMode('ask')
  void runAiExtract('current')
  void runSceneSummaryAfterContinue(chapterId)
  void runCharacterStateAfterContinue(chapterId)
  autoAlignOutlineAfterContinue(chapterId)
  void maybeGenerateChapterTitleAfterContinue(chapterId)
  void runConsistencyCheckAfterContinue(chapterId)
  if (isRewrite) void runRewriteHealthCheck(chapterId)
  if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)
}

function clearChapterDiff(): void {
  chapterDiffSegments.value = []
}

async function applyContinueDraft(): Promise<void> {
  const chapter = selectedChapter.value
  const text = aiContinueDraft.value.text.trim()
  if (!chapter || !text) return

  const isRewrite = aiContinueDraft.value.position === 'replace'
  const content = chapter.content ?? ''

  if (isRewrite) {
    // 重写：整章替换。AI 输出格式为「标题\n\n正文」，拆出首行标题、其余为正文。
    const lines = text.split('\n')
    const firstLine = (lines.find((l) => l.trim().length > 0) ?? '').trim()
    const firstIdx = lines.findIndex((l) => l.trim().length > 0)
    const rest = lines.slice(firstIdx + 1).join('\n').trim()
    // 首行像标题（短、无句末标点）且确实还有正文，才当标题剥离；否则整体作正文，标题留给后续 AI 命名
    const looksLikeTitle = firstLine.length > 0 && firstLine.length <= 24 && !/[。！？，、；：.!?]$/.test(firstLine) && rest.length > 0
    const newBody = looksLikeTitle ? rest : text
    const newTitle = looksLikeTitle ? firstLine.replace(/^[「『《【\["']+|[」』》】\]"']+$/g, '').trim() : ''

    updateChapter({ id: chapter.id, content: newBody, ...(newTitle ? { title: newTitle } : {}) })
    chapters.value = chapters.value.map((item) =>
      item.id === chapter.id ? { ...item, content: newBody, ...(newTitle ? { title: newTitle } : {}) } : item,
    )
    triggerChapterHubSaveToast()
    aiContinueDraft.value = { ...aiContinueDraft.value, status: 'applied' }
    appendAiSystemNote(`已整章重写并替换本章正文（约 ${newBody.replace(/\s/g, '').length} 字${newTitle ? `，标题「${newTitle}」` : ''}）；正在更新章总结、整理档案，并做重写体检…`)
    appendAiChatMessage('assistant', `【已采用重写】${newBody.slice(0, 80)}${newBody.length > 80 ? '…' : ''}`, 'current')
    if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)

    void runChapterSummaryAfterContinue(chapter.id, { autoApply: true })
    switchToAiDeskMode('ask')
    void runAiExtract('current')
    void runSceneSummaryAfterContinue(chapter.id)
    void runCharacterStateAfterContinue(chapter.id)
    autoAlignOutlineAfterContinue(chapter.id)
    if (!newTitle) void maybeGenerateChapterTitleAfterContinue(chapter.id)
    void runRewriteHealthCheck(chapter.id)
    return
  }

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
  appendAiSystemNote(`已采用续写内容（约 ${text.replace(/\s/g, '').length} 字）写入正文；将自动更新章总结并整理人物档案…`)
  appendAiChatMessage('assistant', `【已采用续写】${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`, 'current')
  if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)

  void runChapterSummaryAfterContinue(chapter.id, { autoApply: true })
  switchToAiDeskMode('ask')
  void runAiExtract('current')
  void runSceneSummaryAfterContinue(chapter.id)
  void runCharacterStateAfterContinue(chapter.id)
  autoAlignOutlineAfterContinue(chapter.id)
  void maybeGenerateChapterTitleAfterContinue(chapter.id)
  void runConsistencyCheckAfterContinue(chapter.id)
}

/**
 * 重写体检：整章重写采用后，自动跑一次本章一致性检查，把「后文可能对不上 / 伏笔变化 /
 * 角色状态变化」列成一条提醒消息，结果也展示在现有 aiConsistencyResult 面板。不自动改后文。
 */
async function runRewriteHealthCheck(chapterId: string): Promise<void> {
  const id = novelId.value
  if (!id || !requestAiAccess()) return
  try {
    const snapshot = buildNovelWorkspacePayload(id)
    const result = await checkChapterConsistencyFromWorkspaceStream(snapshot, chapterId, {
      onChunk: () => {},
      onError: (err: Error) => {
        if (err.name !== 'AbortError') console.warn('重写体检失败:', err.message)
      },
    })
    aiConsistencyResult.value = result
    const issueCount =
      result.characterIssues.length + result.timelineIssues.length + result.foreshadowIssues.length + result.settingIssues.length
    if (issueCount > 0) {
      appendAiSystemNote(`重写体检：发现 ${issueCount} 处可能受影响（后文衔接 / 伏笔 / 角色状态 / 设定），已在「一致性检查」面板列出，请人工确认是否需要调整后续章节。`)
    } else {
      appendAiSystemNote('重写体检：未发现与既有档案、大纲、伏笔的明显冲突。仍建议浏览后续章节确认衔接。')
    }
    if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)
  } catch (e: unknown) {
    if (e instanceof Error && e.name !== 'AbortError') console.warn('重写体检失败:', e.message)
  }
}

async function runConsistencyCheckAfterContinue(chapterId: string): Promise<void> {
  const id = novelId.value
  if (!id || !requestAiAccess()) return
  try {
    const snapshot = buildNovelWorkspacePayload(id)
    const result = await checkChapterConsistencyFromWorkspaceStream(snapshot, chapterId, {
      onChunk: () => {},
      onError: (err: Error) => {
        if (err.name !== 'AbortError') console.warn('续写一致性检查失败:', err.message)
      },
    })
    aiConsistencyResult.value = result
    const issueCount =
      result.characterIssues.length + result.timelineIssues.length + result.foreshadowIssues.length + result.settingIssues.length
    if (issueCount > 0) {
      appendAiSystemNote(`一致性检查：发现 ${issueCount} 处潜在问题，已在「一致性检查」面板列出。`)
    }
    if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)
  } catch (e: unknown) {
    if (e instanceof Error && e.name !== 'AbortError') console.warn('续写一致性检查失败:', e.message)
  }
}

/**
 * 续写写入正文后：若本章标题仍是占位（空 / 「第N章」），让 AI 根据正文起一个贴合剧情的标题。
 * 已有作者自定义标题时不覆盖。失败静默，不阻断续写主流程。
 */
const PLACEHOLDER_TITLE_RE = /^第\s*[0-9一二三四五六七八九十百千]+\s*章$/
async function maybeGenerateChapterTitleAfterContinue(chapterId: string): Promise<void> {
  const id = novelId.value
  if (!id || !requestAiAccess()) return
  const current = chapters.value.find((c) => c.id === chapterId)
  const title = String(current?.title ?? '').trim()
  if (title && !PLACEHOLDER_TITLE_RE.test(title)) return
  try {
    const snapshot = buildNovelWorkspacePayload(id)
    const aiTitle = await generateChapterTitleFromWorkspace(snapshot, chapterId)
    if (!aiTitle) return
    // 期间作者可能已手动改名：再次确认仍是占位才写入
    const latest = chapters.value.find((c) => c.id === chapterId)
    const latestTitle = String(latest?.title ?? '').trim()
    if (latestTitle && !PLACEHOLDER_TITLE_RE.test(latestTitle)) return
    updateChapter({ id: chapterId, title: aiTitle })
    reload()
    appendAiSystemNote(`已为本章拟定标题「${aiTitle}」（可在章节信息里手动修改）`)
  } catch {
    /* 起名失败不影响续写主流程 */
  }
}

/**
 * 大纲自动对齐(低风险):写完章后,把本章已绑定的大纲节点标记为 done。
 * 只改 status,不改层级/结构;每条记 merge 日志,可撤销还原原状态。
 * 高风险动作(扩展后续节点、改结构、新建 volume/act)仍走人工提案。
 */
function autoAlignOutlineAfterContinue(chapterId: string): void {
  const id = novelId.value
  if (!id) return
  const chapter = chapters.value.find((c) => c.id === chapterId)
  const boundIds = Array.isArray(chapter?.outlineItemIds) ? chapter!.outlineItemIds : []
  if (boundIds.length === 0) return
  const allOutline = getOutlineByNovelId(id)
  let aligned = 0
  for (const oid of boundIds) {
    const node = allOutline.find((o) => o.id === oid)
    if (!node || node.status === 'done') continue
    try {
      const before = snapshotEntity(node)
      updateOutlineItem({ id: node.id, status: 'done' })
      logAutoApply('outlineItems', 'merge', node.id, node.title, 'update', before, ['status'])
      aligned += 1
    } catch (e) {
      console.warn('大纲自动对齐失败:', node.title, e)
    }
  }
  if (aligned > 0) {
    reload()
    refreshAutoApplyLog()
    pushAutoApplyLogToBackend()
    appendAiSystemNote(`已将本章绑定的 ${aligned} 个大纲节点标记为已写`)
  }
}

async function runCharacterStateAfterContinue(chapterId: string): Promise<void> {
  const id = novelId.value
  if (!id || !requestAiAccess()) return
  try {
    const snapshot = buildNovelWorkspacePayload(id)
    const result = await runCharacterStateExtract(snapshot, chapterId)
    if (result.updated.length > 0) {
      reload()
      appendAiSystemNote(`已更新 ${result.updated.length} 名角色的逐章状态：${result.updated.map((u) => u.name).join('、')}`)
      void putRemoteCharacterStates(id, collectCharacterNarrativeStates(id)).catch((e) =>
        console.warn('角色状态同步后端失败:', e),
      )
    }
    for (const w of result.warnings) console.warn('角色状态抽取:', w)
  } catch (e: unknown) {
    if (e instanceof Error && e.name !== 'AbortError') {
      console.warn('角色状态抽取失败:', e.message)
    }
  }
}

/** 冷启动/换设备:从后端拉取角色逐章状态并灌回本地(按章去重,不覆盖本地已有) */
async function hydrateCharacterStatesFromBackend(): Promise<void> {
  const id = novelId.value
  if (!id) return
  try {
    const rows = await getRemoteCharacterStates(id)
    if (rows.length > 0) importCharacterNarrativeStates(rows)
  } catch (e: unknown) {
    if (e instanceof Error) console.warn('拉取角色状态失败:', e.message)
  }
}

/** 把本地自动入库日志整本推到后端(fire-and-forget,失败不影响主流程) */
function pushAutoApplyLogToBackend(): void {
  const id = novelId.value
  if (!id) return
  void putRemoteAutoApplyLog(id, getAutoApplyLogByNovel(id, { includeUndone: true })).catch((e) =>
    console.warn('自动入库日志同步后端失败:', e),
  )
}

/** 冷启动/换设备:从后端拉取自动入库日志灌回本地(整本替换),再刷新当前章横幅 */
async function hydrateAutoApplyLogFromBackend(): Promise<void> {
  const id = novelId.value
  if (!id) return
  try {
    const remote = await getRemoteAutoApplyLog(id)
    const local = getAutoApplyLogByNovel(id, { includeUndone: true })
    // 本地已有日志(可能含未同步的撤销)优先,仅在本地为空时用远端灌入
    if (local.length === 0 && remote.length > 0) {
      replaceAutoApplyLogForNovel(id, remote)
      refreshAutoApplyLog()
    }
  } catch (e: unknown) {
    if (e instanceof Error) console.warn('拉取自动入库日志失败:', e.message)
  }
}

function ignoreContinueDraft(): void {
  aiContinueDraft.value = { ...aiContinueDraft.value, status: 'ignored', text: '' }
  appendAiSystemNote('已忽略本次续写草稿')
}

function aiToolExecutionContext() {
  const sel = chapterPinnedQuoteSelection.value
  return {
    defaultChapterId: selectedChapterId.value || selectedChapter.value?.id,
    selectionRange: sel ? { chapterId: sel.chapterId, start: sel.start, end: sel.end } : undefined,
  }
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

const TOOL_ACTION_INTENT_RE =
  /(伏笔|设为|标记|创建|新建|添加|删除|移除|绑定|关联|整理|总结|提取|归纳|修改角色|更新角色|创建角色|创建势力|修改势力)/

async function askAiReadingDesk(payload: { question: string; mode?: AiDeskMode }): Promise<void> {
  const id = novelId.value
  if (!id) return
  // 防止并发：已有 AI 任务进行中时（续写/提问/抽取），忽略新的提交
  if (aiBusy.value) return
  const deskMode = payload.mode ?? aiDeskMode.value
  const question = String(payload.question ?? '').trim()
  const isToolAction = TOOL_ACTION_INTENT_RE.test(question)

  // 写作模式：只允许续写/重写相关请求，其他一律拒绝
  if (deskMode === 'write') {
    if (isRewriteIntent(question) || isNextChapterIntent(question) || WRITE_BODY_INTENT_RE.test(question) || chapters.value.length === 0) {
      await runAiContinue({ direction: question || '写第一章开头' })
      return
    }
    appendAiChatMessage('assistant', '写作模式仅支持续写或重写正文。如需提问、创建伏笔、整理角色等操作，请切换到「提问」模式。', 'current')
    return
  }

  // 提问模式：零章节时允许提问（不限制）
  if (!selectedChapter.value && deskMode !== 'ask') {
    aiExtractError.value = '请先选择章节后再使用 AI。'
    return
  }

  // 提问模式：识别到续写/重写意图时自动切到写作模式
  if ((WRITE_BODY_INTENT_RE.test(question) || isRewriteIntent(question)) && !isToolAction) {
    switchToAiDeskMode('write')
    appendAiChatMessage(
      'assistant',
      isRewriteIntent(question)
        ? '已识别为整章重写任务：请在下方「重写草稿」中预览，点「采用」后才会整章替换本章正文。'
        : '已识别为生成正文任务：请在下方「续写草稿」中预览，点「采用」后才会写入稿纸。',
      'current',
    )
    await runAiContinue({ direction: question })
    return
  }

  const quoted = aiSelectionQuote.value.trim()
  const composedQuestion = quoted
    ? `以下选中的正文需要被操作：\n「${quoted}」\n\n作者指令：${question}`
    : question
  if (aiPendingToolActions.value.some((row) => row.status === 'pending')) {
    ignoreAiPendingToolActions(true)
  }
  appendAiChatMessage('user', quoted ? `引用：${quoted}\n${question}` : question, 'current')
  aiChatLoading.value = true
  aiChatThinking.value = true
  aiExtractError.value = ''
  deskAborts.chat?.abort()
  deskAborts.chat = new AbortController()
  const msgId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const msg: AiDeskChatMessage = {
    id: msgId,
    role: 'assistant' as const,
    content: '',
    mode: 'current' as const,
    createdAt: new Date().toISOString(),
  }
  aiChatMessages.value = [...aiChatMessages.value, msg]
  // 通过 id 在响应式数组里就地更新助手消息内容。
  // 不能直接 msg.content += text：那是改原始对象而非响应式代理，切页/重渲染时累积内容会丢。
  let pendingPersist = false
  const patchAssistant = (mut: (m: AiDeskChatMessage) => void): void => {
    const idx = aiChatMessages.value.findIndex((m) => m.id === msgId)
    if (idx < 0) return
    const next = [...aiChatMessages.value]
    const copy = { ...next[idx] }
    mut(copy)
    next[idx] = copy
    aiChatMessages.value = next
    // 流式过程中节流持久化，确保切页/刷新时已输出内容不丢
    if (!pendingPersist && novelId.value) {
      pendingPersist = true
      window.setTimeout(() => {
        pendingPersist = false
        if (novelId.value) persistAiChatMessages(novelId.value, aiChatMessages.value)
      }, 400)
    }
  }
  const readAssistantContent = (): string =>
    String(aiChatMessages.value.find((m) => m.id === msgId)?.content ?? '')
  try {
    const snapshot = buildNovelWorkspacePayload(id)
    const streamCallbacks = {
      onChunk: (text: string) => {
        if (aiChatThinking.value) aiChatThinking.value = false
        patchAssistant((m) => {
          m.content += text
        })
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
              arcSummaries: novel.value.arcSummaries,
              genre: novel.value.genre,
              perspective: novel.value.perspective,
              tone: novel.value.tone,
            }
          : undefined,
      },
      streamCallbacks,
      conversationHistory.value.length > 0 ? conversationHistory.value : undefined,
      deskAborts.chat.signal,
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
    // 清除流式传输中可能残留的 DSML tool call 标记
    let finalContent = readAssistantContent()
      .replace(/<｜｜DSML｜｜[^>]*>[\s\S]*?<｜｜DSML｜｜[^>]*>/g, '')
      .trim()
    if (pendingToolActions && pendingToolActions.length > 0) {
      aiPendingToolActions.value = pendingToolActions
      const hasChapterDraft = pendingToolActions.some((row) => row.toolCall.function.name === 'update_chapter_content')
      finalContent = hasChapterDraft
        ? `${text}\n\n正文已写入上方「待确认的修改」卡片（显示开头预览），请点「采用」后才会出现在稿纸。`
        : text
      aiChatThinking.value = false
    } else if (!finalContent.trim()) {
      finalContent = text?.trim() || '已回答完毕，但这次没有生成可显示的内容。'
    }
    patchAssistant((m) => {
      m.content = finalContent
    })
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      if (!readAssistantContent().trim()) patchAssistant((m) => { m.content = '已停止回答。' })
    } else if (!readAssistantContent().trim()) {
      aiChatMessages.value = aiChatMessages.value.filter((m) => m.id !== msgId)
      aiExtractError.value = e instanceof Error ? e.message : 'AI 请求失败，请稍后重试'
    }
  } finally {
    aiChatLoading.value = false
    aiChatThinking.value = false
    deskAborts.chat = null
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

// 正文同一处重叠多个伏笔时，先弹列表让用户选要操作哪个
const foreshadowPickerOpen = ref(false)
const foreshadowPickerPlantIds = ref<string[]>([])
const foreshadowPickerPlants = computed(() =>
  foreshadowPickerPlantIds.value
    .map((id) => allForeshadowsForHub.value.find((p) => p.id === id))
    .filter((p): p is ForeshadowPlant => !!p),
)

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

// ── 选中文本浮动操作条 ────────────────────────────────────────────────
const selectionActionBarOpen = ref(false)
const selectionActionBarX = ref(0)
const selectionActionBarY = ref(0)
const selectionActionBarSelStart = ref(0)
const selectionActionBarSelEnd = ref(0)
let selectionActionBarHideTimer: number | null = null

const selectionActionBarCanAddAsFaction = computed(() => {
  const ta = chapterTextareaRef.value
  if (!ta) return true
  const start = selectionActionBarSelStart.value
  const end = selectionActionBarSelEnd.value
  if (end <= start) return true
  const text = ta.value.slice(start, end).trim()
  if (!text) return true
  return !someCharacterHasLabel(characters.value, text)
})

function showSelectionActionBar(): void {
  const ta = chapterTextareaRef.value
  if (!ta || !selectedChapter.value) return
  const start = ta.selectionStart ?? 0
  const end = ta.selectionEnd ?? start
  if (end <= start) {
    hideSelectionActionBar()
    return
  }

  if (selectionActionBarHideTimer != null) {
    window.clearTimeout(selectionActionBarHideTimer)
    selectionActionBarHideTimer = null
  }

  selectionActionBarSelStart.value = start
  selectionActionBarSelEnd.value = end

  const coords = getCaretPixelOffset(ta, end)
  if (!coords) return
  const taRect = ta.getBoundingClientRect()
  const caretY = taRect.top + (coords.top - ta.scrollTop) + (coords.height || 18) + 8
  const caretX = taRect.left + coords.left + (coords.width || 0) / 2

  selectionActionBarX.value = Math.max(40, Math.min(caretX, window.innerWidth - 40))
  selectionActionBarY.value = Math.min(caretY, window.innerHeight - 48)
  selectionActionBarOpen.value = true
}

function hideSelectionActionBar(): void {
  if (selectionActionBarHideTimer != null) return
  selectionActionBarHideTimer = window.setTimeout(() => {
    selectionActionBarOpen.value = false
    selectionActionBarHideTimer = null
  }, 150)
}

function cancelHideSelectionActionBar(): void {
  if (selectionActionBarHideTimer != null) {
    window.clearTimeout(selectionActionBarHideTimer)
    selectionActionBarHideTimer = null
  }
}

function selectionActionAddCharacter(): void {
  const ta = chapterTextareaRef.value
  if (!ta || !novel.value) return
  const start = selectionActionBarSelStart.value
  const end = selectionActionBarSelEnd.value
  const name = ta.value.slice(start, end).trim()
  if (!name) return
  createCharacter({
    novelId: novel.value.id,
    name,
    createdInChapterId: selectedChapter.value?.id ?? null,
    firstAppearanceChapterNo: selectedChapter.value?.chapterNo ?? null,
    age: '',
    gender: '',
    goal: '',
    secret: '',
    arc: '',
    notes: '',
  })
  characters.value = getCharactersByNovelId(novelId.value)
  selectionActionBarOpen.value = false
  collapseAndBlurTextarea()
}

function selectionActionAddFaction(): void {
  const ta = chapterTextareaRef.value
  if (!ta || !novel.value) return
  const start = selectionActionBarSelStart.value
  const end = selectionActionBarSelEnd.value
  const name = ta.value.slice(start, end).trim()
  if (!name) return
  createFaction({
    novelId: novel.value.id,
    name,
    createdInChapterId: selectedChapter.value?.id ?? null,
    leader: '',
    notes: '',
  })
  factions.value = getFactionsByNovelId(novelId.value)
  selectionActionBarOpen.value = false
  collapseAndBlurTextarea()
}

function selectionActionAddForeshadow(): void {
  const ta = chapterTextareaRef.value
  if (!ta) return
  const start = selectionActionBarSelStart.value
  const end = selectionActionBarSelEnd.value
  const text = ta.value.slice(start, end).trim()
  if (!text) return
  selectionActionBarOpen.value = false
  openForeshadowPlantModalWithSelection(text, start, end)
}

function collapseAndBlurTextarea(): void {
  const ta = chapterTextareaRef.value
  if (!ta) return
  const pos = ta.selectionEnd ?? ta.value.length
  ta.setSelectionRange(pos, pos)
  ta.blur()
}

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
  if (aiSelectionQuote.value && !focusMode.value && aiStudioOpen.value) {
    if (!requestAiAccess()) return
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

function openForeshadowPlantModalWithSelection(text: string, start: number, end: number): void {
  editingForeshadowPlantId.value = ''
  editingForeshadowFulfillmentId.value = ''
  pendingForeshadowSelection.value = { start, end, text }
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

  // 照应处直接打开；植入处若与其它伏笔重叠，先弹选择列表
  if (meta.segment !== 'fulfill') {
    const overlapping = foreshadowsOverlappingPlant(plant)
    if (overlapping.length > 1) {
      foreshadowPickerPlantIds.value = overlapping.map((p) => p.id)
      foreshadowPickerOpen.value = true
      return
    }
  }
  openForeshadowEditFromMeta(meta)
}

// 找出与给定伏笔植入区间重叠的所有伏笔（含自身），仅限同一植入章节
function foreshadowsOverlappingPlant(plant: ForeshadowPlant): ForeshadowPlant[] {
  const s = plant.plantStart
  const e = plant.plantEnd
  if (typeof s !== 'number' || typeof e !== 'number' || e <= s) return [plant]
  return allForeshadowsForHub.value.filter((p) => {
    if (p.plantChapterId !== plant.plantChapterId) return false
    const ps = p.plantStart
    const pe = p.plantEnd
    if (typeof ps !== 'number' || typeof pe !== 'number' || pe <= ps) return false
    return ps < e && pe > s
  })
}

function openForeshadowEditFromMeta(meta: ForeshadowHoverMeta): void {
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

function closeForeshadowPicker(): void {
  foreshadowPickerOpen.value = false
  foreshadowPickerPlantIds.value = []
}

function onForeshadowPickerEdit(plantId: string): void {
  closeForeshadowPicker()
  openForeshadowEditFromMeta({ id: plantId, segment: 'plant' } as ForeshadowHoverMeta)
}

function onForeshadowPickerRemove(plantId: string): void {
  deleteForeshadowPlant(plantId)
  foreshadowDataTick.value += 1
  foreshadowPickerPlantIds.value = foreshadowPickerPlantIds.value.filter((id) => id !== plantId)
  if (foreshadowPickerPlantIds.value.length === 0) closeForeshadowPicker()
}

function onForeshadowPickerRemoveAll(): void {
  for (const id of foreshadowPickerPlantIds.value) deleteForeshadowPlant(id)
  foreshadowDataTick.value += 1
  closeForeshadowPicker()
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
  window.setTimeout(() => {
    const ta = chapterTextareaRef.value
    if (ta && (ta.selectionEnd ?? 0) > (ta.selectionStart ?? 0)) {
      showSelectionActionBar()
    } else {
      selectionActionBarOpen.value = false
    }
  }, 0)
}

function onChapterTextareaContextmenu(event: MouseEvent): void {
  const ta = chapterTextareaRef.value
  if (!ta) return
  const start = ta.selectionStart ?? 0
  const end = ta.selectionEnd ?? start
  if (end > start) {
    event.preventDefault()
    openCtxMenuAtPoint(start, end, event.clientX, event.clientY)
  }
}

function onChapterTextareaSelect(): void {
  handleChapterTextareaSelect()
  window.setTimeout(syncAiSelectionQuoteFromTextarea, 0)
  window.setTimeout(() => {
    const ta = chapterTextareaRef.value
    if (!ta || (ta.selectionEnd ?? 0) <= (ta.selectionStart ?? 0)) {
      selectionActionBarOpen.value = false
    }
  }, 0)
}

function onChapterTextareaBlur(event: FocusEvent): void {
  handleChapterTextareaBlur(event)
  hideSelectionActionBar()
}

watch(selectedChapterId, (nextId, prevId) => {
  clearChapterQuoteSelection()
  // 续写进行中：本次切章是「生成下一章」自动新建并打开章节所致，
  // 此时 aiContinueDraft 正持有 loading 状态，绝不能被按章节恢复的逻辑覆盖，
  // 否则按钮会停留在「生成」、思考动画不显示，直到流式内容才恢复。
  if (aiContinueDraft.value.loading) return
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

let lastRestoredNovelId = ''
let isDeactivated = false

onActivated(() => {
  isDeactivated = false
})

onDeactivated(() => {
  isDeactivated = true
  flushActiveSessionUiState()
})

watch(
  novelId,
  (id) => {
    if (isDeactivated) return
    if (id === lastRestoredNovelId) return
    lastRestoredNovelId = id
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
    // 若此刻正有 AI 生成在进行（切走又切回触发本 immediate watch），
    // 单例里已持有更新的流式内容，不能用 localStorage 的旧快照覆盖，否则会打断/回退正在生成的内容。
    const genInFlight = aiChatLoading.value || aiChatThinking.value || aiContinueDraft.value.loading
    if (!genInFlight) {
      aiChatMessages.value = activeSession?.messages.slice(-200) ?? []
      conversationHistory.value = activeSession?.history.slice(-60) ?? []
    }
    rememberActiveSessionForMode(activeSession?.kind ?? aiDeskMode.value, activeId)
    clearChapterQuoteSelection()
    restoreAiExtractStateFromSession(activeSession)
    if (!genInFlight) restoreSessionUiState(activeSession)
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
  void hydrateCharacterStatesFromBackend()
  void hydrateAutoApplyLogFromBackend()
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
