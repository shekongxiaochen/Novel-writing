<template>
  <main v-if="!isNovelContext" class="cursor-shell-home">
    <header class="cursor-shell-home__head" data-tauri-drag-region>
      <h1 class="cursor-shell-home__title">Lumen 流明</h1>
      <div class="cursor-shell-home__head-actions">
        <template v-if="isLoggedIn">
          <button type="button" class="cursor-shell__menu-item cursor-shell__menu-item--utility" @click="handleLogout">
            <span class="cursor-shell__menu-title">退出</span>
          </button>
        </template>
        <template v-else>
          <button type="button" class="cursor-shell__menu-item cursor-shell__menu-item--utility" @click="goLogin">
            <span class="cursor-shell__menu-title">登录</span>
          </button>
          <button type="button" class="cursor-shell__menu-item cursor-shell__menu-item--utility" @click="goRegister">
            <span class="cursor-shell__menu-title">注册</span>
          </button>
        </template>
        <button type="button" class="cursor-shell__menu-item cursor-shell__menu-item--utility" @click="handleThemePickerClick">
          <span class="cursor-shell__menu-title">主题</span>
        </button>
        <WindowControls />
      </div>
    </header>
    <RouterView />
  </main>

  <main
    v-else
    class="cursor-shell cursor-shell--novel"
    :class="{ 'is-sidebar-collapsed': sidebarCollapsed, 'is-resizing-sidebar': isResizingSidebar }"
    :style="novelShellStyle"
  >
    <header class="cursor-shell__menu-bar" data-tauri-drag-region>
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
        <button type="button" class="cursor-shell__menu-item cursor-shell__menu-item--utility" @click="handleThemePickerClick">
          <span class="cursor-shell__menu-title">主题</span>
        </button>
        <button
          v-if="isLoggedIn"
          type="button"
          class="cursor-shell__menu-item cursor-shell__menu-item--utility"
          @click="handleLogout"
        >
          <span class="cursor-shell__menu-title">退出</span>
        </button>
        <button
          v-else
          type="button"
          class="cursor-shell__menu-item cursor-shell__menu-item--utility"
          @click="goLogin"
        >
          <span class="cursor-shell__menu-title">登录</span>
        </button>
        <button
          v-if="isWritingRoute"
          type="button"
          class="cursor-shell__menu-item cursor-shell__menu-item--utility"
          :class="{ 'is-active': rightPanelOpen && rightPanelActive === 'summary' }"
          :title="rightPanelOpen && rightPanelActive === 'summary' ? '收起章总结' : '展开章总结'"
          :aria-label="rightPanelOpen && rightPanelActive === 'summary' ? '收起章总结' : '展开章总结'"
          @click="toggleChapterSummarySidebar"
        >
          <span class="cursor-shell__menu-title">章总结</span>
        </button>
        <button
          v-if="isNovelContext"
          type="button"
          class="cursor-shell__menu-item cursor-shell__menu-item--utility"
          :class="{ 'is-active': aiWritingSettingsOpen }"
          title="AI 写作设定"
          aria-label="AI 写作设定"
          @click="openAiWritingSettings($event)"
        >
          <span class="cursor-shell__menu-title">AI 设定</span>
        </button>
        <button
          v-if="isWritingRoute"
          type="button"
          class="cursor-shell__menu-item cursor-shell__menu-item--utility"
          :class="{ 'is-active': aiStudioShellOpen }"
          :title="aiStudioShellOpen ? '收起 AI 阅读台' : '展开 AI 阅读台'"
          :aria-label="aiStudioShellOpen ? '收起 AI 阅读台' : '展开 AI 阅读台'"
          @click="toggleHeaderAiStudio"
        >
          <span class="cursor-shell__menu-title">AI</span>
        </button>
      </div>
      <WindowControls />
    </header>
    <aside class="cursor-shell__sidebar cursor-shell__sidebar--chapters">
      <div class="cursor-shell__brand-row">
        <button type="button" class="cursor-shell__brand-btn" @click="openNovelShelfDialog">
          <div class="cursor-shell__brand">{{ currentNovel?.title || '作品' }}</div>
        </button>
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
        <button type="button" class="cursor-shell__side-action" @click="backToNovelList">返回选书</button>
      </div>
    </aside>
    <div class="cursor-shell__resize-handle" @mousedown.prevent="startResizeSidebar"></div>
    <div class="cursor-shell__content" :class="{ 'cursor-shell__content--writing': route.name === 'novel-chapter-writing' }">
      <RouterView v-slot="{ Component }">
        <keep-alive :include="['NovelChapterHubView', 'NovelWorkspaceView']" :max="6">
          <component :is="Component" :key="`${String(route.name ?? '')}:${currentNovelId || ''}`" v-bind="chapterWritingViewProps" />
        </keep-alive>
      </RouterView>
    </div>

    <aside
      v-if="isWritingRoute"
      class="cursor-shell__summary-studio"
      :class="{ 'cursor-shell__summary-studio--open': isDockedSummaryPanel }"
      :aria-hidden="isDockedSummaryPanel ? 'false' : 'true'"
      @pointerdown.stop
    >
      <div class="cursor-shell__summary-studio-resizer" @pointerdown="startResizeSummaryStudio" @dblclick="resetSummaryStudioWidth" />
      <div class="cursor-shell__summary-studio-surface">
        <header class="cursor-shell__right-panel-head cursor-shell__summary-studio-head">
          <div class="cursor-shell__right-panel-head-titles">
            <div class="cursor-shell__right-panel-kicker">{{ rightPanelKicker }}</div>
            <div class="cursor-shell__right-panel-title">{{ rightPanelTitle }}</div>
            <div v-if="activeChapterForPanels" class="cursor-shell__right-panel-subtitle muted">
              第{{ activeChapterForPanels.chapterNo }}章 · {{ activeChapterForPanels.title || '未命名章节' }}
            </div>
          </div>
          <button type="button" class="cursor-shell__right-panel-close" @click="requestCloseRightPanel" aria-label="关闭侧边栏">×</button>
        </header>

        <div class="cursor-shell__right-panel-body cursor-shell__summary-studio-body">
          <section class="cursor-shell__assistant-section cursor-shell__assistant-section--summary">
            <label class="cursor-shell__chapter-summary-field">
              <span class="cursor-shell__chapter-summary-label">输入章总结</span>
              <div class="cursor-shell__chapter-summary-textarea-shell">
                <textarea
                  v-model="chapterSummaryDraft"
                  class="cursor-shell__right-panel-textarea"
                  rows="10"
                  maxlength="800"
                />
                <span v-if="chapterSummaryAiLoading" class="cursor-shell__chapter-summary-textarea-caret" aria-hidden="true"></span>
              </div>
            </label>
            <div v-if="chapterSummaryAiLoading" class="cursor-shell__chapter-summary-streaming" aria-live="polite">
              <span class="cursor-shell__chapter-summary-streaming-dot" aria-hidden="true"></span>
              <span>正在总结</span>
              <span class="cursor-shell__chapter-summary-streaming-caret" aria-hidden="true"></span>
            </div>
            <p v-if="chapterSummaryAiError" class="character-panel__alert">{{ chapterSummaryAiError }}</p>
            <div class="cursor-shell__right-panel-actions">
              <button
                type="button"
                class="confirm-dialog__btn confirm-dialog__btn--ghost"
                @click="chapterSummaryAiLoading ? stopChapterSummaryAi() : generateChapterSummaryWithAi()"
                :disabled="!activeChapterId"
              >
                {{ chapterSummaryAiLoading ? '停止' : 'AI总结' }}
              </button>
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="saveChapterSummary" :disabled="!activeChapterId">
                保存
              </button>
            </div>
          </section>
        </div>
      </div>
    </aside>

    <div v-if="rightPanelOpen && !isDockedSummaryPanel" class="cursor-shell__right-panel-overlay" @pointerdown.self="requestCloseRightPanel">
        <aside class="cursor-shell__right-panel" @pointerdown.stop>
          <header class="cursor-shell__right-panel-head">
            <div class="cursor-shell__right-panel-head-titles">
              <div class="cursor-shell__right-panel-kicker">{{ rightPanelKicker }}</div>
              <div class="cursor-shell__right-panel-title">{{ rightPanelTitle }}</div>
              <div v-if="isWritingRoute && activeChapterForPanels" class="cursor-shell__right-panel-subtitle muted">
                第{{ activeChapterForPanels.chapterNo }}章 · {{ activeChapterForPanels.title || '未命名章节' }}
              </div>
              <div v-else class="cursor-shell__right-panel-subtitle muted">
                当前界面：{{ currentWorkspaceTabLabel }}
              </div>
            </div>
            <button type="button" class="cursor-shell__right-panel-close" @click="requestCloseRightPanel" aria-label="关闭侧边栏">×</button>
          </header>

          <div class="cursor-shell__right-panel-body">
            <section v-if="isWritingRoute && rightPanelActive === 'summary'" class="cursor-shell__assistant-section">
              <label class="cursor-shell__chapter-summary-field">
                <span class="cursor-shell__chapter-summary-label">输入章总结</span>
                <div class="cursor-shell__chapter-summary-textarea-shell">
                  <textarea
                    v-model="chapterSummaryDraft"
                    class="cursor-shell__right-panel-textarea"
                    rows="10"
                    maxlength="800"
                  />
                  <span v-if="chapterSummaryAiLoading" class="cursor-shell__chapter-summary-textarea-caret" aria-hidden="true"></span>
                </div>
              </label>
              <div v-if="chapterSummaryAiLoading" class="cursor-shell__chapter-summary-streaming" aria-live="polite">
                <span class="cursor-shell__chapter-summary-streaming-dot" aria-hidden="true"></span>
                <span>正在总结</span>
                <span class="cursor-shell__chapter-summary-streaming-caret" aria-hidden="true"></span>
              </div>
              <p v-if="chapterSummaryAiError" class="character-panel__alert">{{ chapterSummaryAiError }}</p>
              <div class="cursor-shell__right-panel-actions">
                <button
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--ghost"
                  @click="chapterSummaryAiLoading ? stopChapterSummaryAi() : generateChapterSummaryWithAi()"
                  :disabled="!activeChapterId"
                >
                  {{ chapterSummaryAiLoading ? '停止' : 'AI总结' }}
                </button>
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="saveChapterSummary" :disabled="!activeChapterId">
                  保存
                </button>
              </div>
            </section>

            <section v-else-if="isWritingRoute" class="cursor-shell__assistant-section">
              <div class="cursor-shell__assistant-card cursor-shell__assistant-card--ink">
                <p class="cursor-shell__assistant-eyebrow">Scene Ledger</p>
                <h3>本章出现与变更</h3>
                <p class="muted">从当前正文与档案记录里整理角色、势力和本章改动；这里只展示线索，不会自动覆盖档案。</p>
              </div>
              <div class="cursor-shell__right-panel-note muted">自动从正文提取 + 记录本章新建/变更（仅展示）。</div>

              <div class="cursor-shell__chapter-entities-title cursor-shell__chapter-entities-title--section">
                本章修改记录（角色 {{ chapterChangedCharacters.length }} / 势力 {{ chapterChangedFactions.length }}）
              </div>
              <div class="cursor-shell__chapter-entities-grid cursor-shell__chapter-entities-grid--section">
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

            <section v-else class="cursor-shell__assistant-section">
              <div class="cursor-shell__assistant-card">
                <p class="cursor-shell__assistant-eyebrow">Workspace AI</p>
                <h3>把 AI 侧栏带到整个工作台</h3>
                <p class="muted">这里不再只服务写作页。你可以从任意工作台界面继续写作，或先查看当前作品的结构规模。</p>
              </div>

              <div class="cursor-shell__chapter-entities-grid cursor-shell__chapter-entities-grid--section">
                <div class="cursor-shell__chapter-entities-col">
                  <div class="cursor-shell__chapter-entities-title">快捷入口</div>
                  <div class="cursor-shell__right-panel-actions">
                    <button type="button" class="cursor-shell__right-panel-btn cursor-shell__right-panel-btn--primary" @click="goWriting">
                      去写作区
                    </button>
                  </div>
                </div>
                <div class="cursor-shell__chapter-entities-col">
                  <div class="cursor-shell__chapter-entities-title">当前工作台</div>
                  <div class="cursor-shell__chapter-entity-row">
                    <div class="cursor-shell__chapter-entity-head">
                      <span class="cursor-shell__chapter-entity-name">{{ currentWorkspaceTabLabel }}</span>
                      <span class="cursor-shell__chapter-entity-badge">已接入 AI 侧栏</span>
                    </div>
                    <div class="cursor-shell__chapter-entity-fields muted">
                      章节 {{ chapterList.length }} · 最近可继续回到写作页或模型控制室。
                    </div>
                  </div>
                </div>
              </div>

              <div class="cursor-shell__chapter-entities-grid">
                <div class="cursor-shell__chapter-entities-col">
                  <div class="cursor-shell__chapter-entities-title">作品概览</div>
                  <div class="cursor-shell__chapter-entity-row">
                    <div class="cursor-shell__chapter-entity-head">
                      <span class="cursor-shell__chapter-entity-name">{{ currentNovel?.title || '当前作品' }}</span>
                    </div>
                    <div class="cursor-shell__chapter-entity-fields muted">
                      {{ currentNovel?.summary?.trim() || '暂无作品简介，可在工作台中继续补全设定。' }}
                    </div>
                  </div>
                </div>
                <div class="cursor-shell__chapter-entities-col">
                  <div class="cursor-shell__chapter-entities-title">使用建议</div>
                  <div class="cursor-shell__chapter-entity-row">
                    <div class="cursor-shell__chapter-entity-fields muted">
                      大纲页先理顺情节点，角色/势力/物品页补档案，最后回写作页结合 AI 阅读台继续推进正文。
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>
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

  <AiWritingSettingsPopover
    :open="aiWritingSettingsOpen"
    :return-focus-el="aiWritingSettingsReturnFocusEl"
    :novel="currentNovel"
    @close="closeAiWritingSettings"
  />

  <ConfirmDialog
    v-model="chapterSummaryCloseConfirmOpen"
    title="关闭章总结"
    message="当前章总结有未保存的修改，确定要关闭吗？"
    confirm-label="仍然关闭"
    cancel-label="继续编辑"
    @confirm="confirmCloseRightPanel"
  />

  <AuthDialog
    :open="authDialogOpen"
    :initial-mode="authDialogMode"
    @close="closeAuthDialog"
    @authenticated="handleAuthSuccess"
  />

  <CreateNovelDialog
    :open="createNovelDialogOpen"
    @close="createNovelDialogOpen = false"
    @created="handleNovelCreated"
  />

  <NovelShelfDialog
    :open="novelShelfDialogOpen"
    :novels="novelRecords"
    :current-novel-id="currentNovelId || ''"
    @close="novelShelfDialogOpen = false"
    @create="handleNovelShelfCreate"
    @select="openNovelFromShelf"
    @delete="handleDeleteNovelFromShelf"
  />

  <ConfirmDialog
    v-model="deleteNovelConfirmOpen"
    danger
    title="删除书籍"
    :message="deleteNovelConfirmMessage"
    confirm-label="删除"
    cancel-label="取消"
    overlay-class="novel-delete-confirm-overlay"
    @confirm="confirmDeleteNovelFromShelf"
    @cancel="pendingDeleteNovel = null"
  />

  <AnnouncementDialog
    v-model="announcementOpen"
    :title="announcementTitle"
    :body="announcementBody"
    :image="announcementImage"
    @close="onAnnouncementClose"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import {
  buildNovelWorkspacePayload,
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
  getNovels,
  deleteNovel,
  updateChapter,
} from './lib/storage'
import type { Chapter, Novel } from './types'
import type { CharacterChangeDetail } from './lib/storage'
import { formatChapterSummaryText } from './lib/chapterSummary'
import { summarizeNovelChapterFromWorkspaceStream } from './lib/localAi'
import { fetchAnnouncement } from './lib/backendAi'
import { currentThemeOption } from './composables/useTheme'
import { useAuth } from './composables/useAuth'
import { requestAiAccess } from './composables/useAiAccess'
import { useCloudSync } from './composables/useCloudSync'
import { Teleport } from 'vue'
import AuthDialog from './components/AuthDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import AnnouncementDialog from './components/AnnouncementDialog.vue'
import CreateNovelDialog from './components/CreateNovelDialog.vue'
import NovelShelfDialog from './components/NovelShelfDialog.vue'
import ThemePickerPopover from './components/ThemePickerPopover.vue'
import SaveToast from './components/SaveToast.vue'
import AiWritingSettingsPopover from './components/AiWritingSettingsPopover.vue'
import WindowControls from './components/WindowControls.vue'

