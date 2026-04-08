<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="open && faction"
        class="confirm-overlay chapter-hub__faction-overlay"
        role="presentation"
        @click.self="requestClose"
      >
        <div
          class="confirm-dialog chapter-hub__faction-modal-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chapter-hub-faction-modal-title"
        >
          <header class="chapter-hub__faction-modal-head">
            <div class="chapter-hub__faction-modal-head-text">
              <h2 id="chapter-hub-faction-modal-title" class="chapter-hub__faction-modal-title">
                势力档案
              </h2>
              <p class="chapter-hub__faction-modal-sub">
                {{ draft.name || faction.name }}
              </p>
            </div>
            <button
              type="button"
              class="chapter-hub__faction-modal-close"
              aria-label="关闭"
              @click="requestClose"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <Transition name="chapter-hub-save-toast">
            <div v-if="savedNotice" class="chapter-hub__faction-save-toast" role="status">已保存</div>
          </Transition>

          <div class="confirm-dialog__body chapter-hub__faction-modal-body">
            <form class="chapter-hub__faction-modal-form" @submit.prevent="onSubmit">
              <div class="chapter-hub__faction-modal-scroll scrollbar-paper">
                <section class="chapter-hub__faction-panel">
                  <div class="chapter-hub__faction-panel-head">
                    <h3 class="chapter-hub__faction-panel-title">基本信息</h3>
                    <p class="chapter-hub__faction-panel-hint">名称与领袖会参与正文中的势力高亮与悬停提示</p>
                  </div>
                  <div class="chapter-hub__faction-panel-inner">
                    <div class="chapter-hub__faction-field-row">
                      <label class="chapter-hub__faction-field">
                        <span class="chapter-hub__faction-field-label">
                          势力名称 <span class="chapter-hub__faction-req">*</span>
                        </span>
                        <input
                          v-model="draft.name"
                          class="chapter-hub__faction-input"
                          :class="{ 'chapter-hub__faction-input--changed': fieldChanged('name') }"
                          maxlength="50"
                          required
                          autocomplete="off"
                        />
                      </label>
                      <label class="chapter-hub__faction-field">
                        <span class="chapter-hub__faction-field-label">领袖</span>
                        <input
                          v-model="draft.leader"
                          class="chapter-hub__faction-input"
                          :class="{ 'chapter-hub__faction-input--changed': fieldChanged('leader') }"
                          maxlength="40"
                          autocomplete="off"
                        />
                      </label>
                    </div>
                    <label class="chapter-hub__faction-field chapter-hub__faction-field--full">
                      <span class="chapter-hub__faction-field-label">备注</span>
                      <textarea
                        v-model="draft.notes"
                        class="chapter-hub__faction-textarea chapter-hub__faction-textarea--notes"
                        :class="{ 'chapter-hub__faction-input--changed': fieldChanged('notes') }"
                        maxlength="200"
                        rows="3"
                      />
                    </label>
                  </div>
                </section>

                <section class="chapter-hub__faction-panel">
                  <div class="chapter-hub__faction-panel-head">
                    <h3 class="chapter-hub__faction-panel-title">自定义字段</h3>
                    <p class="chapter-hub__faction-panel-hint">按需增加条目，例如图腾、据点、戒律等</p>
                  </div>
                  <div class="chapter-hub__faction-panel-inner">
                    <p v-if="draft.attributes.length === 0" class="chapter-hub__faction-empty">
                      暂无条目。若无需扩展信息，可跳过；需要时点击底部「添加字段」。
                    </p>
                    <div
                      v-for="(a, attrIdx) in draft.attributes"
                      :key="a.id"
                      class="chapter-hub__faction-attr-card"
                      :class="{ 'chapter-hub__faction-attr-card--changed': attrChanged(attrIdx, 'key') || attrChanged(attrIdx, 'value') }"
                    >
                      <div class="chapter-hub__faction-attr-card-head">
                        <span class="chapter-hub__faction-attr-index">条目 {{ attrIdx + 1 }}</span>
                        <span
                          v-if="attrChanged(attrIdx, 'key') || attrChanged(attrIdx, 'value')"
                          class="chapter-hub__changed-badge"
                        >
                          已修改
                        </span>
                        <button
                          type="button"
                          class="chapter-hub__faction-attr-remove"
                          title="删除此字段"
                          @click="removeAttrRow(a.id)"
                        >
                          删除
                        </button>
                      </div>
                      <div class="chapter-hub__faction-attr-fields">
                        <label class="chapter-hub__faction-field">
                          <span class="chapter-hub__faction-field-label">名称</span>
                          <input
                            v-model="a.key"
                            class="chapter-hub__faction-input"
                            :class="{ 'chapter-hub__faction-input--changed': attrChanged(attrIdx, 'key') }"
                            maxlength="40"
                          />
                        </label>
                        <label class="chapter-hub__faction-field chapter-hub__faction-field--grow">
                          <span class="chapter-hub__faction-field-label">内容</span>
                          <input
                            v-model="a.value"
                            class="chapter-hub__faction-input"
                            :class="{ 'chapter-hub__faction-input--changed': attrChanged(attrIdx, 'value') }"
                            maxlength="80"
                          />
                        </label>
                      </div>
                    </div>
                    <button type="button" class="chapter-hub__faction-add-btn" @click="addAttrRow">
                      ＋ 添加字段
                    </button>
                  </div>
                </section>

                <section class="chapter-hub__faction-panel">
                  <div class="chapter-hub__faction-panel-head">
                    <h3 class="chapter-hub__faction-panel-title">绑定角色</h3>
                    <p class="chapter-hub__faction-panel-hint">
                      同一角色可加入多个势力；此处仅描述其在本势力中的身份或立场
                    </p>
                  </div>
                  <div class="chapter-hub__faction-panel-inner">
                    <p v-if="characters.length === 0" class="chapter-hub__faction-empty">
                      本书暂无角色。请先到工作台「角色」页创建角色，再回到此处绑定。
                    </p>
                    <template v-else>
                      <p v-if="memberRows.length === 0" class="chapter-hub__faction-empty">
                        尚未绑定角色。在下方选择角色后点击「加入列表」即可。
                      </p>
                      <ul v-else class="chapter-hub__faction-member-list">
                        <li
                          v-for="row in memberRows"
                          :key="row.characterId"
                          class="chapter-hub__faction-member-card"
                          :class="{ 'chapter-hub__faction-member-card--changed': memberRowChanged(row) }"
                        >
                        <div class="chapter-hub__faction-member-top">
                          <span class="chapter-hub__faction-member-badge">{{
                            characterName(row.characterId)
                          }}</span>
                          <span v-if="memberRowChanged(row)" class="chapter-hub__changed-badge">
                            {{ memberAdded(row.characterId) ? '新增' : '已修改' }}
                          </span>
                          <button
                            type="button"
                            class="chapter-hub__faction-member-remove"
                            @click="removeMemberRow(row.characterId)"
                          >
                            移出势力
                          </button>
                        </div>
                        <label class="chapter-hub__faction-field chapter-hub__faction-field--full">
                          <span class="chapter-hub__faction-field-label">在本势力中的描述（最多 120 字）</span>
                          <input
                            v-model="row.description"
                            type="text"
                            class="chapter-hub__faction-input"
                            :class="{ 'chapter-hub__faction-input--changed': memberDescriptionChanged(row.characterId) }"
                            maxlength="120"
                          />
                        </label>
                        </li>
                      </ul>
                    </template>

                    <div
                      v-if="characters.length > 0 && availableCharactersToAdd.length > 0"
                      class="chapter-hub__faction-add-bar"
                    >
                      <label class="chapter-hub__faction-add-bar-label">
                        <span class="chapter-hub__faction-field-label">添加成员</span>
                        <div class="chapter-hub__faction-dd">
                          <button
                            type="button"
                            class="chapter-hub__faction-dd-btn"
                            :class="{ 'chapter-hub__faction-dd-btn--open': memberDropdownOpen }"
                            @click="toggleMemberDropdown"
                          >
                            <span class="chapter-hub__faction-dd-btn-text">
                              {{ memberDropdownLabel }}
                            </span>
                            <span class="chapter-hub__faction-dd-btn-caret" aria-hidden="true">▾</span>
                          </button>
                          <div
                            v-if="memberDropdownOpen"
                            class="chapter-hub__faction-dd-panel scrollbar-paper"
                            role="listbox"
                          >
                            <input
                              v-model="memberDropdownQuery"
                              class="chapter-hub__faction-dd-search"
                              placeholder="搜索角色"
                              @keydown.esc.stop.prevent="closeMemberDropdown"
                            />
                            <button
                              v-for="c in memberDropdownOptions"
                              :key="`dd-${c.id}`"
                              type="button"
                              class="chapter-hub__faction-dd-item"
                              role="option"
                              @click="selectMemberFromDropdown(c.id)"
                            >
                              {{ c.name }}
                            </button>
                            <p v-if="memberDropdownOptions.length === 0" class="chapter-hub__faction-dd-empty">
                              未找到匹配角色
                            </p>
                          </div>
                        </div>
                      </label>
                      <button
                        type="button"
                        class="chapter-hub__faction-add-bar-btn"
                        :disabled="!pendingCharacterId"
                        @click="addMemberRow"
                      >
                        加入列表
                      </button>
                    </div>
                  </div>
                </section>

                <p v-if="errorMsg" class="chapter-hub__faction-modal-error" role="alert">{{ errorMsg }}</p>
              </div>

              <footer class="chapter-hub__faction-modal-footer">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="requestClose">
                  取消
                </button>
                <button type="submit" class="chapter-hub__faction-save-btn">保存</button>
              </footer>
              <div v-if="cancelPromptOpen" class="chapter-hub__cancel-inline-confirm">
                <p class="chapter-hub__cancel-inline-confirm-text">取消将不保存更改，确定取消吗？</p>
                <div class="chapter-hub__cancel-inline-confirm-actions">
                  <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="onCancelCloseDialogCancel">
                    继续编辑
                  </button>
                  <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="confirmCancelClose">
                    确定取消
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import {
  getCharacterFactionMembershipsByNovelId,
  replaceMembershipsForFaction,
  updateFaction,
} from '../../../lib/storage'
import type { Character, CharacterAttribute, Faction } from '../../../types'

