<template>
  <div v-if="focusCharacterId && anchorCharacter" class="character-graph-relation-toolbar">
    <div class="characters-graph-ui__link-mode">
      <label v-if="panelMode === 'edit'" class="characters-graph-ui__field">
        <span class="characters-graph-ui__field-label">搜索角色</span>
        <input
          v-model="relationEditSearchQuery"
          type="search"
          class="characters-graph-ui__input chapter-hub__relation-edit-search-input"
          placeholder="输入角色名筛选"
          autocomplete="off"
        />
      </label>

      <div class="characters-graph-ui__link-head">
        <button
          type="button"
          class="confirm-dialog__btn confirm-dialog__btn--ghost character-graph-relation-toolbar__mode-btn"
          :class="{ 'btn-primary--active': !relationAddModalOpen }"
          @click="openRelationEditModal"
        >
          编辑角色关系
        </button>
        <button
          type="button"
          class="confirm-dialog__btn confirm-dialog__btn--ghost character-graph-relation-toolbar__mode-btn"
          :class="{ 'btn-primary--active': relationAddModalOpen }"
          @click="openRelationAddModal"
        >
          新增角色关系
        </button>
      </div>

      <p v-if="linkError" class="characters-graph-ui__link-error">{{ linkError }}</p>
      <p v-if="linkSuccess" class="characters-graph-ui__link-success">{{ linkSuccess }}</p>

      <div class="character-graph-relation-toolbar__body scrollbar-paper">
        <div v-if="panelMode === 'edit'" class="chapter-hub__relation-edit-scroll">
          <template v-if="relationEditVisibleRows.length > 0">
            <div
              v-for="row in relationEditVisibleRows"
              :key="`rel-edit-${row.targetCharacterId}`"
              class="chapter-hub__relation-view-row"
            >
              <div class="chapter-hub__relation-view-row-head">
                <p class="chapter-hub__relation-view-target">{{ anchorCharacter.name }} · {{ row.targetName }}</p>
              </div>
              <p class="chapter-hub__relation-view-line">
                <span class="chapter-hub__relation-view-name">「{{ anchorCharacter.name }}」</span>
                是
                <span class="chapter-hub__relation-view-name">「{{ row.targetName }}」</span>
                的
                <span class="chapter-hub__relation-view-tag">{{ row.centerToOtherType || '未填写' }}</span>
              </p>
              <p class="chapter-hub__relation-view-line">
                <span class="chapter-hub__relation-view-name">「{{ row.targetName }}」</span>
                是
                <span class="chapter-hub__relation-view-name">「{{ anchorCharacter.name }}」</span>
                的
                <span class="chapter-hub__relation-view-tag">{{ row.otherToCenterType || '未填写' }}</span>
              </p>
            </div>
          </template>
          <p v-else-if="relationDraftRows.length > 0" class="muted">无匹配角色，请调整搜索词。</p>
          <p v-else class="muted">暂无与当前角色相连的关系。</p>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="confirm">
        <div
          v-if="relationAddModalOpen && anchorCharacter"
          class="confirm-overlay"
          role="presentation"
          @click.self="closeRelationAddModal"
        >
          <div
            ref="relationAddDialogRef"
            class="confirm-dialog chapter-hub__relation-add-dialog"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            @keydown.escape.prevent="closeRelationAddModal"
          >
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body chapter-hub__relation-add-dialog-body">
              <h2 class="confirm-dialog__title">新增角色关系</h2>
              <p class="muted chapter-hub__relation-edit-sub">
                为当前焦点角色建立一组双向关系。保存后会同时写入 A→B 与 B→A 两条边。
              </p>

              <div class="chapter-hub__relation-add-form scrollbar-paper">
                <label class="chapter-hub__relation-edit-field">
                  <span>对方角色</span>
                  <div class="workspace-dd">
                    <button
                      type="button"
                      class="workspace-dd__btn workspace-dd__btn--compact character-panel__input"
                      :class="{ 'workspace-dd__btn--open': relationAddTargetDropdownOpen }"
                      data-dd-key="workspace-relation-add-target"
                      :disabled="relationTargetUnlinked.length === 0"
                      @click="toggleRelationAddTargetDropdown"
                    >
                      <span class="workspace-dd__btn-text">{{ relationAddTargetDropdownLabel }}</span>
                      <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                    </button>
                    <div
                      v-if="relationAddTargetDropdownOpen"
                      class="workspace-dd__panel scrollbar-paper chapter-hub__relation-add-dd-panel"
                      :class="[
                        relationAddTargetPanelDirectionClass,
                        { 'workspace-dd__panel--max4': relationAddFilteredCandidates.length > 4 },
                      ]"
                      data-dd-panel-key="workspace-relation-add-target"
                      :style="relationAddTargetPanelStyle"
                      role="listbox"
                    >
                      <div class="workspace-dd__search">
                        <input
                          v-model="relationAddTargetQuery"
                          type="search"
                          class="workspace-dd__search-input"
                          placeholder="搜索角色名…"
                          autocomplete="off"
                        />
                      </div>
                      <button
                        type="button"
                        class="workspace-dd__item"
                        :class="{ 'workspace-dd__item--active': !targetBId }"
                        @click="selectRelationAddTarget('')"
                      >
                        请选择尚未与球心建立关系的角色…
                      </button>
                      <button
                        v-for="c in relationAddFilteredCandidates"
                        :key="`rel-new-${c.id}`"
                        type="button"
                        class="workspace-dd__item"
                        :class="{ 'workspace-dd__item--active': targetBId === c.id }"
                        @click="selectRelationAddTarget(c.id)"
                      >
                        {{ c.name || '未命名角色' }}
                      </button>
                      <p v-if="relationAddFilteredCandidates.length === 0" class="muted chapter-hub__relation-add-empty">
                        无匹配角色
                      </p>
                    </div>
                  </div>
                </label>
                <label v-if="targetBName" class="chapter-hub__relation-edit-field">
                  <span class="chapter-hub__relation-edit-sentence">
                    「<strong>{{ anchorCharacter.name }}</strong>」是「<strong>{{ targetBName }}</strong>」的
                  </span>
                  <input
                    v-model="typeFromA"
                    class="character-panel__input"
                    maxlength="20"
                    placeholder="如：父亲、徒弟、盟友"
                  />
                </label>
                <label v-if="targetBName" class="chapter-hub__relation-edit-field">
                  <span class="chapter-hub__relation-edit-sentence">
                    「<strong>{{ targetBName }}</strong>」是「<strong>{{ anchorCharacter.name }}</strong>」的
                  </span>
                  <input
                    v-model="typeFromB"
                    class="character-panel__input"
                    maxlength="20"
                    placeholder="如：儿子、师父、宿敌"
                  />
                </label>
                <label v-if="targetBName" class="chapter-hub__relation-edit-field">
                  <span>备注（可选）</span>
                  <input
                    v-model="note"
                    class="character-panel__input"
                    maxlength="120"
                    placeholder="补充关系说明"
                  />
                </label>
                <p v-if="relationTargetUnlinked.length === 0" class="muted">
                  本作中已没有可与球心新建关系的角色（或均已存在关系边）。
                </p>
                <p v-if="linkError" class="characters-graph-ui__link-error">{{ linkError }}</p>
              </div>

              <div class="chapter-hub__relation-edit-actions">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeRelationAddModal">
                  取消
                </button>
                <button
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--danger"
                  :disabled="!canSaveNewRelation"
                  @click="submitBidirectional"
                >
                  保存关系
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="confirm">
        <div
          v-if="relationEditModalOpen"
          class="confirm-overlay"
          role="presentation"
          @click.self="closeRelationEditModal"
        >
          <div class="confirm-dialog chapter-hub__relation-edit-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body chapter-hub__relation-edit-dialog-body">
              <h2 class="confirm-dialog__title">编辑角色关系</h2>
              <div class="chapter-hub__relation-edit-top">
                <label class="chapter-hub__relation-edit-field">
                  <span>搜索角色</span>
                  <input
                    v-model="relationEditSearchQuery"
                    type="search"
                    class="characters-graph-ui__input chapter-hub__relation-edit-search-input"
                    placeholder="输入角色名筛选"
                    autocomplete="off"
                  />
                </label>
              </div>
              <div class="chapter-hub__relation-edit-scroll scrollbar-paper">
                <template v-if="relationEditVisibleRows.length > 0">
                  <div
                    v-for="row in relationEditVisibleRows"
                    :key="`rel-modal-${row.targetCharacterId}`"
                    class="chapter-hub__relation-edit-row"
                  >
                    <div class="chapter-hub__relation-edit-row-head">
                      <p class="chapter-hub__relation-edit-target">{{ anchorCharacter.name }} · {{ row.targetName }}</p>
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
                        「<strong>{{ anchorCharacter.name }}</strong>」是「<strong>{{ row.targetName }}</strong>」的
                      </span>
                      <input v-model="row.centerToOtherType" class="characters-graph-ui__input" maxlength="20" />
                    </label>
                    <label class="chapter-hub__relation-edit-field">
                      <span class="chapter-hub__relation-edit-sentence">
                        「<strong>{{ row.targetName }}</strong>」是「<strong>{{ anchorCharacter.name }}</strong>」的
                      </span>
                      <input v-model="row.otherToCenterType" class="characters-graph-ui__input" maxlength="20" />
                    </label>
                  </div>
                </template>
                <p v-else-if="relationDraftRows.length > 0" class="muted">无匹配角色，请调整搜索词。</p>
                <p v-else class="muted">暂无与当前角色相连的关系可编辑。</p>
              </div>
              <div class="chapter-hub__relation-edit-actions">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeRelationEditModal">
                  取消
                </button>
                <button
                  type="button"
                  class="btn-primary character-graph-relation-toolbar__save-btn"
                  :disabled="relationDraftRows.length === 0"
                  @click="saveRelationDraftRowsFromModal"
                >
                  保存关系修改
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { createCharacterRelation, deleteCharacterRelation, getCharacterRelationsByNovelId } from '../lib/storage'
import type { Character, CharacterRelation } from '../types'

