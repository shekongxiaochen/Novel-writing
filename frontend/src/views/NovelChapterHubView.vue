<template>
  <section
    class="page-block chapter-hub"
    :class="{ 'chapter-hub--empty': chapters.length === 0 }"
    v-if="novel"
  >
    <header ref="hubChromeAnchorRef" class="header-row chapter-hub__header">
      <div class="chapter-hub__intro">
        <p class="chapter-hub__eyebrow">
          <RouterLink :to="workspaceLink" class="chapter-hub__crumb-link">{{ novel.title }}</RouterLink>
        </p>
        <h1 class="chapter-hub__title">章节写作</h1>
        <p class="chapter-hub__lede muted">卷章目录、正文稿纸、笔记与字数；大纲在文末勾选关联。</p>
      </div>
      <RouterLink class="chapter-hub__back link-back" :to="workspaceLink">返回工作台</RouterLink>
    </header>

    <section class="card chapter-hub__top chapter-hub__composer">
      <div class="chapter-hub__composer-head">
        <h2 class="chapter-hub__composer-title">新建章节</h2>
        <p class="chapter-hub__composer-lede muted">插入目录末尾并自动编号，可随时在侧栏切换。</p>
      </div>
      <form class="chapter-hub__composer-form" @submit.prevent="handleCreateChapter">
        <div class="chapter-hub__composer-grid">
          <label class="chapter-hub__field">
            <span class="chapter-hub__field-label">章节标题</span>
            <input
              v-model="chapterForm.title"
              class="chapter-hub__input"
              maxlength="80"
              placeholder="例如：雨夜追踪"
            />
          </label>
          <label class="chapter-hub__field">
            <span class="chapter-hub__field-label">章节笔记</span>
            <input
              v-model="chapterForm.notes"
              class="chapter-hub__input"
              maxlength="200"
              placeholder="本章事件、情绪或结构备忘"
            />
          </label>
        </div>
        <div class="chapter-hub__composer-actions">
          <button type="submit" class="chapter-hub__btn chapter-hub__btn--primary">＋ 添加章节</button>
        </div>
      </form>
    </section>

    <template v-if="chapters.length > 0">
      <div class="split chapter-hub__split">
        <aside class="chapter-hub__sidebar chapter-hub__toc">
          <p class="chapter-hub__toc-kicker">目录</p>
          <h3 class="chapter-hub__sidebar-title">章节</h3>
          <div class="chapter-hub__list">
            <button
              v-for="c in chapters"
              :key="c.id"
              type="button"
              class="chapter-link chapter-hub__toc-item"
              :class="{ active: selectedChapterId === c.id }"
              @click="selectedChapterId = c.id"
            >
              <span class="chapter-hub__toc-no">第 {{ c.chapterNo }} 章</span>
              <span class="chapter-hub__toc-name">{{ c.title }}</span>
            </button>
          </div>
        </aside>

        <section class="chapter-hub__editor" v-if="selectedChapter">
          <div class="chapter-hub__editor-head">
            <div class="chapter-hub__editor-titleblock">
              <p class="chapter-hub__editor-kicker">当前章节</p>
              <h3 class="chapter-hub__editor-heading">第 {{ selectedChapter.chapterNo }} 章</h3>
              <p class="chapter-hub__editor-hint muted">正文在稿纸区落笔；元数据与大纲不打扰写作流。</p>
            </div>
            <div class="chapter-hub__editor-actions">
              <div class="chapter-hub__editor-metrics">
                <span class="chapter-hub__stat" title="正文非空白字符数">
                  <span class="chapter-hub__stat-value">{{ wordCount }}</span>
                  <span class="chapter-hub__stat-label">字</span>
                </span>
                <span
                  class="chapter-hub__status"
                  :data-done="selectedChapter.status === 'done' ? '1' : '0'"
                >
                  {{ selectedChapter.status === 'done' ? '已完成' : '草稿' }}
                </span>
              </div>
              <div class="chapter-hub__editor-buttons">
                <button
                  type="button"
                  class="chapter-hub__btn chapter-hub__btn--ghost"
                  @click="toggleDone(selectedChapter.id)"
                >
                  {{ selectedChapter.status === 'done' ? '改为草稿' : '标记完成' }}
                </button>
                <button
                  type="button"
                  class="chapter-hub__btn chapter-hub__btn--danger"
                  @click="openChapterDelete(selectedChapter.id)"
                >
                  删除
                </button>
              </div>
            </div>
          </div>

          <div class="chapter-hub__meta">
            <label class="chapter-hub__field">
              <span class="chapter-hub__field-label">章节标题</span>
              <input
                type="text"
                class="chapter-hub__input"
                :value="selectedChapter.title"
                maxlength="80"
                placeholder="与目录显示一致"
                @change="onChapterTitleChange(selectedChapter.id, $event)"
              />
            </label>
            <label class="chapter-hub__field">
              <span class="chapter-hub__field-label">章节笔记</span>
              <input
                class="chapter-hub__input"
                :value="selectedChapter.notes"
                maxlength="200"
                placeholder="目标、情绪、待写要点…"
                @change="onNotesChange(selectedChapter.id, $event)"
              />
            </label>
          </div>

          <div class="chapter-hub__write">
            <div class="chapter-hub__paper-column">
              <div class="paper-desk paper-desk--hub">
                <label class="chapter-hub__paper-label">
                  <span class="chapter-hub__write-label">正文稿纸</span>
                  <div
                    class="chapter-hub__textarea-wrap chapter-hub__textarea-wrap--overlay"
                    :class="{
                      'chapter-hub__textarea-wrap--writing': isChapterTextareaFocused,
                      'chapter-hub__textarea-wrap--overlay-show': shouldShowEntityOverlay,
                    }"
                  >
                    <div
                      class="chapter-hub__entity-overlay"
                      v-show="shouldShowEntityOverlay"
                    >
                      <template v-for="(line, lineIdx) in entityPreviewLines" :key="`line-${lineIdx}`">
                        <template v-for="(token, tokenIdx) in line" :key="`tok-${lineIdx}-${tokenIdx}`">
                          <span
                            v-if="token.character"
                            class="chapter-hub__entity-name chapter-hub__entity-name--link"
                            role="link"
                            tabindex="0"
                            @mouseenter="onEntityNameEnter($event, token.character)"
                            @mouseleave="onEntityNameLeave"
                            @click.stop="goToCharacter(token.character)"
                            @keydown.enter.prevent="goToCharacter(token.character)"
                          >
                            {{ token.text }}
                          </span>
                          <span
                            v-else-if="token.faction"
                            class="chapter-hub__entity-name chapter-hub__entity-name--faction"
                            :title="`势力：${token.text}`"
                            role="link"
                            tabindex="0"
                            @click.stop="goToFaction(token.faction)"
                            @keydown.enter.prevent="goToFaction(token.faction)"
                          >
                            {{ token.text }}
                          </span>
                          <span v-else>{{ token.text }}</span>
                        </template>
                        <br v-if="lineIdx < entityPreviewLines.length - 1" />
                      </template>
                    </div>
                    <textarea
                      class="textarea textarea-paper textarea-paper--hub chapter-hub__textarea"
                      :value="selectedChapter.content"
                      placeholder=""
                      spellcheck="false"
                      ref="chapterTextareaRef"
                      @input="onChapterContentInput(selectedChapter.id, $event)"
                      @keydown="onChapterTextareaKeydown"
                      @keyup="onChapterTextareaKeyup"
                      @mouseup="onChapterTextareaMouseup"
                      @select="onChapterTextareaSelect"
                      @focus="onChapterTextareaFocus"
                      @blur="onChapterTextareaBlur"
                    />
                    <div v-if="shouldShowChapterPlaceholder" class="chapter-hub__paper-placeholder">
                      在此落笔。
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div class="chapter-hub__outline">
            <div class="chapter-hub__outline-head">
              <p class="chapter-hub__outline-title">关联大纲</p>
              <p class="chapter-hub__outline-hint muted">与工作台「大纲」同步</p>
            </div>
            <div class="checklist chapter-hub__checklist" v-if="outlineItems.length > 0">
              <label v-for="o in outlineItems" :key="o.id" class="check-item">
                <input
                  type="checkbox"
                  :checked="selectedChapter.outlineItemIds.includes(o.id)"
                  @change="toggleChapterOutline(selectedChapter.id, o.id)"
                />
                <span>#{{ o.order }} · {{ o.title }}</span>
              </label>
            </div>
            <p v-else class="chapter-hub__outline-empty muted">暂无大纲情节点。可在工作台「大纲」中新增后再勾选。</p>
          </div>
        </section>
      </div>
    </template>

    <div v-else class="card chapter-hub__empty-card">
      <p class="chapter-hub__empty-title">尚未创建章节</p>
      <p class="muted chapter-hub__empty-text">在上方填写标题与笔记，添加首章后即可在右侧开始写作。</p>
    </div>

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

    <Teleport to="body">
      <div
        v-if="nameSuggestOpen && nameSuggestList.length > 0"
        class="chapter-hub__name-suggest"
        :class="{ 'chapter-hub__name-suggest--up': nameSuggestDirection === 'up' }"
        :style="nameSuggestStyle"
      >
        <button
          v-for="(item, idx) in nameSuggestList"
          :key="item.id"
          type="button"
          class="chapter-hub__name-suggest-item"
          :class="{ active: idx === nameSuggestIndex }"
          @mouseenter="nameSuggestIndex = idx"
          @mousedown.prevent="applyNameSuggestion(item.name)"
        >
          <span class="chapter-hub__name-suggest-name">{{ item.name }}</span>
          <span v-if="item.kind === 'faction'" class="chapter-hub__name-suggest-kind">势力</span>
        </button>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="ctxMenuOpen" class="chapter-hub__ctx-overlay" @click="closeCtxMenu">
        <div
          class="chapter-hub__ctx-menu"
          :style="{ top: `${ctxMenuY}px`, left: `${ctxMenuX}px` }"
          @click.stop
        >
          <p v-if="ctxMenuNotice" class="chapter-hub__ctx-notice">{{ ctxMenuNotice }}</p>
          <div class="chapter-hub__ctx-parent">
            添加为
            <div class="chapter-hub__ctx-sub">
              <button type="button" @click="addSelectionAsCharacter">角色</button>
              <button type="button" @click="addSelectionAsFaction">势力</button>
            </div>
          </div>
          <div v-if="ctxMenuSelectedCharacter" class="chapter-hub__ctx-parent">
            绑定势力
            <div class="chapter-hub__ctx-sub">
              <p class="chapter-hub__ctx-sub-heading">
                <template v-if="ctxMenuBoundFactionName">已绑定势力：{{ ctxMenuBoundFactionName }}</template>
                <template v-else>当前未绑定势力</template>
              </p>
              <button type="button" @click="bindFactionToSelectedCharacter(null)">
                <span class="chapter-hub__ctx-bind-faction-row">
                  未绑定
                  <span v-if="ctxMenuCharacterFactionUnbound" class="chapter-hub__ctx-bind-pill">当前</span>
                </span>
              </button>
              <button
                v-for="f in factions"
                :key="`bindf-${f.id}`"
                type="button"
                @click="bindFactionToSelectedCharacter(f.id)"
              >
                <span class="chapter-hub__ctx-bind-faction-row">
                  {{ f.name }}
                  <span v-if="ctxMenuFactionIsCurrent(f.id)" class="chapter-hub__ctx-bind-pill">当前</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="entityTooltipOpen && entityTooltipCharacter && !isChapterTextareaFocused && !hasTextareaSelection"
        class="chapter-hub__entity-tooltip"
        :style="{ top: `${entityTooltipY}px`, left: `${entityTooltipX}px` }"
      >
        <p class="chapter-hub__entity-tooltip-title">{{ entityTooltipCharacter.name }}</p>
        <p class="chapter-hub__entity-tooltip-row">所属势力：{{ entityTooltipFactionName }}</p>
        <p class="chapter-hub__entity-tooltip-row">首次出场：第 {{ entityTooltipCharacter.firstAppearanceChapterNo || '未设置' }} 章</p>
        <p class="chapter-hub__entity-tooltip-row">年龄：{{ entityTooltipCharacter.age || '未设置' }}</p>
        <p class="chapter-hub__entity-tooltip-row">性别：{{ entityTooltipCharacter.gender || '未设置' }}</p>
        <template v-if="(entityTooltipCharacter.attributes?.length ?? 0) > 0">
          <p
            v-for="attr in entityTooltipCharacter.attributes"
            :key="attr.id"
            class="chapter-hub__entity-tooltip-row"
          >
            {{ attr.key }}：{{ attr.value }}
          </p>
        </template>
      </div>
    </Teleport>

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
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { setChromeAnchor } from '../composables/useChromeAnchor'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import {
  createChapter,
  createCharacter,
  createFaction,
  deleteChapter,
  getCharactersByNovelId,
  getChaptersByNovelId,
  getFactionsByNovelId,
  getNovelById,
  getOutlineByNovelId,
  updateChapter,
  updateCharacter,
} from '../lib/storage'
import type { Chapter, Character, Novel, OutlineItem, Faction } from '../types'

