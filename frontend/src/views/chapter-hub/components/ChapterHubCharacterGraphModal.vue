<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="open && selectedGraphCharacter"
        class="confirm-overlay chapter-hub__char-graph-overlay"
        role="presentation"
      >
        <div
          class="confirm-dialog chapter-hub__char-graph-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chapter-hub-char-graph-title"
        >
          <div class="confirm-dialog__body chapter-hub__char-graph-body">
            <div class="chapter-hub__char-graph-head">
              <div class="chapter-hub__char-graph-head-text">
                <h2 id="chapter-hub-char-graph-title" class="chapter-hub__char-graph-title">
                  {{ selectedGraphCharacterDisplayName }} · 关系
                </h2>
                <p class="chapter-hub__char-graph-sub muted">
                  左侧为工作台「角色」页下方的同款聚焦 3D 关系图；可拖拽旋转查看。
                </p>
                <p
                  v-if="chapterId && modifiedInChapterCharacterIds.length > 0"
                  class="chapter-hub__char-graph-legend muted"
                >
                  琥珀色球体：本章节内修改过档案的角色
                </p>
              </div>
              <div class="chapter-hub__char-graph-head-actions">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="emitClose">
                  关闭
                </button>
              </div>
            </div>

            <div class="characters-graph-ui chapter-hub__char-graph-ui">
              <div class="characters-graph-ui__left chapter-hub__char-graph-col-3d">
                <div class="characters-graph-ui__viz chapter-hub__char-graph-viz-outer">
                  <div class="characters-graph-ui__viz-main chapter-hub__char-graph-viz-main">
                    <div class="chapter-hub__char-graph-viz-actions">
                      <button
                        type="button"
                        class="confirm-dialog__btn confirm-dialog__btn--ghost chapter-hub__char-graph-viz-action-btn"
                        :disabled="!selectedGraphCharacter"
                        @click="openRelationEditModal"
                      >
                        编辑角色关系
                      </button>
                      <button
                        type="button"
                        class="confirm-dialog__btn confirm-dialog__btn--ghost chapter-hub__char-graph-viz-action-btn"
                        :disabled="!selectedGraphCharacter"
                        @click="openRelationAddModal"
                      >
                        新增角色关系
                      </button>
                    </div>
                    <CharacterRelationFocusSphere
                      v-if="visibleCharacters.length > 0"
                      selectable
                      :render-scale="1"
                      :panel-height="520"
                      :characters="visibleCharacters"
                      :relations="relatedRelations"
                      :focus-character-id="focusCharacterId"
                      :modified-in-chapter-ids="modifiedInChapterCharacterIds"
                      @select="onFocusSphereNodeSelect"
                    />
                    <p v-else class="muted">暂无关系数据。</p>
                  </div>
                </div>
              </div>

              <div class="characters-graph-ui__right chapter-hub__char-graph-right">
                <CharacterProfilePanel
                  :character="editingCharacter"
                  :memberships="graphCharacterMemberships"
                  :held-items="graphCharacterHeldItems"
                  :category-names="characterCategoryViewLines"
                  :faction-name-by-id="factionNameById"
                  :display-name="editingCharacterDisplayName"
                  :modified-in-chapter="!!chapterId && isEditingCharacterModifiedInChapter"
                  :show-delete="false"
                  @edit="openCharacterEditModal"
                  @open-all-changes="openCharacterAllChangesModal"
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </Transition>
    <Transition name="confirm">
      <div
        v-if="open && characterAllChangesModalOpen && editingCharacter"
        class="confirm-overlay"
        role="presentation"
      >
        <div class="confirm-dialog chapter-hub__relation-edit-dialog" role="dialog" aria-modal="true">
          <div class="confirm-dialog__accent" aria-hidden="true" />
          <div class="confirm-dialog__body chapter-hub__relation-edit-dialog-body">
            <h2 class="confirm-dialog__title">角色全部更改 · {{ editingCharacterDisplayName }}</h2>
            <CharacterChangeTimeline
              :character-id="editingCharacter.id"
              :novel-id="novelId"
              :attributes="editingCharacter.attributes ?? []"
              dd-key="hub-character-all-changes-field"
              @jump="jumpToCharacterChange"
            />
            <div class="confirm-dialog__actions chapter-hub__relation-edit-actions">
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeCharacterAllChangesModal">
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <Transition name="confirm">
      <div
        v-if="open && characterEditModalOpen && editingCharacter"
        class="confirm-overlay"
        role="presentation"
      >
        <div class="confirm-dialog workspace-character-edit-dialog" role="dialog" aria-modal="true">
          <div class="confirm-dialog__accent" aria-hidden="true" />
          <div class="confirm-dialog__body workspace-character-edit-dialog__body">
            <h2 class="confirm-dialog__title">修改角色</h2>
            <p class="muted workspace-character-edit-dialog__sub">基础信息、分类、势力关联与扩展条目</p>
            <CharacterEditForm
              :editor="characterEditor"
              :categories="categories"
              :faction-options="factionOptions"
              :items="items"
            />

            <div class="confirm-dialog__actions workspace-character-edit-dialog__actions">
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeCharacterEditModal">取消</button>
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" :disabled="!canSaveDraft" @click="saveCharacterEdit">
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <Transition name="confirm">
      <div
        v-if="open && relationEditModalOpen && selectedGraphCharacter"
        class="confirm-overlay"
        role="presentation"
      >
        <div class="confirm-dialog chapter-hub__relation-edit-dialog" role="dialog" aria-modal="true">
          <div class="confirm-dialog__accent" aria-hidden="true" />
          <div class="confirm-dialog__body chapter-hub__relation-edit-dialog-body">
            <h2 class="confirm-dialog__title">编辑角色关系</h2>
            <div v-if="relationDraftRows.length > 0" class="chapter-hub__relation-edit-top">
              <label class="chapter-hub__relation-edit-field">
                <span>搜索角色</span>
                <input
                  v-model="relationEditSearchQuery"
                  type="search"
                  class="character-panel__input chapter-hub__relation-edit-search-input"
                  placeholder="留空显示全部关系；输入对方名称或 id 片段可筛选列表"
                  autocomplete="off"
                  aria-label="筛选要显示的对方角色"
                />
              </label>
            </div>
            <div class="chapter-hub__relation-edit-scroll scrollbar-paper">
              <template v-if="relationEditVisibleRows.length > 0">
                <div
                  v-for="row in relationEditVisibleRows"
                  :key="`rel-edit-${row.targetCharacterId}`"
                  class="chapter-hub__relation-edit-row"
                >
                  <div class="chapter-hub__relation-edit-row-head">
                    <p class="chapter-hub__relation-edit-target">
                      {{ selectedGraphCharacterDisplayName }} · {{ characterNameById(row.targetCharacterId) }}
                    </p>
                    <button
                      type="button"
                      class="character-panel__icon-btn chapter-hub__relation-edit-remove"
                      @click="removeRelationDraftRow(row.targetCharacterId)"
                    >
                      移除此行
                    </button>
                  </div>
                  <label class="chapter-hub__relation-edit-field">
                    <span class="chapter-hub__relation-edit-sentence">
                      「<strong>{{ selectedGraphCharacterDisplayName }}</strong>」是「<strong>{{ characterNameById(row.targetCharacterId) }}</strong>」的
                    </span>
                    <input
                      v-model="row.centerToOtherType"
                      class="character-panel__input"
                      maxlength="20"
                      placeholder="如：父亲、徒弟、盟友"
                    />
                  </label>
                  <label class="chapter-hub__relation-edit-field">
                    <span class="chapter-hub__relation-edit-sentence">
                      「<strong>{{ characterNameById(row.targetCharacterId) }}</strong>」是「<strong>{{ selectedGraphCharacterDisplayName }}</strong>」的
                    </span>
                    <input
                      v-model="row.otherToCenterType"
                      class="character-panel__input"
                      maxlength="20"
                      placeholder="如：儿子、师父、宿敌"
                    />
                  </label>
                </div>
              </template>
              <p v-else-if="relationDraftRows.length > 0" class="muted">无匹配角色，请调整搜索词。</p>
              <p v-else class="muted">暂无与球心相连的角色关系可编辑。</p>
            </div>
            <div class="confirm-dialog__actions chapter-hub__relation-edit-actions">
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeRelationEditModal">
                取消
              </button>
              <button
                type="button"
                class="confirm-dialog__btn confirm-dialog__btn--danger"
                :disabled="!canSaveRelationDraft"
                @click="saveRelationDraftRows"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <Transition name="confirm">
      <div
        v-if="open && relationAddModalOpen && selectedGraphCharacter"
        class="confirm-overlay"
        role="presentation"
      >
        <div class="confirm-dialog chapter-hub__relation-add-dialog" role="dialog" aria-modal="true">
          <div class="confirm-dialog__accent" aria-hidden="true" />
          <div class="confirm-dialog__body chapter-hub__relation-add-dialog-body">
            <h2 class="confirm-dialog__title">新增角色关系</h2>
            <p class="muted chapter-hub__relation-edit-sub">
              为球心「{{ selectedGraphCharacterDisplayName }}」与另一名本作角色建立双向称谓（与「编辑角色关系」中的两行含义相同）。
            </p>
            <div class="chapter-hub__relation-add-form scrollbar-paper">
              <label class="chapter-hub__relation-edit-field">
                <span>对方角色</span>
                <div class="relation-target-dd">
                  <button
                    type="button"
                    class="workspace-dd__btn workspace-dd__btn--compact character-panel__input relation-target-dd__btn"
                    :class="{ 'workspace-dd__btn--open': relationAddTargetDropdownOpen }"
                    @click="toggleRelationAddTargetDropdown"
                  >
                    <span class="workspace-dd__btn-text">{{ relationAddTargetDropdownLabel }}</span>
                    <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                  </button>
                  <div v-if="relationAddTargetDropdownOpen" class="relation-target-dd__panel" role="listbox">
                    <div class="relation-target-dd__search">
                      <input
                        v-model="relationAddTargetQuery"
                        type="search"
                        class="workspace-dd__search-input relation-target-dd__search-input"
                        placeholder="搜索角色名…"
                        autocomplete="off"
                      />
                    </div>
                    <div class="relation-target-dd__list scrollbar-paper">
                      <button
                        type="button"
                        class="workspace-dd__item"
                        :class="{ 'workspace-dd__item--active': !newRelationTargetId }"
                        @click="selectRelationAddTarget('')"
                      >
                        请选择尚未与球心建立关系的角色…
                      </button>
                      <button
                        v-for="c in relationAddFilteredTargets"
                        :key="`rel-new-${c.id}`"
                        type="button"
                        class="workspace-dd__item"
                        :class="{ 'workspace-dd__item--active': newRelationTargetId === c.id }"
                        @click="selectRelationAddTarget(c.id)"
                      >
                        {{ characterNameById(c.id) }}
                      </button>
                      <p v-if="relationAddNewCandidates.length === 0" class="muted relation-target-dd__empty">
                        本作中已没有可与球心新建关系的角色。
                      </p>
                      <p v-else-if="relationAddFilteredTargets.length === 0" class="muted relation-target-dd__empty">
                        没有匹配的角色。
                      </p>
                    </div>
                  </div>
                </div>
              </label>
              <label v-if="newRelationTargetName" class="chapter-hub__relation-edit-field">
                <span class="chapter-hub__relation-edit-sentence">
                  「<strong>{{ selectedGraphCharacterDisplayName }}</strong>」是「<strong>{{ characterNameById(newRelationTargetId) }}</strong>」的
                </span>
                <input
                  v-model="newRelationCenterToOther"
                  class="character-panel__input"
                  maxlength="20"
                  placeholder="如：父亲、徒弟、盟友"
                />
              </label>
              <label v-if="newRelationTargetName" class="chapter-hub__relation-edit-field">
                <span class="chapter-hub__relation-edit-sentence">
                  「<strong>{{ characterNameById(newRelationTargetId) }}</strong>」是「<strong>{{ selectedGraphCharacterDisplayName }}</strong>」的
                </span>
                <input
                  v-model="newRelationOtherToCenter"
                  class="character-panel__input"
                  maxlength="20"
                  placeholder="如：儿子、师父、宿敌"
                />
              </label>
              <p v-if="relationAddNewCandidates.length === 0" class="muted">
                本作中已没有可与球心新建关系的角色（或均已存在关系边）。
              </p>
            </div>
            <div class="confirm-dialog__actions chapter-hub__relation-edit-actions">
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeRelationAddModal">
                取消
              </button>
              <button
                type="button"
                class="confirm-dialog__btn confirm-dialog__btn--danger"
                :disabled="!canSaveNewRelation"
                @click="saveNewRelationPair"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
  <ConfirmDialog
    v-model="renameConfirmOpen"
    title="应用新角色名到全文"
    message="你更改了角色名或别名。保存后将把正文中该角色的旧名字/旧别名统一替换为新角色名。是否继续？"
    confirm-label="继续保存"
    cancel-label="取消"
    :danger="false"
    :show-danger-subhint="false"
    @confirm="confirmRenameAndSave"
  />
  <ConfirmDialog
    v-model="unsavedConfirmOpen"
    title="放弃未保存的修改？"
    message="当前弹窗有未保存内容。确认取消后，当前修改将不会保留。"
    confirm-label="放弃修改"
    cancel-label="继续编辑"
    :danger="false"
    :show-danger-subhint="false"
    @confirm="confirmDiscardChanges"
    @cancel="cancelDiscardChanges"
  />
  <SaveToast :open="saveToastOpen" :message="saveToastMessage" />
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, toRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import CharacterRelationFocusSphere from '../../../components/CharacterRelationFocusSphere.vue'
import CharacterProfilePanel from '../../../components/character/CharacterProfilePanel.vue'
import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import SaveToast from '../../../components/SaveToast.vue'
import CharacterChangeTimeline from '../../../components/character/CharacterChangeTimeline.vue'
import CharacterEditForm from '../../../components/character/CharacterEditForm.vue'
import { useCharacterEditor } from '../../../composables/useCharacterEditor'
import { useCharacterGraphRelations } from '../../../features/chapter-hub/composables/useCharacterGraphRelations'
import {
  getCharacterFactionMembershipsByNovelId,
  getFactionsByNovelId,
  hasCharacterChangeInChapter,
  normalizeCategoryIds,
} from '../../../lib/storage'
import type { Category, Character, CharacterFactionMembership, CharacterRelation, Faction, Item } from '../../../types'
import { buildDisplayNameMap } from '../../../lib/characterLabels'

