<template>
  <section
    class="page-block chapter-hub"
    :class="{ 'chapter-hub--empty': chapters.length === 0 }"
    v-if="novel"
  >
    <ChapterHubPageHeader ref="pageHeaderRef" :novel-title="novel.title" :workspace-link="workspaceLink" />

    <ChapterHubNewChapterForm
      v-model:title="chapterForm.title"
      v-model:notes="chapterForm.notes"
      @submit="handleCreateChapter"
    />

    <template v-if="chapters.length > 0">
      <div class="split chapter-hub__split">
        <ChapterHubTocSidebar
          v-model:selected-chapter-id="selectedChapterId"
          v-model:sidebar-collapsed="hideSidebar"
          :chapters="chapters"
        />

        <section class="chapter-hub__editor" v-if="selectedChapter">
          <ChapterHubEditorToolbar
            :chapter="selectedChapter"
            :word-count="wordCount"
            :hide-meta="hideMeta"
            :hide-outline="hideOutline"
            @toggle-meta="hideMeta = !hideMeta"
            @toggle-outline="hideOutline = !hideOutline"
            @toggle-done="toggleDone(selectedChapter.id)"
            @delete-chapter="openChapterDelete(selectedChapter.id)"
          />

          <ChapterHubChapterMetaFields
            :chapter="selectedChapter"
            :visible="!hideMeta"
            @title-change="onChapterTitleChange(selectedChapter.id, $event)"
            @notes-change="onNotesChange(selectedChapter.id, $event)"
          />

          <ChapterHubPaperBlock
            ref="paperBlockRef"
            :content="selectedChapter.content"
            :entity-preview-lines="entityPreviewLines"
            :should-show-entity-overlay="shouldShowEntityOverlay"
            :is-chapter-textarea-focused="isChapterTextareaFocused"
            @input="onChapterContentInput(selectedChapter.id, $event)"
            @keydown="onChapterTextareaKeydown"
            @keyup="onChapterTextareaKeyup"
            @mouseup="onChapterTextareaMouseup"
            @select="onChapterTextareaSelect"
            @focus="onChapterTextareaFocus"
            @blur="onChapterTextareaBlur"
            @entity-enter="onEntityNameEnter"
            @faction-enter="onFactionNameEnter"
            @entity-leave="onEntityNameLeave"
            @go-character="openHubCharacterGraph"
            @go-faction="openHubFactionModal"
          />

          <ChapterHubOutlinePanel
            :chapter="selectedChapter"
            :outline-items="outlineItems"
            :visible="!hideOutline"
            @toggle-outline-item="toggleChapterOutline(selectedChapter.id, $event)"
          />
        </section>
      </div>
    </template>

    <ChapterHubEmptyChaptersCard v-else />

    <ConfirmDialog
      v-model="chapterDeleteOpen"
      title="删除章节"
      :message="chapterDeleteMessage"
      confirm-label="删除章节"
      cancel-label="保留"
      danger
      @confirm="confirmChapterDelete"
      @cancel="onChapterDeleteDialogCancel"
    />

    <ChapterHubNameSuggestTeleport
      :open="nameSuggestOpen"
      :list="nameSuggestList"
      :active-index="nameSuggestIndex"
      :direction="nameSuggestDirection"
      :panel-style="nameSuggestStyle"
      @update:active-index="setNameSuggestActiveIndex"
      @apply="applyNameSuggestion"
    />

    <ChapterHubCtxMenuTeleport
      :open="ctxMenuOpen"
      :x="ctxMenuX"
      :y="ctxMenuY"
      :notice="ctxMenuNotice"
      :selected-character="ctxMenuSelectedCharacter"
      :selected-faction="ctxMenuSelectedFaction"
      :show-add-as="ctxMenuShowAddAs"
      :bound-faction-summary="ctxMenuBoundFactionSummary"
      :character-faction-unbound="false"
      :can-add-as-faction="ctxMenuCanAddAsFaction"
      :factions="factions"
      :is-faction-current="ctxMenuFactionIsCurrent"
      @close="closeCtxMenu"
      @add-character="addSelectionAsCharacter"
      @add-faction="addSelectionAsFaction"
      @toggle-faction="toggleFactionMembershipForSelectedCharacter"
    />

    <ChapterHubEntityTooltipTeleport
      :open="entityTooltipOpen"
      :character="entityTooltipCharacter"
      :tooltip-faction="entityTooltipFaction"
      :character-faction-lines="entityTooltipCharacterFactionLines"
      :character-category-lines="entityTooltipCharacterCategoryLines"
      :faction-category-lines="entityTooltipFactionCategoryLines"
      :tooltip-x="entityTooltipX"
      :tooltip-y="entityTooltipY"
      :textarea-focused="isChapterTextareaFocused"
      :textarea-has-selection="hasTextareaSelection"
    />

    <ChapterHubCharacterGraphModal
      :open="hubCharacterGraphOpen"
      :novel-id="novelId"
      :characters="characters"
      :focus-character-id="hubGraphFocusCharacterId"
      @close="closeHubCharacterGraph"
    />

    <ChapterHubFactionDetailModal
      :open="hubFactionModalOpen"
      :novel-id="novelId"
      :characters="characters"
      :faction="hubFactionModalTarget"
      @close="closeHubFactionModal"
      @saved="reload"
    />
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
import { ref } from 'vue'
import type { Character, Faction } from '../../types'
import { RouterLink } from 'vue-router'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import { useChapterHubChapterDelete } from '../../features/chapter-hub/composables/useChapterHubChapterDelete'
import { useChapterHubChapterMutations } from '../../features/chapter-hub/composables/useChapterHubChapterMutations'
import { useChapterHubCtxMenu } from '../../features/chapter-hub/composables/useChapterHubCtxMenu'
import { useChapterHubData } from '../../features/chapter-hub/composables/useChapterHubData'
import { useChapterHubDomRefs } from '../../features/chapter-hub/composables/useChapterHubDomRefs'
import { useChapterHubEntityTooltip } from '../../features/chapter-hub/composables/useChapterHubEntityTooltip'
import { useChapterHubNameSuggest } from '../../features/chapter-hub/composables/useChapterHubNameSuggest'
import { useChapterHubTextareaEditor } from '../../features/chapter-hub/composables/useChapterHubTextareaEditor'
import ChapterHubChapterMetaFields from './components/ChapterHubChapterMetaFields.vue'
import ChapterHubCharacterGraphModal from './components/ChapterHubCharacterGraphModal.vue'
import ChapterHubCtxMenuTeleport from './components/ChapterHubCtxMenuTeleport.vue'
import ChapterHubFactionDetailModal from './components/ChapterHubFactionDetailModal.vue'
import ChapterHubEditorToolbar from './components/ChapterHubEditorToolbar.vue'
import ChapterHubEmptyChaptersCard from './components/ChapterHubEmptyChaptersCard.vue'
import ChapterHubEntityTooltipTeleport from './components/ChapterHubEntityTooltipTeleport.vue'
import ChapterHubNameSuggestTeleport from './components/ChapterHubNameSuggestTeleport.vue'
import ChapterHubNewChapterForm from './components/ChapterHubNewChapterForm.vue'
import ChapterHubOutlinePanel from './components/ChapterHubOutlinePanel.vue'
import ChapterHubPageHeader from './components/ChapterHubPageHeader.vue'
import ChapterHubPaperBlock from './components/ChapterHubPaperBlock.vue'
import ChapterHubTocSidebar from './components/ChapterHubTocSidebar.vue'