const route = useRoute()
const router = useRouter()
const novelId = computed(() => String(route.params.novelId ?? ''))

const novel = computed<Novel | null>(() => getNovelById(novelId.value) ?? null)
const chapters = ref<Chapter[]>([])
const characters = ref<Character[]>([])
const factions = ref<Faction[]>([])
const outlineItems = ref<OutlineItem[]>([])
const selectedChapterId = ref('')
const chapterForm = reactive({
  title: '',
  notes: '',
})

const workspaceLink = computed(() => `/novels/${novelId.value}`)

const chapterTextareaRef = ref<HTMLTextAreaElement | null>(null)

// 两个“汉字宽度”的缩进：全角空格（U+3000）
const INDENT = '　　'

const isChapterTextareaFocused = ref(false)
const hasTextareaSelection = ref(false)

const hubChromeAnchorRef = ref<HTMLElement | null>(null)
watch(hubChromeAnchorRef, (el) => setChromeAnchor(el), { immediate: true })
onUnmounted(() => setChromeAnchor(null))

function reload() {
  chapters.value = getChaptersByNovelId(novelId.value)
  outlineItems.value = getOutlineByNovelId(novelId.value)
  characters.value = getCharactersByNovelId(novelId.value)
  factions.value = getFactionsByNovelId(novelId.value)
}

