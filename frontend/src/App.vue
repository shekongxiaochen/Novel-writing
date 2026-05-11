<template>
  <main v-if="!isNovelContext" class="cursor-shell-home">
    <header class="cursor-shell-home__head">
      <h1 class="cursor-shell-home__title">小说工作台</h1>
      <div class="cursor-shell-home__head-actions">
        <button type="button" class="cursor-shell-home__theme-btn" @click="handleThemePickerClick">
          颜色主题 · {{ currentThemeOption.label }}
        </button>
        <div class="cursor-shell-home__auth-actions">
          <template v-if="isLoggedIn">
            <span class="cursor-shell-home__auth-name" :title="displayName">{{ displayName }}</span>
            <button type="button" class="cursor-shell__auth-btn" @click="logoutAndGo">退出</button>
          </template>
          <template v-else>
            <button type="button" class="cursor-shell__auth-btn" @click="goTo('/login')">登录</button>
            <button type="button" class="cursor-shell__auth-btn cursor-shell__auth-btn--secondary" @click="goTo('/register')">
              注册
            </button>
          </template>
        </div>
      </div>
    </header>
    <RouterView />
  </main>

  <main
    v-else
    class="cursor-shell cursor-shell--novel"
    :class="{ 'is-sidebar-collapsed': sidebarCollapsed, 'is-resizing-sidebar': isResizingSidebar }"
    :style="{ '--novel-sidebar-width': `${sidebarWidth}px` }"
  >
    <header class="cursor-shell__menu-bar">
      <button
        v-for="tab in workspaceTabs"
        :key="tab.key"
        type="button"
        class="cursor-shell__menu-item"
        :class="{ 'is-active': isWorkspaceTabActive(tab.key) }"
        :aria-current="isWorkspaceTabActive(tab.key) ? 'page' : undefined"
        @click="goWorkspaceTab(tab.key)"
      >
        <span class="cursor-shell__menu-title">{{ tab.label }}</span>
      </button>
      <div
        class="cursor-shell__menu-poem"
        :title="`${currentMenuPoem.line} —— ${currentMenuPoem.source}`"
      >
        <span class="cursor-shell__menu-poem-line">{{ currentMenuPoem.line }}</span>
        <span class="cursor-shell__menu-poem-source">—— {{ currentMenuPoem.source }}</span>
      </div>
      <button
        type="button"
        class="cursor-shell__collapse-btn cursor-shell__collapse-btn--menu"
        :title="sidebarCollapsed ? '展开章节导航' : '收起章节导航'"
        :aria-label="sidebarCollapsed ? '展开章节导航' : '收起章节导航'"
        @click="toggleSidebar"
      >
        <span class="cursor-shell__collapse-icon" aria-hidden="true"></span>
      </button>
      <div class="cursor-shell__auth-actions">
        <button type="button" class="cursor-shell__auth-btn cursor-shell__auth-btn--secondary" @click="handleThemePickerClick">
          颜色主题 · {{ currentThemeOption.label }}
        </button>
        <template v-if="isLoggedIn">
          <span class="cursor-shell__auth-name" :title="displayName">{{ displayName }}</span>
          <button type="button" class="cursor-shell__auth-btn cursor-shell__auth-btn--secondary" @click="logoutAndGo">退出</button>
        </template>
        <template v-else>
          <button type="button" class="cursor-shell__auth-btn" @click="goTo('/login')">登录</button>
          <button type="button" class="cursor-shell__auth-btn cursor-shell__auth-btn--secondary" @click="goTo('/register')">
            注册
          </button>
        </template>
      </div>
    </header>
    <aside class="cursor-shell__sidebar cursor-shell__sidebar--chapters">
      <div class="cursor-shell__brand-row">
        <div class="cursor-shell__brand">{{ currentNovel?.title || '作品' }}</div>
      </div>
      <div class="cursor-shell__group-row">
        <p class="cursor-shell__group-title">章节导航</p>
        <button type="button" class="cursor-shell__new-chapter-mini" @click="openCreateChapterModal">新建章节</button>
      </div>
      <nav ref="chapterNavRef" class="cursor-shell__nav cursor-shell__chapter-list">
        <div class="cursor-shell__overview-row">
          <button type="button" class="cursor-shell__nav-btn cursor-shell__overview-btn" @click="goWorkspaceTab('write')">
            <span class="cursor-shell__nav-text">总览</span>
          </button>
        </div>
        <button
          v-for="ch in chapterList"
          :key="ch.id"
          :id="`cursor-shell-chapter-nav-${ch.id}`"
          type="button"
          class="cursor-shell__nav-btn cursor-shell__chapter-file"
          :class="{ 'is-active': activeChapterId === ch.id }"
          :title="`第${ch.chapterNo}章 ${ch.title || '未命名章节'}`"
          @click="openChapter(ch.id)"
          @dblclick.stop="renameChapter(ch.id, ch.title)"
          @contextmenu.prevent.stop="openChapterItemMenu($event, ch.id, ch.title)"
        >
          <span class="cursor-shell__nav-text">第{{ ch.chapterNo }}章 {{ ch.title || '未命名章节' }}</span>
          <span class="cursor-shell__chapter-meta" :title="`非空白字数：${chapterWordCount(ch.content)} 字`">
            {{ chapterWordCount(ch.content) }}
          </span>
        </button>
      </nav>
      <div class="cursor-shell__sidebar-foot">
        <button type="button" class="cursor-shell__side-action" @click="goWriting">开始码字</button>
        <button type="button" class="cursor-shell__side-action" @click="backToNovelListCreate">返回作品页</button>
      </div>
    </aside>
    <div class="cursor-shell__resize-handle" @mousedown.prevent="startResizeSidebar"></div>
    <section class="cursor-shell__main">
      <div v-if="route.name === 'novel-chapter-writing'" class="cursor-shell__chapter-top">
        <div class="cursor-shell__chapter-tabs" role="tablist" aria-label="打开的章节">
          <button
            v-for="ch in openChapters"
            :key="ch.id"
            type="button"
            class="cursor-shell__chapter-tab"
            :class="{ 'is-active': activeChapterId === ch.id }"
            :title="`第${ch.chapterNo}章 ${ch.title || '未命名章节'}`"
            @click="openChapter(ch.id)"
          >
            <span class="cursor-shell__chapter-tab-title">第{{ ch.chapterNo }}章 {{ ch.title || '未命名章节' }}</span>
            <span
              class="cursor-shell__chapter-tab-close"
              role="button"
              tabindex="0"
              @click.stop="closeChapterTab(ch.id)"
              @keydown.enter.stop.prevent="closeChapterTab(ch.id)"
            >
              ×
            </span>
          </button>
        </div>
        <div class="cursor-shell__chapter-top-actions">
          <button
            type="button"
            class="cursor-shell__chapter-top-btn"
            :class="{ 'is-active': rightPanelOpen && rightPanelActive === 'summary' }"
            :disabled="!activeChapterId"
            @click="toggleChapterSummary"
            title="展开/收起：章节总结"
          >
            章总结
          </button>
          <button
            type="button"
            class="cursor-shell__chapter-top-btn cursor-shell__chapter-top-btn--secondary"
            :class="{ 'is-active': rightPanelOpen && rightPanelActive === 'entities' }"
            :disabled="!activeChapterId"
            @click="toggleChapterEntities"
            title="展开/收起：本章角色/势力"
          >
            角色/势力
          </button>
        </div>
      </div>
      <div class="cursor-shell__content" :class="{ 'cursor-shell__content--writing': route.name === 'novel-chapter-writing' }">
        <RouterView />
      </div>

      <div
        v-if="route.name === 'novel-chapter-writing' && rightPanelOpen"
        class="cursor-shell__right-panel-overlay"
        @pointerdown.self="closeRightPanel"
      >
        <aside class="cursor-shell__right-panel" @pointerdown.stop>
          <header class="cursor-shell__right-panel-head">
            <div class="cursor-shell__right-panel-head-titles">
              <div class="cursor-shell__right-panel-title">
                {{ rightPanelActive === 'summary' ? '章节总结' : '本章角色 / 势力' }}
              </div>
              <div v-if="activeChapterForPanels" class="cursor-shell__right-panel-subtitle muted">
                第{{ activeChapterForPanels.chapterNo }}章 {{ activeChapterForPanels.title || '未命名章节' }}
              </div>
            </div>
            <button type="button" class="cursor-shell__right-panel-close" @click="closeRightPanel" aria-label="关闭侧边栏">×</button>
          </header>

          <div class="cursor-shell__right-panel-body">
            <section v-if="rightPanelActive === 'summary'">
              <textarea
                v-model="chapterSummaryDraft"
                class="cursor-shell__right-panel-textarea"
                rows="10"
                maxlength="800"
                placeholder="写下这一章发生了什么、推进了什么、留下了什么钩子（建议 2-6 句）。"
              />
              <div class="cursor-shell__right-panel-actions">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="cancelChapterSummary" :disabled="!activeChapterId">
                  取消
                </button>
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="saveChapterSummary" :disabled="!activeChapterId">
                  保存
                </button>
              </div>
            </section>

            <section v-else>
              <div class="cursor-shell__right-panel-note muted">自动从正文提取 + 记录本章新建/变更（仅展示）。</div>

              <div class="cursor-shell__chapter-entities-title" style="margin-bottom: 10px">
                本章修改记录（角色 {{ chapterChangedCharacters.length }} / 势力 {{ chapterChangedFactions.length }}）
              </div>
              <div class="cursor-shell__chapter-entities-grid" style="margin-bottom: 12px">
                <div class="cursor-shell__chapter-entities-col">
                  <div class="cursor-shell__chapter-entities-title">角色修改</div>
                  <div v-if="chapterChangedCharacters.length === 0" class="muted">本章未修改角色档案。</div>
                  <div v-for="row in chapterChangedCharacters" :key="`chg-char-${row.character.id}`" class="cursor-shell__chapter-entity-row">
                    <div class="cursor-shell__chapter-entity-head">
                      <span class="cursor-shell__chapter-entity-name">{{ row.character.name }}</span>
                      <span class="cursor-shell__chapter-entity-badge cursor-shell__chapter-entity-badge--warn">已修改</span>
                    </div>
                    <div v-if="row.updates.length" class="cursor-shell__chapter-entity-details">
                      <div v-for="(u, ui) in row.updates" :key="`${row.character.id}-upd-${ui}`" class="cursor-shell__chapter-entity-detail">
                        <div v-if="u.label" class="cursor-shell__chapter-entity-detail-title">{{ u.label }}</div>
                        <p v-for="(line, i) in u.lines" :key="`${row.character.id}-chg-line-${ui}-${i}`" class="cursor-shell__chapter-entity-fields">
                          变更：{{ line }}
                        </p>
                      </div>
                    </div>
                    <div v-else-if="row.changedFields.length" class="cursor-shell__chapter-entity-fields muted">变更字段：{{ row.changedFields.join('、') }}</div>
                  </div>
                </div>
                <div class="cursor-shell__chapter-entities-col">
                  <div class="cursor-shell__chapter-entities-title">势力修改</div>
                  <div v-if="chapterChangedFactions.length === 0" class="muted">本章未修改势力档案。</div>
                  <div v-for="row in chapterChangedFactions" :key="`chg-fac-${row.faction.id}`" class="cursor-shell__chapter-entity-row">
                    <div class="cursor-shell__chapter-entity-head">
                      <span class="cursor-shell__chapter-entity-name">{{ row.faction.name }}</span>
                      <span class="cursor-shell__chapter-entity-badge cursor-shell__chapter-entity-badge--warn">已修改</span>
                    </div>
                    <div v-if="row.updates.length" class="cursor-shell__chapter-entity-details">
                      <div v-for="(u, ui) in row.updates" :key="`${row.faction.id}-upd-${ui}`" class="cursor-shell__chapter-entity-detail">
                        <div v-if="u.label" class="cursor-shell__chapter-entity-detail-title">{{ u.label }}</div>
                        <p v-for="(line, i) in u.lines" :key="`${row.faction.id}-chg-line-${ui}-${i}`" class="cursor-shell__chapter-entity-fields">
                          变更：{{ line }}
                        </p>
                      </div>
                    </div>
                    <div v-else-if="row.changedFields.length" class="cursor-shell__chapter-entity-fields muted">变更字段：{{ row.changedFields.join('、') }}</div>
                  </div>
                </div>
              </div>

              <div class="cursor-shell__chapter-entities-grid">
                <div class="cursor-shell__chapter-entities-col">
                  <div class="cursor-shell__chapter-entities-title">
                    角色（{{ chapterInvolvedCharacters.length }}）
                  </div>
                  <div v-if="chapterInvolvedCharacters.length === 0" class="muted">未检测到角色。</div>
                  <div
                    v-for="row in chapterInvolvedCharacters"
                    :key="row.character.id"
                    class="cursor-shell__chapter-entity-row"
                  >
                    <div class="cursor-shell__chapter-entity-head">
                      <span class="cursor-shell__chapter-entity-name">{{ row.character.name }}</span>
                      <span v-if="row.isCreatedHere" class="cursor-shell__chapter-entity-badge">本章新建</span>
                      <span v-if="row.hasChangeHere" class="cursor-shell__chapter-entity-badge cursor-shell__chapter-entity-badge--warn">本章有改动</span>
                    </div>
                  </div>
                </div>

                <div class="cursor-shell__chapter-entities-col">
                  <div class="cursor-shell__chapter-entities-title">
                    势力（{{ chapterInvolvedFactions.length }}）
                  </div>
                  <div v-if="chapterInvolvedFactions.length === 0" class="muted">未检测到势力。</div>
                  <div
                    v-for="row in chapterInvolvedFactions"
                    :key="row.faction.id"
                    class="cursor-shell__chapter-entity-row"
                  >
                    <div class="cursor-shell__chapter-entity-head">
                      <span class="cursor-shell__chapter-entity-name">{{ row.faction.name }}</span>
                      <span v-if="row.isCreatedHere" class="cursor-shell__chapter-entity-badge">本章新建</span>
                      <span v-if="row.hasChangeHere" class="cursor-shell__chapter-entity-badge cursor-shell__chapter-entity-badge--warn">本章有改动</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </section>
    <Teleport to="body">
      <div
        v-if="chapterMenuOpen"
        class="cursor-shell-tab-menu"
        :style="{ left: `${chapterMenuX}px`, top: `${chapterMenuY}px` }"
        @pointerdown.stop
      >
        <button type="button" class="cursor-shell-tab-menu__item" @click="openRenameFromContextMenu">重命名</button>
        <button type="button" class="cursor-shell-tab-menu__item cursor-shell-tab-menu__item--danger" @click="openDeleteChapterConfirm">
          删除章节
        </button>
      </div>
      <div v-if="chapterEditorOpen" class="cursor-shell-modal" @pointerdown.self="closeChapterEditorModal">
        <div class="cursor-shell-modal__card" @pointerdown.stop>
          <h3 class="cursor-shell-modal__title">{{ chapterEditorMode === 'create' ? '新建章节' : '章节信息' }}</h3>
          <input
            ref="chapterEditorInputRef"
            v-model="chapterEditorValue"
            class="cursor-shell-modal__input"
            :placeholder="chapterEditorMode === 'create' ? '输入章节标题（可留空）' : '输入新标题'"
            @keydown.enter.prevent="submitChapterEditor"
          />
          <textarea
            v-model="chapterEditorAnnotationValue"
            class="cursor-shell-modal__input cursor-shell-modal__textarea"
            rows="3"
            maxlength="200"
            placeholder="章节注释 / 章总结（可选，建议 1-2 句）"
          />
          <div class="cursor-shell-modal__actions">
            <button type="button" class="cursor-shell-modal__btn" @click="closeChapterEditorModal">取消</button>
            <button type="button" class="cursor-shell-modal__btn cursor-shell-modal__btn--primary" @click="submitChapterEditor">
              确认
            </button>
          </div>
        </div>
      </div>
      <div v-if="chapterDeleteConfirmOpen && chapterDeletePreview" class="cursor-shell-modal" @pointerdown.self="closeDeleteChapterConfirm">
        <div class="cursor-shell-modal__card cursor-shell-modal__card--danger" @pointerdown.stop>
          <h3 class="cursor-shell-modal__title">删除章节确认</h3>
          <p class="muted">
            你将删除第{{ chapterDeletePreview.chapterNo }}章{{ chapterDeletePreview.chapterTitle ? `「${chapterDeletePreview.chapterTitle}」` : '' }}及其内容。
          </p>
          <ul class="cursor-shell-modal__danger-list">
            <li>角色：{{ chapterDeletePreview.charactersToDelete.length }} 个</li>
            <li>势力：{{ chapterDeletePreview.factionsToDelete.length }} 个</li>
            <li>伏笔：{{ chapterDeletePreview.foreshadowPlantsToDelete.length }} 条</li>
            <li>照应：{{ chapterDeletePreview.fulfillmentsToDeleteCount }} 条</li>
            <li>章节号前移：后续 {{ chapterDeletePreview.chaptersToRenumberCount }} 章</li>
          </ul>
          <p v-if="chapterDeletePreview.charactersToDelete.length" class="cursor-shell-modal__danger-note">
            将删除角色：{{ chapterDeletePreview.charactersToDelete.map((c) => c.name).join('、') }}
          </p>
          <p v-if="chapterDeletePreview.factionsToDelete.length" class="cursor-shell-modal__danger-note">
            将删除势力：{{ chapterDeletePreview.factionsToDelete.map((f) => f.name).join('、') }}
          </p>
          <div class="cursor-shell-modal__actions">
            <button type="button" class="cursor-shell-modal__btn" @click="closeDeleteChapterConfirm">取消</button>
            <button type="button" class="cursor-shell-modal__btn cursor-shell-modal__btn--danger" @click="confirmDeleteChapter">
              确认删除
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>

  <SaveToast
    :open="chapterSummarySaveToastOpen"
    title="保存成功"
    message="章节总结已保存。"
  />

  <ThemePickerPopover
    :open="isThemePickerOpen"
    :return-focus-el="themePickerReturnFocusEl"
    @close="closeThemePicker"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import {
  createChapter,
  deleteChapter,
  getChapterDeletePreview,
  getChaptersByNovelId,
  getNovelById,
  getCharactersByNovelId,
  getFactionsByNovelId,
  getCharacterChangeHistory,
  getFactionChangeHistory,
  hasCharacterChangeInChapter,
  hasFactionChangeInChapter,
  updateChapter,
} from './lib/storage'
import type { Chapter, Novel } from './types'
import type { CharacterChangeDetail } from './lib/storage'
import { currentThemeOption } from './composables/useTheme'
import { useAuth } from './composables/useAuth'
import { Teleport } from 'vue'
import { menuPoems } from './data/menuPoems'
import ThemePickerPopover from './components/ThemePickerPopover.vue'
import SaveToast from './components/SaveToast.vue'