const props = defineProps<{
  open: boolean
  novelId: string
  characters: Character[]
  faction: Faction | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const draft = reactive({
  name: '',
  leader: '',
  notes: '',
  attributes: [] as CharacterAttribute[],
})

const memberRows = ref<{ characterId: string; description: string }[]>([])
const pendingCharacterId = ref('')
const errorMsg = ref('')
const savedNotice = ref(false)
const cancelPromptOpen = ref(false)
const memberDropdownOpen = ref(false)
const memberDropdownQuery = ref('')
const initialDraft = ref({
  name: '',
  leader: '',
  notes: '',
  attrs: [] as Array<{ key: string; value: string }>,
  memberDescByCharId: {} as Record<string, string>,
})

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function characterName(characterId: string): string {
  return props.characters.find((c) => c.id === characterId)?.name ?? '未知'
}

const availableCharactersToAdd = computed(() => {
  const taken = new Set(memberRows.value.map((r) => r.characterId))
  return props.characters.filter((c) => !taken.has(c.id))
})

const memberDropdownOptions = computed(() => {
  const q = memberDropdownQuery.value.trim().toLowerCase()
  if (!q) return availableCharactersToAdd.value
  return availableCharactersToAdd.value.filter((c) => c.name.toLowerCase().includes(q))
})

const memberDropdownLabel = computed(() => {
  if (pendingCharacterId.value) return characterName(pendingCharacterId.value)
  return '选择角色…'
})

function closeMemberDropdown(): void {
  memberDropdownOpen.value = false
  memberDropdownQuery.value = ''
}

function fieldChanged(key: 'name' | 'leader' | 'notes'): boolean {
  if (key === 'name') return draft.name.trim() !== initialDraft.value.name
  if (key === 'leader') return draft.leader.trim() !== initialDraft.value.leader
  return draft.notes.trim() !== initialDraft.value.notes
}

function attrChanged(index: number, key: 'key' | 'value'): boolean {
  const cur = draft.attributes[index]
  const old = initialDraft.value.attrs[index]
  const curVal = (key === 'key' ? cur?.key : cur?.value) ?? ''
  const oldVal = (key === 'key' ? old?.key : old?.value) ?? ''
  return curVal.trim() !== oldVal.trim()
}

function memberDescriptionChanged(characterId: string): boolean {
  const cur = memberRows.value.find((r) => r.characterId === characterId)?.description ?? ''
  const old = initialDraft.value.memberDescByCharId[characterId] ?? ''
  return cur.trim() !== old.trim()
}

function memberAdded(characterId: string): boolean {
  return !(characterId in initialDraft.value.memberDescByCharId)
}

function memberRowChanged(row: { characterId: string; description: string }): boolean {
  return memberAdded(row.characterId) || memberDescriptionChanged(row.characterId)
}

function hasUnsavedChanges(): boolean {
  if (fieldChanged('name') || fieldChanged('leader') || fieldChanged('notes')) return true
  if (draft.attributes.length !== initialDraft.value.attrs.length) return true
  for (let i = 0; i < draft.attributes.length; i++) {
    if (attrChanged(i, 'key') || attrChanged(i, 'value')) return true
  }
  const oldIds = Object.keys(initialDraft.value.memberDescByCharId).sort().join('|')
  const nowIds = memberRows.value.map((m) => m.characterId).sort().join('|')
  if (oldIds !== nowIds) return true
  return memberRows.value.some((m) => memberDescriptionChanged(m.characterId))
}

function toggleMemberDropdown(): void {
  memberDropdownOpen.value = !memberDropdownOpen.value
  if (!memberDropdownOpen.value) memberDropdownQuery.value = ''
}

function selectMemberFromDropdown(id: string): void {
  pendingCharacterId.value = id
  closeMemberDropdown()
}

function syncFromFaction(f: Faction | null): void {
  if (!f) return
  draft.name = f.name ?? ''
  draft.leader = f.leader ?? ''
  draft.notes = f.notes ?? ''
  draft.attributes = (f.attributes ?? []).map((a) => ({ ...a }))

  const mems = getCharacterFactionMembershipsByNovelId(props.novelId).filter((m) => m.factionId === f.id)
  memberRows.value = mems.map((m) => ({
    characterId: m.characterId,
    description: m.description ?? '',
  }))
  pendingCharacterId.value = ''
  initialDraft.value = {
    name: draft.name.trim(),
    leader: draft.leader.trim(),
    notes: draft.notes.trim(),
    attrs: draft.attributes.map((a) => ({ key: a.key.trim(), value: a.value.trim() })),
    memberDescByCharId: Object.fromEntries(memberRows.value.map((m) => [m.characterId, (m.description ?? '').trim()])),
  }
}

function addAttrRow(): void {
  draft.attributes.push({ id: uid(), key: '', value: '' })
}

function removeAttrRow(id: string): void {
  const i = draft.attributes.findIndex((a) => a.id === id)
  if (i >= 0) draft.attributes.splice(i, 1)
}

function addMemberRow(): void {
  const id = pendingCharacterId.value.trim()
  if (!id) return
  if (memberRows.value.some((r) => r.characterId === id)) return
  memberRows.value = [...memberRows.value, { characterId: id, description: '' }]
  pendingCharacterId.value = ''
}

function removeMemberRow(characterId: string): void {
  memberRows.value = memberRows.value.filter((r) => r.characterId !== characterId)
}

watch(
  () => props.open,
  (v) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = v ? 'hidden' : ''
    }
    if (v && props.faction) {
      syncFromFaction(props.faction)
      errorMsg.value = ''
      cancelPromptOpen.value = false
      closeMemberDropdown()
    }
  },
  { flush: 'post' }
)