watch(novelId, () => reload(), { immediate: true })

watch(
  chapters,
  (list) => {
    const ids = new Set(list.map((c) => c.id))
    if (list.length === 0) {
      selectedChapterId.value = ''
    } else if (!selectedChapterId.value || !ids.has(selectedChapterId.value)) {
      selectedChapterId.value = list[0].id
    }
  },
  { immediate: true }
)

const selectedChapter = computed(() => chapters.value.find((c) => c.id === selectedChapterId.value) ?? null)

/** 悬停角色名时，与当前 factions 列表同步的势力显示名 */
const entityTooltipFactionName = computed(() => {
  const c = entityTooltipCharacter.value
  if (!c) return '—'
  const fid = c.factionId?.trim()
  if (!fid) return '未绑定'
  return factions.value.find((f) => f.id === fid)?.name ?? '未知势力'
})

type EntityToken = { text: string; character: Character | null; faction: Faction | null }

const entityPreviewLines = computed<EntityToken[][]>(() => {
  const content = selectedChapter.value?.content ?? ''
  const lines = content.split('\n')
  const chars = [...characters.value]
    .filter((c) => !!c.name)
    .sort((a, b) => b.name.length - a.name.length)
  const facs = [...factions.value]
    .filter((f) => !!f.name)
    .sort((a, b) => b.name.length - a.name.length)

  const entities = [
    ...chars.map((c) => ({ kind: 'character' as const, name: c.name, obj: c })),
    ...facs.map((f) => ({ kind: 'faction' as const, name: f.name, obj: f })),
  ].sort((a, b) => b.name.length - a.name.length)

  const tokenize = (line: string): EntityToken[] => {
    if (!line) return [{ text: '', character: null, faction: null }]
    const tokens: EntityToken[] = []
    let i = 0
    while (i < line.length) {
      let matchedChar: Character | null = null
      let matchedFaction: Faction | null = null
      let matchedLen = 0

      for (const e of entities) {
        if (line.startsWith(e.name, i)) {
          matchedLen = e.name.length
          if (e.kind === 'character') matchedChar = e.obj as Character
          else matchedFaction = e.obj as Faction
          break
        }
      }

      if (matchedLen > 0) {
        tokens.push({
          text: line.slice(i, i + matchedLen),
          character: matchedChar,
          faction: matchedFaction,
        })
        i += matchedLen
      } else {
        tokens.push({ text: line[i], character: null, faction: null })
        i += 1
      }
    }
    return tokens
  }

  return lines.map((l) => tokenize(l))
})