const route = useRoute()
const router = useRouter()
const currentNovel = ref<Novel | null>(null)
const chapterList = ref<Chapter[]>([])
const chapterMenuOpen = ref(false)
const chapterMenuX = ref(0)
const chapterMenuY = ref(0)
const chapterMenuTargetId = ref('')
const chapterMenuTargetTitle = ref('')
const themePickerReturnFocusEl = ref<HTMLElement | null>(null)
const isThemePickerOpen = ref(false)

function handleThemePickerClick(event: MouseEvent): void {
  openThemePicker(event.currentTarget instanceof HTMLElement ? event.currentTarget : null)
}

function openThemePicker(returnFocusEl: HTMLElement | null): void {
  themePickerReturnFocusEl.value = returnFocusEl
  isThemePickerOpen.value = true
}

function closeThemePicker(): void {
  isThemePickerOpen.value = false
}

const chapterEditorOpen = ref(false)
const chapterEditorMode = ref<'create' | 'rename'>('create')
const chapterEditorTargetId = ref('')
const chapterEditorValue = ref('')
const chapterEditorAnnotationValue = ref('')
const chapterEditorInputRef = ref<HTMLInputElement | null>(null)
const chapterDeleteConfirmOpen = ref(false)
const chapterDeletePreview = ref<ReturnType<typeof getChapterDeletePreview>>(null)
const chapterNavRef = ref<HTMLElement | null>(null)
const sidebarCollapsed = ref(false)
const sidebarWidth = ref(272)
const isResizingSidebar = ref(false)
const openChapterIds = ref<string[]>([])