const props = defineProps<{
  open: boolean
  novelId: string
  characters: Character[]
  items: Item[]
  /** 作品下全部分类（用于多选） */
  categories?: Category[]
  focusCharacterId: string
  chapterId?: string
  sourceTextRange?: { start: number; end: number } | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()
const router = useRouter()

const characterRelations = ref<CharacterRelation[]>([])
const factionOptions = ref<Faction[]>([])
const membershipSource = ref<CharacterFactionMembership[]>([])
const editingCharacterId = ref('')
const saveToastOpen = ref(false)
const saveToastMessage = ref('修改已保存。')
const characterAllChangesModalOpen = ref(false)
const unsavedConfirmOpen = ref(false)
let pendingDiscardAction: null | (() => void) = null
let saveToastTimer: ReturnType<typeof setTimeout> | null = null

function onFocusSphereNodeSelect(id: string): void {
  const next = props.characters.find((c) => c.id === id)
  if (!next) return
  setDraftByCharacter(next)
}

const selectedGraphCharacter = computed(
  () => props.characters.find((c) => c.id === props.focusCharacterId) ?? null
)
// 同名实体显示名映射(作者视图:张三1/张三2),在全书集合上计算
const characterDisplayNameMap = computed(() =>
  buildDisplayNameMap(props.characters.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt }))),
)
const factionDisplayNameMap = computed(() =>
  buildDisplayNameMap(factionOptions.value.map((f) => ({ id: f.id, name: f.name, createdAt: f.createdAt }))),
)
const selectedGraphCharacterDisplayName = computed(() =>
  selectedGraphCharacter.value
    ? characterDisplayNameMap.value.get(selectedGraphCharacter.value.id) ?? selectedGraphCharacter.value.name
    : '',
)
const editingCharacter = computed(
  () => props.characters.find((c) => c.id === editingCharacterId.value) ?? selectedGraphCharacter.value ?? null
)
const editingCharacterDisplayName = computed(() =>
  editingCharacter.value
    ? characterDisplayNameMap.value.get(editingCharacter.value.id) ?? editingCharacter.value.name
    : '',
)
const graphCharacterMemberships = computed(() => {
  const c = editingCharacter.value
  if (!c) return []
  return membershipSource.value.filter((m) => m.characterId === c.id)
})

