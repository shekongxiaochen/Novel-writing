<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="open && faction"
        class="confirm-overlay chapter-hub__faction-overlay"
        role="presentation"
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
                    <p class="chapter-hub__faction-panel-hint">名称会参与正文中的势力高亮与悬停提示</p>
                  </div>
                  <div class="chapter-hub__faction-panel-inner">
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
                  </div>
                </section>

                <section class="chapter-hub__faction-panel">
                  <div class="chapter-hub__faction-panel-head">
                    <h3 class="chapter-hub__faction-panel-title">分类</h3>
                    <p class="chapter-hub__faction-panel-hint">
                      可多选；也可在写作区「分类」页从分类侧绑定势力
                    </p>
                  </div>
                  <div class="chapter-hub__faction-panel-inner">
                    <p v-if="sortedCategories.length === 0" class="chapter-hub__faction-empty">
                      暂无分类，请在工作台「分类」中新建。
                    </p>
                    <div
                      v-else
                      class="faction-row__attrs chapter-hub__faction-category-checks"
                      role="group"
                      aria-label="势力分类"
                    >
                      <label
                        v-for="cat in sortedCategories"
                        :key="`fcm-cat-${cat.id}`"
                        class="muted faction-row__attr-chip category-bind-chip chapter-hub__faction-category-chip"
                        :class="
                          draft.categoryIds.includes(cat.id) ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'
                        "
                        :for="`hub-faction-cat-${cat.id}`"
                      >
                        <input
                          :id="`hub-faction-cat-${cat.id}`"
                          type="checkbox"
                          class="visually-hidden"
                          :checked="draft.categoryIds.includes(cat.id)"
                          @change="toggleCategoryDraft(cat.id)"
                        />
                        <span class="category-bind-chip__state" aria-hidden="true">{{
                          draft.categoryIds.includes(cat.id) ? '✓' : '+'
                        }}</span>
                        {{ cat.name }}
                      </label>
                    </div>
                  </div>
                </section>

                <section class="chapter-hub__faction-panel">
                  <div class="chapter-hub__faction-panel-head">
                    <h3 class="chapter-hub__faction-panel-title">绑定角色</h3>
                    <p class="chapter-hub__faction-panel-hint">
                      点击角色切换绑定状态；未绑定在前、已绑定在后，组内按拼音排序
                    </p>
                  </div>
                  <div class="chapter-hub__faction-panel-inner">
                    <p v-if="characters.length === 0" class="chapter-hub__faction-empty">
                      本书暂无角色。请先到工作台「角色」页创建角色，再回到此处绑定。
                    </p>
                    <label v-if="characters.length > 0" class="chapter-hub__faction-field chapter-hub__faction-field--full">
                      <span class="chapter-hub__faction-field-label">搜索角色</span>
                      <input v-model="memberQuery" class="chapter-hub__faction-input" maxlength="30" />
                    </label>
                    <div class="faction-row__attrs" style="margin-top: 10px">
                      <small
                        v-for="c in factionMemberOptions"
                        :key="`fmc-${c.id}`"
                        class="muted faction-row__attr-chip category-bind-chip"
                        :class="memberCharIds.includes(c.id) ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'"
                        @click="toggleMember(c.id)"
                      >
                        <span class="category-bind-chip__state">{{ memberCharIds.includes(c.id) ? '已绑定' : '未绑定' }}</span>
                        {{ characterDisplay(c) }}
                      </small>
                    </div>
                    <div v-if="boundMembers.length > 0" style="margin-top: 14px">
                      <label
                        v-for="m in boundMembers"
                        :key="`desc-${m.id}`"
                        class="chapter-hub__faction-field chapter-hub__faction-field--full"
                        style="margin-top: 8px"
                      >
                        <span class="chapter-hub__faction-field-label">{{ characterDisplay(m) }} 描述（最多10字）</span>
                        <input
                          :value="memberDescByCharId[m.id] ?? ''"
                          class="chapter-hub__faction-input"
                          :class="{ 'chapter-hub__faction-input--changed': memberDescriptionChanged(m.id) }"
                          @compositionstart="onMemberDescCompositionStart(m.id)"
                          @compositionend="onMemberDescCompositionEnd(m.id, $event)"
                          @input="onMemberDescInput(m.id, $event)"
                        />
                      </label>
                    </div>
                  </div>
                </section>

                <section class="chapter-hub__faction-panel">
                  <div class="chapter-hub__faction-panel-head">
                    <h3 class="chapter-hub__faction-panel-title">绑定物品</h3>
                    <p class="chapter-hub__faction-panel-hint">点击物品切换绑定状态</p>
                  </div>
                  <div class="chapter-hub__faction-panel-inner">
                    <p v-if="items.length === 0" class="chapter-hub__faction-empty">
                      本书暂无物品。请先到工作台「物品」页创建物品，再回到此处绑定。
                    </p>
                    <label v-if="items.length > 0" class="chapter-hub__faction-field chapter-hub__faction-field--full">
                      <span class="chapter-hub__faction-field-label">搜索物品</span>
                      <input v-model="itemQuery" class="chapter-hub__faction-input" maxlength="40" />
                    </label>
                    <div v-if="items.length > 0" class="faction-row__attrs" style="margin-top: 10px">
                      <small
                        v-for="item in itemPickerRows"
                        :key="`fmi-${item.id}`"
                        class="muted faction-row__attr-chip category-bind-chip"
                        :class="item.bound ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'"
                        @click="toggleItem(item.id)"
                      >
                        <span class="category-bind-chip__state">{{ item.bound ? '已绑定' : '未绑定' }}</span>
                        {{ item.name }}
                      </small>
                    </div>
                    <p v-if="items.length > 0 && itemPickerRows.length === 0" class="chapter-hub__faction-empty">
                      没有匹配的物品。
                    </p>
                  </div>
                </section>

                <p v-if="errorMsg" class="chapter-hub__faction-modal-error" role="alert">{{ errorMsg }}</p>
              </div>

              <footer class="confirm-dialog__actions chapter-hub__faction-modal-footer">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="requestClose">
                  取消
                </button>
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="onSubmit">
                  保存
                </button>
              </footer>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <ConfirmDialog
    v-model="factionHubCancelConfirmOpen"
    overlay-class="chapter-hub__faction-cancel-confirm-overlay"
    title="有未保存的修改"
    message="您已修改势力内容，关闭将丢弃这些更改。确定返回写作区吗？"
    confirm-label="确定放弃修改"
    cancel-label="继续编辑"
    danger
    :show-danger-subhint="false"
    @confirm="forceCloseFactionHubModal"
    @cancel="onFactionHubCancelConfirmDialogCancel"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import {
  buildFactionStateSnapshot,
  getCharacterFactionMembershipsByNovelId,
  getFactionsByNovelId,
  normalizeCategoryIds,
  recordFactionChangeFields,
  replaceItemOwnersForEntity,
  replaceMembershipsForFaction,
  type CharacterChangeDetail,
  type FactionStateSnapshot,
  updateFaction,
} from '../../../lib/storage'
import { characterMatchLabels, buildDisplayNameMap } from '../../../lib/characterLabels'
import type { Category, Character, Faction, Item } from '../../../types'

