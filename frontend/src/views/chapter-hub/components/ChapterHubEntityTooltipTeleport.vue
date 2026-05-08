<template>
  <Teleport to="body">
    <div
      v-if="open && (character || tooltipFaction) && !textareaFocused && !textareaHasSelection"
      ref="tooltipRef"
      class="chapter-hub__entity-tooltip"
      :style="tooltipStyle"
    >
      <template v-if="character">
        <p class="chapter-hub__entity-tooltip-title">角色：{{ character.name }}</p>
        <template v-if="activeChangeDetailLines.length > 0">
          <p
            v-for="(line, i) in activeChangeDetailLines"
            :key="`chg-${i}`"
            class="chapter-hub__entity-tooltip-row chapter-hub__entity-tooltip-row--changed"
          >
            变更：{{ line }}
          </p>
        </template>
        <p v-if="characterAliasLine" class="chapter-hub__entity-tooltip-row" :class="changedRowClass('aliases')">别名：{{ characterAliasLine }}</p>
        <template v-if="characterCategoryLines.length > 0">
          <p v-for="(line, i) in characterCategoryLines" :key="`cc-${i}`" class="chapter-hub__entity-tooltip-row" :class="changedRowClass('categoryIds')">
            分类：{{ line }}
          </p>
        </template>
        <template v-if="characterFactionLines.length > 0">
          <p v-for="(line, i) in characterFactionLines" :key="`cf-${i}`" class="chapter-hub__entity-tooltip-row" :class="changedRowClass('memberships')">
            所属势力：{{ line }}
          </p>
        </template>
        <p v-else class="chapter-hub__entity-tooltip-row" :class="changedRowClass('memberships')">所属势力：未加入</p>
        <p class="chapter-hub__entity-tooltip-row" :class="changedRowClass('firstAppearanceChapterNo')">
          首次出场：第 {{ character.firstAppearanceChapterNo || '未设置' }} 章
        </p>
        <p class="chapter-hub__entity-tooltip-row" :class="changedRowClass('age')">年龄：{{ character.age || '未设置' }}</p>
        <p class="chapter-hub__entity-tooltip-row" :class="changedRowClass('gender')">性别：{{ character.gender || '未设置' }}</p>
        <template v-if="(character.attributes?.length ?? 0) > 0">
          <p
            v-for="attr in character.attributes"
            :key="attr.id"
            class="chapter-hub__entity-tooltip-row"
            :class="changedRowClass('attributes')"
          >
            {{ attr.key }}：{{ attr.value }}
          </p>
        </template>
      </template>
      <template v-else-if="tooltipFaction">
        <p class="chapter-hub__entity-tooltip-title">势力：{{ tooltipFaction.name }}</p>
        <template v-if="factionActiveChangeDetailLines.length > 0">
          <p
            v-for="(line, i) in factionActiveChangeDetailLines"
            :key="`fchg-${i}`"
            class="chapter-hub__entity-tooltip-row chapter-hub__entity-tooltip-row--changed"
          >
            变更：{{ line }}
          </p>
        </template>
        <p
          v-if="factionCategoryLines.length > 0 || factionRemovedCategoryNames.length > 0"
          class="chapter-hub__entity-tooltip-row chapter-hub__entity-tooltip-faction-categories"
          :class="factionChangedRowClass('categoryIds')"
        >
          <span class="chapter-hub__entity-tooltip-faction-categories-label">分类：</span>
          <span class="chapter-hub__entity-tooltip-faction-categories-values">
            <span
              v-for="(name, i) in factionCategoryLines"
              :key="`fc-${i}-${name}`"
              class="chapter-hub__entity-tooltip-faction-categories-name"
            >{{ name }}</span>
            <span
              v-for="name in factionRemovedCategoryNames"
              :key="`fc-removed-${name}`"
              class="chapter-hub__entity-tooltip-faction-categories-name chapter-hub__entity-tooltip-faction-categories-name--removed"
            >{{ name }}</span>
          </span>
        </p>
        <p class="chapter-hub__entity-tooltip-row" :class="factionChangedRowClass('leader')">
          领袖：{{ tooltipFaction.leader?.trim() || '未设置' }}
        </p>
        <template v-if="(tooltipFaction.attributes?.length ?? 0) > 0">
          <p
            v-for="attr in tooltipFaction.attributes"
            :key="attr.id"
            class="chapter-hub__entity-tooltip-row"
            :class="factionChangedRowClass('attributes')"
          >
            {{ attr.key }}：{{ attr.value }}
          </p>
        </template>
        <p class="chapter-hub__entity-tooltip-row" :class="factionChangedRowClass('notes')">
          势力备注：{{ tooltipFaction.notes?.trim() || '未设置' }}
        </p>
        <p class="chapter-hub__entity-tooltip-section">
          成员
          <span v-if="factionMemberTotal > 0" class="chapter-hub__entity-tooltip-section-count">
            （{{ factionMemberTotal }}）
          </span>
        </p>
        <div v-if="factionMemberTotal > 0" class="chapter-hub__entity-tooltip-members-wrap">
          <div class="chapter-hub__entity-tooltip-members scrollbar-paper">
            <p
              v-for="(row, i) in factionMemberRows"
              :key="`fm-${i}-${row.name}`"
              class="chapter-hub__entity-tooltip-row chapter-hub__entity-tooltip-row--faction-member"
              :class="{
                'chapter-hub__entity-tooltip-row--member-added': factionMembershipDelta.added.has(row.name),
                'chapter-hub__entity-tooltip-row--member-desc-changed': factionMembershipDelta.descChanged?.has(row.name),
              }"
            >
              <span class="chapter-hub__entity-tooltip-member-name">{{ row.name }}</span>
              <span v-if="row.description" class="chapter-hub__entity-tooltip-member-desc"> — {{ row.description }}</span>
              <span v-else class="chapter-hub__entity-tooltip-member-desc chapter-hub__entity-tooltip-member-desc--empty">
                （未填本势力内描述）
              </span>
            </p>
            <p
              v-for="name in factionRemovedMemberNames"
              :key="`fm-removed-${name}`"
              class="chapter-hub__entity-tooltip-row chapter-hub__entity-tooltip-row--faction-member chapter-hub__entity-tooltip-row--member-removed"
            >
              <span class="chapter-hub__entity-tooltip-member-name chapter-hub__entity-tooltip-member-name--removed">{{ name }}</span>
              <span class="chapter-hub__entity-tooltip-member-desc muted">（已去除）</span>
            </p>
          </div>
          <p v-if="factionMemberTotal > FACTION_TOOLTIP_MEMBER_LIMIT" class="chapter-hub__entity-tooltip-scroll-hint muted">
            仅显示前 {{ FACTION_TOOLTIP_MEMBER_LIMIT }} 人；还有 {{ factionMemberTotal - FACTION_TOOLTIP_MEMBER_LIMIT }} 人请在势力编辑中查看
          </p>
        </div>
        <p v-else class="chapter-hub__entity-tooltip-row muted">暂无绑定角色</p>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { normalizeCharacterAliases } from '../../../lib/characterLabels'