const { isLoggedIn, displayName, logout } = useAuth()

const SIDEBAR_WIDTH_KEY = 'novel-writing.sidebar-width'
const SIDEBAR_COLLAPSED_KEY = 'novel-writing.sidebar-collapsed'
const OPEN_CHAPTERS_KEY_PREFIX = 'novel-writing.open-chapters.'
const SIDEBAR_MIN = 248
const SIDEBAR_MAX = 520
const poemIndex = ref(0)
let poemRotateTimer: number | null = null

function chapterWordCount(content?: string | null): number {
  return String(content ?? '').replace(/\s/g, '').length
}

const currentMenuPoem = computed(() => {
  if (menuPoems.length === 0) return { line: '文心雕龙，笔落生花。', source: '系统诗词库' }
  const idx = ((poemIndex.value % menuPoems.length) + menuPoems.length) % menuPoems.length
  return menuPoems[idx]
})

const currentNovelId = computed(() => {
  const id = route.params.id ?? route.params.novelId
  const t = String(id ?? '').trim()
  return t || ''
})
const activeChapterId = computed(() => {
  const q = String(route.query.chapterId ?? '').trim()
  if (q) return q
  return route.name === 'novel-chapter-writing' ? (chapterList.value[0]?.id ?? '') : ''
})
const openChapters = computed(() =>
  openChapterIds.value
    .map((id) => chapterList.value.find((c) => c.id === id))
    .filter((c): c is Chapter => !!c)
)