const props = defineProps<{
  open: boolean
  novelId: string
  characters: Character[]
  items: Item[]
  categories?: Category[]
  faction: Faction | null
  /** 从章节正文打开时传入，用于修改记录锚点 */
  chapterId?: string
  sourceTextRange?: { start: number; end: number } | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const draft = reactive({
  name: '',
  categoryIds: [] as string[],
})

const memberQuery = ref('')
const itemQuery = ref('')
const memberCharIds = ref<string[]>([])
const itemIds = ref<string[]>([])
const memberDescByCharId = reactive<Record<string, string>>({})
const memberDescComposing = reactive<Record<string, boolean>>({})
const errorMsg = ref('')
const savedNotice = ref(false)
const factionHubCancelConfirmOpen = ref(false)
const initialDraft = ref({
  name: '',
  memberCharIds: [] as string[],
  itemIds: [] as string[],
  memberDescByCharId: {} as Record<string, string>,
  categoryIds: [] as string[],
})

function characterName(characterId: string): string {
  return charDisplayNameMap.value.get(characterId) ?? props.characters.find((c) => c.id === characterId)?.name ?? '未知'
}

// 同名角色显示名(作者视图:张三1/张三2)
const charDisplayNameMap = computed(() =>
  buildDisplayNameMap(props.characters.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt }))),
)
function characterDisplay(c: { id: string; name: string }): string {
  return charDisplayNameMap.value.get(c.id) ?? c.name
}

function normalizeItemIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hans'))
}

function itemName(itemId: string): string {
  return props.items.find((item) => item.id === itemId)?.name ?? itemId
}