import {
  getCharacterChangeHistory,
  getCharacterChangeEventForPosition,
  getCharacterChangedFieldsForPosition,
  getFactionChangeHistory,
  getFactionChangeEventForPosition,
  getFactionChangedFieldsForPosition,
} from '../../../lib/storage'
import {
  FACTION_TOOLTIP_MEMBER_LIMIT,
  type FactionTooltipMemberRow,
} from '../../../features/chapter-hub/composables/useChapterHubEntityTooltip'
import type { Character, Faction } from '../../../types'

const props = defineProps<{
  open: boolean
  character: Character | null
  /** 悬停势力时展示（与 character 互斥） */
  tooltipFaction: Faction | null
  /** 悬停的“名字”元素边界（用于角点对齐定位） */
  anchorRect: DOMRect | null
  /** 角色悬停：多行「势力名」或「势力名：描述」 */
  characterFactionLines: string[]
  /** 角色分类（按名称展示） */
  characterCategoryLines: string[]
  /** 势力分类（按名称展示） */
  factionCategoryLines: string[]
  /** 势力悬停：绑定角色及在该势力中的身份描述（至多前 10 人） */
  factionMemberRows: FactionTooltipMemberRow[]
  /** 势力下绑定角色总人数（用于标题人数与「仅显示前 10」提示） */
  factionMemberTotal: number
  tooltipX: number
  tooltipY: number
  hoverTextRange: { start: number; end: number } | null
  currentChapterId: string
  textareaFocused: boolean
  textareaHasSelection: boolean
}>()