const props = withDefaults(
  defineProps<{
    novelId: string
    focusCharacterId: string
    characters: Character[]
    relations: CharacterRelation[]
    /** 聚焦图中点击的对方角色 id（非中心）；空字符串表示未点选 */
    pairCharacterId?: string
  }>(),
  { pairCharacterId: '' }
)

const emit = defineEmits<{
  relationsChanged: []
}>()

const linkMode = defineModel<boolean>('linkMode', { default: false })
const panelMode = ref<'edit' | 'add'>('edit')

const targetBId = ref('')
const typeFromA = ref('')
const typeFromB = ref('')
const note = ref('')
const linkError = ref('')
const linkSuccess = ref('')
const relationEditSearchQuery = ref('')
const relationEditModalOpen = ref(false)
const relationAddModalOpen = ref(false)
const relationAddDialogRef = ref<HTMLElement | null>(null)
const relationAddTargetDropdownOpen = ref(false)
const relationAddTargetPanelStyle = ref<Record<string, string>>({})
const relationAddTargetQuery = ref('')
const relationAddTargetPanelDirection = ref<'up' | 'down'>('down')

type RelationDraftRow = {
  targetCharacterId: string
  targetName: string
  centerToOtherType: string
  otherToCenterType: string
  centerToOtherRelId: string
  otherToCenterRelId: string
}
const relationDraftRows = ref<RelationDraftRow[]>([])