const route = useRoute()
const router = useRouter()
const { user, isLoggedIn, displayName, logout } = useAuth()
const { syncNow, clearSyncState } = useCloudSync()
const currentNovel = ref<Novel | null>(null)
const chapterList = ref<Chapter[]>([])
const chapterMenuOpen = ref(false)
const chapterMenuX = ref(0)
const chapterMenuY = ref(0)
const chapterMenuTargetId = ref('')
const chapterMenuTargetTitle = ref('')
const themePickerReturnFocusEl = ref<HTMLElement | null>(null)
const isThemePickerOpen = ref(false)
const authDialogOpen = ref(false)
const authDialogMode = ref<'login' | 'register'>('login')
const createNovelDialogOpen = ref(false)
const novelShelfDialogOpen = ref(false)
const novelRecords = ref(getNovels())
const pendingDeleteNovel = ref<Novel | null>(null)
const deleteNovelConfirmOpen = computed({
  get: () => pendingDeleteNovel.value !== null,
  set: (open: boolean) => {
    if (!open) pendingDeleteNovel.value = null
  },
})
const deleteNovelConfirmMessage = computed(() => {
  const label = pendingDeleteNovel.value?.title || '未命名书籍'
  return `确认删除《${label}》？相关章节、大纲、角色与伏笔数据都会一起删除。`
})