const tooltipRef = ref<HTMLElement | null>(null)
const measuredTooltipWidth = ref(320)
const measuredTooltipHeight = ref(220)
const tooltipVerticalPlacement = ref<'up' | 'down'>('down')
const tooltipHorizontalPlacement = ref<'left' | 'right'>('right')

/** 与样式中成员区 max-height 上限一致，用于估算提示框高度、避免贴底被裁 */
const FACTION_MEMBER_SCROLL_CAP = 240

const estimatedTooltipHeight = computed(() => {
  if (props.character) return 220
  if (props.tooltipFaction) {
    const f = props.tooltipFaction
    const catN = props.factionCategoryLines?.length ?? 0
    const attrN = f.attributes?.length ?? 0
    const shown = props.factionMemberRows?.length ?? 0
    const total = props.factionMemberTotal ?? 0
    const overflowHint = total > FACTION_TOOLTIP_MEMBER_LIMIT ? 36 : 0
    const memberBlock =
      shown > 0 ? Math.min(shown * 28 + 14, FACTION_MEMBER_SCROLL_CAP) + overflowHint + 6 : 28
    // 分类合并为一行展示（过长换行），高度按 1～2 行估算即可
    const catBlock = catN > 0 ? 22 + (catN > 5 ? 22 : 0) : 0
    let h = 124 + catBlock + attrN * 22 + memberBlock
    return Math.min(480, Math.max(168, h))
  }
  return 220
})

const tooltipStyle = computed(() => {
  const margin = 12
  const estimatedHeight = estimatedTooltipHeight.value
  const estimatedWidth = Math.max(220, measuredTooltipWidth.value || 320)
  const resolvedHeight = Math.max(120, measuredTooltipHeight.value || estimatedHeight)
  let top = props.tooltipY
  let left = props.tooltipX
  let transform = 'none'

  if (typeof window !== 'undefined') {
    const viewportH = window.innerHeight || 0
    const viewportW = window.innerWidth || 0
    const r = props.anchorRect
    if (r) {
      // 角点对齐（空间足够时严格重合）：
      // down-right: 名字右下角 = tooltip 左上角
      // up-right:   名字右上角 = tooltip 左下角
      // down-left:  名字左下角 = tooltip 右上角
      // up-left:    名字左上角 = tooltip 右下角
      const canDown = r.bottom + resolvedHeight <= viewportH - margin
      const canUp = r.top - resolvedHeight >= margin
      const canRight = r.right + estimatedWidth <= viewportW - margin
      const canLeft = r.left - estimatedWidth >= margin

      // 使用已锁定方向，避免因 tooltip 尺寸测量抖动而在底部反复翻转
      let placeUp = tooltipVerticalPlacement.value === 'up'
      let placeLeft = tooltipHorizontalPlacement.value === 'left'
      if (placeUp && !canUp && canDown) placeUp = false
      if (!placeUp && !canDown && canUp) placeUp = true
      if (placeLeft && !canLeft && canRight) placeLeft = false
      if (!placeLeft && !canRight && canLeft) placeLeft = true

      left = placeLeft ? r.left - estimatedWidth : r.right
      top = placeUp ? r.top - resolvedHeight : r.bottom

      // 兜底钳制（仅在角点方案无法完整放下时启用）
      top = Math.max(margin, Math.min(top, viewportH - resolvedHeight - margin))
      left = Math.max(margin, Math.min(left, viewportW - estimatedWidth - margin))
      transform = 'none'
    }
  }

  return {
    top: `${top}px`,
    left: `${left}px`,
    transform,
  }
})

