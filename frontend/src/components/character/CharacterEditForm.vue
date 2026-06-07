<template>
  <div class="character-panel__body character-panel__body--edit workspace-character-edit-dialog__scroll scrollbar-paper" style="padding: 0; margin-top: 12px">
    <div class="character-panel__form-grid">
      <label class="character-panel__field workspace-character-edit-dialog__left-col">
        <span class="character-panel__field-label">姓名</span>
        <input v-model="editor.draft.name" class="character-panel__input" maxlength="40" />
      </label>
      <label class="character-panel__field workspace-character-edit-dialog__left-col">
        <span class="character-panel__field-label">年龄</span>
        <input v-model="editor.draft.age" class="character-panel__input" maxlength="20" />
      </label>
      <div class="character-panel__field">
        <span class="character-panel__field-label">性别</span>
        <div class="character-gender-toggle" role="radiogroup" aria-label="性别">
          <button
            v-for="option in genderOptions"
            :key="`gender-${option.value || 'unset'}`"
            type="button"
            class="character-gender-toggle__option"
            :class="{ 'character-gender-toggle__option--active': editor.draft.gender === option.value }"
            role="radio"
            :aria-checked="editor.draft.gender === option.value"
            @click="editor.draft.gender = option.value"
          >
            <span class="character-gender-toggle__dot" aria-hidden="true">{{ option.mark }}</span>
            <span>{{ option.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <section class="character-panel__block character-panel__block--edit workspace-character-edit-dialog__full-row">
      <div class="character-panel__block-head">
        <h4 class="character-panel__block-title">别名</h4>
      </div>
      <div v-for="row in editor.draft.aliasRows" :key="row.id" class="character-panel__custom-card">
        <label class="character-panel__field character-panel__field--tight">
          <span class="character-panel__field-label">别称</span>
          <input v-model="row.value" class="character-panel__input" maxlength="40" />
        </label>
        <button type="button" class="character-panel__icon-btn" @click="editor.removeAliasRow(row.id)">移除</button>
      </div>
      <button type="button" class="character-panel__btn character-panel__btn--dashed" @click="editor.addAliasRow">＋ 添加别名</button>
    </section>

    <section class="character-panel__block character-panel__block--edit workspace-character-edit-dialog__full-row">
      <div class="character-panel__block-head">
        <h4 class="character-panel__block-title">分类</h4>
      </div>
      <p v-if="sortedCategories.length === 0" class="muted" style="margin: 0 0 8px">暂无分类，请在工作台「分类」中新建。</p>
      <div v-else class="character-panel__category-checks" role="group" aria-label="角色分类">
        <label
          v-for="cat in sortedCategories"
          :key="`dcc-${cat.id}`"
          class="category-bind-chip character-panel__category-chip"
          :class="editor.draft.categoryIds.includes(cat.id) ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'"
          :for="`edit-cat-${cat.id}`"
        >
          <input
            :id="`edit-cat-${cat.id}`"
            type="checkbox"
            class="visually-hidden"
            :checked="editor.draft.categoryIds.includes(cat.id)"
            @change="toggleDraftCategory(cat.id)"
          />
          <span class="category-bind-chip__state" aria-hidden="true">{{
            editor.draft.categoryIds.includes(cat.id) ? '✓' : '+'
          }}</span>
          <span class="character-panel__category-chip-text">{{ cat.name }}</span>
        </label>
      </div>
    </section>
    <section class="character-panel__block character-panel__block--edit workspace-character-edit-dialog__full-row">
      <div class="character-panel__block-head">
        <h4 class="character-panel__block-title">所属势力</h4>
      </div>
      <div v-for="(row, idx) in editor.draft.membershipRows" :key="`mm-${idx}-${row.factionId}`" class="character-panel__custom-card">
        <label class="character-panel__field character-panel__field--tight">
          <span class="character-panel__field-label">势力</span>
          <div class="workspace-dd">
            <button
              type="button"
              class="workspace-dd__btn workspace-dd__btn--compact"
              :class="{ 'workspace-dd__btn--open': editor.characterEditMembershipFactionDropdownOpenId.value === String(idx) }"
              :data-dd-key="`character-membership-${idx}`"
              @click="onToggleMembershipDropdown(idx)"
            >
              <span class="workspace-dd__btn-text">{{ editor.characterEditMembershipFactionLabel(row.factionId) }}</span>
              <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
            </button>
            <div
              v-if="editor.characterEditMembershipFactionDropdownOpenId.value === String(idx)"
              class="workspace-dd__panel scrollbar-paper"
              :class="[
                dropdownPanelDirectionClass(`character-membership-${idx}`),
                { 'workspace-dd__panel--max4': factionOptions.length > 4 },
              ]"
              :data-dd-panel-key="`character-membership-${idx}`"
              role="listbox"
            >
              <button
                v-for="f in factionOptions"
                :key="`cfd-${f.id}`"
                type="button"
                class="workspace-dd__item"
                :class="{ 'workspace-dd__item--active': row.factionId === f.id }"
                @click="editor.selectCharacterEditMembershipFaction(idx, f.id)"
              >
                {{ f.name }}
              </button>
            </div>
          </div>
        </label>
        <label class="character-panel__field">
          <span class="character-panel__field-label">在该势力中的描述（最多 120 字）</span>
          <input v-model="row.description" class="character-panel__input" maxlength="120" />
        </label>
        <button type="button" class="character-panel__icon-btn" @click="editor.removeMembershipRow(idx)">移除</button>
      </div>
      <button type="button" class="character-panel__btn character-panel__btn--dashed" @click="editor.addMembershipRow">＋ 添加势力关联</button>
    </section>

    <section class="character-panel__block character-panel__block--edit workspace-character-edit-dialog__full-row">
      <div class="character-panel__block-head">
        <h4 class="character-panel__block-title">绑定物品</h4>
      </div>
      <p v-if="items.length === 0" class="muted" style="margin: 0 0 8px">暂无物品，请先到工作台「物品」页创建物品。</p>
      <label v-else class="character-panel__field character-panel__field--tight">
        <span class="character-panel__field-label">搜索物品</span>
        <input v-model="editor.itemQuery.value" class="character-panel__input" maxlength="40" />
      </label>
      <div v-if="items.length > 0" class="character-panel__category-checks" role="group" aria-label="绑定物品">
        <button
          v-for="item in editor.itemPickerRows.value"
          :key="`character-item-${item.id}`"
          type="button"
          class="category-bind-chip character-panel__category-chip"
          :class="item.bound ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'"
          @click="editor.toggleItemBinding(item.id)"
        >
          <span class="category-bind-chip__state" aria-hidden="true">{{ item.bound ? '已绑定' : '未绑定' }}</span>
          <span class="character-panel__category-chip-text">{{ item.name }}</span>
        </button>
      </div>
      <p v-if="items.length > 0 && editor.itemPickerRows.value.length === 0" class="muted" style="margin: 8px 0 0">没有匹配的物品。</p>
    </section>

    <section class="character-panel__block character-panel__block--edit workspace-character-edit-dialog__full-row">
      <div class="character-panel__block-head">
        <h4 class="character-panel__block-title">扩展条目</h4>
      </div>
      <div v-for="a in editor.draft.attributes" :key="a.id" class="character-panel__custom-card">
        <label class="character-panel__field character-panel__field--tight">
          <span class="character-panel__field-label">名称</span>
          <input v-model="a.key" class="character-panel__input" maxlength="40" />
        </label>
        <label class="character-panel__field">
          <span class="character-panel__field-label">说明</span>
          <input v-model="a.value" class="character-panel__input" maxlength="80" />
        </label>
        <button type="button" class="character-panel__icon-btn" @click="editor.removeAttributeRow(a.id)">移除</button>
      </div>
      <button type="button" class="character-panel__btn character-panel__btn--dashed" @click="editor.addAttributeRow">＋ 新建条目</button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive } from 'vue'