const isNovelContext = computed(() => route.name === 'novel-workspace' || route.name === 'novel-chapter-writing')
const workspaceTabs = [
  { key: 'write' as const, label: '写作' },
  { key: 'outline' as const, label: '大纲' },
  { key: 'characters' as const, label: '角色' },
  { key: 'items' as const, label: '物品' },
  { key: 'factions' as const, label: '势力' },
  { key: 'categories' as const, label: '分类' },
  { key: 'issues' as const, label: '伏笔' },
]

function goTo(to: string): void {
  if (!to) return
  void router.push(to)
}

function logoutAndGo(): void {
  logout()
  goTo('/')
}

function backToNovelListCreate(): void {
  void router.push({ path: '/', query: { focus: 'create' } })
}

function goWorkspaceTab(tab: WorkspaceTabKey): void {
  if (!currentNovelId.value) return
  if (tab === 'write') {
    goWriting()
    return
  }
  void router.push({ path: `/novels/${currentNovelId.value}`, query: { ...route.query, tab } })
}

function goWriting(): void {
  if (!currentNovelId.value) return
  const hasContent = (v: string | null | undefined) => (v ?? '').trim().length > 0
  const contentChapters = chapterList.value.filter((c) => hasContent((c as { content?: string }).content))
  const targetId =
    [...contentChapters].sort((a, b) => b.chapterNo - a.chapterNo)[0]?.id ||
    chapterList.value[0]?.id

  if (targetId) {
    ensureChapterOpened(targetId)
    void router.push({
      path: `/novels/${currentNovelId.value}/chapter-writing`,
      query: { ...route.query, chapterId: targetId, jumpEnd: '1' },
    })
    return
  }
  void router.push({
    path: `/novels/${currentNovelId.value}/chapter-writing`,
    query: { ...route.query, jumpEnd: '1' },
  })
}

function scrollChapterNavToActive(chapterId: string): void {
  if (!chapterId || typeof document === 'undefined') return
  const nav = chapterNavRef.value
  if (!nav) return
  const el = document.getElementById(`cursor-shell-chapter-nav-${chapterId}`)
  if (!el) return
  try {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  } catch {
    el.scrollIntoView()
  }
}

const rightPanelOpen = ref(false)
const rightPanelActive = ref<'summary' | 'entities'>('summary')
const chapterSummaryDraft = ref('')
const chapterSummarySaveToastOpen = ref(false)
let chapterSummarySaveToastTimer: number | null = null

const activeChapterForPanels = computed(() => {
  const id = activeChapterId.value
  if (!id) return null
  return chapterList.value.find((c) => c.id === id) ?? null
})

function toggleChapterSummary(): void {
  if (rightPanelOpen.value && rightPanelActive.value === 'summary') {
    rightPanelOpen.value = false
    return
  }
  rightPanelActive.value = 'summary'
  rightPanelOpen.value = true
}

function toggleChapterEntities(): void {
  if (rightPanelOpen.value && rightPanelActive.value === 'entities') {
    rightPanelOpen.value = false
    return
  }
  // 写作时章节正文会频繁变动（同 tab 不触发 storage 事件），这里在打开面板前主动刷新一次，
  // 确保“本章出现的角色/势力”基于最新正文计算。
  reloadNovelContext()
  rightPanelActive.value = 'entities'
  rightPanelOpen.value = true
}

function closeRightPanel(): void {
  rightPanelOpen.value = false
}