function handleThemePickerClick(event: MouseEvent): void {
  openThemePicker(event.currentTarget instanceof HTMLElement ? event.currentTarget : null)
}

function openAuthDialog(mode: 'login' | 'register'): void {
  authDialogMode.value = mode
  authDialogOpen.value = true
}

function closeAuthDialog(): void {
  authDialogOpen.value = false
}

function goLogin(): void {
  openAuthDialog('login')
}

function goRegister(): void {
  openAuthDialog('register')
}

async function handleLogout(): Promise<void> {
  await logout()
  clearSyncState()
  void router.push('/')
  openAuthDialog('login')
}

function handleAuthSuccess(): void {
  authDialogOpen.value = false
  if (route.name === 'login' || route.name === 'register' || route.name === 'reset-password') {
    void router.replace('/')
  }
  // 实际的"登录后拉云端书架"由下方 watch(isLoggedIn) 统一处理，
  // 这样冷启动 restoreSession、登录弹窗、设备注册三条路径行为一致。
}

function handleNovelCreated(novelId: string): void {
  createNovelDialogOpen.value = false
  novelShelfDialogOpen.value = false
  refreshNovelRecords()
  void router.push(`/novels/${novelId}`)
}

function handleNovelShelfCreate(): void {
  novelShelfDialogOpen.value = false
  createNovelDialogOpen.value = true
}

function openNovelFromShelf(novelId: string): void {
  novelShelfDialogOpen.value = false
  if (!novelId) return
  void router.push(`/novels/${novelId}`)
}

async function handleDeleteNovelFromShelf(novelId: string): Promise<void> {
  const novel = novelRecords.value.find((item) => item.id === novelId)
  if (!novel) return
  pendingDeleteNovel.value = novel
}

async function confirmDeleteNovelFromShelf(): Promise<void> {
  const novel = pendingDeleteNovel.value
  pendingDeleteNovel.value = null
  if (!novel) return
  const novelId = novel.id

  const deleted = deleteNovel(novelId)
  if (!deleted) return
  refreshNovelRecords()
  novelShelfDialogOpen.value = false

  if (currentNovelId.value === novelId) {
    const nextId = novelRecords.value[0]?.id
    if (nextId) void router.replace(`/novels/${nextId}`)
    else void router.replace('/')
  }

  if (!isLoggedIn.value) return
  try {
    await syncNow()
  } catch {
    /* tombstone remains locally; next sync can continue deleting remotely */
  }
}