const pinyinCollator = new Intl.Collator('zh-Hans-u-co-pinyin', { sensitivity: 'base', numeric: true })
const sortByPinyin = (list: Character[]) => [...list].sort((a, b) => pinyinCollator.compare(a.name ?? '', b.name ?? ''))

function fieldChanged(key: 'name'): boolean {
  return key === 'name' && draft.name.trim() !== initialDraft.value.name
}

function memberDescriptionChanged(characterId: string): boolean {
  const cur = memberDescByCharId[characterId] ?? ''
  const old = initialDraft.value.memberDescByCharId[characterId] ?? ''
  return cur.trim() !== old.trim()
}

const boundMembers = computed(() =>
  memberCharIds.value
    .map((id) => ({ id, name: characterName(id) }))
    .sort((a, b) => pinyinCollator.compare(a.name, b.name)),
)

const sortedCategories = computed(() => {
  const list = props.categories ?? []
  return [...list].sort((a, b) => pinyinCollator.compare(a.name ?? '', b.name ?? ''))
})

const factionMemberOptions = computed(() => {
  const q = memberQuery.value.trim().toLowerCase()
  const base = !q
    ? props.characters
    : props.characters.filter((c) =>
        characterMatchLabels(c).some((l) => l.toLowerCase().includes(q)),
      )
  const sorted = sortByPinyin(base)
  const unbound = sorted.filter((c) => !memberCharIds.value.includes(c.id))
  const bound = sorted.filter((c) => memberCharIds.value.includes(c.id))
  return [...unbound, ...bound]
})

const itemPickerRows = computed(() => {
  const q = itemQuery.value.trim().toLowerCase()
  const rows = props.items
    .filter((item) => item.novelId === props.novelId)
    .filter((item) => !q || `${item.name ?? ''} ${item.summary ?? ''}`.toLowerCase().includes(q))
    .map((item) => ({
      ...item,
      bound: itemIds.value.includes(item.id),
    }))
  return rows.sort((a, b) => {
    const groupA = a.bound ? 0 : !a.ownerType ? 1 : 2
    const groupB = b.bound ? 0 : !b.ownerType ? 1 : 2
    if (groupA !== groupB) return groupA - groupB
    return pinyinCollator.compare(a.name ?? '', b.name ?? '')
  })
})

function hasUnsavedChanges(): boolean {
  if (fieldChanged('name')) return true
  const oldCat = [...initialDraft.value.categoryIds].join('|')
  const nowCat = [...normalizeCategoryIds(draft.categoryIds)].sort().join('|')
  if (oldCat !== nowCat) return true
  const oldIds = [...initialDraft.value.memberCharIds].sort().join('|')
  const nowIds = [...memberCharIds.value].sort().join('|')
  if (oldIds !== nowIds) return true
  const oldItemIds = [...initialDraft.value.itemIds].sort().join('|')
  const nowItemIds = normalizeItemIds(itemIds.value).join('|')
  if (oldItemIds !== nowItemIds) return true
  return memberCharIds.value.some((id) => memberDescriptionChanged(id))
}

function syncFromFaction(f: Faction | null): void {
  if (!f) return
  draft.name = f.name ?? ''
  draft.categoryIds = [...normalizeCategoryIds(f.categoryIds)]

  const mems = getCharacterFactionMembershipsByNovelId(props.novelId).filter((m) => m.factionId === f.id)
  memberCharIds.value = mems.map((m) => m.characterId)
  itemIds.value = normalizeItemIds(
    props.items
      .filter((item) => item.novelId === props.novelId && item.ownerType === 'faction' && item.ownerId === f.id)
      .map((item) => item.id),
  )
  Object.keys(memberDescByCharId).forEach((k) => delete memberDescByCharId[k])
  mems.forEach((m) => {
    memberDescByCharId[m.characterId] = (m.description ?? '').trim()
  })
  memberQuery.value = ''
  itemQuery.value = ''
  initialDraft.value = {
    name: draft.name.trim(),
    memberCharIds: [...memberCharIds.value].sort(),
    itemIds: normalizeItemIds(itemIds.value),
    memberDescByCharId: Object.fromEntries(mems.map((m) => [m.characterId, (m.description ?? '').trim()])),
    categoryIds: [...normalizeCategoryIds(f.categoryIds)].sort(),
  }
}