watch(
  () => props.faction,
  (f) => {
    if (props.open && f) syncFromFaction(f)
  }
)

function onWindowPointerDown(e: PointerEvent): void {
  if (!memberDropdownOpen.value) return
  const t = e.target as HTMLElement | null
  if (!t) return
  if (t.closest('.chapter-hub__faction-dd')) return
  closeMemberDropdown()
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', onWindowPointerDown, true)
}

function requestClose(): void {
  if (hasUnsavedChanges()) {
    cancelPromptOpen.value = true
    return
  }
  emit('close')
}

function confirmCancelClose(): void {
  cancelPromptOpen.value = false
  emit('close')
}

function onCancelCloseDialogCancel(): void {
  cancelPromptOpen.value = false
}

function onSubmit(): void {
  const f = props.faction
  if (!f) return
  const name = draft.name.trim()
  if (!name) {
    errorMsg.value = '请填写势力名。'
    return
  }
  const attrs: CharacterAttribute[] = []
  for (const a of draft.attributes) {
    const k = a.key.trim()
    const v = a.value.trim()
    if (!k && !v) continue
    if (!k || !v) {
      errorMsg.value = '自定义字段需同时填写「字段名」与「内容」。'
      return
    }
    attrs.push({ id: a.id || uid(), key: k, value: v })
  }
  errorMsg.value = ''
  updateFaction({
    id: f.id,
    name,
    leader: draft.leader.trim(),
    notes: draft.notes.trim(),
    attributes: attrs.length > 0 ? attrs : undefined,
  })
  replaceMembershipsForFaction(props.novelId, f.id, memberRows.value)
  savedNotice.value = true
  emit('saved')
  window.setTimeout(() => {
    savedNotice.value = false
  }, 1400)
}

onUnmounted(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointerdown', onWindowPointerDown, true)
  }
})
</script>