async function measureTooltipSize(): Promise<void> {
  if (!props.open) return
  await nextTick()
  const el = tooltipRef.value
  if (!el) return
  const nextW = Math.ceil(el.offsetWidth || measuredTooltipWidth.value)
  const nextH = Math.ceil(el.offsetHeight || measuredTooltipHeight.value)
  if (Math.abs(nextW - measuredTooltipWidth.value) > 1) measuredTooltipWidth.value = nextW
  if (Math.abs(nextH - measuredTooltipHeight.value) > 1) measuredTooltipHeight.value = nextH
}

watch(
  () => [
    props.open,
    props.character?.id ?? '',
    props.tooltipFaction?.id ?? '',
    props.anchorRect?.left ?? 0,
    props.anchorRect?.top ?? 0,
    props.anchorRect?.right ?? 0,
    props.anchorRect?.bottom ?? 0,
  ],
  () => {
    void measureTooltipSize()
  },
  { flush: 'post' },
)

watch(
  () => [props.open, props.anchorRect?.left ?? 0, props.anchorRect?.top ?? 0, props.anchorRect?.bottom ?? 0, props.anchorRect?.right ?? 0],
  () => {
    if (!props.open) return
    if (typeof window === 'undefined') return
    const r = props.anchorRect
    if (!r) return
    const viewportH = window.innerHeight || 0
    const viewportW = window.innerWidth || 0
    tooltipVerticalPlacement.value = r.bottom > viewportH * 0.62 ? 'up' : 'down'
    tooltipHorizontalPlacement.value = r.right > viewportW * 0.68 ? 'left' : 'right'
  },
  { immediate: true },
)

const characterAliasLine = computed(() => {
  const character = props.character
  if (!character) return ''
  const aliases = normalizeCharacterAliases(character.aliases)
    .filter((alias) => alias !== character.name.trim())
  return aliases.join('、')
})

const changedFieldSet = computed<Set<string>>(() => {
  const c = props.character
  if (!c) return new Set<string>()
  const range = props.hoverTextRange
  if (!props.currentChapterId || !range) return new Set<string>()
  return new Set(getCharacterChangedFieldsForPosition(c.id, props.currentChapterId, range.start))
})

const factionChangedFieldSet = computed<Set<string>>(() => {
  const f = props.tooltipFaction
  if (!f) return new Set<string>()
  const range = props.hoverTextRange
  if (!props.currentChapterId || !range) return new Set<string>()
  return new Set(getFactionChangedFieldsForPosition(f.id, props.currentChapterId, range.start))
})

const activeChangeDetailLines = computed(() => {
  const c = props.character
  const range = props.hoverTextRange
  if (!c || !props.currentChapterId || !range) return [] as string[]
  const event = getCharacterChangeEventForPosition(c.id, props.currentChapterId, range.start)
  if (!event) return [] as string[]
  const details = normalizeEventDetailsByChapterTimeline(getCharacterChangeHistory(c.id), props.currentChapterId, event)
  const out: string[] = []
  const partsByKey = new Map<string, { label: string; parts: string[] }>()
  for (const d of details) {
    const field = String(d.field ?? '').trim()
    const location = String(d.location ?? '').trim()
    if (!field || !location) continue
    const key = `${location}::${field}`
    const label = location
    const part = `${d.before || '空'} -> ${d.after || '空'}`
    if (!partsByKey.has(key)) partsByKey.set(key, { label, parts: [] })
    partsByKey.get(key)!.parts.push(part)
  }
  for (const row of partsByKey.values()) {
    out.push(`${row.label}：${row.parts.join('、')}`)
  }
  return out
})