function showChapterSummarySavedToast(): void {
  chapterSummarySaveToastOpen.value = true
  if (chapterSummarySaveToastTimer != null) window.clearTimeout(chapterSummarySaveToastTimer)
  chapterSummarySaveToastTimer = window.setTimeout(() => {
    chapterSummarySaveToastOpen.value = false
    chapterSummarySaveToastTimer = null
  }, 1800)
}

function cancelChapterSummary(): void {
  chapterSummaryDraft.value = activeChapterForPanels.value?.annotation ?? ''
  closeRightPanel()
}

function saveChapterSummary(): void {
  const ch = activeChapterForPanels.value
  if (!ch) return
  const summary = chapterSummaryDraft.value.trim()
  updateChapter({ id: ch.id, annotation: summary })
  chapterSummaryDraft.value = summary
  reloadNovelContext()
  closeRightPanel()
  showChapterSummarySavedToast()
}

watch(
  () => activeChapterId.value,
  (id) => {
    chapterSummaryDraft.value = activeChapterForPanels.value?.annotation ?? ''
    if (!id) return
    void nextTick(() => {
      requestAnimationFrame(() => scrollChapterNavToActive(id))
    })
  },
  { immediate: true },
)

type ChapterInvolvedCharacterRow = {
  character: { id: string; name: string; createdInChapterId?: string | null; aliases?: string[] }
  isCreatedHere: boolean
  hasChangeHere: boolean
  changedFields: string[]
  changeDetails: CharacterChangeDetail[]
}

type ChapterInvolvedFactionRow = {
  faction: { id: string; name: string; createdInChapterId?: string | null }
  isCreatedHere: boolean
  hasChangeHere: boolean
  changedFields: string[]
  changeDetails: CharacterChangeDetail[]
}

type ChapterChangeUpdate = { label: string; lines: string[] }
type ChapterChangedCharacterRow = ChapterInvolvedCharacterRow & { updates: ChapterChangeUpdate[] }
type ChapterChangedFactionRow = ChapterInvolvedFactionRow & { updates: ChapterChangeUpdate[] }

function aggregateChapterChanges(
  events: Array<{ fields?: string[]; details?: CharacterChangeDetail[] }>,
): { fields: string[]; details: CharacterChangeDetail[] } {
  const fields = Array.from(new Set(events.flatMap((e) => (e.fields ?? []).map((f) => String(f ?? '').trim()).filter(Boolean))))
  const detailMap = new Map<string, CharacterChangeDetail>()
  for (const ev of events) {
    for (const d of ev.details ?? []) {
      const field = String(d.field ?? '').trim()
      const location = String(d.location ?? '').trim()
      if (!field || !location) continue
      const key = `${location}::${field}`
      const before = String(d.before ?? '')
      const after = String(d.after ?? '')
      const prev = detailMap.get(key)
      if (!prev) detailMap.set(key, { field, location, before, after })
      else detailMap.set(key, { ...prev, after })
    }
  }
  return { fields, details: Array.from(detailMap.values()) }
}

function includesAnyLabel(content: string, labels: string[]): boolean {
  const text = String(content ?? '')
  if (!text) return false
  for (const raw of labels) {
    const s = String(raw ?? '').trim()
    if (!s) continue
    if (text.includes(s)) return true
  }
  return false
}

function cleanChangeLocation(raw: string): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  return s.replace(/^角色档案\//, '').replace(/^势力档案\//, '')
}

function parseNamesBySep(raw: string, sep: string): string[] {
  const text = String(raw ?? '').trim()
  if (!text) return []
  return text
    .split(sep)
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
}

function parseMembershipMap(raw: string): Map<string, string> {
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

function formatChangeLines(details: CharacterChangeDetail[], mode: 'character' | 'faction'): string[] {
  const partsByKey = new Map<string, { label: string; parts: string[] }>()
  const pushPart = (key: string, label: string, part: string): void => {
    if (!partsByKey.has(key)) partsByKey.set(key, { label, parts: [] })
    partsByKey.get(key)!.parts.push(part)
  }
  for (const d of details) {
    const field = String(d.field ?? '').trim()
    const location = cleanChangeLocation(d.location ?? '')
    if (!field) continue
    if (mode === 'faction' && field === 'memberships') {
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
      for (const row of changedDesc) pushPart(key, label, `更新 ${row.name} 描述：${row.before || '空'} -> ${row.after || '空'}`)
      continue
    }
    if (mode === 'faction' && field === 'categoryIds') {
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
    const key = `${location}::${field}`
    pushPart(key, location || field, `${d.before || '空'} -> ${d.after || '空'}`)
  }
  return Array.from(partsByKey.values()).map((row) =>
    mode === 'faction' ? `${row.label} ${row.parts.join('、')}` : `${row.label}：${row.parts.join('、')}`,
  )
}

function updateOrderLabel(index: number, total: number): string {
  if (total <= 1) return ''
  const zhNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  const n = index + 1
  const nText =
    n <= 10
      ? zhNums[n]
      : n < 20
        ? `十${zhNums[n - 10]}`
        : n % 10 === 0
          ? `${zhNums[Math.floor(n / 10)]}十`
          : `${zhNums[Math.floor(n / 10)]}十${zhNums[n % 10]}`
  return `第${nText}次更新`
}

function anchorRangeKey(ev: { anchorStart?: number; anchorEnd?: number; updatedAt?: string }): string {
  if (typeof ev.anchorStart !== 'number') return `no-anchor:${String(ev.updatedAt ?? '')}`
  const s = Math.max(0, Math.floor(ev.anchorStart))
  const endRaw = typeof ev.anchorEnd === 'number' ? Math.max(0, Math.floor(ev.anchorEnd)) : s + 1
  const e = Math.max(s + 1, endRaw)
  return `${s}:${e}`
}

function aggregateEventDetails(
  events: Array<{ details?: CharacterChangeDetail[] }>,
): CharacterChangeDetail[] {
  const map = new Map<string, CharacterChangeDetail>()
  for (const ev of events) {
    for (const d of ev.details ?? []) {
      const field = String(d.field ?? '').trim()
      const location = String(d.location ?? '').trim()
      if (!field || !location) continue
      const key = `${location}::${field}`
      const before = String(d.before ?? '')
      const after = String(d.after ?? '')
      const prev = map.get(key)
      if (!prev) map.set(key, { field, location, before, after })
      else map.set(key, { ...prev, after })
    }
  }
  return Array.from(map.values())
}

function buildGroupedUpdates(
  events: Array<{ anchorStart?: number; anchorEnd?: number; updatedAt?: string; details?: CharacterChangeDetail[] }>,
  mode: 'character' | 'faction',
): ChapterChangeUpdate[] {
  if (events.length === 0) return []
  const ordered = [...events].sort((a, b) => String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? '')))
  const byKey = new Map<string, typeof ordered>()
  const keyOrder: string[] = []
  for (const ev of ordered) {
    const key = anchorRangeKey(ev)
    if (!byKey.has(key)) {
      byKey.set(key, [])
      keyOrder.push(key)
    }
    byKey.get(key)!.push(ev)
  }
  const total = keyOrder.length
  return keyOrder.map((key, idx) => {
    const groupedEvents = byKey.get(key) ?? []
    const details = aggregateEventDetails(groupedEvents)
    return {
      label: updateOrderLabel(idx, total),
      lines: formatChangeLines(details, mode),
    }
  })
}