const graphCharacterHeldItems = computed(() => {
  const c = editingCharacter.value
  if (!c) return [] as Item[]
  return props.items
    .filter((item) => item.novelId === props.novelId && item.ownerType === 'character' && item.ownerId === c.id)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans'))
})

const sortedCategories = computed(() =>
  [...(props.categories ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans')),
)

const characterCategoryViewLines = computed(() => {
  const c = editingCharacter.value
  if (!c) return [] as string[]
  const idSet = new Set(normalizeCategoryIds(c.categoryIds))
  return sortedCategories.value.filter((cat) => idSet.has(cat.id)).map((cat) => cat.name)
})

const relatedRelations = computed(() => {
  const id = props.focusCharacterId
  return characterRelations.value.filter((r) => r.fromCharacterId === id || r.toCharacterId === id)
})

const visibleGraphCharacterIds = computed(() => {
  const ids = new Set<string>()
  if (props.focusCharacterId) ids.add(props.focusCharacterId)
  relatedRelations.value.forEach((r) => {
    ids.add(r.fromCharacterId)
    ids.add(r.toCharacterId)
  })
  return ids
})

const visibleCharacters = computed(() => props.characters.filter((c) => visibleGraphCharacterIds.value.has(c.id)))

const {
  relationEditModalOpen,
  relationAddModalOpen,
  newRelationTargetId,
  newRelationCenterToOther,
  newRelationOtherToCenter,
  relationDraftRows,
  relationEditSearchQuery,
  relationEditVisibleRows,
  canSaveRelationDraft,
  hasUnsavedRelationEditChanges,
  hasUnsavedRelationAddChanges,
  relationAddNewCandidates,
  newRelationTargetName,
  canSaveNewRelation,
  reloadRelations,
  refreshRelationEditState,
  refreshRelationAddState,
  openRelationEditModal,
  closeRelationEditModal: closeRelationEditModalCore,
  openRelationAddModal,
  closeRelationAddModal: closeRelationAddModalCore,
  removeRelationDraftRow,
  saveNewRelationPair,
  saveRelationDraftRows,
} = useCharacterGraphRelations({
  novelId: toRef(props, 'novelId'),
  characters: toRef(props, 'characters'),
  focusCharacterId: toRef(props, 'focusCharacterId'),
  characterRelations,
  onSaved: handleSaved,
})


const relationAddTargetDropdownOpen = ref(false)
const relationAddTargetQuery = ref('')
const relationAddTargetDropdownLabel = computed(() => newRelationTargetName.value || '请选择尚未与球心建立关系的角色…')
const relationAddFilteredTargets = computed(() => {
  const q = relationAddTargetQuery.value.trim().toLowerCase()
  if (!q) return relationAddNewCandidates.value
  return relationAddNewCandidates.value.filter((c) => String(c.name ?? '').toLowerCase().includes(q))
})

function selectRelationAddTarget(id: string): void {
  newRelationTargetId.value = id
  relationAddTargetDropdownOpen.value = false
  relationAddTargetQuery.value = ''
  if (!id) {
    newRelationCenterToOther.value = ''
    newRelationOtherToCenter.value = ''
  }
}

function toggleRelationAddTargetDropdown(): void {
  relationAddTargetDropdownOpen.value = !relationAddTargetDropdownOpen.value
  if (!relationAddTargetDropdownOpen.value) relationAddTargetQuery.value = ''
}

/** 变更历史里在本章节（chapterId）记过一笔的角色，用于 3D 球体琥珀色高亮 */
const modifiedInChapterCharacterIds = computed(() => {
  const chId = String(props.chapterId ?? '').trim()
  if (!chId) return [] as string[]
  return props.characters.filter((c) => hasCharacterChangeInChapter(c.id, chId)).map((c) => c.id)
})

const isEditingCharacterModifiedInChapter = computed(() => {
  const chId = String(props.chapterId ?? '').trim()
  const id = editingCharacter.value?.id
  if (!chId || !id) return false
  return hasCharacterChangeInChapter(id, chId)
})

const characterEditor = useCharacterEditor({
  novelId: toRef(props, 'novelId'),
  chapterId: toRef(props, 'chapterId'),
  sourceTextRange: toRef(props, 'sourceTextRange'),
  categories: toRef(props, 'categories'),
  characters: toRef(props, 'characters'),
  items: toRef(props, 'items'),
  editingCharacter,
  membershipSource,
  factionOptions,
  reloadModalSources,
  onSaved: handleSaved,
})
const {
  characterEditModalOpen,
  renameConfirmOpen,
  canSaveDraft,
  hasUnsavedCharacterChanges,
  resetCharacterEditTransientState,
  setDraftByCharacter,
  openCharacterEditModal,
  closeCharacterEditModal: closeCharacterEditModalCore,
  saveCharacterEdit,
  confirmRenameAndSave,
} = characterEditor

function clearSaveToastTimer(): void {
  if (saveToastTimer) {
    clearTimeout(saveToastTimer)
    saveToastTimer = null
  }
}

function showSaveToast(message = '修改已保存。'): void {
  clearSaveToastTimer()
  saveToastMessage.value = message
  saveToastOpen.value = true
  saveToastTimer = setTimeout(() => {
    saveToastOpen.value = false
    saveToastTimer = null
  }, 2200)
}

function handleSaved(message?: string): void {
  showSaveToast(message)
  emit('saved')
}

function requestDiscard(action: () => void): void {
  pendingDiscardAction = action
  unsavedConfirmOpen.value = true
}

function confirmDiscardChanges(): void {
  const action = pendingDiscardAction
  pendingDiscardAction = null
  unsavedConfirmOpen.value = false
  if (action) action()
}

function cancelDiscardChanges(): void {
  pendingDiscardAction = null
  unsavedConfirmOpen.value = false
}

function closeCharacterEditModal(): void {
  if (closeCharacterEditModalCore()) return
  requestDiscard(() => {
    closeCharacterEditModalCore(true)
  })
}

function closeRelationEditModal(): void {
  if (closeRelationEditModalCore()) return
  requestDiscard(() => {
    closeRelationEditModalCore(true)
  })
}

function closeRelationAddModal(): void {
  relationAddTargetDropdownOpen.value = false
  relationAddTargetQuery.value = ''
  if (closeRelationAddModalCore()) return
  requestDiscard(() => {
    closeRelationAddModalCore(true)
  })
}

function hasUnsavedModalChanges(): boolean {
  return hasUnsavedCharacterChanges.value || hasUnsavedRelationEditChanges.value || hasUnsavedRelationAddChanges.value
}

function resetModalTransientState(force = false): boolean {
  if (!force && hasUnsavedModalChanges()) return false
  resetCharacterEditTransientState()
  closeRelationEditModalCore(true)
  closeRelationAddModalCore(true)
  return true
}

function emitClose(): void {
  if (resetModalTransientState()) {
    emit('close')
    return
  }
  requestDiscard(() => {
    resetModalTransientState(true)
    emit('close')
  })
}

function openCharacterAllChangesModal(): void {
  if (!editingCharacter.value) return
  characterAllChangesModalOpen.value = true
}

function closeCharacterAllChangesModal(): void {
  characterAllChangesModalOpen.value = false
}

function jumpToCharacterChange(row: {
  chapterId: string
  anchorStart: number | null
  anchorEnd: number | null
}): void {
  const chapterId = String(row.chapterId ?? '').trim()
  if (!chapterId || !props.novelId) return
  const nextQuery: Record<string, string> = {
    chapterId,
    focusChapter: chapterId,
    focusRangeToken: String(Date.now()),
  }
  if (typeof row.anchorStart === 'number' && typeof row.anchorEnd === 'number' && row.anchorEnd > row.anchorStart) {
    nextQuery.focusRangeStart = String(row.anchorStart)
    nextQuery.focusRangeEnd = String(row.anchorEnd)
  }
  characterAllChangesModalOpen.value = false
  emitClose()
  void router.push({ path: `/novels/${props.novelId}/chapter-writing`, query: nextQuery })
}

function factionNameById(id: string): string {
  return factionDisplayNameMap.value.get(id) ?? factionOptions.value.find((f) => f.id === id)?.name ?? '未命名势力'
}

function characterNameById(id: string): string {
  return characterDisplayNameMap.value.get(id) ?? props.characters.find((c) => c.id === id)?.name ?? '角色'
}

function reloadModalSources(): void {
  reloadRelations()
  factionOptions.value = getFactionsByNovelId(props.novelId)
  membershipSource.value = getCharacterFactionMembershipsByNovelId(props.novelId)
}

function syncDraftWithSelectedGraphCharacter(): void {
  if (selectedGraphCharacter.value) setDraftByCharacter(selectedGraphCharacter.value)
}

function syncRelationModalStateByFocus(): void {
  if (relationEditModalOpen.value) refreshRelationEditState()
  if (relationAddModalOpen.value) refreshRelationAddState()
}

watch(
  () => props.open,
  (v) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = v ? 'hidden' : ''
    }
    if (v) {
      reloadModalSources()
      syncDraftWithSelectedGraphCharacter()
    } else {
      characterAllChangesModalOpen.value = false
      resetModalTransientState()
    }
  },
  { flush: 'post' }
)

watch(
  () => props.focusCharacterId,
  () => {
    editingCharacterId.value = props.focusCharacterId || editingCharacterId.value
    syncDraftWithSelectedGraphCharacter()
    syncRelationModalStateByFocus()
  }
)

watch(
  () => props.characters,
  () => {
    const current = editingCharacter.value
    if (current) setDraftByCharacter(current)
  },
  { deep: true },
)

onUnmounted(() => {
  clearSaveToastTimer()
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>