const anchorCharacter = computed(() => props.characters.find((c) => c.id === props.focusCharacterId) ?? null)

const relatedRelations = computed(() => {
  const id = props.focusCharacterId
  return props.relations.filter((r) => r.fromCharacterId === id || r.toCharacterId === id)
})

const relationTargetOptions = computed(() => props.characters.filter((c) => c.id !== props.focusCharacterId))

const linkedCharacterIds = computed(() => {
  const focus = props.focusCharacterId
  const set = new Set<string>()
  for (const r of relatedRelations.value) {
    if (r.fromCharacterId === focus) set.add(r.toCharacterId)
    else if (r.toCharacterId === focus) set.add(r.fromCharacterId)
  }
  return set
})

function sortCharactersByName(list: Character[]): Character[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans'))
}

const relationTargetUnlinked = computed(() =>
  sortCharactersByName(relationTargetOptions.value.filter((c) => !linkedCharacterIds.value.has(c.id)))
)

const targetBName = computed(() => props.characters.find((c) => c.id === targetBId.value)?.name ?? '')
const relationAddFilteredCandidates = computed(() => {
  const q = relationAddTargetQuery.value.trim().toLowerCase()
  if (!q) return relationTargetUnlinked.value
  return relationTargetUnlinked.value.filter((c) => String(c.name ?? '').toLowerCase().includes(q))
})