const chapterInvolvedCharacters = computed<ChapterInvolvedCharacterRow[]>(() => {
  const novelId = currentNovelId.value
  const ch = activeChapterForPanels.value
  if (!novelId || !ch?.id) return []
  const content = ch.content ?? ''
  const all = getCharactersByNovelId(novelId)
  const involved = all.filter((c) => {
    if ((c.createdInChapterId ?? '') === ch.id) return true
    const labels = [c.name, ...(Array.isArray(c.aliases) ? c.aliases : [])].filter(Boolean)
    return includesAnyLabel(content, labels)
  })
  return involved
    .map((c) => {
      const history = getCharacterChangeHistory(c.id).filter((e) => String(e.chapterId ?? '').trim() === ch.id)
      const aggregated = aggregateChapterChanges(history)
      return {
        character: c,
        isCreatedHere: (c.createdInChapterId ?? '') === ch.id,
        hasChangeHere: hasCharacterChangeInChapter(c.id, ch.id),
        changedFields: aggregated.fields,
        changeDetails: aggregated.details,
      }
    })
    .sort((a, b) => a.character.name.localeCompare(b.character.name, 'zh-Hans'))
})

const chapterInvolvedFactions = computed<ChapterInvolvedFactionRow[]>(() => {
  const novelId = currentNovelId.value
  const ch = activeChapterForPanels.value
  if (!novelId || !ch?.id) return []
  const content = ch.content ?? ''
  const all = getFactionsByNovelId(novelId)
  const involved = all.filter((f) => {
    if ((f.createdInChapterId ?? '') === ch.id) return true
    return includesAnyLabel(content, [f.name])
  })
  return involved
    .map((f) => {
      const history = getFactionChangeHistory(f.id).filter((e) => String(e.chapterId ?? '').trim() === ch.id)
      const aggregated = aggregateChapterChanges(history)
      return {
        faction: f,
        isCreatedHere: (f.createdInChapterId ?? '') === ch.id,
        hasChangeHere: hasFactionChangeInChapter(f.id, ch.id),
        changedFields: aggregated.fields,
        changeDetails: aggregated.details,
      }
    })
    .sort((a, b) => a.faction.name.localeCompare(b.faction.name, 'zh-Hans'))
})

const chapterChangedCharacters = computed<ChapterChangedCharacterRow[]>(() =>
  chapterInvolvedCharacters.value
    .filter((row) => row.hasChangeHere)
    .map((row) => {
      const ch = activeChapterForPanels.value
      const events = ch
        ? getCharacterChangeHistory(row.character.id)
            .filter((e) => String(e.chapterId ?? '').trim() === ch.id)
            .sort((a, b) => String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? '')))
        : []
      const updates = buildGroupedUpdates(events, 'character')
      return { ...row, updates }
    }),
)
const chapterChangedFactions = computed<ChapterChangedFactionRow[]>(() =>
  chapterInvolvedFactions.value
    .filter((row) => row.hasChangeHere)
    .map((row) => {
      const ch = activeChapterForPanels.value
      const events = ch
        ? getFactionChangeHistory(row.faction.id)
            .filter((e) => String(e.chapterId ?? '').trim() === ch.id)
            .sort((a, b) => String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? '')))
        : []
      const updates = buildGroupedUpdates(events, 'faction')
      return { ...row, updates }
    }),
)

function openChapter(chapterId: string): void {
  if (!currentNovelId.value || !chapterId) return
  ensureChapterOpened(chapterId)
  void router.push({
    path: `/novels/${currentNovelId.value}/chapter-writing`,
    query: { ...route.query, chapterId },
  })
}

function ensureChapterOpened(chapterId: string): void {
  if (!chapterId) return
  if (!openChapterIds.value.includes(chapterId)) {
    openChapterIds.value = [...openChapterIds.value, chapterId]
  }
  persistOpenChapters()
}

function closeChapterTab(chapterId: string): void {
  const next = openChapterIds.value.filter((id) => id !== chapterId)
  if (next.length === 0) return
  const wasActive = activeChapterId.value === chapterId
  openChapterIds.value = next
  persistOpenChapters()
  if (wasActive) {
    const fallback = next[next.length - 1]
    openChapter(fallback)
  }
}

function openChapterItemMenu(e: MouseEvent, chapterId: string, title: string): void {
  const PAD = 8
  const MENU_W = 172
  const MENU_H = 76
  chapterMenuX.value = Math.max(PAD, Math.min(e.clientX, window.innerWidth - MENU_W - PAD))
  chapterMenuY.value = Math.max(PAD, Math.min(e.clientY, window.innerHeight - MENU_H - PAD))
  chapterMenuTargetId.value = chapterId
  chapterMenuTargetTitle.value = title ?? ''
  chapterMenuOpen.value = true
}

function closeChapterAreaMenu(): void {
  chapterMenuOpen.value = false
  chapterMenuTargetId.value = ''
  chapterMenuTargetTitle.value = ''
}

function openDeleteChapterConfirm(): void {
  const id = chapterMenuTargetId.value
  if (!id) return
  chapterDeletePreview.value = getChapterDeletePreview(id)
  chapterDeleteConfirmOpen.value = !!chapterDeletePreview.value
  closeChapterAreaMenu()
}

function closeDeleteChapterConfirm(): void {
  chapterDeleteConfirmOpen.value = false
  chapterDeletePreview.value = null
}