async function handleCloudSync(): Promise<void> {
  try {
    await syncNow()
  } catch {
    /* state already captured in composable */
  }
}

let autoSyncTimer: number | null = null

function scheduleAutoSync(): void {
  if (!isLoggedIn.value || typeof window === 'undefined') return
  if (autoSyncTimer != null) window.clearTimeout(autoSyncTimer)
  autoSyncTimer = window.setTimeout(() => {
    autoSyncTimer = null
    if (!isLoggedIn.value) return
    void handleCloudSync()
  }, 2500)
}

// 登录态变为已登录时，从云端拉一次完整书架。
// 覆盖三条入口：登录弹窗、设备注册、冷启动 restoreSession 自动续登。
// 否则换设备登录或重装客户端后，本地 scope (user:<id>) 是空的，
// 用户会看到空书架，但后台显示该账号名下其实有书。
//
// immediate=true 用于冷启动场景：useAuth 同步从 localStorage 读 token，
// isLoggedIn 在挂载时就可能已是 true（旧 session 续登），watch 不会触发
// false→true 跳变。wasLoggedIn === undefined 表示首次回调。
watch(
  isLoggedIn,
  async (loggedIn, wasLoggedIn) => {
    if (!loggedIn) return
    if (wasLoggedIn === true) return
    try {
      await handleCloudSync()
    } finally {
      refreshNovelRecords()
    }
  },
  { immediate: true },
)

function openThemePicker(returnFocusEl: HTMLElement | null): void {
  themePickerReturnFocusEl.value = returnFocusEl
  isThemePickerOpen.value = true
}

function closeThemePicker(): void {
  isThemePickerOpen.value = false
}

const aiWritingSettingsOpen = ref(false)
const aiWritingSettingsReturnFocusEl = ref<HTMLElement | null>(null)

function openAiWritingSettings(event: MouseEvent): void {
  aiWritingSettingsReturnFocusEl.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  aiWritingSettingsOpen.value = true
}

function closeAiWritingSettings(): void {
  aiWritingSettingsOpen.value = false
}

function refreshNovelRecords(): void {
  novelRecords.value = getNovels()
}

function openCreateNovelDialog(): void {
  createNovelDialogOpen.value = true
}

function openNovelShelfDialog(): void {
  novelShelfDialogOpen.value = true
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

const SIDEBAR_WIDTH_KEY = 'novel-writing.sidebar-width'
const SIDEBAR_COLLAPSED_KEY = 'novel-writing.sidebar-collapsed'
const OPEN_CHAPTERS_KEY_PREFIX = 'novel-writing.open-chapters.'
const AI_STUDIO_OPEN_STORAGE_KEY = 'novel-writing.ai-studio-open'
const AI_STUDIO_WIDTH_STORAGE_KEY = 'novel-writing.ai-studio-width'
const SUMMARY_STUDIO_WIDTH_KEY = 'novel-writing.summary-studio-width'
const SIDEBAR_MIN = 248
const SIDEBAR_MAX = 520
const AI_STUDIO_WIDTH_MIN = 360
const AI_STUDIO_WIDTH_MAX = 720
const aiStudioShellOpen = ref(readInitialAiStudioShellOpen())

watch(
  () => route.name,
  (name) => {
    if (name === 'login' || name === 'register' || name === 'reset-password') {
      openAuthDialog(name)
      void router.replace('/')
    }
  },
  { immediate: true },
)

watch(
  () => user.value?.id ?? '',
  (userId, prevUserId) => {
    refreshNovelRecords()
    if (!userId) {
      aiStudioShellOpen.value = false
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('novel-writing:set-ai-open', { detail: { open: false } }))
      }
      if (prevUserId) clearSyncState()
      return
    }
    void handleCloudSync()
  },
  { immediate: true },
)
const aiStudioShellWidth = ref(readInitialAiStudioShellWidth())
const summaryStudioWidth = ref(readInitialSummaryStudioWidth())
let summaryStudioResizeCleanup: (() => void) | null = null

function readInitialAiStudioShellOpen(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(AI_STUDIO_OPEN_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function clampAiStudioShellWidth(raw: number): number {
  if (typeof window === 'undefined') return Math.max(AI_STUDIO_WIDTH_MIN, raw)
  const max = Math.min(AI_STUDIO_WIDTH_MAX, Math.max(AI_STUDIO_WIDTH_MIN + 40, Math.floor(window.innerWidth * 0.56)))
  return Math.min(max, Math.max(AI_STUDIO_WIDTH_MIN, raw))
}

function readInitialAiStudioShellWidth(): number {
  if (typeof window === 'undefined') return 420
  try {
    const raw = Number(localStorage.getItem(AI_STUDIO_WIDTH_STORAGE_KEY) ?? '')
    if (Number.isFinite(raw)) return clampAiStudioShellWidth(raw)
  } catch {
    /* ignore */
  }
  return clampAiStudioShellWidth(Math.round(window.innerWidth * 0.28))
}

function clampSummaryStudioWidth(raw: number): number {
  if (typeof window === 'undefined') return Math.max(AI_STUDIO_WIDTH_MIN, raw)
  const max = Math.min(AI_STUDIO_WIDTH_MAX, Math.max(AI_STUDIO_WIDTH_MIN + 40, Math.floor(window.innerWidth * 0.56)))
  return Math.min(max, Math.max(AI_STUDIO_WIDTH_MIN, raw))
}

function readInitialSummaryStudioWidth(): number {
  if (typeof window === 'undefined') return 420
  try {
    const raw = Number(localStorage.getItem(SUMMARY_STUDIO_WIDTH_KEY) ?? '')
    if (Number.isFinite(raw)) return clampSummaryStudioWidth(raw)
  } catch {
    /* ignore */
  }
  return clampSummaryStudioWidth(Math.round(window.innerWidth * 0.28))
}

function syncAiStudioShellWidth(next: number): void {
  aiStudioShellWidth.value = clampAiStudioShellWidth(next)
}

function persistAiStudioShellWidth(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AI_STUDIO_WIDTH_STORAGE_KEY, String(Math.round(aiStudioShellWidth.value)))
  } catch {
    /* ignore */
  }
}

function syncSummaryStudioWidth(next: number): void {
  summaryStudioWidth.value = clampSummaryStudioWidth(next)
}

function persistSummaryStudioWidth(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SUMMARY_STUDIO_WIDTH_KEY, String(Math.round(summaryStudioWidth.value)))
  } catch {
    /* ignore */
  }
}

function dispatchAiStudioShellWidth(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('novel-writing:ai-width', { detail: { width: aiStudioShellWidth.value } }))
}

function onAiStudioWidthEvent(event: Event): void {
  const width = Number((event as CustomEvent<{ width?: number }>).detail?.width)
  if (Number.isFinite(width)) syncAiStudioShellWidth(width)
}

function onAiStudioOpenEvent(event: Event): void {
  const open = Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open)
  aiStudioShellOpen.value = open
  if (open) rightPanelOpen.value = false
}