const factionActiveChangeDetailLines = computed(() => {
  const f = props.tooltipFaction
  const range = props.hoverTextRange
  if (!f || !props.currentChapterId || !range) return [] as string[]
  const event = getFactionChangeEventForPosition(f.id, props.currentChapterId, range.start)
  if (!event) return [] as string[]
  const details = normalizeEventDetailsByChapterTimeline(getFactionChangeHistory(f.id), props.currentChapterId, event)

  const cleanLocation = (raw: string): string => {
    const s = String(raw ?? '').trim()
    if (!s) return ''
    return s.replace(/^角色档案\//, '').replace(/^势力档案\//, '')
  }

  const parseNamesBySep = (raw: string, sep: string): string[] => {
    const text = String(raw ?? '').trim()
    if (!text) return []
    return text
      .split(sep)
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
  }

  const parseMembershipMap = (raw: string): Map<string, string> => {
    const text = String(raw ?? '').trim()
    const out = new Map<string, string>()
    if (!text) return out
    for (const partRaw of text.split('；')) {
      const part = String(partRaw ?? '').trim()
      if (!part) continue
      const sep = part.includes('：') ? '：' : part.includes(':') ? ':' : ''
      const name = sep ? String(part.split(sep)[0] ?? '').trim() : part.trim()
      const desc = sep ? String(part.split(sep).slice(1).join(sep) ?? '').trim() : ''
      if (!name) continue
      out.set(name, desc)
    }
    return out
  }

  const out: string[] = []
  const partsByKey = new Map<string, { label: string; parts: string[] }>()
  const pushPart = (key: string, label: string, part: string): void => {
    if (!partsByKey.has(key)) partsByKey.set(key, { label, parts: [] })
    partsByKey.get(key)!.parts.push(part)
  }

  for (const d of details) {
    const field = String(d.field ?? '').trim()
    const location = cleanLocation(d.location ?? '')
    if (field === 'memberships') {
      const beforeMap = parseMembershipMap(d.before)
      const afterMap = parseMembershipMap(d.after)
      const beforeNames = new Set(beforeMap.keys())
      const afterNames = new Set(afterMap.keys())
      const added = Array.from(afterNames).filter((n) => !beforeNames.has(n))
      const removed = Array.from(beforeNames).filter((n) => !afterNames.has(n))
      const changedDesc = Array.from(afterNames)
        .filter((n) => beforeNames.has(n))
        .filter((n) => String(beforeMap.get(n) ?? '').trim() !== String(afterMap.get(n) ?? '').trim())
        .map((n) => ({ name: n, before: beforeMap.get(n) ?? '', after: afterMap.get(n) ?? '' }))

      const label = location || '绑定角色'
      const key = `${location}::memberships`
      if (added.length) pushPart(key, label, `新增 ${added.join('、')}`)
      if (removed.length) pushPart(key, label, `去除 ${removed.join('、')}`)
      for (const row of changedDesc) {
        pushPart(key, label, `更新 ${row.name} 描述：${row.before || '空'} -> ${row.after || '空'}`)
      }
      continue
    }
    if (field === 'categoryIds') {
      const beforeNames = new Set(parseNamesBySep(d.before, '、'))
      const afterNames = new Set(parseNamesBySep(d.after, '、'))
      const added = Array.from(afterNames).filter((n) => !beforeNames.has(n))
      const removed = Array.from(beforeNames).filter((n) => !afterNames.has(n))
      const label = location || '分类'
      const key = `${location}::categoryIds`
      if (added.length) pushPart(key, label, `新增 ${added.join('、')}`)
      if (removed.length) pushPart(key, label, `去除 ${removed.join('、')}`)
      continue
    }
    if (field && location) {
      const key = `${location}::${field}`
      pushPart(key, location, `${d.before || '空'} -> ${d.after || '空'}`)
    }
  }
  for (const row of partsByKey.values()) {
    out.push(`${row.label} ${row.parts.join('、')}`)
  }
  return out
})

const factionCategoryDelta = computed(() => {
  const f = props.tooltipFaction
  const empty = { added: new Set<string>(), removed: new Set<string>() }
  const range = props.hoverTextRange
  if (!f || !props.currentChapterId || !range) return empty
  const event = getFactionChangeEventForPosition(f.id, props.currentChapterId, range.start)
  if (!event || !Array.isArray(event.details)) return empty
  const normalized = normalizeEventDetailsByChapterTimeline(getFactionChangeHistory(f.id), props.currentChapterId, event)
  const detail = normalized.find((d) => String(d.field ?? '').trim() === 'categoryIds')
  if (!detail) return empty
  const parse = (raw: string): Set<string> =>
    new Set(
      String(raw ?? '')
        .split('、')
        .map((x) => String(x ?? '').trim())
        .filter(Boolean),
    )
  const before = parse(detail.before)
  const after = parse(detail.after)
  return {
    added: new Set(Array.from(after).filter((n) => !before.has(n))),
    removed: new Set(Array.from(before).filter((n) => !after.has(n))),
  }
})

const factionRemovedCategoryNames = computed(() => {
  const removed = Array.from(factionCategoryDelta.value.removed)
  if (removed.length === 0) return []
  const current = new Set(props.factionCategoryLines ?? [])
  return removed.filter((n) => !current.has(n))
})

const factionMembershipDelta = computed(() => {
  const f = props.tooltipFaction
  const empty = { added: new Set<string>(), removed: new Set<string>(), descChanged: new Set<string>() }
  const range = props.hoverTextRange
  if (!f || !props.currentChapterId || !range) return empty
  const event = getFactionChangeEventForPosition(f.id, props.currentChapterId, range.start)
  if (!event || !Array.isArray(event.details)) return empty
  const normalized = normalizeEventDetailsByChapterTimeline(getFactionChangeHistory(f.id), props.currentChapterId, event)
  const membershipDetail = normalized.find((d) => String(d.field ?? '').trim() === 'memberships')
  if (!membershipDetail) return empty

  const parseMembershipMap = (raw: string): Map<string, string> => {
    const text = String(raw ?? '').trim()
    const out = new Map<string, string>()
    if (!text) return out
    for (const partRaw of text.split('；')) {
      const part = String(partRaw ?? '').trim()
      if (!part) continue
      const sep = part.includes('：') ? '：' : part.includes(':') ? ':' : ''
      const name = sep ? String(part.split(sep)[0] ?? '').trim() : part.trim()
      const desc = sep ? String(part.split(sep).slice(1).join(sep) ?? '').trim() : ''
      if (!name) continue
      out.set(name, desc)
    }
    return out
  }

  const beforeMap = parseMembershipMap(membershipDetail.before)
  const afterMap = parseMembershipMap(membershipDetail.after)
  const beforeNames = new Set(beforeMap.keys())
  const afterNames = new Set(afterMap.keys())
  const added = new Set(Array.from(afterNames).filter((n) => !beforeNames.has(n)))
  const removed = new Set(Array.from(beforeNames).filter((n) => !afterNames.has(n)))
  const descChanged = new Set(
    Array.from(afterNames)
      .filter((n) => beforeNames.has(n))
      .filter((n) => String(beforeMap.get(n) ?? '').trim() !== String(afterMap.get(n) ?? '').trim()),
  )
  return { added, removed, descChanged }
})

const factionRemovedMemberNames = computed(() => {
  const removed = Array.from(factionMembershipDelta.value.removed)
  if (removed.length === 0) return []
  const current = new Set((props.factionMemberRows ?? []).map((r) => r.name))
  return removed.filter((n) => !current.has(n))
})

function changedRowClass(fieldKey: string): Record<string, boolean> {
  const key = String(fieldKey ?? '').trim()
  if (!key) return {}
  return {
    'chapter-hub__entity-tooltip-row--changed': changedFieldSet.value.has(key),
  }
}

function factionChangedRowClass(fieldKey: string): Record<string, boolean> {
  const key = String(fieldKey ?? '').trim()
  if (!key) return {}
  return {
    'chapter-hub__entity-tooltip-row--changed': factionChangedFieldSet.value.has(key),
  }
}

function normalizeEventDetailsByChapterTimeline(
  history: Array<{
    chapterId?: string
    updatedAt?: string
    anchorStart?: number
    anchorEnd?: number
    details?: Array<{ field: string; location: string; before: string; after: string }>
  }>,
  chapterId: string,
  targetEvent: {
    updatedAt?: string
    anchorStart?: number
    anchorEnd?: number
    details?: Array<{ field: string; location: string; before: string; after: string }>
  },
): Array<{ field: string; location: string; before: string; after: string }> {
  const chId = String(chapterId ?? '').trim()
  if (!chId) return (targetEvent.details ?? []) as Array<{ field: string; location: string; before: string; after: string }>
  const timeline = history
    .filter((e) => String(e.chapterId ?? '').trim() === chId)
    .sort((a, b) => String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? '')))
  if (timeline.length === 0) return (targetEvent.details ?? []) as Array<{ field: string; location: string; before: string; after: string }>

  const normStart = (v: unknown) => (typeof v === 'number' ? Math.max(0, Math.floor(v)) : -1)
  const normEnd = (s: number, v: unknown) => {
    const endRaw = typeof v === 'number' ? Math.max(0, Math.floor(v)) : s + 1
    return Math.max(s + 1, endRaw)
  }

  const tS = normStart(targetEvent.anchorStart)
  const tE = normEnd(tS, targetEvent.anchorEnd)
  const targetKey = `${String(targetEvent.updatedAt ?? '')}::${tS}::${tE}`
  const targetIdx = timeline.findIndex((e) => {
    const s = normStart(e.anchorStart)
    const ed = normEnd(s, e.anchorEnd)
    return `${String(e.updatedAt ?? '')}::${s}::${ed}` === targetKey
  })
  const idx = targetIdx >= 0 ? targetIdx : timeline.length - 1

  // 同一章节内：同一“修改位置”（同一 anchor 区间）多次保存，悬停应折叠为一次：
  // before 取该位置第一次修改前（若此前章节内已有同字段修改，则以此前 after 为基准），after 取该位置最后一次 after。
  const anchorKeyForIdx = (i: number): string => {
    const e = timeline[i]
    const s = normStart(e.anchorStart)
    const ed = normEnd(s, e.anchorEnd)
    return `${s}:${ed}`
  }
  const targetAnchorKey = anchorKeyForIdx(idx)
  let firstIdx = idx
  let lastIdx = idx
  for (let i = idx - 1; i >= 0; i--) {
    if (anchorKeyForIdx(i) !== targetAnchorKey) break
    firstIdx = i
  }
  for (let i = idx + 1; i < timeline.length; i++) {
    if (anchorKeyForIdx(i) !== targetAnchorKey) break
    lastIdx = i
  }

  const prevAfterByField = new Map<string, string>()
  for (let i = 0; i < firstIdx; i++) {
    for (const d of timeline[i].details ?? []) {
      const field = String(d.field ?? '').trim()
      const location = String(d.location ?? '').trim()
      if (!field || !location) continue
      prevAfterByField.set(`${location}::${field}`, String(d.after ?? ''))
    }
  }

  const firstDetails = (timeline[firstIdx].details ?? []) as Array<{ field: string; location: string; before: string; after: string }>
  const lastDetails = (timeline[lastIdx].details ?? []) as Array<{ field: string; location: string; before: string; after: string }>

  const firstByKey = new Map<string, { field: string; location: string; before: string }>()
  for (const d of firstDetails) {
    const field = String(d.field ?? '').trim()
    const location = String(d.location ?? '').trim()
    if (!field || !location) continue
    const key = `${location}::${field}`
    if (!firstByKey.has(key)) firstByKey.set(key, { field, location, before: String(d.before ?? '') })
  }
  const lastAfterByKey = new Map<string, string>()
  for (const d of lastDetails) {
    const field = String(d.field ?? '').trim()
    const location = String(d.location ?? '').trim()
    if (!field || !location) continue
    const key = `${location}::${field}`
    lastAfterByKey.set(key, String(d.after ?? ''))
  }

  const out: Array<{ field: string; location: string; before: string; after: string }> = []
  for (const [key, first] of firstByKey.entries()) {
    const before = prevAfterByField.has(key) ? String(prevAfterByField.get(key) ?? '') : first.before
    const after = lastAfterByKey.get(key) ?? ''
    out.push({ field: first.field, location: first.location, before, after })
  }
  return out
}
</script>
