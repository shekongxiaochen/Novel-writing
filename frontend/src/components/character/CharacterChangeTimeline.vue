<template>
  <div class="character-change-timeline" :class="{ 'character-change-timeline--embedded': embedded }">
    <div class="chapter-hub__relation-edit-top">
      <label class="chapter-hub__relation-edit-field">
        <span>查看字段</span>
        <div class="workspace-dd">
          <button
            type="button"
            class="workspace-dd__btn workspace-dd__btn--compact"
            :class="{ 'workspace-dd__btn--open': dropdownOpen }"
            :data-dd-key="ddKey"
            @click="toggleDropdown"
          >
            <span class="workspace-dd__btn-text">{{ dropdownLabel }}</span>
            <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
          </button>
          <div
            v-if="dropdownOpen"
            class="workspace-dd__panel scrollbar-paper"
            :data-dd-panel-key="ddKey"
            role="listbox"
          >
            <button
              type="button"
              class="workspace-dd__item"
              :class="{ 'workspace-dd__item--active': fieldFilter === '__all__' }"
              @click="selectField('__all__')"
            >
              全部字段
            </button>
            <button
              v-for="opt in fieldOptions"
              :key="`chg-field-${opt.value}`"
              type="button"
              class="workspace-dd__item"
              :class="{ 'workspace-dd__item--active': fieldFilter === opt.value }"
              @click="selectField(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </label>
    </div>
    <div class="chapter-hub__relation-edit-scroll scrollbar-paper">
      <template v-if="filteredRows.length > 0">
        <div
          v-for="(row, idx) in filteredRows"
          :key="`chg-all-${idx}-${row.updatedAt}`"
          class="chapter-hub__relation-edit-row"
        >
          <div class="chapter-hub__relation-edit-row-head">
            <p class="chapter-hub__relation-edit-target">
              {{ row.when }}<span v-if="row.chapterLabel"> · {{ row.chapterLabel }}</span>
            </p>
            <button
              v-if="row.chapterId"
              type="button"
              class="character-panel__icon-btn chapter-hub__relation-edit-remove"
              @click="emit('jump', row)"
            >
              跳转
            </button>
          </div>
          <template v-if="row.details.length > 0">
            <p
              v-for="(d, i) in row.details"
              :key="`chg-all-d-${idx}-${i}`"
              class="muted"
              style="margin: 0 0 4px;"
            >
              {{ d.location }}：{{ d.before || '空' }} -> {{ d.after || '空' }}
            </p>
          </template>
          <p v-else-if="row.fields.length > 0" class="muted" style="margin: 0 0 4px;">
            字段：{{ row.fields.map(characterFieldLabel).join('、') }}
          </p>
          <p v-else class="muted" style="margin: 0 0 4px;">（该记录无明细，可能来自旧版本数据）</p>
        </div>
      </template>
      <p v-else class="muted">暂无更改记录。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { getCharacterChangeHistory, getChaptersByNovelId } from '../../lib/storage'
import type { CharacterAttribute } from '../../types'
import {
  characterFieldLabel,
  extractAttributeKeys,
  groupChangesByAnchor,
  type CharacterChangeRow,
} from './characterChangeTimeline'

const props = withDefaults(
  defineProps<{
    characterId: string
    novelId: string
    attributes?: CharacterAttribute[]
    embedded?: boolean
    ddKey?: string
  }>(),
  { attributes: () => [], embedded: false, ddKey: 'character-change-timeline-field' },
)

const emit = defineEmits<{ jump: [row: CharacterChangeRow] }>()

const fieldFilter = ref('__all__')
const dropdownOpen = ref(false)

const chapterLabelById = computed(() => {
  const map = new Map<string, string>()
  for (const ch of getChaptersByNovelId(props.novelId)) {
    map.set(ch.id, `第 ${ch.chapterNo} 章${(ch.title ?? '').trim() ? ` · ${ch.title}` : ''}`)
  }
  return map
})

const allRows = computed<CharacterChangeRow[]>(() => {
  const id = String(props.characterId ?? '').trim()
  if (!id) return []
  return groupChangesByAnchor(getCharacterChangeHistory(id), chapterLabelById.value)
    .filter((row) => (row.fields?.length ?? 0) > 0 || (row.details?.length ?? 0) > 0)
    .slice()
    .reverse()
})

const fieldOptions = computed(() => {
  const fieldSet = new Set<string>()
  const attrKeySet = new Set<string>()
  for (const row of allRows.value) {
    for (const f of row.fields) fieldSet.add(f)
    for (const d of row.details) {
      if (d.field !== 'attributes') continue
      for (const k of extractAttributeKeys(d.before)) attrKeySet.add(k)
      for (const k of extractAttributeKeys(d.after)) attrKeySet.add(k)
    }
  }
  for (const a of props.attributes ?? []) {
    const k = String(a.key ?? '').trim()
    if (k) attrKeySet.add(k)
  }
  const out: Array<{ value: string; label: string }> = Array.from(fieldSet)
    .filter((f) => f !== 'attributes')
    .sort((a, b) => characterFieldLabel(a).localeCompare(characterFieldLabel(b), 'zh-Hans'))
    .map((f) => ({ value: `field:${f}`, label: characterFieldLabel(f) }))
  const attrItems = Array.from(attrKeySet)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans'))
    .map((k) => ({ value: `attr:${k}`, label: k }))
  return [...out, ...attrItems]
})

const dropdownLabel = computed(() => {
  const sel = String(fieldFilter.value ?? '__all__').trim()
  if (!sel || sel === '__all__') return '全部字段'
  return fieldOptions.value.find((x) => x.value === sel)?.label ?? '全部字段'
})

const filteredRows = computed<CharacterChangeRow[]>(() => {
  const sel = String(fieldFilter.value ?? '__all__').trim()
  if (!sel || sel === '__all__') return allRows.value
  if (sel.startsWith('field:')) {
    const field = sel.slice('field:'.length)
    return allRows.value
      .map((row) => ({ ...row, details: row.details.filter((d) => d.field === field) }))
      .filter((row) => row.fields.includes(field) || row.details.length > 0)
  }
  if (sel.startsWith('attr:')) {
    const key = sel.slice('attr:'.length).trim()
    if (!key) return allRows.value
    return allRows.value
      .map((row) => ({
        ...row,
        details: row.details.filter((d) => d.field === 'attributes' && `${d.before} ${d.after}`.includes(`${key}:`)),
      }))
      .filter((row) => row.details.length > 0)
  }
  return allRows.value
})

function selectField(v: string): void {
  fieldFilter.value = v
  dropdownOpen.value = false
}

function toggleDropdown(): void {
  dropdownOpen.value = !dropdownOpen.value
}

function onDocPointerDown(e: MouseEvent): void {
  if (!dropdownOpen.value) return
  const t = e.target
  if (!(t instanceof Node)) return
  const btn = document.querySelector<HTMLElement>(`[data-dd-key="${props.ddKey}"]`)
  const panel = document.querySelector<HTMLElement>(`[data-dd-panel-key="${props.ddKey}"]`)
  if (btn?.contains(t) || panel?.contains(t)) return
  dropdownOpen.value = false
}

watch(dropdownOpen, (open) => {
  if (typeof document === 'undefined') return
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  if (open) document.addEventListener('pointerdown', onDocPointerDown, true)
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.removeEventListener('pointerdown', onDocPointerDown, true)
})
</script>