function toggleHeaderAiStudio(): void {
  if (typeof window === 'undefined' || !isWritingRoute.value) return
  const open = !aiStudioShellOpen.value
  if (open && !requestAiAccess()) return
  if (open) rightPanelOpen.value = false
  window.dispatchEvent(new CustomEvent('novel-writing:set-ai-open', { detail: { open } }))
  aiStudioShellOpen.value = open
}

function startResizeSummaryStudio(event: PointerEvent): void {
  if (typeof window === 'undefined') return
  const startX = event.clientX
  const startWidth = summaryStudioWidth.value
  document.body.style.userSelect = 'none'
  document.body.classList.add('is-resizing-summary-studio')

  const onMove = (ev: PointerEvent) => {
    syncSummaryStudioWidth(startWidth - (ev.clientX - startX))
  }

  const finish = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
    document.body.style.userSelect = ''
    document.body.classList.remove('is-resizing-summary-studio')
    summaryStudioResizeCleanup = null
    persistSummaryStudioWidth()
  }

  summaryStudioResizeCleanup?.()
  summaryStudioResizeCleanup = finish
  ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', finish)
}

function resetSummaryStudioWidth(): void {
  if (typeof window === 'undefined') return
  syncSummaryStudioWidth(Math.round(window.innerWidth * 0.28))
  persistSummaryStudioWidth()
}

function onWindowResizeForSummaryStudio(): void {
  syncAiStudioShellWidth(aiStudioShellWidth.value)
  syncSummaryStudioWidth(summaryStudioWidth.value)
  dispatchAiStudioShellWidth()
}

function chapterWordCount(content?: string | null): number {
  return String(content ?? '').replace(/\s/g, '').length
}