import type { Category, Faction, Item } from '../../types'
import type { CharacterEditor } from '../../composables/useCharacterEditor'

const props = withDefaults(
  defineProps<{
    editor: CharacterEditor
    categories?: Category[]
    factionOptions: Faction[]
    items: Item[]
  }>(),
  { categories: () => [] },
)

const genderOptions = [
  { value: '', label: '未设', mark: '—' },
  { value: '男', label: '男', mark: '♂' },
  { value: '女', label: '女', mark: '♀' },
  { value: '其他', label: '其他', mark: '◇' },
]

const sortedCategories = computed(() =>
  [...(props.categories ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans')),
)

function toggleDraftCategory(categoryId: string): void {
  const id = String(categoryId ?? '').trim()
  if (!id) return
  const ids = props.editor.draft.categoryIds
  const i = ids.indexOf(id)
  if (i >= 0) ids.splice(i, 1)
  else ids.push(id)
}

const dropdownDirectionByKey = reactive<Record<string, 'up' | 'down'>>({})

function dropdownPanelDirectionClass(key: string): 'workspace-dd__panel--up' | 'workspace-dd__panel--down' {
  return dropdownDirectionByKey[key] === 'up' ? 'workspace-dd__panel--up' : 'workspace-dd__panel--down'
}

function resolveDropdownDirection(key: string): void {
  void nextTick(() => {
    if (typeof window === 'undefined') return
    const trigger = document.querySelector<HTMLElement>(`[data-dd-key="${key}"]`)
    const panel = document.querySelector<HTMLElement>(`[data-dd-panel-key="${key}"]`)
    if (!trigger || !panel) {
      dropdownDirectionByKey[key] = 'down'
      return
    }
    const rect = trigger.getBoundingClientRect()
    const pad = 8
    const below = window.innerHeight - rect.bottom - pad
    const above = rect.top - pad
    const desired = Math.min(Math.max(panel.offsetHeight, 180), 360)
    dropdownDirectionByKey[key] = below < desired && above > below ? 'up' : 'down'
  })
}

function onToggleMembershipDropdown(idx: number): void {
  props.editor.toggleCharacterEditMembershipFactionDropdown(idx)
  if (props.editor.characterEditMembershipFactionDropdownOpenId.value === String(idx)) {
    resolveDropdownDirection(`character-membership-${idx}`)
  }
}
</script>