function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed.value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function createChapterFromSidebar(): void {
  openCreateChapterModal()
}

function renameChapter(chapterId: string, oldTitle: string): void {
  chapterEditorMode.value = 'rename'
  chapterEditorTargetId.value = chapterId
  chapterEditorValue.value = oldTitle ?? ''
  chapterEditorAnnotationValue.value = chapterList.value.find((c) => c.id === chapterId)?.annotation ?? ''
  chapterEditorOpen.value = true
  void nextTick(() => {
    const input = chapterEditorInputRef.value
    if (!input) return
    input.focus()
    input.select()
  })
}

function openRenameFromContextMenu(): void {
  const id = chapterMenuTargetId.value
  if (!id) {
    closeChapterAreaMenu()
    return
  }
  const oldTitle = chapterMenuTargetTitle.value
  closeChapterAreaMenu()
  renameChapter(id, oldTitle)
}

function openCreateChapterModal(): void {
  chapterEditorMode.value = 'create'
  chapterEditorTargetId.value = ''
  chapterEditorValue.value = ''
  chapterEditorAnnotationValue.value = ''
  chapterEditorOpen.value = true
  closeChapterAreaMenu()
  void nextTick(() => {
    const input = chapterEditorInputRef.value
    if (!input) return
    input.focus()
    input.select()
  })
}

function closeChapterEditorModal(): void {
  chapterEditorOpen.value = false
  chapterEditorTargetId.value = ''
  chapterEditorValue.value = ''
  chapterEditorAnnotationValue.value = ''
}

function confirmDeleteChapter(): void {
  const preview = chapterDeletePreview.value
  if (!preview || !currentNovelId.value) return
  const deletingActive = activeChapterId.value === preview.chapterId
  const ok = deleteChapter(preview.chapterId)
  closeDeleteChapterConfirm()
  if (!ok) return
  reloadNovelContext()
  if (route.name !== 'novel-chapter-writing') return
  if (deletingActive) {
    const fallback = chapterList.value[0]?.id
    if (fallback) openChapter(fallback)
    else void router.push({ path: `/novels/${currentNovelId.value}/chapter-writing`, query: { ...route.query, chapterId: undefined } })
    return
  }
  const curId = activeChapterId.value
  if (curId && chapterList.value.some((c) => c.id === curId)) return
  const fallback = chapterList.value[0]?.id
  if (fallback) openChapter(fallback)
}

function submitChapterEditor(): void {
  const title = chapterEditorValue.value.trim()
  const annotation = chapterEditorAnnotationValue.value.trim()
  if (chapterEditorMode.value === 'create') {
    if (!currentNovelId.value) return
    const chapter = createChapter({ novelId: currentNovelId.value, title, notes: '', annotation })
    reloadNovelContext()
    ensureChapterOpened(chapter.id)
    openChapter(chapter.id)
    closeChapterEditorModal()
    return
  }
  if (!chapterEditorTargetId.value) {
    closeChapterEditorModal()
    return
  }
  updateChapter({ id: chapterEditorTargetId.value, title, annotation })
  reloadNovelContext()
  closeChapterEditorModal()
}

function isWorkspaceTabActive(tab: WorkspaceTabKey): boolean {
  if (tab === 'write') return route.name === 'novel-chapter-writing' || String(route.query.tab ?? '') === 'write'
  return route.name === 'novel-workspace' && String(route.query.tab ?? 'write') === tab
}

function reloadNovelContext(): void {
  const id = currentNovelId.value
  if (!id) {
    currentNovel.value = null
    chapterList.value = []
    openChapterIds.value = []
    return
  }
  currentNovel.value = getNovelById(id)
  chapterList.value = getChaptersByNovelId(id)
  restoreOpenChapters()
}

function restoreOpenChapters(): void {
  const id = currentNovelId.value
  if (!id) return
  const validIds = new Set(chapterList.value.map((c) => c.id))
  let restored: string[] = []
  try {
    const raw = localStorage.getItem(`${OPEN_CHAPTERS_KEY_PREFIX}${id}`)
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) restored = parsed.map((x) => String(x)).filter((x) => validIds.has(x))
  } catch {
    restored = []
  }
  const activeId = String(route.query.chapterId ?? '').trim()
  if (activeId && validIds.has(activeId) && !restored.includes(activeId)) restored.push(activeId)
  if (!restored.length && chapterList.value[0]?.id) restored = [chapterList.value[0].id]
  openChapterIds.value = restored
  persistOpenChapters()
}

function persistOpenChapters(): void {
  const id = currentNovelId.value
  if (!id) return
  try {
    localStorage.setItem(`${OPEN_CHAPTERS_KEY_PREFIX}${id}`, JSON.stringify(openChapterIds.value))
  } catch {
    /* ignore */
  }
}

function onGlobalChapterSwitch(e: KeyboardEvent): void {
  if (route.name !== 'novel-chapter-writing') return
  if (!e.ctrlKey || e.key !== 'Tab') return
  const list = openChapterIds.value
  if (list.length <= 1) return
  e.preventDefault()
  const cur = activeChapterId.value
  const idx = Math.max(0, list.indexOf(cur))
  const nextIdx = e.shiftKey ? (idx - 1 + list.length) % list.length : (idx + 1) % list.length
  openChapter(list[nextIdx])
}

function onStorage(): void {
  reloadNovelContext()
}

function onNovelDataChanged(): void {
  reloadNovelContext()
}

function startResizeSidebar(e: MouseEvent): void {
  if (sidebarCollapsed.value) return
  const startX = e.clientX
  const startWidth = sidebarWidth.value
  isResizingSidebar.value = true
  document.body.classList.add('is-resizing-novel-sidebar')
  document.body.style.userSelect = 'none'

  const onMove = (ev: MouseEvent) => {
    const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startWidth + (ev.clientX - startX)))
    sidebarWidth.value = next
  }

  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    isResizingSidebar.value = false
    document.body.classList.remove('is-resizing-novel-sidebar')
    document.body.style.userSelect = ''
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth.value))
    } catch {
      /* ignore */
    }
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

try {
  const savedW = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? '')
  if (Number.isFinite(savedW) && savedW >= SIDEBAR_MIN && savedW <= SIDEBAR_MAX) sidebarWidth.value = savedW
  sidebarCollapsed.value = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
} catch {
  /* ignore */
}