const currentNovelId = computed(() => {
  const id = route.params.id ?? route.params.novelId
  const t = String(id ?? '').trim()
  return t || ''
})
const isWritingRoute = computed(() => route.name === 'novel-chapter-writing')
const currentWorkspaceTabKey = computed<WorkspaceTabKey>(() => {
  if (isWritingRoute.value) return 'write'
  const raw = String(route.query.tab ?? 'write')
  return (workspaceTabs.find((tab) => tab.key === raw)?.key ?? 'write') as WorkspaceTabKey
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
const chapterWritingViewProps = computed(() =>
  route.name === 'novel-chapter-writing'
    ? {
        openChapterIds: openChapters.value.map((chapter) => chapter.id),
        activeChapterId: activeChapterId.value,
        onOpenChapter: openChapter,
        onCloseChapterTab: closeChapterTab,
        onChapterTabsWheel,
      }
    : {},
)
const isNovelContext = computed(() => route.name === 'novel-workspace' || route.name === 'novel-chapter-writing')
const novelShellStyle = computed(() => ({
  '--novel-sidebar-width': `${sidebarWidth.value}px`,
  '--chapter-shell-ai-width': `${Math.round(aiStudioShellWidth.value)}px`,
  '--chapter-shell-summary-width': `${Math.round(summaryStudioWidth.value)}px`,
  '--chapter-shell-panel-width':
    rightPanelActive.value === 'summary' ? `${Math.round(summaryStudioWidth.value)}px` : `${Math.round(aiStudioShellWidth.value)}px`,
  '--chapter-shell-summary-column':
    route.name === 'novel-chapter-writing' && rightPanelOpen.value && rightPanelActive.value === 'summary'
      ? `${Math.round(summaryStudioWidth.value)}px`
      : '0px',
  '--chapter-shell-ai-gap': '0px',
}))

watch(
  [() => route.name, () => route.params.id, novelRecords],
  ([name, novelId]) => {
    if ((name === 'novel-workspace' || name === 'novel-chapter-writing') && novelId && !getNovels().some((novel) => novel.id === novelId)) {
      const firstNovelId = novelRecords.value[0]?.id
      if (firstNovelId) void router.replace(`/novels/${firstNovelId}`)
      else {
        void router.replace('/')
      }
    }
  },
  { immediate: true },
)

type WorkspaceTabKey = 'write' | 'outline' | 'characters' | 'items' | 'factions' | 'categories' | 'issues' | 'worldsettings' | 'scenes' | 'comic'
const workspaceTabs = [
  { key: 'write' as const, label: '写作' },
  { key: 'outline' as const, label: '大纲' },
  { key: 'characters' as const, label: '角色' },
  { key: 'items' as const, label: '物品' },
  { key: 'factions' as const, label: '势力' },
  { key: 'scenes' as const, label: '场景' },
  { key: 'comic' as const, label: '漫剧' },
  { key: 'categories' as const, label: '分类' },
  { key: 'issues' as const, label: '伏笔' },
  { key: 'worldsettings' as const, label: '世界观' },
]
const currentWorkspaceTabLabel = computed(
  () => workspaceTabs.find((tab) => tab.key === currentWorkspaceTabKey.value)?.label ?? '写作',
)

function goTo(to: string): void {
  if (!to) return
  void router.push(to)
}

function backToNovelList(): void {
  void router.push('/')
}

function goWorkspaceTab(tab: WorkspaceTabKey): void {
  if (!currentNovelId.value) return
  if (tab === 'write') {
    goWriting()
    return
  }
  void router.push({ path: `/novels/${currentNovelId.value}`, query: { ...route.query, tab } })
}

function resolveWritingReturnChapterId(): string {
  const validIds = new Set(chapterList.value.map((c) => c.id))
  const queryChapterId = String(route.query.chapterId ?? '').trim()
  if (queryChapterId && validIds.has(queryChapterId)) return queryChapterId

  const lastOpenedChapterId = [...openChapterIds.value].reverse().find((id) => validIds.has(id))
  if (lastOpenedChapterId) return lastOpenedChapterId

  return ''
}

function goWriting(): void {
  if (!currentNovelId.value) return
  const returnChapterId = resolveWritingReturnChapterId()
  if (returnChapterId) {
    ensureChapterOpened(returnChapterId)
    void router.push({
      path: `/novels/${currentNovelId.value}/chapter-writing`,
      query: { ...route.query, chapterId: returnChapterId },
    })
    return
  }

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
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  } catch {
    el.scrollIntoView()
  }
}

function onChapterTabsWheel(e: WheelEvent): void {
  const el = e.currentTarget instanceof HTMLElement ? e.currentTarget : null
  if (!el) return
  if (el.scrollWidth <= el.clientWidth) return
  const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
  if (!delta) return
  e.preventDefault()
  el.scrollLeft += delta
}

const rightPanelOpen = ref(false)
const rightPanelActive = ref<'summary' | 'entities'>('summary')
const chapterSummaryDraft = ref('')
const chapterSummaryAiLoading = ref(false)
const chapterSummaryAiError = ref('')
const chapterSummarySaveToastOpen = ref(false)
const chapterSummaryCloseConfirmOpen = ref(false)
let chapterSummarySaveToastTimer: number | null = null
let chapterSummaryAiAbortController: AbortController | null = null
const rightPanelKicker = computed(() => (isWritingRoute.value ? '当前章节' : '工作台 AI 侧栏'))
const rightPanelTitle = computed(() => (isWritingRoute.value ? '章总结' : 'AI 助手'))

const activeChapterForPanels = computed(() => {
  const id = activeChapterId.value
  if (!id) return null
  return chapterList.value.find((c) => c.id === id) ?? null
})

const normalizedActiveChapterSummary = computed(() => formatChapterSummaryText(activeChapterForPanels.value?.annotation ?? ''))
const normalizedChapterSummaryDraft = computed(() => formatChapterSummaryText(chapterSummaryDraft.value))
const chapterSummaryLoadedChapterId = ref('')
const chapterSummaryLoadedText = ref('')

const chapterSummaryHasUnsavedChanges = computed(() => {
  if (!(rightPanelOpen.value && rightPanelActive.value === 'summary' && isWritingRoute.value)) return false
  return normalizedChapterSummaryDraft.value !== normalizedActiveChapterSummary.value
})

const isDockedSummaryPanel = computed(() => isWritingRoute.value && rightPanelOpen.value && rightPanelActive.value === 'summary')

function toggleChapterSummarySidebar(): void {
  if (!isWritingRoute.value || typeof window === 'undefined') return
  const shouldOpen = !(rightPanelOpen.value && rightPanelActive.value === 'summary')
  rightPanelActive.value = 'summary'
  if (shouldOpen) {
    if (aiStudioShellOpen.value) {
      window.dispatchEvent(new CustomEvent('novel-writing:set-ai-open', { detail: { open: false } }))
      aiStudioShellOpen.value = false
    }
    rightPanelOpen.value = true
    return
  }
  requestCloseRightPanel()
}

function closeRightPanel(): void {
  chapterSummaryAiAbortController?.abort()
  rightPanelOpen.value = false
}

function requestCloseRightPanel(): void {
  if (chapterSummaryHasUnsavedChanges.value) {
    chapterSummaryCloseConfirmOpen.value = true
    return
  }
  closeRightPanel()
}

function confirmCloseRightPanel(): void {
  chapterSummaryCloseConfirmOpen.value = false
  syncChapterSummaryDraftFromActive(true)
  closeRightPanel()
}

function showChapterSummarySavedToast(): void {
  chapterSummarySaveToastOpen.value = true
  if (chapterSummarySaveToastTimer != null) window.clearTimeout(chapterSummarySaveToastTimer)
  chapterSummarySaveToastTimer = window.setTimeout(() => {
    chapterSummarySaveToastOpen.value = false
    chapterSummarySaveToastTimer = null
  }, 1800)
}

function saveChapterSummary(): void {
  const ch = activeChapterForPanels.value
  if (!ch) return
  const summary = formatChapterSummaryText(chapterSummaryDraft.value)
  updateChapter({ id: ch.id, annotation: summary })
  chapterSummaryDraft.value = summary
  chapterSummaryLoadedChapterId.value = ch.id
  chapterSummaryLoadedText.value = summary
  reloadNovelContext()
  showChapterSummarySavedToast()
}

function syncChapterSummaryDraftFromActive(force = false): void {
  const chapterId = activeChapterForPanels.value?.id ?? ''
  const nextText = normalizedActiveChapterSummary.value
  const sourceChanged = chapterId !== chapterSummaryLoadedChapterId.value || nextText !== chapterSummaryLoadedText.value
  if (!force && !sourceChanged) return

  const hasLocalEdits = normalizedChapterSummaryDraft.value !== chapterSummaryLoadedText.value
  if (force || chapterId !== chapterSummaryLoadedChapterId.value || !hasLocalEdits) {
    chapterSummaryDraft.value = nextText
  }

  chapterSummaryLoadedChapterId.value = chapterId
  chapterSummaryLoadedText.value = nextText
  chapterSummaryAiError.value = ''
}

async function generateChapterSummaryWithAi(): Promise<void> {
  const chapter = activeChapterForPanels.value
  const novelId = currentNovelId.value
  if (!chapter || !novelId) return
  chapterSummaryAiAbortController?.abort()
  chapterSummaryAiAbortController = new AbortController()
  chapterSummaryAiLoading.value = true
  chapterSummaryAiError.value = ''
  chapterSummaryDraft.value = ''
  try {
    const snapshot = buildNovelWorkspacePayload(novelId)
    const text = await summarizeNovelChapterFromWorkspaceStream(
      snapshot,
      { mode: 'current', chapterIds: [chapter.id] },
      {
        onChunk: (chunk: string) => {
          chapterSummaryDraft.value = formatChapterSummaryText(chapterSummaryDraft.value + chunk)
        },
        onError: (error: Error) => {
          if (error.name === 'AbortError') return
          chapterSummaryAiError.value = error.message || 'AI 总结失败，请稍后重试。'
        },
      },
      chapterSummaryAiAbortController.signal,
    )
    if (!String(text ?? '').trim()) {
      chapterSummaryAiError.value = 'AI 没有生成可用的章节总结。'
      return
    }
    chapterSummaryDraft.value = formatChapterSummaryText(text)
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') return
    chapterSummaryAiError.value = error instanceof Error ? error.message : 'AI 总结失败，请稍后重试。'
  } finally {
    chapterSummaryAiLoading.value = false
    chapterSummaryAiAbortController = null
  }
}

function stopChapterSummaryAi(): void {
  chapterSummaryAiAbortController?.abort()
}

watch(
  () => [activeChapterForPanels.value?.id ?? '', activeChapterForPanels.value?.annotation ?? ''],
  ([id], previousValue) => {
    const prevId = previousValue?.[0] ?? ''
    syncChapterSummaryDraftFromActive(id !== prevId)
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
  refreshNovelRecords()
  reloadNovelContext()
}

function onNovelDataChanged(): void {
  refreshNovelRecords()
  reloadNovelContext()
  scheduleAutoSync()
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
function onOpenAuthEvent(event: Event): void {
  const mode = (event as CustomEvent<{ mode?: 'login' | 'register' }>).detail?.mode ?? 'login'
  openAuthDialog(mode)
}

onMounted(() => window.addEventListener('novel-writing:open-auth', onOpenAuthEvent as EventListener))
onMounted(() => window.addEventListener('novel-writing:ai-open', onAiStudioOpenEvent as EventListener))
onMounted(() => window.addEventListener('novel-writing:ai-width', onAiStudioWidthEvent as EventListener))
onMounted(() => window.addEventListener('pointerdown', closeChapterAreaMenu))
onMounted(() => window.addEventListener('keydown', onGlobalChapterSwitch))
onMounted(() => window.addEventListener('keydown', onEscapeCloseChapterModal))
onMounted(() => window.addEventListener('resize', onWindowResizeForSummaryStudio))

// ── 弹窗公告 ──
const announcementOpen = ref(false)
const announcementTitle = ref('')
const announcementBody = ref('')
const announcementImage = ref('')
const announcementVersion = ref('')
const ANNOUNCEMENT_SEEN_KEY = 'novel-writing.announcement-seen-version'

onMounted(async () => {
  const data = await fetchAnnouncement()
  if (!data || !data.enabled) return
  if (!data.title.trim() && !data.body.trim() && !data.image.trim()) return
  let seen = ''
  try {
    seen = localStorage.getItem(ANNOUNCEMENT_SEEN_KEY) ?? ''
  } catch {
    /* ignore */
  }
  if (seen === data.version) return
  announcementTitle.value = data.title
  announcementBody.value = data.body
  announcementImage.value = data.image
  announcementVersion.value = data.version
  announcementOpen.value = true
})

function onAnnouncementClose(dontShowAgain: boolean): void {
  if (dontShowAgain) {
    try {
      localStorage.setItem(ANNOUNCEMENT_SEEN_KEY, announcementVersion.value)
    } catch {
      /* ignore */
    }
  }
}

onMounted(() => {
  try {
    const key = 'novel-writing.session-started'
    const started = sessionStorage.getItem(key) === '1'
    if (!started) {
      sessionStorage.setItem(key, '1')
      if (route.name === 'novel-workspace' || route.name === 'novel-chapter-writing') {
        void router.replace('/')
      }
    }
  } catch {
    /* ignore */
  }
})
onUnmounted(() => window.removeEventListener('storage', onStorage))
onUnmounted(() => window.removeEventListener('novel-writing:changed', onNovelDataChanged))
onUnmounted(() => window.removeEventListener('novel-writing:open-auth', onOpenAuthEvent as EventListener))
onUnmounted(() => window.removeEventListener('novel-writing:ai-open', onAiStudioOpenEvent as EventListener))
onUnmounted(() => window.removeEventListener('novel-writing:ai-width', onAiStudioWidthEvent as EventListener))
onUnmounted(() => window.removeEventListener('pointerdown', closeChapterAreaMenu))
onUnmounted(() => window.removeEventListener('keydown', onGlobalChapterSwitch))
onUnmounted(() => window.removeEventListener('keydown', onEscapeCloseChapterModal))
onUnmounted(() => window.removeEventListener('resize', onWindowResizeForSummaryStudio))
onUnmounted(() => {
  summaryStudioResizeCleanup?.()
  document.body.classList.remove('is-resizing-summary-studio')
  document.body.style.userSelect = ''
  if (chapterSummarySaveToastTimer != null) window.clearTimeout(chapterSummarySaveToastTimer)
  chapterSummarySaveToastTimer = null
  if (autoSyncTimer != null) window.clearTimeout(autoSyncTimer)
  autoSyncTimer = null
})
watch(currentNovelId, reloadNovelContext, { immediate: true })

function onEscapeCloseChapterModal(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (rightPanelOpen.value) {
    e.preventDefault()
    requestCloseRightPanel()
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

.cursor-shell--novel {
  animation: novel-shell-enter 0.42s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

@keyframes novel-shell-enter {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.992);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.cursor-shell__right-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  justify-content: flex-end;
}

.cursor-shell__content {
  height: 100%;
  min-height: 0;
}

.cursor-shell__summary-studio {
  position: relative;
  grid-column: 4;
  grid-row: 2;
  align-self: stretch;
  justify-self: stretch;
  width: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  margin: 0;
  padding: 0;
  border-left: 1px solid color-mix(in srgb, var(--color-border-strong) 52%, transparent);
  overflow: hidden;
  background: color-mix(in srgb, var(--color-surface) 96%, transparent);
  box-shadow: none;
  opacity: 1;
  pointer-events: auto;
  z-index: 3;
  transform: none;
  transition:
    width 0.2s ease,
    opacity 0.16s ease,
    border-color 0.16s ease;
  will-change: width;
}

.cursor-shell__summary-studio:not(.cursor-shell__summary-studio--open) {
  width: 0;
  border-left-color: transparent;
  opacity: 0;
  pointer-events: none;
}

.cursor-shell__summary-studio-resizer {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 10px;
  transform: translateX(-5px);
  cursor: ew-resize;
  z-index: 4;
  touch-action: none;
}

.cursor-shell__summary-studio-resizer::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  width: 1px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-border-strong) 44%, transparent);
  transition: background 0.16s ease, opacity 0.16s ease;
  opacity: 0.9;
}

.cursor-shell__summary-studio-resizer:hover::before {
  background: color-mix(in srgb, var(--color-primary) 38%, var(--color-border-strong));
  opacity: 1;
}

body.is-resizing-summary-studio .cursor-shell__summary-studio-resizer::before {
  background: color-mix(in srgb, var(--color-primary) 38%, var(--color-border-strong));
  opacity: 1;
}

.cursor-shell__summary-studio-surface {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 99%, #fff 1%), color-mix(in srgb, var(--color-surface) 96%, #000 4%));
}

.cursor-shell__summary-studio-head {
  padding: 8px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border-strong) 36%, transparent);
  background: color-mix(in srgb, var(--color-surface) 99%, #fff 1%);
}

.cursor-shell__right-panel-close {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.cursor-shell__summary-studio-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 10px 12px 12px;
}

@media (max-width: 980px) {
  .cursor-shell__summary-studio {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    grid-column: auto;
    grid-row: auto;
    width: min(var(--chapter-shell-summary-width, 420px), calc(100vw - 20px));
    border-left: 1px solid color-mix(in srgb, var(--color-border-strong) 52%, transparent);
    z-index: 30;
    transform: translate3d(18px, 0, 0);
    transition:
      transform 0.2s ease,
      opacity 0.16s ease;
    will-change: transform, opacity;
  }

  .cursor-shell__summary-studio--open {
    opacity: 1;
    pointer-events: auto;
    transform: translate3d(0, 0, 0);
  }

  .cursor-shell__summary-studio:not(.cursor-shell__summary-studio--open) {
    width: min(var(--chapter-shell-summary-width, 420px), calc(100vw - 20px));
    border-left-color: color-mix(in srgb, var(--color-border-strong) 52%, transparent);
  }
}

.cursor-shell__right-panel {
  width: min(var(--chapter-shell-panel-width, 420px), calc(100vw - 24px));
  height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-left: 1px solid color-mix(in srgb, var(--color-border-strong) 64%, transparent);
}

.cursor-shell__right-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 78%, transparent);
}