function resetInitialDraftFromCurrent(): void {
  const descByCharId: Record<string, string> = {}
  memberCharIds.value.forEach((id) => {
    descByCharId[id] = limitMemberDesc((memberDescByCharId[id] ?? '').trim())
  })
  initialDraft.value = {
    name: draft.name.trim(),
    memberCharIds: [...memberCharIds.value].sort(),
    itemIds: normalizeItemIds(itemIds.value),
    memberDescByCharId: descByCharId,
    categoryIds: [...normalizeCategoryIds(draft.categoryIds)].sort(),
  }
}

function toggleCategoryDraft(categoryId: string): void {
  const id = String(categoryId ?? '').trim()
  if (!id) return
  const i = draft.categoryIds.indexOf(id)
  if (i >= 0) draft.categoryIds.splice(i, 1)
  else draft.categoryIds.push(id)
}

function toggleMember(characterId: string): void {
  const ids = [...memberCharIds.value]
  const idx = ids.indexOf(characterId)
  if (idx >= 0) ids.splice(idx, 1)
  else ids.push(characterId)
  memberCharIds.value = ids
  if (!ids.includes(characterId)) {
    delete memberDescByCharId[characterId]
    delete memberDescComposing[characterId]
  }
}

function toggleItem(itemId: string): void {
  const id = String(itemId ?? '').trim()
  if (!id) return
  const ids = [...itemIds.value]
  const idx = ids.indexOf(id)
  if (idx >= 0) ids.splice(idx, 1)
  else ids.push(id)
  itemIds.value = ids
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
      factionHubCancelConfirmOpen.value = false
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

function limitMemberDesc(value: string): string {
  return Array.from(value).slice(0, 10).join('')
}

function onMemberDescInput(characterId: string, event: Event): void {
  const target = event.target as HTMLInputElement | null
  const raw = target?.value ?? ''
  if (memberDescComposing[characterId]) {
    memberDescByCharId[characterId] = raw
    return
  }
  const limited = limitMemberDesc(raw)
  memberDescByCharId[characterId] = limited
  if (target && target.value !== limited) target.value = limited
}

function onMemberDescCompositionStart(characterId: string): void {
  memberDescComposing[characterId] = true
}

function onMemberDescCompositionEnd(characterId: string, event: Event): void {
  memberDescComposing[characterId] = false
  onMemberDescInput(characterId, event)
}

function requestClose(): void {
  if (hasUnsavedChanges()) {
    factionHubCancelConfirmOpen.value = true
    return
  }
  emit('close')
}

function forceCloseFactionHubModal(): void {
  factionHubCancelConfirmOpen.value = false
  emit('close')
}

function onFactionHubCancelConfirmDialogCancel(): void {
  void nextTick(() => {
    if (typeof document !== 'undefined' && props.open) {
      document.body.style.overflow = 'hidden'
    }
  })
}

function normalizeFactionMemberRows(
  ids: string[],
  descById: Record<string, string>,
): Array<{ characterId: string; description: string }> {
  return [...ids]
    .map((id) => String(id ?? '').trim())
    .filter(Boolean)
    .map((characterId) => ({ characterId, description: limitMemberDesc((descById[characterId] ?? '').trim()) }))
    .sort((a, b) => a.characterId.localeCompare(b.characterId))
}

function computeFactionHubSaveChangePayload(): {
  fields: string[]
  details: CharacterChangeDetail[]
  fieldValues: Record<string, string>
} {
  const changed = new Set<string>()
  const details: CharacterChangeDetail[] = []
  const pushDetail = (field: string, location: string, before: unknown, after: unknown): void => {
    details.push({
      field,
      location,
      before: String(before ?? ''),
      after: String(after ?? ''),
    })
  }
  const name = draft.name.trim()
  const init = initialDraft.value
  if (name !== init.name) {
    changed.add('name')
    pushDetail('name', '势力档案/名称', init.name, name)
  }
  const curCat = [...normalizeCategoryIds(draft.categoryIds)].sort().join('|')
  const initCat = [...init.categoryIds].sort().join('|')
  if (curCat !== initCat) {
    changed.add('categoryIds')
    const nameById = new Map((props.categories ?? []).map((c) => [c.id, c.name]))
    const label = (ids: string[]) =>
      normalizeCategoryIds(ids)
        .map((id) => nameById.get(id) ?? id)
        .join('、')
    pushDetail('categoryIds', '势力档案/分类', label(init.categoryIds), label(draft.categoryIds))
  }
  const memA = normalizeFactionMemberRows(memberCharIds.value, memberDescByCharId)
  const memB = normalizeFactionMemberRows(init.memberCharIds, init.memberDescByCharId)
  const memChanged =
    memA.length !== memB.length ||
    memA.some((m, i) => m.characterId !== memB[i]?.characterId || m.description !== memB[i]?.description)
  if (memChanged) {
    changed.add('memberships')
    const fmt = (rows: typeof memA) =>
      rows.map((m) => `${characterName(m.characterId)}:${m.description}`).join('；')
    pushDetail('memberships', '势力档案/绑定角色', fmt(memB), fmt(memA))
  }
  const itemA = normalizeItemIds(itemIds.value)
  const itemB = normalizeItemIds(init.itemIds)
  const itemsChanged = itemA.length !== itemB.length || itemA.some((id, i) => id !== itemB[i])
  if (itemsChanged) {
    changed.add('items')
    const label = (ids: string[]) => ids.map((id) => itemName(id)).join('、')
    pushDetail('items', '势力档案/绑定物品', label(itemB), label(itemA))
  }
  const fields = Array.from(changed)
  const fieldValues: Record<string, string> = {}
  if (fields.includes('name')) fieldValues.name = name
  if (fields.includes('categoryIds')) {
    const nameById = new Map((props.categories ?? []).map((c) => [c.id, c.name]))
    fieldValues.categoryIds = normalizeCategoryIds(draft.categoryIds)
      .map((id) => nameById.get(id) ?? id)
      .join('、')
  }
  if (fields.includes('memberships')) {
    fieldValues.memberships = memA.map((m) => `${characterName(m.characterId)}:${m.description}`).join('；')
  }
  if (fields.includes('items')) {
    fieldValues.items = itemA.map((id) => itemName(id)).join('、')
  }
  return { fields, details, fieldValues }
}

function draftFactionMembershipSnapshots(factionId: string): FactionStateSnapshot['memberships'] {
  return normalizeFactionMemberRows(memberCharIds.value, memberDescByCharId).map((row) => ({
    novelId: props.novelId,
    characterId: row.characterId,
    factionId,
    description: row.description,
  }))
}

function buildDraftFactionSnapshot(f: Faction): FactionStateSnapshot {
  return {
    ...buildFactionStateSnapshot(f, []),
    name: draft.name.trim() || f.name,
    categoryIds: normalizeCategoryIds(draft.categoryIds),
    memberships: draftFactionMembershipSnapshots(f.id),
  }
}

function onSubmit(): void {
  const f = props.faction
  if (!f) return
  const name = draft.name.trim()
  if (!name) {
    errorMsg.value = '请填写势力名。'
    return
  }
  errorMsg.value = ''
  const changePayload = computeFactionHubSaveChangePayload()
  const existingMemberships = getCharacterFactionMembershipsByNovelId(props.novelId).filter((m) => m.factionId === f.id)
  const beforeSnapshot = buildFactionStateSnapshot(f, existingMemberships)
  const afterSnapshot = buildDraftFactionSnapshot(f)
  const chId = String(props.chapterId ?? '').trim()
  const range = props.sourceTextRange
  const isAnchoredEdit = !!chId && !!range && range.end > range.start
  updateFaction({
    id: f.id,
    name,
    leader: '',
    notes: '',
    attributes: undefined,
    categoryIds: normalizeCategoryIds(draft.categoryIds),
  })
  replaceMembershipsForFaction(
    props.novelId,
    f.id,
    memberCharIds.value.map((id) => ({
      characterId: id,
      description: limitMemberDesc((memberDescByCharId[id] ?? '').trim()),
    })),
  )
  replaceItemOwnersForEntity(props.novelId, 'faction', f.id, itemIds.value)
  if (changePayload.fields.length > 0) {
    recordFactionChangeFields(f.id, changePayload.fields, {
      ...(chId ? { chapterId: chId } : {}),
      ...(range && typeof range.start === 'number'
        ? { anchorStart: range.start, anchorEnd: range.end }
        : {}),
      details: changePayload.details,
      fieldValues: changePayload.fieldValues,
      beforeSnapshot: isAnchoredEdit ? beforeSnapshot : null,
      afterSnapshot: isAnchoredEdit ? afterSnapshot : null,
    })
  }
  // 保存成功后将当前值设为新的“初始值”，避免再次取消时误判未保存改动。
  resetInitialDraftFromCurrent()
  factionHubCancelConfirmOpen.value = false
  emit('saved')
  emit('close')
}

onUnmounted(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>