const relationAddTargetDropdownLabel = computed(() => {
  if (!targetBId.value) return '请选择尚未与球心建立关系的角色…'
  return targetBName.value || '请选择尚未与球心建立关系的角色…'
})

const relationAddTargetPanelDirectionClass = computed(() =>
  relationAddTargetPanelDirection.value === 'up' ? 'workspace-dd__panel--up' : 'workspace-dd__panel--down',
)

function selectRelationAddTarget(id: string): void {
  targetBId.value = id
  relationAddTargetDropdownOpen.value = false
  relationAddTargetQuery.value = ''
  if (!id) {
    typeFromA.value = ''
    typeFromB.value = ''
    note.value = ''
  }
}

function toggleRelationAddTargetDropdown(): void {
  if (relationTargetUnlinked.value.length === 0) return
  relationAddTargetDropdownOpen.value = !relationAddTargetDropdownOpen.value
  if (relationAddTargetDropdownOpen.value) {
    void nextTick(() => positionRelationAddTargetPanel())
  } else {
    relationAddTargetQuery.value = ''
  }
}

function positionRelationAddTargetPanel(): void {
  if (typeof window === 'undefined') return
  const btn = document.querySelector<HTMLElement>('[data-dd-key="workspace-relation-add-target"]')
  const panel = document.querySelector<HTMLElement>('[data-dd-panel-key="workspace-relation-add-target"]')
  if (!btn || !panel) return
  const rect = btn.getBoundingClientRect()
  const pad = 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  const panelH = panel.offsetHeight || 240
  const below = vh - rect.bottom - pad
  const above = rect.top - pad
  const openUp = below < Math.min(Math.max(panelH, 180), 360) && above > below
  relationAddTargetPanelDirection.value = openUp ? 'up' : 'down'

  const w = rect.width
  const left = Math.max(8, Math.min(rect.left, vw - w - 8))
  const top = openUp ? Math.max(8, rect.top - pad - panelH) : Math.min(vh - 8, rect.bottom + pad)
  relationAddTargetPanelStyle.value = {
    left: `${Math.round(left)}px`,
    width: `${Math.round(w)}px`,
    top: `${Math.round(top)}px`,
  }
}

function onDocPointerDownForRelationAddTarget(e: MouseEvent): void {
  if (!relationAddTargetDropdownOpen.value) return
  const t = e.target
  if (!(t instanceof Node)) return
  const btn = document.querySelector<HTMLElement>('[data-dd-key="workspace-relation-add-target"]')
  const panel = document.querySelector<HTMLElement>('[data-dd-panel-key="workspace-relation-add-target"]')
  if (btn?.contains(t)) return
  if (panel?.contains(t)) return
  relationAddTargetDropdownOpen.value = false
  relationAddTargetQuery.value = ''
}


const canSaveNewRelation = computed(() => {
  return !!anchorCharacter.value && !!targetBId.value && !!typeFromA.value.trim() && !!typeFromB.value.trim()
})

function characterNameById(id: string): string {
  return props.characters.find((c) => c.id === id)?.name ?? '未知'
}

function clearFormFields(): void {
  targetBId.value = ''
  typeFromA.value = ''
  typeFromB.value = ''
  note.value = ''
  relationAddTargetDropdownOpen.value = false
  relationAddTargetQuery.value = ''
}

function syncRelationDraftRows(): void {
  const focus = props.focusCharacterId
  if (!focus) {
    relationDraftRows.value = []
    return
  }
  const byTarget = new Map<string, RelationDraftRow>()
  for (const r of props.relations) {
    if (r.fromCharacterId !== focus && r.toCharacterId !== focus) continue
    const targetId = r.fromCharacterId === focus ? r.toCharacterId : r.fromCharacterId
    const targetName = characterNameById(targetId)
    if (!byTarget.has(targetId)) {
      byTarget.set(targetId, {
        targetCharacterId: targetId,
        targetName,
        centerToOtherType: '',
        otherToCenterType: '',
        centerToOtherRelId: '',
        otherToCenterRelId: '',
      })
    }
    const row = byTarget.get(targetId)!
    if (r.fromCharacterId === focus && r.toCharacterId === targetId) {
      row.centerToOtherType = String(r.relationType ?? '')
      row.centerToOtherRelId = r.id
    } else if (r.fromCharacterId === targetId && r.toCharacterId === focus) {
      row.otherToCenterType = String(r.relationType ?? '')
      row.otherToCenterRelId = r.id
    }
  }
  relationDraftRows.value = Array.from(byTarget.values()).sort((a, b) => a.targetName.localeCompare(b.targetName, 'zh-Hans'))
}