.cursor-shell__right-panel-kicker,
.cursor-shell__assistant-eyebrow {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.cursor-shell__right-panel-title {
  margin-top: 4px;
  font-size: 1.28rem;
  line-height: 1.1;
  font-weight: 800;
}

.cursor-shell__right-panel-subtitle {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  margin-top: 9px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 66%, transparent);
  background: color-mix(in srgb, var(--color-surface) 82%, transparent);
  font-size: 12px;
}

.cursor-shell__right-panel-head--sidebar {
  padding: 18px 16px 12px;
}

.cursor-shell__right-panel-body {
  padding: 14px 16px 18px;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-text-muted) 42%, transparent)
    color-mix(in srgb, var(--color-border) 48%, transparent);
}

.cursor-shell__right-panel-body--sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.cursor-shell__right-panel-body::-webkit-scrollbar {
  width: 7px;
}

.cursor-shell__right-panel-body::-webkit-scrollbar-track {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-border) 42%, transparent);
}

.cursor-shell__right-panel-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  border: 1px solid transparent;
  background-clip: padding-box;
  background: color-mix(in srgb, var(--color-text-muted) 44%, transparent);
}

.cursor-shell__right-panel-body::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--color-text) 35%, var(--color-primary) 18%);
}

[data-theme='dark'] .cursor-shell__right-panel-body,
[data-theme='codex'] .cursor-shell__right-panel-body {
  scrollbar-color: color-mix(in srgb, #cbd5e1 38%, transparent) color-mix(in srgb, #334155 58%, transparent);
}

[data-theme='dark'] .cursor-shell__right-panel-body::-webkit-scrollbar-track,
[data-theme='codex'] .cursor-shell__right-panel-body::-webkit-scrollbar-track {
  background: color-mix(in srgb, #334155 58%, transparent);
}

[data-theme='dark'] .cursor-shell__right-panel-body::-webkit-scrollbar-thumb,
[data-theme='codex'] .cursor-shell__right-panel-body::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, #cbd5e1 36%, transparent);
}

[data-theme='dark'] .cursor-shell__right-panel-body::-webkit-scrollbar-thumb:hover,
[data-theme='codex'] .cursor-shell__right-panel-body::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, #e2e8f0 46%, var(--color-primary) 18%);
}