onMounted(() => window.addEventListener('storage', onStorage))
onMounted(() => window.addEventListener('novel-writing:changed', onNovelDataChanged))
onMounted(() => window.addEventListener('pointerdown', closeChapterAreaMenu))
onMounted(() => window.addEventListener('keydown', onGlobalChapterSwitch))
onMounted(() => window.addEventListener('keydown', onEscapeCloseChapterModal))
onMounted(() => {
  if (menuPoems.length > 0) poemIndex.value = Math.floor(Math.random() * menuPoems.length)
  if (menuPoems.length > 1) {
    poemRotateTimer = window.setInterval(() => {
      poemIndex.value = (poemIndex.value + 1) % menuPoems.length
    }, 16000)
  }
})
onUnmounted(() => window.removeEventListener('storage', onStorage))
onUnmounted(() => window.removeEventListener('novel-writing:changed', onNovelDataChanged))
onUnmounted(() => window.removeEventListener('pointerdown', closeChapterAreaMenu))
onUnmounted(() => window.removeEventListener('keydown', onGlobalChapterSwitch))
onUnmounted(() => window.removeEventListener('keydown', onEscapeCloseChapterModal))
onUnmounted(() => {
  if (poemRotateTimer != null) window.clearInterval(poemRotateTimer)
  poemRotateTimer = null
  if (chapterSummarySaveToastTimer != null) window.clearTimeout(chapterSummarySaveToastTimer)
  chapterSummarySaveToastTimer = null
})
watch(() => route.fullPath, reloadNovelContext, { immediate: true })

function onEscapeCloseChapterModal(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (rightPanelOpen.value) {
    e.preventDefault()
    closeRightPanel()
    return
  }
  if (chapterDeleteConfirmOpen.value) {
    e.preventDefault()
    closeDeleteChapterConfirm()
    return
  }
  if (!chapterEditorOpen.value) return
  e.preventDefault()
  closeChapterEditorModal()
}
</script>

<style scoped>
.cursor-shell__chapter-top {
  display: flex;
  align-items: stretch;
  gap: 10px;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
}

.cursor-shell__chapter-tabs {
  flex: 1;
  display: flex;
  align-items: stretch;
  gap: 6px;
  padding: 10px 10px 8px;
  overflow-x: auto;
}

.cursor-shell__chapter-top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 8px 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.cursor-shell__chapter-top-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 12px;
  box-shadow: none;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.cursor-shell__chapter-top-btn:hover {
  border-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 34%, transparent);
  color: var(--color-text);
}

.cursor-shell__chapter-top-btn.is-active,
.cursor-shell__chapter-top-btn--secondary.is-active {
  border-color: color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary-soft) 62%, transparent);
  color: var(--color-primary);
  box-shadow: none;
}

.cursor-shell__chapter-top-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cursor-shell__right-panel-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, #000 28%, transparent);
  z-index: 60;
}

.cursor-shell__right-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: min(520px, 92vw);
  background: var(--color-surface);
  border-left: 1px solid color-mix(in srgb, var(--color-border-strong) 84%, transparent);
  box-shadow: -16px 0 36px rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
  animation: cursorShellRightPanelIn 140ms ease-out;
}

@keyframes cursorShellRightPanelIn {
  from {
    transform: translateX(14px);
    opacity: 0.95;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.cursor-shell__right-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--color-border);
}

.cursor-shell__right-panel-title {
  font-weight: 700;
}

.cursor-shell__right-panel-subtitle {
  font-size: 12px;
  margin-top: 2px;
}

.cursor-shell__right-panel-close {
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  font-family: inherit;
}

.cursor-shell__right-panel-close:hover {
  border-color: var(--color-primary);
}

.cursor-shell__right-panel-body {
  padding: 12px;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-text-muted) 42%, transparent)
    color-mix(in srgb, var(--color-border) 48%, transparent);
}

.cursor-shell__right-panel-body::-webkit-scrollbar {
  width: 10px;
}

.cursor-shell__right-panel-body::-webkit-scrollbar-track {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-border) 42%, transparent);
}

.cursor-shell__right-panel-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
  background: color-mix(in srgb, var(--color-text-muted) 44%, transparent);
}

.cursor-shell__right-panel-body::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--color-text) 35%, var(--color-primary) 18%);
}

[data-theme='dark'] .cursor-shell__right-panel-body {
  scrollbar-color: color-mix(in srgb, #cbd5e1 38%, transparent) color-mix(in srgb, #334155 58%, transparent);
}

[data-theme='dark'] .cursor-shell__right-panel-body::-webkit-scrollbar-track {
  background: color-mix(in srgb, #334155 58%, transparent);
}

[data-theme='dark'] .cursor-shell__right-panel-body::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, #cbd5e1 36%, transparent);
}

[data-theme='dark'] .cursor-shell__right-panel-body::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, #e2e8f0 46%, var(--color-primary) 18%);
}

.cursor-shell__right-panel-textarea {
  width: 100%;
  resize: vertical;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  padding: 10px 12px;
  outline: none;
  min-height: 220px;
}

.cursor-shell__right-panel-textarea:focus {
  border-color: var(--color-primary);
}

.cursor-shell__right-panel-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.cursor-shell__right-panel-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font-size: 12px;
}

.cursor-shell__right-panel-btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-primary-contrast, #fff);
}

.cursor-shell__right-panel-note {
  font-size: 12px;
  margin-bottom: 10px;
}

.cursor-shell__chapter-entities-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 980px) {
  .cursor-shell__chapter-entities-grid {
    grid-template-columns: 1fr;
  }
}

.cursor-shell__chapter-entities-title {
  font-weight: 650;
  margin-bottom: 8px;
}

.cursor-shell__chapter-entity-row {
  padding: 10px 10px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-surface) 92%, var(--color-border));
  margin-bottom: 8px;
}

.cursor-shell__chapter-entity-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cursor-shell__chapter-entity-name {
  font-weight: 650;
}

.cursor-shell__chapter-entity-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.cursor-shell__chapter-entity-badge--warn {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
}

.cursor-shell__chapter-entity-fields {
  margin-top: 6px;
  font-size: 12px;
}

.cursor-shell__chapter-entity-details {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

.cursor-shell__chapter-entity-detail {
  border-left: 3px solid color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
  padding-left: 10px;
}

.cursor-shell__chapter-entity-detail-title {
  font-size: 12px;
  font-weight: 650;
  margin-bottom: 4px;
}

.cursor-shell__chapter-entity-detail-body {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
  word-break: break-word;
}
</style>