const relationEditVisibleRows = computed(() => {
  const q = relationEditSearchQuery.value.trim().toLowerCase()
  if (!q) return relationDraftRows.value
  return relationDraftRows.value.filter((row) =>
    row.targetName.toLowerCase().includes(q) || row.targetCharacterId.toLowerCase().includes(q),
  )
})

function removeRelationDraftRow(targetCharacterId: string): void {
  const row = relationDraftRows.value.find((x) => x.targetCharacterId === targetCharacterId)
  if (!row) return
  if (row.centerToOtherRelId) deleteCharacterRelation(row.centerToOtherRelId)
  if (row.otherToCenterRelId) deleteCharacterRelation(row.otherToCenterRelId)
  relationDraftRows.value = relationDraftRows.value.filter((x) => x.targetCharacterId !== targetCharacterId)
  emit('relationsChanged')
}

function saveRelationDraftRows(): void {
  const focus = props.focusCharacterId
  if (!focus) return
  for (const row of relationDraftRows.value) {
    if (row.centerToOtherRelId) deleteCharacterRelation(row.centerToOtherRelId)
    if (row.otherToCenterRelId) deleteCharacterRelation(row.otherToCenterRelId)
    const t1 = row.centerToOtherType.trim()
    const t2 = row.otherToCenterType.trim()
    if (t1) {
      createCharacterRelation({
        novelId: props.novelId,
        fromCharacterId: focus,
        toCharacterId: row.targetCharacterId,
        relationType: t1,
      })
    }
    if (t2) {
      createCharacterRelation({
        novelId: props.novelId,
        fromCharacterId: row.targetCharacterId,
        toCharacterId: focus,
        relationType: t2,
      })
    }
  }
  linkError.value = ''
  linkSuccess.value = '角色关系已保存。'
  emit('relationsChanged')
  syncRelationDraftRows()
}

function openRelationEditModal(): void {
  panelMode.value = 'edit'
  relationAddModalOpen.value = false
  linkMode.value = false
  linkError.value = ''
  linkSuccess.value = ''
  relationEditSearchQuery.value = ''
  syncRelationDraftRows()
  relationEditModalOpen.value = true
}

function closeRelationEditModal(): void {
  relationEditModalOpen.value = false
  relationEditSearchQuery.value = ''
}

function openRelationAddModal(): void {
  panelMode.value = 'edit'
  relationEditModalOpen.value = false
  linkMode.value = true
  linkError.value = ''
  linkSuccess.value = ''
  clearFormFields()
  relationAddModalOpen.value = true
  void nextTick(() => relationAddDialogRef.value?.focus())
}

function closeRelationAddModal(): void {
  relationAddModalOpen.value = false
  linkMode.value = false
  clearFormFields()
}

function saveRelationDraftRowsFromModal(): void {
  saveRelationDraftRows()
  relationEditModalOpen.value = false
}

function submitBidirectional(): void {
  const a = anchorCharacter.value
  const bId = targetBId.value
  const typeAB = typeFromA.value.trim()
  const typeBA = typeFromB.value.trim()
  const noteVal = note.value.trim()

  if (!a) {
    linkError.value = '当前角色无效。'
    linkSuccess.value = ''
    return
  }
  if (!bId || bId === a.id) {
    linkError.value = '请选择尚未关联的角色 B。'
    linkSuccess.value = ''
    return
  }
  if (linkedCharacterIds.value.has(bId)) {
    linkError.value = '该角色已与当前角色存在关系，无法在此重复新增。请先在下方列表删除对应边。'
    linkSuccess.value = ''
    return
  }
  if (!typeAB || !typeBA) {
    linkError.value = '请分别填写 A 对 B、B 对 A 的关系描述。'
    linkSuccess.value = ''
    return
  }

  const fresh = getCharacterRelationsByNovelId(props.novelId)
  const touching = fresh.some(
    (r) =>
      (r.fromCharacterId === a.id && r.toCharacterId === bId) ||
      (r.fromCharacterId === bId && r.toCharacterId === a.id)
  )
  if (touching) {
    linkError.value = '数据已存在关联，请刷新或先在下方列表删除后再试。'
    linkSuccess.value = ''
    return
  }

  createCharacterRelation({
    novelId: props.novelId,
    fromCharacterId: a.id,
    toCharacterId: bId,
    relationType: typeAB,
    note: noteVal || undefined,
  })
  createCharacterRelation({
    novelId: props.novelId,
    fromCharacterId: bId,
    toCharacterId: a.id,
    relationType: typeBA,
    note: noteVal || undefined,
  })

  emit('relationsChanged')
  clearFormFields()
  relationAddModalOpen.value = false
  linkMode.value = false
  linkError.value = ''
  linkSuccess.value = '双向关系已新增。'
}