const hideSidebar = ref(false)
const hideMeta = ref(false)
const hideOutline = ref(false)

const hubCharacterGraphOpen = ref(false)
const hubGraphFocusCharacterId = ref('')

function openHubCharacterGraph(c: Character): void {
  onEntityNameLeave()
  hubGraphFocusCharacterId.value = c.id
  hubCharacterGraphOpen.value = true
}

function closeHubCharacterGraph(): void {
  hubCharacterGraphOpen.value = false
}

const hubFactionModalOpen = ref(false)
const hubFactionModalTarget = ref<Faction | null>(null)

function openHubFactionModal(f: Faction): void {
  onEntityNameLeave()
  hubFactionModalTarget.value = f
  hubFactionModalOpen.value = true
}

function closeHubFactionModal(): void {
  hubFactionModalOpen.value = false
  hubFactionModalTarget.value = null
}

const {
  novelId,
  novel,
  chapters,
  characters,
  factions,
  categories,
  characterFactionMemberships,
  outlineItems,
  selectedChapterId,
  selectedChapter,
  selectedChapterCtx,
  chapterForm,
  workspaceLink,
  reload,
} = useChapterHubData()

const { paperBlockRef, pageHeaderRef, chapterTextareaRef } = useChapterHubDomRefs()

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
  selectedChapter,
  chapters,
  chapterTextareaRef,
})

const {
  ctxMenuOpen,
  ctxMenuX,
  ctxMenuY,
  ctxMenuNotice,
  ctxMenuSelectedCharacter,
  ctxMenuSelectedFaction,
  ctxMenuShowAddAs,
  ctxMenuBoundFactionSummary,
  ctxMenuCanAddAsFaction,
  openCtxMenuFromSelection,
  openCtxMenuForExplicitSelection,
  openCtxMenuAtPoint,
  closeCtxMenu,
  addSelectionAsCharacter,
  addSelectionAsFaction,
  ctxMenuFactionIsCurrent,
  toggleFactionMembershipForSelectedCharacter,
} = useChapterHubCtxMenu({
  novelId,
  novel,
  selectedChapter: selectedChapterCtx,
  characters,
  factions,
  characterFactionMemberships,
  chapterTextareaRef,
})

const {
  entityTooltipOpen,
  entityTooltipCharacter,
  entityTooltipFaction,
  entityTooltipX,
  entityTooltipY,
  entityTooltipCharacterFactionLines,
  entityTooltipCharacterCategoryLines,
  entityTooltipFactionCategoryLines,
  onEntityNameEnter,
  onFactionNameEnter,
  onEntityNameLeave,
} = useChapterHubEntityTooltip({ factions, categories, characterFactionMemberships })

const {
  chapterDeleteOpen,
  chapterDeleteMessage,
  openChapterDelete,
  confirmChapterDelete,
  onChapterDeleteDialogCancel,
} = useChapterHubChapterDelete(chapters, reload)

const {
  handleCreateChapter,
  toggleDone,
  onNotesChange,
  onChapterTitleChange,
  onChapterContentInput,
  toggleChapterOutline,
} = useChapterHubChapterMutations({
  novel,
  chapters,
  selectedChapterId,
  chapterForm,
  reload,
  updateNameSuggestion,
})

const {
  isChapterTextareaFocused,
  hasTextareaSelection,
  entityPreviewLines,
  shouldShowEntityOverlay,
  wordCount,
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

function setNameSuggestActiveIndex(i: number) {
  nameSuggestIndex.value = i
}
</script>