.cursor-shell__assistant-section {
  display: grid;
  gap: 12px;
}

.cursor-shell__assistant-section--summary {
  height: 100%;
  align-content: start;
}

.cursor-shell__chapter-summary-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.cursor-shell__chapter-summary-label {
  font-size: 13px;
  font-weight: 700;
  color: color-mix(in srgb, var(--color-text) 82%, var(--color-primary) 18%);
}

.cursor-shell__chapter-summary-textarea-shell {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.cursor-shell__chapter-summary-textarea-caret {
  position: absolute;
  right: 18px;
  bottom: 18px;
  width: 10px;
  height: 20px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--color-primary) 74%, var(--color-text) 26%);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-surface) 60%, transparent);
  pointer-events: none;
  animation: cursor-shell-summary-caret 0.9s steps(1) infinite;
}

.cursor-shell__chapter-summary-streaming {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 62%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 28%, var(--color-surface));
  color: color-mix(in srgb, var(--color-text) 82%, var(--color-primary) 18%);
  font-size: 12px;
  line-height: 1;
}

.cursor-shell__chapter-summary-streaming-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--color-primary);
  animation: cursor-shell-summary-pulse 1s ease-in-out infinite;
}

.cursor-shell__chapter-summary-streaming-caret {
  width: 9px;
  height: 16px;
  border-radius: 2px;
  background: currentColor;
  animation: cursor-shell-summary-caret 0.9s steps(1) infinite;
}

@keyframes cursor-shell-summary-pulse {
  0%, 100% { transform: scale(0.85); opacity: 0.5; }
  50% { transform: scale(1); opacity: 1; }
}

@keyframes cursor-shell-summary-caret {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0.2; }
}

.cursor-shell__assistant-section--chapters {
  min-height: 0;
  height: 100%;
}

.cursor-shell__assistant-card {
  padding: 16px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 66%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 98%, rgba(255,255,255,0.7)), color-mix(in srgb, var(--color-surface-muted) 88%, transparent)),
    radial-gradient(circle at top right, color-mix(in srgb, var(--color-primary-soft) 34%, transparent), transparent 46%);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 52%, transparent);
}

.cursor-shell__assistant-card--ink {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 96%, rgba(255,255,255,0.7)), color-mix(in srgb, var(--color-primary-soft) 24%, var(--color-surface-muted))),
    radial-gradient(circle at bottom left, color-mix(in srgb, #7c5b2f 14%, transparent), transparent 48%);
}

.cursor-shell__assistant-card h3 {
  margin: 5px 0 6px;
}

.cursor-shell__assistant-card p:last-child {
  margin-bottom: 0;
}

.cursor-shell__right-panel-textarea {
  width: 100%;
  height: 100%;
  resize: none;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-text-muted) 28%, transparent) transparent;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 74%, transparent);
  background:
    repeating-linear-gradient(
      to bottom,
      color-mix(in srgb, var(--color-surface) 96%, rgba(255,255,255,0.72)) 0,
      color-mix(in srgb, var(--color-surface) 96%, rgba(255,255,255,0.72)) 31px,
      color-mix(in srgb, var(--color-border) 54%, transparent) 32px
    );
  color: var(--color-text);
  padding: 14px 16px;
  line-height: 32px;
  outline: none;
  min-height: 240px;
}

.cursor-shell__right-panel-textarea::-webkit-scrollbar {
  width: 5px;
}

.cursor-shell__right-panel-textarea::-webkit-scrollbar-track {
  background: transparent;
}

.cursor-shell__right-panel-textarea::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-muted) 28%, transparent);
}

.cursor-shell__right-panel-textarea::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--color-primary) 42%, var(--color-text-muted) 58%);
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
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px dashed color-mix(in srgb, var(--color-border-strong) 62%, transparent);
  background: color-mix(in srgb, var(--color-surface) 80%, transparent);
  font-size: 12px;
  margin-bottom: 0;
}

.cursor-shell__chapter-entities-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.cursor-shell__chapter-entities-grid--section {
  margin-bottom: 12px;
}

.cursor-shell__group-row--sidebar {
  margin-bottom: 0;
}

.cursor-shell__chapter-entities-col {
  min-width: 0;
}

.cursor-shell__chapter-entities-title--section {
  margin: 2px 0 10px;
}

@media (max-width: 980px) {
  .cursor-shell__chapter-entities-grid {
    grid-template-columns: 1fr;
  }

  .cursor-shell__right-panel {
    width: calc(100vw - 20px);
  }
}

.cursor-shell__chapter-entities-title {
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 8px;
  color: color-mix(in srgb, var(--color-text) 82%, var(--color-primary) 18%);
}

.cursor-shell__chapter-entity-row {
  padding: 11px 12px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 66%, transparent);
  border-radius: 14px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 94%, rgba(255,255,255,0.7)), color-mix(in srgb, var(--color-surface-muted) 84%, transparent));
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--color-primary) 18%, transparent);
  margin-bottom: 8px;
}

.cursor-shell__chapter-entity-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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

@media (prefers-reduced-motion: reduce) {
  .cursor-shell--novel {
    animation: none;
  }
}
</style>