function removeRelation(relationId: string): void {
  deleteCharacterRelation(relationId)
  emit('relationsChanged')
  linkSuccess.value = ''
  linkError.value = ''
}

watch(linkMode, (v) => {
  if (!v) {
    relationAddModalOpen.value = false
    clearFormFields()
    linkError.value = ''
    linkSuccess.value = ''
  }
})

watch(
  () => props.focusCharacterId,
  () => {
    clearFormFields()
    linkError.value = ''
    linkSuccess.value = ''
    panelMode.value = 'edit'
    linkMode.value = false
    relationEditSearchQuery.value = ''
    relationEditModalOpen.value = false
    relationAddModalOpen.value = false
    syncRelationDraftRows()
  }
)

watch(relationAddTargetDropdownOpen, (open) => {
  if (typeof document === 'undefined') return
  document.removeEventListener('pointerdown', onDocPointerDownForRelationAddTarget, true)
  if (open) document.addEventListener('pointerdown', onDocPointerDownForRelationAddTarget, true)
})

watch(
  () => [relationAddModalOpen.value, relationAddTargetDropdownOpen.value] as const,
  ([modalOpen, ddOpen]) => {
    if (!modalOpen) {
      relationAddTargetDropdownOpen.value = false
      relationAddTargetQuery.value = ''
      return
    }
    if (!ddOpen) return
    void nextTick(() => positionRelationAddTargetPanel())
  },
)


watch(panelMode, (mode) => {
  linkMode.value = mode === 'add'
  linkError.value = ''
  linkSuccess.value = ''
})

watch(
  () => props.pairCharacterId ?? '',
  (pid) => {
    const id = String(pid ?? '').trim()
    if (!id || id === props.focusCharacterId) {
      // 清空点选：恢复全量展示（保留用户手动输入的搜索词则会“锁住”过滤）
      return
    }
    const name = props.characters.find((c) => c.id === id)?.name ?? ''
    if (!name) return
    panelMode.value = 'edit'
    relationEditSearchQuery.value = name
  }
)

onUnmounted(() => {
  linkMode.value = false
})

syncRelationDraftRows()
</script>

<style scoped>
.character-graph-relation-toolbar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.characters-graph-ui__link-mode {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
}

.characters-graph-ui__link-head {
  margin: 6px 0 10px;
}

.character-graph-relation-toolbar__mode-btn {
  min-height: 34px;
  padding: 6px 12px;
  font-size: 0.78rem;
  border-radius: 999px;
}

.character-graph-relation-toolbar__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding-right: 6px;
}

.chapter-hub__relation-view-row {
  border: 1px solid color-mix(in srgb, var(--color-border) 76%, transparent);
  border-radius: 16px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-surface) 96%, transparent),
    color-mix(in srgb, var(--color-surface-muted) 88%, transparent)
  );
  padding: 12px 14px;
  display: grid;
  gap: 8px;
}

.chapter-hub__relation-view-row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chapter-hub__relation-view-target {
  margin: 0;
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--color-text);
}

.chapter-hub__relation-view-remove {
  flex-shrink: 0;
  font-size: 0.72rem;
}

.chapter-hub__relation-view-line {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.chapter-hub__relation-view-name {
  color: var(--color-text);
  font-weight: 650;
}

.chapter-hub__relation-view-tag {
  display: inline-block;
  margin-left: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary-soft) 45%, transparent);
  color: color-mix(in srgb, var(--color-primary) 86%, var(--color-text) 14%);
  font-size: 0.74rem;
  line-height: 1.4;
}

.chapter-hub__relation-add-form {
  margin-top: 2px;
}

.chapter-hub__relation-add-empty {
  margin: 2px 6px 6px;
}
</style>