const isChapterContentEmpty = computed(() => {
  const c = selectedChapter.value?.content ?? ''
  // 去掉所有空白（包含全角空格）后为空，视为“没文字”
  const stripped = c.replace(/[ \u3000\n\r\t]/g, '')
  return stripped.length === 0
})

const shouldShowChapterPlaceholder = computed(() => isChapterContentEmpty.value && !isChapterTextareaFocused.value)
const shouldShowEntityOverlay = computed(() => !isChapterTextareaFocused.value && !hasTextareaSelection.value)

const nameSuggestOpen = ref(false)
const nameSuggestList = ref<Array<{ id: string; name: string; kind: 'character' | 'faction' }>>([])
const nameSuggestIndex = ref(0)
const nameSuggestRange = ref<{ start: number; end: number } | null>(null)
const nameSuggestDirection = ref<'down' | 'up'>('down')
const nameSuggestStyle = ref<Record<string, string>>({})
const forceSuggest = ref(false)

// 选中文本后“添加为”菜单
const ctxMenuOpen = ref(false)
const ctxMenuX = ref(0)
const ctxMenuY = ref(0)
const ctxMenuSelection = ref('')
const ctxMenuNotice = ref('')
const entityTooltipOpen = ref(false)
const entityTooltipCharacter = ref<Character | null>(null)
const entityTooltipX = ref(0)
const entityTooltipY = ref(0)
let entityTooltipTimer: ReturnType<typeof setTimeout> | null = null

function getTypingPrefixInfo(ta: HTMLTextAreaElement): { start: number; end: number; prefix: string } | null {
  const end = ta.selectionStart ?? 0
  const text = ta.value.slice(0, end)
  const m = text.match(/([\p{Script=Han}A-Za-z0-9_]+)$/u)
  if (!m || !m[1]) return null
  const prefix = m[1]
  return { start: end - prefix.length, end, prefix }
}

function resolveNamePrefix(textPrefix: string, names: string[]): { prefix: string; offsetFromEnd: number } | null {
  const s = textPrefix.trim()
  if (!s) return null

  const maxLen = Math.min(12, s.length)
  // 从长到短尝试“后缀”，让“他说陈”也能识别“陈”
  for (let len = maxLen; len >= 1; len--) {
    const suffix = s.slice(-len)
    if (!suffix) continue
    if (names.some((n) => n.startsWith(suffix))) {
      return { prefix: suffix, offsetFromEnd: len }
    }
  }
  return null
}

function updateNameSuggestion(ta: HTMLTextAreaElement): void {
  const info = getTypingPrefixInfo(ta)
  if (!info && !forceSuggest.value) {
    nameSuggestOpen.value = false
    nameSuggestList.value = []
    nameSuggestRange.value = null
    return
  }

  const prefixRaw = info?.prefix.trim() ?? ''
  if (!prefixRaw) {
    if (!forceSuggest.value) {
      nameSuggestOpen.value = false
      nameSuggestList.value = []
      nameSuggestRange.value = null
      return
    }
  }

  const characterNames = characters.value.map((c) => c.name).filter(Boolean)
  const factionNames = factions.value.map((f) => f.name).filter(Boolean)
  const allNames = [...characterNames, ...factionNames]
  const resolved = prefixRaw ? resolveNamePrefix(prefixRaw, allNames) : null
  const prefix = resolved?.prefix ?? prefixRaw

  // 已完整输入角色名时，自动收起补全（除非用户手动 Ctrl+Space 触发）
  if (!forceSuggest.value && allNames.includes(prefix)) {
    nameSuggestOpen.value = false
    nameSuggestList.value = []
    nameSuggestRange.value = null
    return
  }

  const normalizedPrefix = prefix.toLowerCase()
  const startsWithMatches = [
    ...characters.value
      .filter((c) => c.name && c.name.toLowerCase().startsWith(normalizedPrefix))
      .map((c) => ({ id: c.id, name: c.name, kind: 'character' as const })),
    ...factions.value
      .filter((f) => f.name && f.name.toLowerCase().startsWith(normalizedPrefix))
      .map((f) => ({ id: f.id, name: f.name, kind: 'faction' as const })),
  ]
  const includeMatches = [
    ...characters.value
      .filter((c) => c.name && !c.name.toLowerCase().startsWith(normalizedPrefix) && c.name.includes(prefix))
      .map((c) => ({ id: c.id, name: c.name, kind: 'character' as const })),
    ...factions.value
      .filter((f) => f.name && !f.name.toLowerCase().startsWith(normalizedPrefix) && f.name.includes(prefix))
      .map((f) => ({ id: f.id, name: f.name, kind: 'faction' as const })),
  ]

  const list = (prefix
    ? [...startsWithMatches, ...includeMatches]
    : [
        ...characters.value.map((c) => ({ id: c.id, name: c.name, kind: 'character' as const })),
        ...factions.value.map((f) => ({ id: f.id, name: f.name, kind: 'faction' as const })),
      ])
    .slice(0, 10)

  if (list.length === 0) {
    nameSuggestOpen.value = false
    nameSuggestList.value = []
    nameSuggestRange.value = null
    return
  }

  nameSuggestList.value = list
  nameSuggestOpen.value = true
  if (info) {
    if (resolved) {
      nameSuggestRange.value = {
        start: info.end - resolved.offsetFromEnd,
        end: info.end,
      }
    } else {
      nameSuggestRange.value = { start: info.start, end: info.end }
    }
  }
  if (nameSuggestIndex.value >= list.length) nameSuggestIndex.value = 0

  // VSCode 风格：提示框浮在页面层，依据可视区自动向上/向下展开
  const caretPos = info?.end ?? (ta.selectionStart ?? ta.value.length)
  const coords = getCaretPixelOffset(ta, caretPos)
  if (!coords) return

  const panelHeight = Math.min(260, list.length * 40 + 16)
  const panelWidth = Math.min(420, Math.max(240, ta.clientWidth * 0.72))
  const taRect = ta.getBoundingClientRect()
  const caretYViewport = taRect.top + (coords.top - ta.scrollTop)
  const caretXViewport = taRect.left + coords.left
  const lineHeight = Math.max(18, coords.height || 0)
  const viewportPad = 8
  const spaceBelow = window.innerHeight - (caretYViewport + lineHeight)
  const spaceAbove = caretYViewport
  const preferUp = spaceBelow < panelHeight + 8 && spaceAbove > panelHeight + 8

  const top = preferUp
    ? Math.max(viewportPad, caretYViewport - panelHeight - 6)
    : Math.min(window.innerHeight - panelHeight - viewportPad, caretYViewport + lineHeight + 6)
  const left = Math.min(
    Math.max(viewportPad, caretXViewport - 18),
    Math.max(viewportPad, window.innerWidth - panelWidth - viewportPad)
  )

  nameSuggestDirection.value = preferUp ? 'up' : 'down'
  nameSuggestStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${panelWidth}px`,
  }
}

function applyNameSuggestion(name: string): void {
  const chapter = selectedChapter.value
  const ta = chapterTextareaRef.value
  const range = nameSuggestRange.value
  if (!chapter || !ta || !range) return

  const current = ta.value ?? ''
  const nextValue = current.slice(0, range.start) + name + current.slice(range.end)
  const nextCaret = range.start + name.length

  updateChapter({ id: chapter.id, content: nextValue })
  const i = chapters.value.findIndex((c) => c.id === chapter.id)
  if (i >= 0) {
    chapters.value = chapters.value.map((c, j) => (j === i ? { ...c, content: nextValue } : c))
  }

  nameSuggestOpen.value = false
  nameSuggestList.value = []
  nameSuggestRange.value = null
  nameSuggestIndex.value = 0
  nameSuggestDirection.value = 'down'
  nameSuggestStyle.value = {}
  forceSuggest.value = false

  void nextTick(() => {
    ta.focus()
    ta.setSelectionRange(nextCaret, nextCaret)
    scrollCaretIntoView(ta, nextCaret)
  })
}

async function ensureFirstLineIndent(shouldSelect: boolean): Promise<void> {
  const c = selectedChapter.value
  if (!c) return
  if (c.content !== '') return

  const nextValue = INDENT
  updateChapter({ id: c.id, content: nextValue })
  chapters.value = chapters.value.map((x) => (x.id === c.id ? { ...x, content: nextValue } : x))

  await nextTick()
  if (shouldSelect) {
    chapterTextareaRef.value?.setSelectionRange(nextValue.length, nextValue.length)
  }
}

watch(selectedChapterId, async () => {
  await nextTick()
  // 切换章节时只补齐缩进，不强制聚焦，避免遮挡占位文案
  void ensureFirstLineIndent(false)
})

const wordCount = computed(() => {
  const t = selectedChapter.value?.content ?? ''
  return t.replace(/\s/g, '').length
})

const chapterDeleteOpen = ref(false)
const pendingDeleteChapterId = ref<string | null>(null)

const chapterDeleteMessage = computed(() => {
  const id = pendingDeleteChapterId.value
  if (!id) return ''
  const c = chapters.value.find((x) => x.id === id)
  if (!c) return ''
  return `即将删除「第 ${c.chapterNo} 章 · ${c.title}」。该章正文与笔记会一并移除，其余章节将按顺序重新编号。此操作无法撤销。`
})

function openChapterDelete(chapterId: string) {
  pendingDeleteChapterId.value = chapterId
  chapterDeleteOpen.value = true
}

function confirmChapterDelete() {
  const id = pendingDeleteChapterId.value
  pendingDeleteChapterId.value = null
  if (!id) return
  deleteChapter(id)
  reload()
}

function onChapterDeleteDialogCancel() {
  pendingDeleteChapterId.value = null
}

function handleCreateChapter() {
  if (!novel.value) return
  createChapter({
    novelId: novel.value.id,
    title: chapterForm.title,
    notes: chapterForm.notes,
  })
  chapterForm.title = ''
  chapterForm.notes = ''
  reload()
  const list = getChaptersByNovelId(novel.value.id)
  if (list.length > 0) {
    selectedChapterId.value = list[list.length - 1].id
  }
}

function toggleDone(chapterId: string) {
  const current = chapters.value.find((c) => c.id === chapterId)
  if (!current) return
  updateChapter({
    id: chapterId,
    status: current.status === 'done' ? 'draft' : 'done',
  })
  reload()
}

function onNotesChange(chapterId: string, event: Event) {
  const target = event.target as HTMLInputElement | null
  updateChapter({ id: chapterId, notes: target?.value ?? '' })
  reload()
}

function onChapterTitleChange(chapterId: string, event: Event) {
  const target = event.target as HTMLInputElement | null
  const t = target?.value?.trim() || '未命名章节'
  updateChapter({ id: chapterId, title: t })
  reload()
}

function onChapterContentInput(chapterId: string, event: Event) {
  const target = event.target as HTMLTextAreaElement | null
  const v = target?.value ?? ''
  updateChapter({ id: chapterId, content: v })
  const i = chapters.value.findIndex((c) => c.id === chapterId)
  if (i >= 0) {
    chapters.value = chapters.value.map((c, j) => (j === i ? { ...c, content: v } : c))
  }

  if (target) updateNameSuggestion(target)
}

function toggleChapterOutline(chapterId: string, outlineId: string) {
  const current = chapters.value.find((c) => c.id === chapterId)
  if (!current) return
  const set = new Set(current.outlineItemIds ?? [])
  if (set.has(outlineId)) set.delete(outlineId)
  else set.add(outlineId)
  updateChapter({ id: chapterId, outlineItemIds: Array.from(set) })
  reload()
}

function onChapterTextareaKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key.toLowerCase() === ' ') {
    e.preventDefault()
    forceSuggest.value = true
    const ta = chapterTextareaRef.value
    if (ta) updateNameSuggestion(ta)
    return
  }

  // Alt+Enter：对当前选中内容/光标所在词弹出“添加为 角色/势力”
  if (
    e.altKey &&
    (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13)
  ) {
    e.preventDefault()
    openCtxMenuFromSelection()
    return
  }

  if (nameSuggestOpen.value && nameSuggestList.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      nameSuggestIndex.value = (nameSuggestIndex.value + 1) % nameSuggestList.value.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      nameSuggestIndex.value =
        (nameSuggestIndex.value - 1 + nameSuggestList.value.length) % nameSuggestList.value.length
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      nameSuggestOpen.value = false
      nameSuggestList.value = []
      nameSuggestRange.value = null
      forceSuggest.value = false
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const pick = nameSuggestList.value[nameSuggestIndex.value]
      if (pick) applyNameSuggestion(pick.name)
      return
    }
  }

  if (e.key !== 'Enter') return
  // 只处理“手动换行”（单独回车）；不干预 Shift/Ctrl/Meta/Alt 组合
  if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
  if (!selectedChapter.value) return

  const ta = chapterTextareaRef.value
  if (!ta) return

  const start = ta.selectionStart ?? 0
  const end = ta.selectionEnd ?? start
  const current = selectedChapter.value.content ?? ''

  // 先空一行，再换行一次，并在新段落开头给“两汉字宽”的缩进
  const insert = `\n\n${INDENT}`
  const nextValue = current.slice(0, start) + insert + current.slice(end)

  e.preventDefault()

  updateChapter({ id: selectedChapter.value.id, content: nextValue })

  const i = chapters.value.findIndex((c) => c.id === selectedChapter.value!.id)
  if (i >= 0) {
    chapters.value = chapters.value.map((c, j) => (j === i ? { ...c, content: nextValue } : c))
  }

  const newPos = start + insert.length
  void nextTick(() => {
    ta.setSelectionRange(newPos, newPos)
    ta.focus()
    // 因为我们拦截并阻止了默认 Enter 行为，浏览器可能不会自动把视角滚到光标处；
    // 使用“测量光标像素坐标”来更准确地设置 scrollTop。
    scrollCaretIntoView(ta, newPos)
  })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getCaretPixelOffset(ta: HTMLTextAreaElement, position: number): { top: number; left: number; height: number } | null {
  if (typeof document === 'undefined') return null

  const style = window.getComputedStyle(ta)

  const div = document.createElement('div')
  const span = document.createElement('span')

  // 使用与 textarea 尽量一致的排版环境，来测量光标 marker 的 offsetTop
  div.style.position = 'absolute'
  div.style.visibility = 'hidden'
  div.style.whiteSpace = 'pre-wrap'
  div.style.wordWrap = 'break-word'
  div.style.overflow = 'hidden'

  // 关键：复制 textarea 的排版与内边距/宽度
  div.style.fontFamily = style.fontFamily
  div.style.fontSize = style.fontSize
  div.style.lineHeight = style.lineHeight
  div.style.letterSpacing = style.letterSpacing
  div.style.padding = style.padding
  div.style.width = `${ta.clientWidth}px`

  // border 在 offset 计算中不一定需要；我们只做 top/left 的相对对齐
  div.style.border = 'none'
  div.style.boxSizing = style.boxSizing

  const value = ta.value ?? ''
  const before = value.slice(0, position)
  const after = value.slice(position)

  // textarea 内的空格与换行在 HTML 中需要特殊处理
  const beforeHtml = escapeHtml(before).replace(/ {2}/g, ' &nbsp;').replace(/ /g, '&nbsp;').replace(/\n/g, '<br/>')
  const afterHtml = escapeHtml(after).replace(/ {2}/g, ' &nbsp;').replace(/ /g, '&nbsp;').replace(/\n/g, '<br/>')

  span.innerHTML = '&#8203;' // 零宽字符，用于占位

  div.innerHTML = `${beforeHtml}` + `<span id="caret-marker">${span.innerHTML}</span>` + `${afterHtml}`

  document.body.appendChild(div)
  const marker = div.querySelector('#caret-marker') as HTMLElement | null
  if (!marker) {
    document.body.removeChild(div)
    return null
  }

  const rect = marker.getBoundingClientRect()
  const divRect = div.getBoundingClientRect()

  const top = rect.top - divRect.top
  const left = rect.left - divRect.left
  const height = marker.offsetHeight || parseFloat(style.lineHeight || '0') || 0

  document.body.removeChild(div)
  return { top, left, height }
}

function onGlobalKeydownCapture(e: KeyboardEvent): void {
  const ta = chapterTextareaRef.value
  if (!ta) return
  if (document.activeElement !== ta) return

  if (
    e.altKey &&
    (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13)
  ) {
    e.preventDefault()
    e.stopPropagation()
    openCtxMenuFromSelection()
  }
}

function openCtxMenuForSelection(text: string, caretEnd: number): void {
  const ta = chapterTextareaRef.value
  if (!ta) return

  ctxMenuSelection.value = text
  ctxMenuNotice.value = ''

  const coords = getCaretPixelOffset(ta, caretEnd)
  if (!coords) return

  const taRect = ta.getBoundingClientRect()
  const caretYViewport = taRect.top + (coords.top - ta.scrollTop)
  const caretXViewport = taRect.left + coords.left

  const menuWidth = 180
  const menuHeight = 96
  const pad = 8

  let x = caretXViewport + 6
  let y = caretYViewport + (coords.height || 18) + 6
  if (x + menuWidth > window.innerWidth - pad) x = window.innerWidth - menuWidth - pad
  if (y + menuHeight > window.innerHeight - pad) {
    y = caretYViewport - menuHeight - 6
    if (y < pad) y = pad
  }

  ctxMenuX.value = x
  ctxMenuY.value = y
  ctxMenuOpen.value = true
}

function openCtxMenuAtPoint(text: string, x0: number, y0: number): void {
  ctxMenuSelection.value = text
  ctxMenuNotice.value = ''

  const menuWidth = 180
  const menuHeight = 96
  const pad = 8

  let x = x0
  let y = y0
  if (x + menuWidth > window.innerWidth - pad) x = window.innerWidth - menuWidth - pad
  if (y + menuHeight > window.innerHeight - pad) y = window.innerHeight - menuHeight - pad
  if (x < pad) x = pad
  if (y < pad) y = pad

  ctxMenuX.value = x
  ctxMenuY.value = y
  ctxMenuOpen.value = true
}

function openCtxMenuFromSelection(): void {
  const ta = chapterTextareaRef.value
  if (!ta || !selectedChapter.value) return

  const start = ta.selectionStart ?? 0
  const end = ta.selectionEnd ?? start

  if (end > start) {
    const selected = ta.value.slice(start, end).trim()
    if (!selected) return
    openCtxMenuForSelection(selected, end)
    return
  }

  // 无选区时：按光标所在词弹出（兼容之前 Alt+Enter 的用法）
  const text = ta.value ?? ''
  const pos = start
  const left = text.slice(0, pos)
  const right = text.slice(pos)
  const leftMatch = left.match(/([\p{Script=Han}A-Za-z0-9_]+)$/u)
  const rightMatch = right.match(/^([\p{Script=Han}A-Za-z0-9_]+)/u)
  const leftPart = leftMatch?.[1] ?? ''
  const rightPart = rightMatch?.[1] ?? ''
  const word = (leftPart + rightPart).trim()
  if (!word) return

  openCtxMenuForSelection(word, pos + rightPart.length)
}

function openCtxMenuForExplicitSelection(): void {
  const ta = chapterTextareaRef.value
  if (!ta || !selectedChapter.value) return

  const start = ta.selectionStart ?? 0
  const end = ta.selectionEnd ?? start
  if (end <= start) {
    closeCtxMenu()
    return
  }

  const selected = ta.value.slice(start, end).trim()
  if (!selected) {
    closeCtxMenu()
    return
  }
  openCtxMenuForSelection(selected, end)
}

function closeCtxMenu(): void {
  ctxMenuOpen.value = false
  ctxMenuNotice.value = ''
}

function addSelectionAsCharacter(): void {
  if (!novel.value) return
  const name = ctxMenuSelection.value.trim()
  if (!name) return

  createCharacter({
    novelId: novel.value.id,
    name,
    firstAppearanceChapterNo: selectedChapter.value?.chapterNo ?? null,
    age: '',
    gender: '',
    goal: '',
    secret: '',
    arc: '',
    notes: '',
  })
  characters.value = getCharactersByNovelId(novelId.value)
  closeCtxMenu()
}

function addSelectionAsFaction(): void {
  if (!novel.value) return
  const name = ctxMenuSelection.value.trim()
  if (!name) return

  const existed = factions.value.some((f) => (f.name ?? '').trim() === name)
  if (existed) {
    ctxMenuNotice.value = '已存在此势力'
    return
  }

  createFaction({
    novelId: novel.value.id,
    name,
    leader: '',
    goal: '',
    resource: '',
    relationToProtagonist: '',
    notes: '',
  })
  factions.value = getFactionsByNovelId(novelId.value)
  closeCtxMenu()
}

const ctxMenuSelectedCharacter = computed(() => {
  const name = ctxMenuSelection.value.trim()
  if (!name) return null
  return characters.value.find((c) => c.name.trim() === name) ?? null
})

/** 右键选中词对应角色当前绑定的势力名（无绑定则为空） */
const ctxMenuBoundFactionName = computed(() => {
  const c = ctxMenuSelectedCharacter.value
  const fid = (c?.factionId ?? '').trim()
  if (!fid) return ''
  return factions.value.find((f) => f.id === fid)?.name ?? ''
})

const ctxMenuCharacterFactionUnbound = computed(() => {
  const c = ctxMenuSelectedCharacter.value
  return !!c && !(c.factionId ?? '').trim()
})

function ctxMenuFactionIsCurrent(factionId: string): boolean {
  const c = ctxMenuSelectedCharacter.value
  if (!c) return false
  return (c.factionId ?? '').trim() === factionId
}

function bindFactionToSelectedCharacter(factionId: string | null): void {
  const c = ctxMenuSelectedCharacter.value
  if (!c) return
  updateCharacter({ id: c.id, factionId })
  characters.value = getCharactersByNovelId(novelId.value)
  ctxMenuNotice.value = factionId ? '已绑定势力' : '已取消绑定'
}

function goToCharacter(c: Character): void {
  onEntityNameLeave()
  void router.push({
    name: 'novel-workspace',
    params: { id: novelId.value },
    query: { tab: 'characters', focusCharacterId: c.id, scrollTo: 'characters-bottom' },
  })
}

function goToFaction(f: Faction): void {
  void router.push({
    name: 'novel-workspace',
    params: { id: novelId.value },
    query: { tab: 'factions', focusFactionId: f.id, scrollTo: 'factions-item' },
  })
}

function onEntityNameEnter(e: MouseEvent, c: Character): void {
  if (entityTooltipTimer) clearTimeout(entityTooltipTimer)
  entityTooltipTimer = window.setTimeout(() => {
    entityTooltipCharacter.value = c
    entityTooltipOpen.value = true
    entityTooltipX.value = Math.min(e.clientX + 12, window.innerWidth - 320)
    entityTooltipY.value = Math.max(12, e.clientY + 12)
  }, 300)
}

function onEntityNameLeave(): void {
  if (entityTooltipTimer) {
    clearTimeout(entityTooltipTimer)
    entityTooltipTimer = null
  }
  entityTooltipOpen.value = false
  entityTooltipCharacter.value = null
}


function scrollCaretIntoView(ta: HTMLTextAreaElement, caretPos: number): void {
  const coords = getCaretPixelOffset(ta, caretPos)
  if (!coords) return

  const style = window.getComputedStyle(ta)
  const paddingTop = parseFloat(style.paddingTop || '0') || 0

  // coords.top 包含 padding；textarea.scrollTop 不包含 padding 的这部分，所以需要扣掉
  const caretY = coords.top - paddingTop
  const caretBottom = caretY + (coords.height || 0)

  const viewTop = ta.scrollTop
  const viewBottom = viewTop + ta.clientHeight
  const pad = 18

  if (caretY < viewTop + pad) {
    ta.scrollTop = Math.max(0, caretY - pad)
  } else if (caretBottom > viewBottom - pad) {
    ta.scrollTop = Math.max(0, caretBottom - ta.clientHeight + pad)
  }
}

function onChapterTextareaFocus(): void {
  isChapterTextareaFocused.value = true
  void (async () => {
    await nextTick()
    // 聚焦时再确保光标在缩进处
    await ensureFirstLineIndent(true)
    // 如果已有内容但光标不在缩进处，这里不强制改动
    const ta2 = chapterTextareaRef.value
    if (ta2 && (selectedChapter.value?.content ?? '') === INDENT) {
      ta2.setSelectionRange(INDENT.length, INDENT.length)
    }
    if (ta2) updateNameSuggestion(ta2)
  })()
}

function onChapterTextareaKeyup(e: KeyboardEvent): void {
  const ta = chapterTextareaRef.value
  if (!ta) return
  hasTextareaSelection.value = (ta.selectionStart ?? 0) !== (ta.selectionEnd ?? 0)
  if (forceSuggest.value && (ta.selectionStart ?? 0) !== (ta.selectionEnd ?? 0)) {
    forceSuggest.value = false
  }
  updateNameSuggestion(ta)

  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    window.setTimeout(() => openCtxMenuForExplicitSelection(), 0)
  }
}

function onChapterTextareaMouseup(e: MouseEvent): void {
  const ta = chapterTextareaRef.value
  if (!ta || !selectedChapter.value) return

  window.setTimeout(() => {
    const start = ta.selectionStart ?? 0
    const end = ta.selectionEnd ?? start
    if (end <= start) {
      closeCtxMenu()
      return
    }
    const selected = ta.value.slice(start, end).trim()
    if (!selected) {
      closeCtxMenu()
      return
    }
    // 鼠标选区时优先贴近鼠标位置，呈现“右键菜单”感觉
    openCtxMenuAtPoint(selected, e.clientX + 6, e.clientY + 6)
  }, 0)
}

function onChapterTextareaSelect(): void {
  const ta = chapterTextareaRef.value
  if (ta) hasTextareaSelection.value = (ta.selectionStart ?? 0) !== (ta.selectionEnd ?? 0)
  if (hasTextareaSelection.value) onEntityNameLeave()
  // 比 mouseup 更稳定：无论左拖右拖还是键盘选区都能触发
  window.setTimeout(() => openCtxMenuForExplicitSelection(), 0)
}

function onChapterTextareaBlur(): void {
  isChapterTextareaFocused.value = false
  hasTextareaSelection.value = false
  window.setTimeout(() => {
    nameSuggestOpen.value = false
    nameSuggestList.value = []
    nameSuggestRange.value = null
    nameSuggestDirection.value = 'down'
    nameSuggestStyle.value = {}
    forceSuggest.value = false
    ctxMenuOpen.value = false
    onEntityNameLeave()
  }, 80)
}

function onWindowViewportChange(): void {
  if (!nameSuggestOpen.value) return
  const ta = chapterTextareaRef.value
  if (!ta) return
  updateNameSuggestion(ta)
}

if (typeof window !== 'undefined') {
  window.addEventListener('scroll', onWindowViewportChange, true)
  window.addEventListener('resize', onWindowViewportChange)
  window.addEventListener('keydown', onGlobalKeydownCapture, true)
}

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', onWindowViewportChange, true)
    window.removeEventListener('resize', onWindowViewportChange)
    window.removeEventListener('keydown', onGlobalKeydownCapture, true)
  }
  if (entityTooltipTimer) clearTimeout(entityTooltipTimer)
})
</script>
