<template>
  <section
    class="page-block"
    :class="{ 'page-block--ai-open': aiSidebarOpen && activeTab !== 'write' }"
    :style="(aiSidebarOpen && activeTab !== 'write') ? { paddingRight: `min(${aiSidebarWidth}px, 92vw)` } : undefined"
    v-if="novel"
  >
    <header ref="workspaceChromeAnchorRef" class="header-row">
      <div>
        <h1>{{ novel.title }} <button type="button" class="ws-edit-novel-btn" title="编辑书籍信息" @click="editNovelOpen = true">✎</button></h1>
        <p class="muted workspace-sub one-line">{{ novel.summary || '暂无简介' }}</p>
        <nav class="tabs">
          <button type="button" class="tab" :class="{ active: activeTab === 'write' }" @click="switchTab('write')">
            写作
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'worldsettings' }"
            @click="switchTab('worldsettings')"
          >
            世界观
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'outline' }"
            @click="switchTab('outline')"
          >
            大纲
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'characters' }"
            @click="switchTab('characters')"
          >
            角色
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'items' }"
            @click="switchTab('items')"
          >
            物品
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'factions' }"
            @click="switchTab('factions')"
          >
            势力
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'categories' }"
            @click="switchTab('categories')"
          >
            分类
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'issues' }"
            @click="switchTab('issues')"
          >
            伏笔
          </button>
        </nav>
      </div>
    </header>

    <section class="ws-overview ws-tab-panel" v-show="activeTab === 'write'">
      <!-- ① 故事核心 hero -->
      <header class="ws-ov-hero">
        <div class="ws-ov-hero__main">
          <span class="ws-ov-hero__eyebrow">故事核心</span>
          <p class="ws-ov-hero__premise">{{ novel.summary || '还没写下一句话卖点。点右侧编辑，先定下这本书最吸引人的核心。' }}</p>
          <div class="ws-ov-hero__badges">
            <span v-if="novel.genre" class="ws-ov-badge">{{ novel.genre }}</span>
            <span v-if="novel.perspective" class="ws-ov-badge">{{ novel.perspective }}</span>
            <span v-if="novel.tone" class="ws-ov-badge">{{ novel.tone }}</span>
            <span v-if="novel.isMultiLineNarrative" class="ws-ov-badge">多线</span>
          </div>
        </div>
        <button type="button" class="ws-ov-hero__edit" @click="switchTab('outline')">编辑设定</button>
      </header>

      <div class="ws-ov-grid">
        <!-- ② 进度 -->
        <section class="ws-ov-card ws-ov-card--progress">
          <h3 class="ws-ov-card__title">进度</h3>
          <div class="ws-ov-progress-nums">
            <div><strong>{{ overviewProgress.writtenChapters }}</strong><span>/ {{ overviewProgress.totalChapters }} 章</span></div>
            <div><strong>{{ overviewProgress.totalChars.toLocaleString() }}</strong><span>字</span></div>
          </div>
          <p class="ws-ov-progress-sub">大纲完成 {{ overviewProgress.outlineDone }}/{{ overviewProgress.outlineTotal }} · 已绑定 {{ overviewProgress.outlineLinked }}</p>
          <div class="ws-ov-bar"><span :style="{ width: overviewProgress.pct + '%' }" /></div>
          <button type="button" class="ws-ov-btn ws-ov-btn--primary" @click="goToWritingChapter">继续写</button>
        </section>

        <!-- ③ 下一步 -->
        <section class="ws-ov-card ws-ov-card--next">
          <h3 class="ws-ov-card__title">下一步</h3>
          <p v-if="overviewNextBeat.arcTitle" class="ws-ov-next-arc">当前弧线：{{ overviewNextBeat.arcTitle }}</p>
          <p class="ws-ov-next-beat" v-if="overviewNextBeat.nextChapterNo">
            下一章：第 {{ overviewNextBeat.nextChapterNo }} 章 {{ overviewNextBeat.nextChapterTitle || '（未命名）' }}
          </p>
          <p class="ws-ov-next-beat muted" v-else>暂无后续章节，去大纲规划下一个节拍。</p>
          <div class="ws-ov-actions">
            <button type="button" class="ws-ov-btn ws-ov-btn--primary" @click="goToWritingChapter">去写作</button>
            <button type="button" class="ws-ov-btn ws-ov-btn--ghost" @click="switchTab('outline')">看大纲</button>
          </div>
        </section>

        <!-- ④ 故事体检 -->
        <section class="ws-ov-card ws-ov-card--health ws-ov-card--wide">
          <h3 class="ws-ov-card__title">故事体检</h3>
          <ul v-if="overviewHealth.length > 0" class="ws-ov-health-list">
            <li v-for="item in overviewHealth" :key="item.key" class="ws-ov-health-item">
              <span class="ws-ov-health-dot" aria-hidden="true" />
              <span class="ws-ov-health-label">{{ item.label }}</span>
              <button v-if="item.tab" type="button" class="ws-ov-chip" @click="switchTab(item.tab)">去处理</button>
            </li>
          </ul>
          <p v-else class="ws-ov-health-ok muted">暂无需要注意的问题，结构是同步的。</p>
        </section>

        <!-- ⑤ 最近发生 / 连续性 -->
        <section class="ws-ov-card ws-ov-card--recent">
          <h3 class="ws-ov-card__title">最近发生</h3>
          <p v-if="String(novel.continuityBrief || '').trim()" class="ws-ov-recent-brief">{{ novel.continuityBrief }}</p>
          <p v-else class="muted">还没有连续性摘要。写到一定章数后，可在写作页一键生成。</p>
        </section>

        <!-- ⑥ 人物阵容 -->
        <section class="ws-ov-card ws-ov-card--cast">
          <h3 class="ws-ov-card__title">人物阵容</h3>
          <p class="ws-ov-cast-counts">角色 {{ overviewCast.characterCount }} · 势力 {{ overviewCast.factionCount }} · 关系 {{ overviewCast.relationCount }}</p>
          <div class="ws-ov-cast-names">
            <span v-for="c in overviewCast.mains" :key="c.id" class="ws-ov-cast-chip">{{ charDisplay(c) || '未命名' }}</span>
            <span v-if="overviewCast.mains.length === 0" class="muted">还没有角色</span>
          </div>
          <button type="button" class="ws-ov-btn ws-ov-btn--ghost" @click="switchTab('characters')">看角色</button>
        </section>

        <!-- ⑦ 伏笔状态 -->
        <section class="ws-ov-card ws-ov-card--foreshadow ws-ov-card--wide">
          <h3 class="ws-ov-card__title">伏笔状态</h3>
          <p class="ws-ov-fs-counts">开 {{ overviewForeshadow.openCount }} · 已收 {{ overviewForeshadow.fulfilledCount }}</p>
          <ul v-if="overviewForeshadow.pending.length > 0" class="ws-ov-fs-list">
            <li v-for="f in overviewForeshadow.pending" :key="f.id">
              <span class="ws-ov-fs-title">{{ f.title || '未命名伏笔' }}</span>
              <span v-if="f.expectedFulfillChapterNo" class="ws-ov-fs-due">第 {{ f.expectedFulfillChapterNo }} 章前</span>
            </li>
          </ul>
          <p v-else class="muted">没有待回收的伏笔。</p>
          <button type="button" class="ws-ov-btn ws-ov-btn--ghost" @click="switchTab('issues')">看伏笔</button>
        </section>
      </div>
    </section>

    <section class="card outline-console-card outline-console-card--map-only ws-tab-panel" v-show="activeTab === 'outline'">
      <header class="outline-map-hero">
        <div class="outline-map-hero__copy">
          <h2>大纲</h2>
        </div>
        <dl class="outline-map-hero__stats" aria-label="大纲统计">
          <div>
            <dt>情节点</dt>
            <dd>{{ outlineConsoleStats.total }}</dd>
          </div>
          <div>
            <dt>已完成</dt>
            <dd>{{ outlineConsoleStats.done }}</dd>
          </div>
          <div>
            <dt>已绑定</dt>
            <dd>{{ outlineConsoleStats.linked }}</dd>
          </div>
        </dl>
        <div
          v-if="outlineStorylines.length > 0"
          class="outline-map-hero__storyline-filter"
          role="toolbar"
          aria-label="按故事线筛选"
        >
          <button
            type="button"
            class="outline-map-hero__filter-chip"
            :class="{ 'is-active': !outlineStorylineFilterId }"
            @click="outlineStorylineFilterId = ''"
          >
            全部
          </button>
          <button
            v-for="storyline in outlineStorylines"
            :key="storyline.id"
            type="button"
            class="outline-map-hero__filter-chip"
            :class="{ 'is-active': outlineStorylineFilterId === storyline.id }"
            :style="{ '--storyline-color': storyline.color }"
            @click="outlineStorylineFilterId = storyline.id"
          >
            {{ storyline.name }}
          </button>
          <span
            v-if="outlineStorylineFilterId && storylineMatchedCount === 0"
            class="outline-map-hero__filter-empty"
          >该故事线下暂无节点，去节点上绑定试试</span>
        </div>
        <div class="outline-map-hero__actions">
          <div v-if="outlineItems.length > 0" class="outline-level-filter" role="toolbar" aria-label="按层级筛选">
            <button
              type="button"
              :class="{ 'is-active': outlineFilter.level === '' }"
              @click="outlineFilter.level = ''"
            >全部</button>
            <button
              type="button"
              :class="{ 'is-active': outlineFilter.level === 'volume' }"
              @click="outlineFilter.level = 'volume'"
            >卷</button>
            <button
              type="button"
              :class="{ 'is-active': outlineFilter.level === 'act' }"
              @click="outlineFilter.level = 'act'"
            >幕</button>
            <button
              type="button"
              :class="{ 'is-active': outlineFilter.level === 'chapter' }"
              @click="outlineFilter.level = 'chapter'"
            >章</button>
          </div>
          <input
            v-if="outlineItems.length > 0"
            v-model="outlineFilter.keyword"
            type="search"
            class="outline-search-input"
            placeholder="在筛选范围内搜索…"
            aria-label="搜索大纲"
          />
          <div v-if="outlineItems.length > 0" class="outline-view-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              :aria-selected="outlineMapViewMode === 'vertical'"
              :class="{ 'is-active': outlineMapViewMode === 'vertical' }"
              @click="outlineMapViewMode = 'vertical'"
            >大纲</button>
            <button
              type="button"
              role="tab"
              :aria-selected="outlineMapViewMode === 'board'"
              :class="{ 'is-active': outlineMapViewMode === 'board' }"
              @click="outlineMapViewMode = 'board'"
            >看板</button>
          </div>
          <button v-if="outlineItems.length > 0" type="button" class="btn-primary" @click="openOutlineAiExpand">
            AI 扩展大纲
          </button>
          <button type="button" class="btn-secondary" @click="openOutlineAiDesignerCreate">
            {{ outlineItems.length > 0 ? '从零设计' : 'AI 设计大纲' }}
          </button>
          <button type="button" class="btn-primary" @click="openOutlineCreate">＋ 新增情节点</button>
        </div>
        <Transition name="chapter-hub-save-toast">
          <div v-if="outlineAiWriteToast" class="workspace-faction-edit-save-toast" role="status">{{ outlineAiWriteToast }}</div>
        </Transition>
      </header>

      <div class="outline-map-workspace">
        <OutlineVerticalView
          v-if="outlineMapViewMode === 'vertical'"
          :tree="outlineTree"
          :active-id="activeOutlineMapId"
          :linked-count="getLinkedChaptersCount"
          :chapter-label="getOutlineChapterLabel"
          :storylines="outlineStorylines"
          :dimmed-ids="dimmedOutlineIdSet"
          @select="selectOutlineMindMapNode"
          @create-child="createOutlineNodeFromMindMap('child', $event)"
          @create-sibling="createOutlineNodeFromMindMap('sibling', $event)"
          @create-root="createOutlineNodeFromMindMap('root')"
          @cycle-status="cycleOutlineStatus"
          @toggle-storyline="toggleOutlineStoryline"
          @reorder="reorderOutlineNode"
          @jump-chapter="jumpToWritingChapterFromOutline"
          @ai-design="openOutlineAiDesignerCreate"
        />
        <OutlineBoardView
          v-else
          :tree="outlineTree"
          :active-id="activeOutlineMapId"
          :linked-count="getLinkedChaptersCount"
          :chapter-label="getOutlineChapterLabel"
          :storylines="outlineStorylines"
          :dimmed-ids="dimmedOutlineIdSet"
          @select="selectOutlineMindMapNode"
          @create-child="createOutlineNodeFromMindMap('child', $event)"
          @create-sibling="createOutlineNodeFromMindMap('sibling', $event)"
          @create-root="createOutlineNodeFromMindMap('root')"
          @cycle-status="cycleOutlineStatus"
          @toggle-storyline="toggleOutlineStoryline"
          @reorder="reorderOutlineNode"
          @jump-chapter="jumpToWritingChapterFromOutline"
          @ai-design="openOutlineAiDesignerCreate"
        />

        <OutlineMindMapInspector
          :item="activeOutlineMapItem"
          :chapters="chapters"
          :linked-chapters="activeOutlineMapLinkedChapters"
          :storylines="outlineStorylines"
          :assoc-start="activeOutlineAssocStart"
          :assoc-end="activeOutlineAssocEnd"
          :assoc-dirty="activeOutlineAssocDirty"
          @patch="patchOutlineFromMindMap"
          @cycle-status="cycleOutlineStatus"
          @delete-node="handleDeleteOutline"
          @jump-chapter="jumpToWritingChapterFromOutline"
          @set-assoc-start="setOutlineAssocStart"
          @set-assoc-end="setOutlineAssocEnd"
          @apply-assoc="requestApplyOutlineAssoc"
          @cancel-assoc="requestCancelOutlineAssoc"
          @ai-expand="openOutlineAiExpandFromNode"
        />
      </div>

      <Teleport to="body">
        <Transition name="confirm">
          <div v-if="outlineAiDesignerOpen" class="confirm-overlay" role="presentation">
            <div class="confirm-dialog workspace-outline-dialog workspace-outline-ai-dialog" role="dialog" aria-modal="true">
              <div class="confirm-dialog__accent" aria-hidden="true" />
              <div class="confirm-dialog__body workspace-outline-dialog__body">
                <div class="workspace-outline-ai-dialog__head">
                  <div>
                    <h2 class="confirm-dialog__title">{{ outlineAiMode === 'expand' ? 'AI 扩展大纲' : 'AI 设计大纲' }}</h2>
                    <p class="muted workspace-outline-dialog__sub">
                      {{
                        outlineAiDesignerStep === 'intro'
                          ? '先确认世界观就绪，再开始设计；点「开始设计」前不会调用 AI。'
                          : outlineAiMode === 'expand' && outlineAiDesignerStep === 'expand'
                          ? '会结合全书设定、已有大纲与写作进度在后台整理上下文；你只需选位置、说一句方向。'
                          : outlineAiDesignerStep === 'brief'
                            ? '用一段话说说你想要的故事走向，AI 会据此直接给出几套大纲方案；不必答一堆问题。'
                          : outlineAiDesignerStep === 'interview'
                            ? '信息够用时可直接出方案，不必答完所有轮次。'
                            : outlineAiDesignerStep === 'options'
                              ? '选好方案后一键生成；已有大纲时更推荐用「AI 扩展大纲」。'
                              : outlineAiDesignerStep === 'skeleton'
                                ? '确认卷/幕/章结构后，再决定是否补充场景细节。'
                                : outlineAiAppendMode
                                  ? '确认后追加到现有导图，不会覆盖已有节点。'
                                  : '确认草案后写入；写入后仍可在大纲页慢慢改。'
                      }}
                    </p>
                  </div>
                  <span class="workspace-outline-ai-dialog__progress">
                      {{
                        outlineAiDesignerStep === 'intro'
                          ? '准备'
                          : outlineAiMode === 'expand' && outlineAiDesignerStep === 'expand'
                          ? '扩展'
                          : outlineAiDesignerStep === 'brief'
                            ? '构想'
                          : outlineAiDesignerStep === 'interview'
                            ? `访谈中 · ${outlineAiInterviewTurnCount}`
                            : outlineAiDesignerStep === 'options'
                              ? '方案选择'
                              : outlineAiDesignerStep === 'skeleton'
                                ? '章节骨架'
                                : '预览'
                      }}
                    </span>
                  </div>

                <div
                  v-if="outlineItems.length > 0"
                  class="workspace-outline-ai-mode-tabs"
                  role="tablist"
                >
                  <button
                    type="button"
                    role="tab"
                    :aria-selected="outlineAiMode === 'expand'"
                    :class="{ 'is-active': outlineAiMode === 'expand' }"
                    @click="switchOutlineAiMode('expand')"
                  >
                    接着现有大纲
                  </button>
                  <button
                    type="button"
                    role="tab"
                    :aria-selected="outlineAiMode === 'create'"
                    :class="{ 'is-active': outlineAiMode === 'create' }"
                    @click="switchOutlineAiMode('create')"
                  >
                    从零规划
                  </button>
                </div>

                <div ref="outlineAiScrollRef" class="workspace-outline-dialog__scroll scrollbar-paper workspace-outline-ai-dialog__scroll">
                  <template v-if="outlineAiDesignerStep === 'intro'">
                    <section v-if="!hasWorldviewForOutline" class="workspace-outline-ai-panel workspace-outline-ai-gate">
                      <div class="workspace-outline-ai-gate__icon" aria-hidden="true">◍</div>
                      <h3 class="workspace-outline-ai-gate__title">先完善世界观，再设计大纲</h3>
                      <p class="workspace-outline-ai-gate__desc">
                        大纲会建立在你的世界观设定之上——设定、规则、地理、势力都要与世界观一致。
                        当前还没有任何世界观设定，请先补全，AI 才能据此生成贴合的大纲。
                      </p>
                      <button type="button" class="btn-primary workspace-outline-ai-gate__cta" @click="goCompleteWorldviewFromOutlineAi">
                        去填写世界观设定
                      </button>
                    </section>
                    <section v-else class="workspace-outline-ai-panel workspace-outline-ai-gate">
                      <div class="workspace-outline-ai-gate__icon" aria-hidden="true">✦</div>
                      <h3 class="workspace-outline-ai-gate__title">开始 AI 设计大纲</h3>
                      <p class="workspace-outline-ai-gate__desc">
                        AI 会结合你的世界观设定（已有 {{ worldSettings.length }} 条），让你用一段话说说想要的故事走向，
                        再据此给出多套大纲方案。点击下方按钮开始，不会马上锁住界面。
                      </p>
                      <p class="muted workspace-outline-ai-gate__hint">只需写一段构想，几个引导项可填可不填，随时能关闭。</p>
                    </section>
                  </template>

                  <template v-else-if="outlineAiMode === 'expand' && outlineAiDesignerStep === 'expand'">
                    <section class="workspace-outline-ai-panel workspace-outline-ai-panel--expand">
                      <p class="workspace-outline-ai-brief">
                        扩展位置：<strong>{{ outlineAiExpandAnchorLabel }}</strong>
                      </p>
                      <div class="workspace-outline-ai-expand-presets">
                        <button
                          v-for="preset in outlineAiExpandPresets"
                          :key="preset.id"
                          type="button"
                          class="workspace-outline-ai-option"
                          :class="{ 'workspace-outline-ai-option--active': outlineAiExpandPreset === preset.id }"
                          @click="outlineAiExpandPreset = preset.id"
                        >
                          {{ preset.label }}
                        </button>
                      </div>
                      <label class="workspace-outline-ai-expand-note">
                        <span>补充说明（可选）</span>
                        <textarea
                          v-model="outlineAiExpandNote"
                          class="workspace-outline-ai-question__input workspace-outline-ai-question__textarea"
                          rows="3"
                          maxlength="300"
                          placeholder="例如：从第12章往后扩5章、把「夜袭」拆成三场戏、加一条感情线支线…"
                        />
                      </label>
                      <p class="muted workspace-outline-ai-expand-hint">
                        生成时会自动带上角色、伏笔、已写章节与节拍路径，无需你手动整理。
                      </p>
                    </section>
                  </template>

                  <template v-else-if="outlineAiDesignerStep === 'brief'">
                    <section class="workspace-outline-ai-panel">
                      <p class="muted workspace-outline-ai-brief-intro">
                        全部留空也行——直接点下面的按钮，AI 会基于你的世界观自由构思大纲。想给方向就在下面写，AI 会更贴合你的想法。
                      </p>
                      <label class="workspace-outline-ai-brief-field">
                        <span class="workspace-outline-ai-brief-field__label">你想要一个什么样的故事？<em>（可选）</em></span>
                        <textarea
                          v-model="outlineAiBrief"
                          class="workspace-outline-ai-question__input workspace-outline-ai-question__textarea workspace-outline-ai-brief-field__main"
                          rows="8"
                          placeholder="不想写就留空，AI 会基于世界观自由发挥。&#10;想给方向也可以，比如：&#10;主角是个落魄的制符师，意外捡到一枚能吞噬他人天赋的古印，从此一边被各大势力追杀，一边逐渐发现古印背后是上古封印……"
                        />
                        <span class="muted workspace-outline-ai-question__hint">写不写都行。写了 AI 会据此出方案，留空则完全自由发挥。下面三项同样可选。</span>
                      </label>

                      <label class="ws-ai-checkbox">
                        <input type="checkbox" v-model="outlineAiUseNovelInfo" />
                        <span class="ws-ai-checkbox__box">{{ outlineAiUseNovelInfo ? '✓' : '' }}</span>
                        <span class="ws-ai-checkbox__text">
                          参考本书的书名《{{ novel?.title || '未命名' }}》和简介来设计
                          <span class="ws-ai-checkbox__hint">不勾选则只按你上面写的内容和世界观来设计，忽略书名简介</span>
                        </span>
                      </label>

                      <div class="workspace-outline-ai-brief-guides">
                        <label class="workspace-outline-ai-brief-field">
                          <span class="workspace-outline-ai-brief-field__label">核心冲突 / 主线矛盾<em>（可选）</em></span>
                          <textarea
                            v-model="outlineAiGuideConflict"
                            class="workspace-outline-ai-question__input workspace-outline-ai-question__textarea"
                            rows="2"
                            maxlength="200"
                            placeholder="例如：旧秩序的守护者 vs 想打破规则的主角"
                          />
                        </label>
                        <label class="workspace-outline-ai-brief-field">
                          <span class="workspace-outline-ai-brief-field__label">主角目标 / 要克服什么<em>（可选）</em></span>
                          <textarea
                            v-model="outlineAiGuideProtagonist"
                            class="workspace-outline-ai-question__input workspace-outline-ai-question__textarea"
                            rows="2"
                            maxlength="200"
                            placeholder="例如：找回失踪的妹妹，同时压制体内失控的力量"
                          />
                        </label>
                        <label class="workspace-outline-ai-brief-field">
                          <span class="workspace-outline-ai-brief-field__label">结局基调 / 期待走向<em>（可选）</em></span>
                          <textarea
                            v-model="outlineAiGuideEnding"
                            class="workspace-outline-ai-question__input workspace-outline-ai-question__textarea"
                            rows="2"
                            maxlength="200"
                            placeholder="例如：苦尽甘来的圆满 / 略带遗憾的开放结局"
                          />
                        </label>
                      </div>
                    </section>
                  </template>

                  <template v-else-if="outlineAiDesignerStep === 'options'">
                    <section class="workspace-outline-ai-panel">
                      <div v-if="outlineAiDesignerLoading && outlineAiDesignerStreaming" class="workspace-outline-ai-stream">
                        <p class="workspace-outline-ai-stream__hint">AI 正在构思完整大纲结构…</p>
                        <div class="workspace-outline-ai-stream__lines">
                          <p v-for="(line, idx) in outlineAiDesignerStreamLines" :key="idx" :class="'workspace-outline-ai-stream__line workspace-outline-ai-stream__line--' + line.level">
                            {{ line.text }}
                          </p>
                          <span class="workspace-outline-ai-stream__cursor" aria-hidden="true"></span>
                        </div>
                      </div>
                      <p v-if="outlineAiDesignerBrief" class="workspace-outline-ai-brief">{{ outlineAiDesignerBrief }}</p>
                      <div class="workspace-outline-ai-plan-list">
                        <article
                          v-for="option in outlineAiDesignerOptions"
                          :key="option.id"
                          class="workspace-outline-ai-plan"
                          :class="{ 'workspace-outline-ai-plan--active': outlineAiDesignerSelectedOptionId === option.id }"
                          @click="chooseOutlineAiOption(option.id)"
                        >
                          <div class="workspace-outline-ai-plan__head">
                            <div>
                              <h3>{{ option.title }}</h3>
                              <p>{{ option.premise }}</p>
                            </div>
                            <span>{{ option.narrativeShape || option.structure }}</span>
                          </div>
                          <p v-if="option.coreQuestion" class="workspace-outline-ai-plan__question muted">核心问题：{{ option.coreQuestion }}</p>
                          <div class="workspace-outline-ai-plan__section">
                            <strong>亮点</strong>
                            <ul>
                              <li v-for="point in option.highlights" :key="point">{{ point }}</li>
                            </ul>
                          </div>
                          <div class="workspace-outline-ai-plan__section">
                            <strong>推进节拍</strong>
                            <ol>
                              <li v-for="beat in option.beats" :key="beat">{{ beat }}</li>
                            </ol>
                          </div>
                          <p class="workspace-outline-ai-plan__ending">结局气质：{{ option.endingTone || '未注明' }}</p>
                          <label class="workspace-outline-ai-plan__note" @click.stop>
                            <span>调整意见</span>
                            <textarea
                              :value="outlineAiOptionNotes[option.id] ?? ''"
                              class="workspace-outline-ai-question__input workspace-outline-ai-question__textarea workspace-outline-ai-plan__note-input"
                              rows="3"
                              maxlength="500"
                              placeholder="选中此方案后，写下想改的方向（如加强感情线、换结局气质…），再点下方「AI 调整方案」"
                              @click.stop
                              @input="setOutlineAiOptionNote(option.id, ($event.target as HTMLTextAreaElement).value)"
                            />
                          </label>
                        </article>
                      </div>
                      <p v-if="outlineAiOptionRevisionHistory.length > 0" class="muted workspace-outline-ai-plan-revision-hint">
                        已根据你的意见调整 {{ outlineAiOptionRevisionHistory.length }} 轮；可继续修改直到满意，再生成正式大纲。
                      </p>
                    </section>
                  </template>

                  <template v-else-if="outlineAiDesignerStep === 'skeleton' && outlineAiDesignerDraft">
                    <section class="workspace-outline-ai-panel">
                      <div
                        v-if="outlineAiDraftLintIssues.length > 0 && !outlineAiLintDismissed"
                        class="workspace-outline-ai-lint"
                      >
                        <p v-for="(issue, index) in outlineAiDraftLintIssues" :key="index" :class="`workspace-outline-ai-lint--${issue.severity}`">
                          {{ issue.message }}
                        </p>
                        <button type="button" class="workspace-outline-ai-lint__dismiss" @click="outlineAiLintDismissed = true">知道了</button>
                      </div>
                      <p class="workspace-outline-ai-brief">
                        当前是<strong>章节骨架</strong>（{{ outlineAiSkeletonItemCount }} 个结构节点）。可先写入，或继续让 AI 补充场景节拍。
                      </p>
                      <div class="workspace-outline-ai-draft-list">
                        <article
                          v-for="item in outlineAiDesignerDraft.items"
                          :key="item.tempId"
                          class="workspace-outline-ai-draft-item workspace-outline-ai-draft-item--skeleton"
                        >
                          <div class="workspace-outline-ai-draft-item__head">
                            <strong>{{ item.title }}</strong>
                            <span>{{ item.level }}</span>
                          </div>
                          <p>{{ item.summary || item.goal || '暂无说明' }}</p>
                        </article>
                      </div>
                    </section>
                  </template>

                  <template v-else-if="outlineAiDesignerDraft">
                    <section class="workspace-outline-ai-panel">
                      <div
                        v-if="outlineAiDraftLintIssues.length > 0 && !outlineAiLintDismissed"
                        class="workspace-outline-ai-lint"
                        role="status"
                      >
                        <p v-for="(issue, index) in outlineAiDraftLintIssues" :key="index" :class="`workspace-outline-ai-lint--${issue.severity}`">
                          {{ issue.message }}
                        </p>
                        <button type="button" class="workspace-outline-ai-lint__dismiss" @click="outlineAiLintDismissed = true">知道了</button>
                      </div>
                      <div v-if="outlineAiDesignerDraft?.critiqueNotes" class="workspace-outline-ai-critique" role="status">
                        <p>AI 审读：{{ outlineAiDesignerDraft.critiqueNotes }}</p>
                      </div>
                      <div class="workspace-outline-ai-preview-head">
                        <div>
                          <h3>{{ outlineAiDesignerDraft.title || selectedOutlineAiOption?.title || '未命名大纲' }}</h3>
                          <p>{{ outlineAiDesignerDraft.summary || selectedOutlineAiOption?.premise || 'AI 已生成一份可写入的大纲草案。' }}</p>
                        </div>
                        <dl>
                          <div>
                            <dt>节点</dt>
                            <dd>{{ outlineAiDesignerDraft.items.length }}</dd>
                          </div>
                          <div v-if="outlineAiDesignerDraft.storylines?.length">
                            <dt>故事线</dt>
                            <dd>{{ outlineAiDesignerDraft.storylines.length }}</dd>
                          </div>
                        </dl>
                      </div>
                      <ul v-if="outlineAiDesignerDraft.storylines?.length" class="workspace-outline-ai-storylines">
                        <li v-for="sl in outlineAiDesignerDraft.storylines" :key="sl.name" class="workspace-outline-ai-storyline">
                          <strong>{{ sl.name }}</strong>
                          <span>{{ sl.type }}</span>
                          <p>{{ sl.description }}</p>
                        </li>
                      </ul>
                      <div class="workspace-outline-ai-draft-list">
                        <article v-for="item in outlineAiDesignerDraft.items" :key="item.tempId" class="workspace-outline-ai-draft-item">
                          <div class="workspace-outline-ai-draft-item__head">
                            <strong>{{ item.title }}</strong>
                            <span>{{ item.level }}</span>
                          </div>
                          <p>{{ item.summary || '暂无摘要' }}</p>
                          <div class="workspace-outline-ai-draft-item__meta">
                            <span v-if="item.goal">目标：{{ item.goal }}</span>
                            <span v-if="item.conflict">冲突：{{ item.conflict }}</span>
                            <span v-if="item.suspense">悬念：{{ item.suspense }}</span>
                          </div>
                        </article>
                      </div>
                    </section>
                  </template>

                </div>

                <p v-if="outlineAiDesignerError" class="form-error workspace-outline-ai-dialog__error workspace-outline-ai-dialog__error--actions">{{ outlineAiDesignerError }}</p>

                <div class="confirm-dialog__actions workspace-outline-dialog__actions workspace-outline-ai-dialog__actions">
                  <button type="button" class="btn-secondary" :disabled="outlineAiDesignerLoading || outlineAiDesignerWriting" @click="closeOutlineAiDesigner">关闭</button>
                  <template v-if="outlineAiDesignerStep === 'intro'">
                    <button
                      v-if="hasWorldviewForOutline"
                      type="button"
                      class="btn-primary"
                      :disabled="outlineAiDesignerLoading"
                      @click="startOutlineAiInterview"
                    >
                      {{ outlineAiDesignerLoading ? '准备中…' : '开始设计' }}
                    </button>
                    <button
                      v-else
                      type="button"
                      class="btn-primary"
                      @click="goCompleteWorldviewFromOutlineAi"
                    >
                      去填写世界观
                    </button>
                  </template>
                  <template v-else-if="outlineAiMode === 'expand' && outlineAiDesignerStep === 'expand'">
                    <button
                      type="button"
                      class="btn-primary"
                      :disabled="outlineAiDesignerLoading || !outlineAiExpandAnchorId"
                      @click="generateOutlineAiExpand"
                    >
                      {{ outlineAiDesignerLoading ? '生成中…' : '生成扩展' }}
                    </button>
                  </template>
                  <button
                    v-else-if="outlineAiDesignerStep === 'brief'"
                    type="button"
                    class="btn-primary"
                    :disabled="outlineAiDesignerLoading"
                    @click="submitOutlineAiBrief"
                  >
                    {{ outlineAiDesignerLoading ? '生成中…' : (outlineAiBriefReady ? '生成大纲方案' : '直接生成（AI 自由发挥）') }}
                  </button>
                  <button
                    v-else-if="outlineAiDesignerStep === 'interview'"
                    type="button"
                    class="btn-secondary"
                    :disabled="outlineAiDesignerLoading || outlineAiInterviewHistory.length === 0"
                    @click="generateOutlineAiOptions"
                  >
                    {{ outlineAiDesignerLoading ? '生成中…' : '直接出方案' }}
                  </button>
                  <button
                    v-if="outlineAiDesignerStep === 'interview'"
                    type="button"
                    class="btn-primary"
                    :disabled="outlineAiDesignerLoading || !outlineAiCanSubmitInterview || !outlineAiCurrentQuestion"
                    @click="submitOutlineAiInterviewAnswer"
                  >
                    {{ outlineAiDesignerLoading ? '处理中…' : '回答这一轮' }}
                  </button>
                  <template v-else-if="outlineAiDesignerStep === 'options'">
                    <button type="button" class="btn-secondary" :disabled="outlineAiDesignerLoading" @click="backToOutlineAiInterview">返回改构想</button>
                    <button
                      type="button"
                      class="btn-secondary"
                      :disabled="outlineAiDesignerLoading || !selectedOutlineAiOption || !outlineAiSelectedOptionNote"
                      @click="refineOutlineAiOptions"
                    >
                      {{ outlineAiDesignerLoading ? '调整中…' : 'AI 调整方案' }}
                    </button>
                    <button type="button" class="btn-primary" :disabled="outlineAiDesignerLoading || !selectedOutlineAiOption" @click="generateOutlineAiDraft">
                      {{ outlineAiDesignerLoading ? '生成中…' : '生成完整大纲' }}
                    </button>
                    <button
                      v-if="outlineAiDesignerLoading && outlineAiDesignerStreaming"
                      type="button"
                      class="btn-secondary"
                      @click="stopOutlineAiDesignerGeneration"
                    >停止</button>
                    <button
                      type="button"
                      class="btn-secondary workspace-outline-ai-dialog__link-btn"
                      :disabled="outlineAiDesignerLoading || !selectedOutlineAiOption"
                      @click="generateOutlineAiSkeleton"
                    >
                      {{ outlineAiDesignerLoading ? '生成中…' : '先看章节骨架' }}
                    </button>
                  </template>
                  <template v-else-if="outlineAiDesignerStep === 'skeleton'">
                    <button type="button" class="btn-secondary" :disabled="outlineAiDesignerLoading || outlineAiDesignerWriting" @click="backToOutlineAiOptions">返回方案</button>
                    <button
                      type="button"
                      class="btn-secondary"
                      :disabled="outlineAiDesignerLoading || outlineAiDesignerWriting"
                      @click="applyOutlineAiDraft"
                    >
                      {{ outlineAiDesignerWriting ? '写入中…' : '直接写入骨架' }}
                    </button>
                    <button type="button" class="btn-primary" :disabled="outlineAiDesignerLoading" @click="generateOutlineAiScenesFromSkeleton">
                      {{ outlineAiDesignerLoading ? '展开中…' : '补充场景细节' }}
                    </button>
                  </template>
                  <template v-else-if="outlineAiDesignerStep === 'preview'">
                    <button
                      type="button"
                      class="btn-secondary"
                      :disabled="outlineAiDesignerLoading || outlineAiDesignerWriting"
                      @click="outlineAiAppendMode ? backToOutlineAiExpand() : backToOutlineAiOptions()"
                    >
                      {{ outlineAiAppendMode ? '返回修改' : '返回方案' }}
                    </button>
                    <button
                      type="button"
                      class="btn-primary"
                      :disabled="outlineAiDesignerWriting || !outlineAiDesignerDraft?.items?.length"
                      @click="applyOutlineAiDraft"
                    >
                      {{ outlineAiDesignerWriting ? '写入中…' : outlineAiAppendMode ? '追加到大纲' : '写入当前大纲' }}
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <Transition name="confirm">
          <div v-if="outlineCreateOpen" class="confirm-overlay" role="presentation">
            <div class="confirm-dialog workspace-outline-dialog workspace-outline-create-dialog" role="dialog" aria-modal="true">
              <div class="confirm-dialog__accent" aria-hidden="true" />
              <div class="confirm-dialog__body workspace-outline-dialog__body">
                <h2 class="confirm-dialog__title">新增情节点</h2>
                <p class="muted workspace-outline-dialog__sub">填写标题和简介即可；节拍、故事线可在右侧选中节点后再补。</p>
                <form class="outline-dialog-form" @submit.prevent="submitOutlineCreate">
                  <div class="workspace-outline-dialog__scroll scrollbar-paper">
                    <div class="outline-dialog-grid outline-dialog-grid--primary outline-dialog-grid--simple">
                      <label class="outline-dialog-field outline-dialog-field--wide">
                        <span>标题 *</span>
                        <input v-model="outlineForm.title" maxlength="80" required autocomplete="off" placeholder="情节点标题…" />
                      </label>
                      <label class="outline-dialog-field">
                        <span>状态</span>
                        <select v-model="outlineForm.status">
                          <option value="todo">待写</option>
                          <option value="doing">进行中</option>
                          <option value="done">已完成</option>
                        </select>
                      </label>
                      <label class="outline-dialog-field outline-dialog-field--wide">
                        <span>简介</span>
                        <textarea v-model="outlineForm.summary" maxlength="240" rows="4" placeholder="一句话说明这个节点发生什么" />
                      </label>
                    </div>
                  </div>
                  <div class="confirm-dialog__actions workspace-outline-dialog__actions">
                    <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeOutlineCreate">取消</button>
                    <button type="submit" class="confirm-dialog__btn confirm-dialog__btn--danger">添加节点</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <Teleport to="body">
        <Transition name="confirm">
          <div
            v-if="outlineDetailOpenId && activeOutlineDetailItem"
            class="confirm-overlay"
            role="presentation"
          >
            <div class="confirm-dialog workspace-outline-dialog workspace-outline-detail-dialog" role="dialog" aria-modal="true">
              <div class="confirm-dialog__accent" aria-hidden="true" />
              <div class="confirm-dialog__body workspace-outline-dialog__body">
                <h2 class="confirm-dialog__title">编辑情节点 · #{{ activeOutlineDetailItem.order }}</h2>
                <p class="muted workspace-outline-dialog__sub">{{ activeOutlineDetailItem.title || '未命名情节点' }}</p>
                <div class="workspace-outline-dialog__scroll scrollbar-paper">
                  <section class="outline-dialog-section">
                    <h3>基础信息</h3>
                    <div class="outline-dialog-grid outline-dialog-grid--primary">
                      <label class="outline-dialog-field outline-dialog-field--wide">
                        <span>标题</span>
                        <input
                          :value="activeOutlineDetailItem.title"
                          maxlength="80"
                          placeholder="情节点标题"
                          @change="onOutlineTitleChange(activeOutlineDetailItem.id, $event)"
                        />
                      </label>
                      <label class="outline-dialog-field outline-dialog-field--wide">
                        <span>摘要</span>
                        <input
                          :value="activeOutlineDetailItem.summary"
                          maxlength="240"
                          placeholder="摘要（可选）"
                          @change="onOutlineSummaryChange(activeOutlineDetailItem.id, $event)"
                        />
                      </label>
                      <label class="outline-dialog-field">
                        <span>层级</span>
                        <select :value="activeOutlineDetailItem.level ?? 'scene'" @change="onOutlineLevelChange(activeOutlineDetailItem.id, $event)">
                          <option value="scene">场景</option>
                          <option value="chapter">章</option>
                          <option value="act">幕</option>
                          <option value="volume">卷</option>
                        </select>
                      </label>
                      <label class="outline-dialog-field">
                        <span>张力</span>
                        <select :value="normalizeOutlineTensionForUi(activeOutlineDetailItem.tension)" @change="onOutlineTensionChange(activeOutlineDetailItem.id, $event)">
                          <option :value="1">低潮</option>
                          <option :value="2">铺垫</option>
                          <option :value="3">推进</option>
                          <option :value="4">紧张</option>
                          <option :value="5">爆点</option>
                        </select>
                      </label>
                      <label class="outline-dialog-field">
                        <span>POV</span>
                        <select :value="activeOutlineDetailItem.povCharacterId ?? ''" @change="onOutlinePovChange(activeOutlineDetailItem.id, $event)">
                          <option value="">不指定</option>
                          <option v-for="c in characters" :key="`ol-pov-${activeOutlineDetailItem.id}-${c.id}`" :value="c.id">{{ charDisplay(c) }}</option>
                        </select>
                      </label>
                      <label class="outline-dialog-field">
                        <span>时间</span>
                        <input :value="activeOutlineDetailItem.timeLabel ?? ''" maxlength="80" placeholder="时间" @change="onOutlineContextFieldChange(activeOutlineDetailItem.id, 'timeLabel', $event)" />
                      </label>
                      <label class="outline-dialog-field">
                        <span>地点</span>
                        <input :value="activeOutlineDetailItem.location ?? ''" maxlength="80" placeholder="地点" @change="onOutlineContextFieldChange(activeOutlineDetailItem.id, 'location', $event)" />
                      </label>
                    </div>
                  </section>

                  <section class="outline-dialog-section">
                    <h3>情节推进</h3>
                    <div class="outline-dialog-grid">
                      <input :value="activeOutlineDetailItem.goal ?? ''" maxlength="120" placeholder="目标" @change="onOutlineFieldChange(activeOutlineDetailItem.id, 'goal', $event)" />
                      <input :value="activeOutlineDetailItem.conflict ?? ''" maxlength="120" placeholder="冲突" @change="onOutlineFieldChange(activeOutlineDetailItem.id, 'conflict', $event)" />
                      <input :value="activeOutlineDetailItem.twist ?? ''" maxlength="120" placeholder="转折" @change="onOutlineFieldChange(activeOutlineDetailItem.id, 'twist', $event)" />
                      <input :value="activeOutlineDetailItem.result ?? ''" maxlength="120" placeholder="结果" @change="onOutlineFieldChange(activeOutlineDetailItem.id, 'result', $event)" />
                      <input :value="activeOutlineDetailItem.suspense ?? ''" maxlength="120" placeholder="悬念/钩子" @change="onOutlineFieldChange(activeOutlineDetailItem.id, 'suspense', $event)" />
                    </div>
                    <div class="outline-card__ai-actions outline-dialog-ai-actions">
                      <button type="button" class="btn-secondary" :disabled="!!outlineAiLoadingById[activeOutlineDetailItem.id]" @click="enhanceOutlineByAi(activeOutlineDetailItem.id, 'conflict')">AI补冲突</button>
                      <button type="button" class="btn-secondary" :disabled="!!outlineAiLoadingById[activeOutlineDetailItem.id]" @click="enhanceOutlineByAi(activeOutlineDetailItem.id, 'twist')">AI补转折</button>
                      <button type="button" class="btn-secondary" :disabled="!!outlineAiLoadingById[activeOutlineDetailItem.id]" @click="enhanceOutlineByAi(activeOutlineDetailItem.id, 'suspense')">AI补悬念</button>
                      <button type="button" class="btn-primary" :disabled="!!outlineAiLoadingById[activeOutlineDetailItem.id]" @click="enhanceOutlineByAi(activeOutlineDetailItem.id, 'full')">
                        {{ outlineAiLoadingById[activeOutlineDetailItem.id] ? '生成中…' : 'AI一键补全' }}
                      </button>
                    </div>
                  </section>

                  <section class="outline-dialog-section">
                    <h3>关联对象</h3>
                    <details class="outline-card__bind" open>
                      <summary>关联角色（{{ (activeOutlineDetailItem.characterIds ?? []).length }}）</summary>
                      <div class="outline-card__bind-chips outline-dialog-bind-chips">
                        <button
                          v-for="c in characters"
                          :key="`ol-char-${activeOutlineDetailItem.id}-${c.id}`"
                          type="button"
                          class="outline-card__bind-chip"
                          :class="{ 'outline-card__bind-chip--active': isOutlineCharacterBound(activeOutlineDetailItem, c.id) }"
                          @click="toggleOutlineCharacterBind(activeOutlineDetailItem.id, c.id)"
                        >
                          {{ charDisplay(c) }}
                        </button>
                        <span v-if="characters.length === 0" class="muted">暂无角色可关联</span>
                      </div>
                      <p class="muted outline-card__bind-summary">已关联：{{ outlineCharacterNames(activeOutlineDetailItem) }}</p>
                    </details>
                    <details class="outline-card__bind">
                      <summary>关联势力（{{ (activeOutlineDetailItem.factionIds ?? []).length }}）</summary>
                      <div class="outline-card__bind-chips outline-dialog-bind-chips">
                        <button
                          v-for="f in factions"
                          :key="`ol-faction-${activeOutlineDetailItem.id}-${f.id}`"
                          type="button"
                          class="outline-card__bind-chip"
                          :class="{ 'outline-card__bind-chip--active': isOutlineFactionBound(activeOutlineDetailItem, f.id) }"
                          @click="toggleOutlineFactionBind(activeOutlineDetailItem.id, f.id)"
                        >
                          {{ factionDisplay(f) }}
                        </button>
                        <span v-if="factions.length === 0" class="muted">暂无势力可关联</span>
                      </div>
                      <p class="muted outline-card__bind-summary">已关联：{{ outlineFactionNames(activeOutlineDetailItem) }}</p>
                    </details>
                    <details class="outline-card__bind">
                      <summary>关联伏笔（{{ (activeOutlineDetailItem.foreshadowIds ?? []).length }}）</summary>
                      <div class="outline-card__bind-chips outline-dialog-bind-chips">
                        <button
                          v-for="fz in foreshadows"
                          :key="`ol-fz-${activeOutlineDetailItem.id}-${fz.id}`"
                          type="button"
                          class="outline-card__bind-chip"
                          :class="{ 'outline-card__bind-chip--active': isOutlineForeshadowBound(activeOutlineDetailItem, fz.id) }"
                          @click="toggleOutlineForeshadowBind(activeOutlineDetailItem.id, fz.id)"
                        >
                          {{ fz.title }}
                        </button>
                        <span v-if="foreshadows.length === 0" class="muted">暂无伏笔可关联</span>
                      </div>
                      <p class="muted outline-card__bind-summary">已关联：{{ outlineForeshadowNames(activeOutlineDetailItem) }}</p>
                    </details>
                  </section>

                  <section class="outline-dialog-section">
                    <h3>落地章节</h3>
                    <p class="outline-card__assoc-hint muted">设置起止章节后，按区间关联章节。</p>
                    <div class="outline-assoc-range">
                      <label class="timeline-add-form__field">
                        <span>开始章节</span>
                        <div class="workspace-dd">
                          <button
                            type="button"
                            class="workspace-dd__btn workspace-dd__btn--compact"
                            :class="{ 'workspace-dd__btn--open': outlineAssocStartDropdownOpenId === activeOutlineDetailItem.id }"
                            :data-dd-key="`outline-assoc-start-${activeOutlineDetailItem.id}`"
                            @click="toggleOutlineAssocStartDropdown(activeOutlineDetailItem.id)"
                          >
                            <span class="workspace-dd__btn-text">{{ outlineAssocStartLabel(activeOutlineDetailItem.id) }}</span>
                            <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                          </button>
                          <div
                            v-if="outlineAssocStartDropdownOpenId === activeOutlineDetailItem.id"
                            class="workspace-dd__panel scrollbar-paper"
                            :class="dropdownPanelDirectionClass(`outline-assoc-start-${activeOutlineDetailItem.id}`)"
                            :data-dd-panel-key="`outline-assoc-start-${activeOutlineDetailItem.id}`"
                            role="listbox"
                          >
                            <button type="button" class="workspace-dd__item" :class="{ 'workspace-dd__item--active': (outlineAssocStartByItemId[activeOutlineDetailItem.id] ?? '') === '' }" @click="setOutlineAssocStart(activeOutlineDetailItem.id, '')">
                              不设置
                            </button>
                            <button
                              v-for="ch in chapters"
                              :key="`oa-s-${activeOutlineDetailItem.id}-${ch.id}`"
                              type="button"
                              class="workspace-dd__item"
                              :class="{ 'workspace-dd__item--active': (outlineAssocStartByItemId[activeOutlineDetailItem.id] ?? '') === String(ch.chapterNo) }"
                              @click="setOutlineAssocStart(activeOutlineDetailItem.id, String(ch.chapterNo))"
                            >
                              {{ chapterDisplayLabel(ch) }}
                            </button>
                          </div>
                        </div>
                      </label>
                      <label class="timeline-add-form__field">
                        <span>结束章节</span>
                        <div class="workspace-dd">
                          <button
                            type="button"
                            class="workspace-dd__btn workspace-dd__btn--compact"
                            :class="{ 'workspace-dd__btn--open': outlineAssocEndDropdownOpenId === activeOutlineDetailItem.id }"
                            :data-dd-key="`outline-assoc-end-${activeOutlineDetailItem.id}`"
                            @click="toggleOutlineAssocEndDropdown(activeOutlineDetailItem.id)"
                          >
                            <span class="workspace-dd__btn-text">{{ outlineAssocEndLabel(activeOutlineDetailItem.id) }}</span>
                            <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                          </button>
                          <div
                            v-if="outlineAssocEndDropdownOpenId === activeOutlineDetailItem.id"
                            class="workspace-dd__panel scrollbar-paper"
                            :class="dropdownPanelDirectionClass(`outline-assoc-end-${activeOutlineDetailItem.id}`)"
                            :data-dd-panel-key="`outline-assoc-end-${activeOutlineDetailItem.id}`"
                            role="listbox"
                          >
                            <button type="button" class="workspace-dd__item" :class="{ 'workspace-dd__item--active': (outlineAssocEndByItemId[activeOutlineDetailItem.id] ?? '') === '' }" @click="setOutlineAssocEnd(activeOutlineDetailItem.id, '')">
                              不设置
                            </button>
                            <button
                              v-for="ch in chapters"
                              :key="`oa-e-${activeOutlineDetailItem.id}-${ch.id}`"
                              type="button"
                              class="workspace-dd__item"
                              :class="{ 'workspace-dd__item--active': (outlineAssocEndByItemId[activeOutlineDetailItem.id] ?? '') === String(ch.chapterNo) }"
                              @click="setOutlineAssocEnd(activeOutlineDetailItem.id, String(ch.chapterNo))"
                            >
                              {{ chapterDisplayLabel(ch) }}
                            </button>
                          </div>
                        </div>
                      </label>
                      <div class="outline-assoc-range__actions">
                        <button type="button" class="btn-secondary" @click="requestCancelOutlineAssoc(activeOutlineDetailItem.id)">取消</button>
                        <button type="button" class="btn-primary" @click="requestApplyOutlineAssoc(activeOutlineDetailItem.id)">确认</button>
                      </div>
                    </div>
                  </section>
                </div>
                <div class="confirm-dialog__actions workspace-outline-dialog__actions">
                  <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeOutlineDetail">完成</button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <ConfirmDialog
        v-model="outlineDeleteOpen"
        title="删除情节点"
        message="确定删除该情节点？已关联该节点的章节将自动解除关联，此操作无法撤销。"
        confirm-label="删除"
        cancel-label="取消"
        danger
        @confirm="confirmDeleteOutline"
        @cancel="onOutlineDeleteDialogCancel"
      />
      <ConfirmDialog
        v-model="outlineAssocApplyConfirmOpen"
        title="确认区间关联"
        message="确认按当前开始/结束章节更新关联吗？区间外原有关联将被取消。"
        confirm-label="确认"
        cancel-label="再想想"
        @confirm="confirmApplyOutlineAssoc"
        @cancel="onOutlineAssocApplyDialogCancel"
      />
      <ConfirmDialog
        v-model="outlineAssocCancelConfirmOpen"
        title="取消修改"
        message="已修改区间设置，确认取消并恢复到当前已关联区间吗？"
        confirm-label="确认取消"
        cancel-label="继续编辑"
        @confirm="confirmCancelOutlineAssoc"
        @cancel="onOutlineAssocCancelDialogCancel"
      />
    </section>

    <section class="card ws-tab-panel" v-show="activeTab === 'characters'">
      <div class="faction-filter-block">
        <label class="faction-filter-label">
          <span>关键字筛选</span>
          <input v-model="characterKeywordFilter" maxlength="30" placeholder="输入角色名称…" class="faction-filter-input" />
        </label>
        <div class="faction-filter-chips">
          <button
            type="button"
            class="faction-filter-chip"
            :class="{ 'faction-filter-chip--active': !selectedCategoryFilterId }"
            @click="clearCategoryFilter"
          >全部（{{ characters.length }}）</button>
          <button
            v-for="cat in sortedCategories"
            :key="`cfilter-${cat.id}`"
            type="button"
            class="faction-filter-chip"
            :class="{ 'faction-filter-chip--active': selectedCategoryFilterId === cat.id }"
            @click="setCategoryFilter(cat.id)"
          >{{ cat.name }}</button>
        </div>
      </div>
      <section class="ws-empty" v-if="filteredCharacters.length === 0">
        <div class="ws-empty__glow" aria-hidden="true"></div>
        <div class="ws-empty__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
          </svg>
        </div>
        <h3 class="ws-empty__title">还没有角色</h3>
        <p class="ws-empty__desc">
          记录主角、配角与反派的画像与关系。角色越完整，AI 续写时越能贴合每个人的性格与处境。
        </p>
        <div class="ws-empty__hints">
          <span class="ws-empty__hint">外貌与性格</span>
          <span class="ws-empty__hint">身份与目标</span>
          <span class="ws-empty__hint">人物关系</span>
        </div>
        <div class="ws-empty__actions">
          <button type="button" class="btn-primary ws-empty__cta" @click="openCharacterCreate">新增第一个角色</button>
        </div>
      </section>

      <section class="panel characters-graph-block" v-else>
        <h2 class="characters-graph-block__title">角色</h2>

        <div class="characters-graph-ui characters-graph-ui--two-boxes">
          <div class="characters-graph-ui__box characters-graph-ui__box--top">
            <div class="characters-graph-ui__box-left">
              <div class="characters-graph-stage">
                <CharacterRelationSphere
                  :characters="filteredCharacters"
                  :relations="filteredCharacterRelations"
                  :focus-character-id="graphFocusCharacterId"
                  @select="onSphereSelect"
                />

                <button type="button" class="characters-graph-stage__add workspace-character__add-btn" @click="openCharacterCreate">
                  新增角色
                </button>
              </div>
            </div>

            <div class="characters-graph-ui__box-right">
              <CharacterProfilePanel
                :character="selectedGraphCharacter"
                :memberships="graphCharacterMemberships"
                :held-items="graphCharacterHeldItems"
                :category-names="selectedGraphCharacter ? categoryNamesByIds(selectedGraphCharacter.categoryIds) : []"
                :faction-name-by-id="factionNameById"
                :display-name="selectedGraphCharacter ? charDisplay(selectedGraphCharacter) : ''"
                show-delete
                placeholder="在上方关系导航中选择角色以查看档案"
                @open-all-changes="openWorkspaceCharacterAllChangesModal"
                @edit="startCharacterEdit"
                @delete="selectedGraphCharacter && openCharacterDelete(selectedGraphCharacter.id)"
              >
                <template #body-extra>
                  <section v-if="selectedGraphCharacter" class="char-figure">
                    <div class="char-figure__head">
                      <h4 class="char-figure__title">角色形象（漫剧用）</h4>
                      <select v-if="novel" v-model="selectedVisualStyle" class="ws-style-picker ws-style-picker--sm" @change="saveVisualStyle">
                        <option value="">🎨 未选画风</option>
                        <option v-for="p in VISUAL_STYLE_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
                      </select>
                    </div>
                    <div class="char-figure__views">
                      <div v-for="meta in CHAR_VIEW_KINDS" :key="meta.kind" class="char-figure__view">
                        <div class="char-figure__thumb">
                          <img
                            v-if="charView(selectedGraphCharacter, meta.kind)?.imageUrl"
                            :src="charView(selectedGraphCharacter, meta.kind)!.imageUrl"
                            :alt="meta.label"
                          />
                          <div v-else class="char-figure__placeholder">
                            <i class="fa-solid fa-user"></i>
                          </div>
                        </div>
                        <span class="char-figure__label">{{ meta.label }}</span>
                        <button
                          type="button"
                          class="char-figure__btn"
                          :disabled="!!charGenningKey || (meta.kind !== 'front' && !frontViewImage(selectedGraphCharacter))"
                          @click="generateCharacterView(selectedGraphCharacter, meta.kind)"
                        >
                          {{ charGenningKey === `${selectedGraphCharacter.id}:${meta.kind}`
                              ? '生成中…'
                              : (charView(selectedGraphCharacter, meta.kind) ? '重新生成' : '生成') }}
                        </button>
                      </div>
                    </div>
                    <p class="char-figure__hint">先生成「正面」，再生成侧面/背面（以正面为基准锁定同一角色）。</p>
                    <p v-if="charGenError" class="char-figure__error">{{ charGenError }}</p>
                  </section>
                </template>
              </CharacterProfilePanel>
            </div>
          </div>

          <div class="characters-graph-ui__box characters-graph-ui__box--bottom">
            <div class="characters-graph-ui__box-left">
              <div class="characters-graph-ui__viz">
                <div class="characters-graph-ui__viz-main">
                  <CharacterRelationFocusSphere
                    v-if="graphFocusCharacterId && visibleCharacters.length > 0"
                    selectable
                    :characters="visibleCharacters"
                    :relations="relatedRelations"
                    :focus-character-id="graphFocusCharacterId"
                    :panel-height="582"
                    @select="onFocusSphereNodeSelect"
                  />

                  <p v-else class="muted">暂无关系。</p>
                </div>
              </div>
            </div>

            <div class="characters-graph-ui__box-right">
              <section class="characters-graph-ui__section characters-graph-ui__toolbar">
              <CharacterGraphRelationToolbar
                v-model:link-mode="graphLinkMode"
                v-model:search-query="graphSphereSearchQuery"
                :novel-id="novelId"
                :focus-character-id="graphFocusCharacterId"
                :pair-character-id="graphFocusSphereSelectedId"
                :characters="characters"
                :relations="characterRelations"
                @relations-changed="onCharacterRelationsChanged"
              />
              </section>
            </div>
          </div>
        </div>

        <ConfirmDialog
          v-model="characterDeleteOpen"
          title="删除角色"
          :message="characterDeleteMessage"
          confirm-label="删除角色"
          cancel-label="取消"
          danger
          @confirm="confirmCharacterDelete"
          @cancel="onCharacterDeleteDialogCancel"
        />

        <Teleport to="body">
          <Transition name="confirm">
            <div
              v-if="characterAllChangesModalOpen && selectedGraphCharacter"
              class="confirm-overlay"
              role="presentation"
            >
              <div class="confirm-dialog chapter-hub__relation-edit-dialog" role="dialog" aria-modal="true">
                <div class="confirm-dialog__accent" aria-hidden="true" />
                <div class="confirm-dialog__body chapter-hub__relation-edit-dialog-body">
                  <h2 class="confirm-dialog__title">角色全部更改 · {{ selectedGraphCharacter.name }}</h2>
                  <CharacterChangeTimeline
                    :character-id="selectedGraphCharacter.id"
                    :novel-id="novelId"
                    :attributes="selectedGraphCharacter.attributes ?? []"
                    dd-key="workspace-character-all-changes-field"
                    @jump="jumpToWorkspaceCharacterChange"
                  />
                  <div class="confirm-dialog__actions chapter-hub__relation-edit-actions">
                    <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeWorkspaceCharacterAllChangesModal">
                      关闭
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
              v-if="characterEditor.characterEditModalOpen.value && selectedGraphCharacter"
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
                    :faction-options="factions"
                    :items="items"
                  />
                  <div class="confirm-dialog__actions workspace-character-edit-dialog__actions">
                    <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="requestCloseCharacterEdit">
                      取消
                    </button>
                    <button
                      type="button"
                      class="confirm-dialog__btn confirm-dialog__btn--danger"
                      :disabled="!characterEditor.canSaveDraft.value"
                      @click="characterEditor.saveCharacterEdit"
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
          v-model="characterEditCancelConfirmOpen"
          title="确认取消"
          message="取消将不保存更改，确定取消吗？"
          confirm-label="确定取消"
          cancel-label="继续编辑"
          danger
          @confirm="forceCancelCharacterEdit"
          @cancel="onCharacterEditCancelDialogCancel"
        />
        <ConfirmDialog
          v-model="characterEditor.renameConfirmOpen.value"
          title="应用新角色名到全文"
          message="你更改了角色名或别名。保存后将把正文中该角色的旧名字/旧别名统一替换为新角色名。是否继续？"
          confirm-label="继续保存"
          cancel-label="取消"
          @confirm="characterEditor.confirmRenameAndSave"
        />
      </section>

      <!-- 新增角色弹框 -->
      <Teleport to="body">
        <Transition name="confirm">
          <div
            v-if="characterCreateOpen"
            class="confirm-overlay"
            role="presentation"
          >
            <div class="confirm-dialog workspace-character-create-dialog" role="dialog" aria-modal="true">
              <div class="confirm-dialog__accent" aria-hidden="true" />
              <div class="confirm-dialog__body workspace-character-create-dialog__body scrollbar-paper">
                <h2 class="confirm-dialog__title">新增角色</h2>

                <div class="workspace-character-create-dialog__scroll scrollbar-paper">
                  <div class="form-grid workspace-character-create-dialog__form">
                  <div class="grid-4 workspace-character-create-dialog__basic-grid">
                    <label>
                      角色名 *
                      <input v-model="characterForm.name" maxlength="40" required />
                    </label>
                    <label>
                      年龄
                      <input v-model="characterForm.age" maxlength="20" />
                    </label>
                    <div class="workspace-character-create-dialog__gender-field">
                      <span class="workspace-character-create-dialog__gender-label">性别</span>
                      <div class="character-gender-toggle character-gender-toggle--compact" role="radiogroup" aria-label="性别">
                        <button
                          v-for="option in genderOptions"
                          :key="`create-gender-${option.value || 'unset'}`"
                          type="button"
                          class="character-gender-toggle__option"
                          :class="{ 'character-gender-toggle__option--active': characterForm.gender === option.value }"
                          role="radio"
                          :aria-checked="characterForm.gender === option.value"
                          @click="characterForm.gender = option.value"
                        >
                          <span class="character-gender-toggle__dot" aria-hidden="true">{{ option.mark }}</span>
                          <span>{{ option.label }}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="character-custom-fields character-custom-fields--modal workspace-character-create-dialog__section">
                    <p class="character-custom-list__title">别名（可选，可多个）</p>
                    <p class="muted" style="font-size: 12px; margin: 4px 0 8px">
                      正文中与角色名同样高亮、识别；与主名重复或彼此重复的条目会自动忽略
                    </p>
                    <div
                      v-for="row in characterForm.aliasRows"
                      :key="row.id"
                      class="character-custom-fields__row"
                    >
                      <label class="character-custom-fields__pair">
                        别名
                        <input v-model="row.value" class="character-custom-fields__input" maxlength="40" />
                      </label>
                      <button
                        type="button"
                        class="btn-danger character-custom-fields__remove"
                        @click="removeCharacterFormAliasRow(row.id)"
                      >
                        删除
                      </button>
                    </div>
                    <button type="button" class="btn-primary" @click="addCharacterFormAliasRow">添加别名</button>
                  </div>

                  <div class="character-custom-fields character-custom-fields--modal workspace-character-create-dialog__section">
                    <p class="character-custom-list__title">所属势力（可选，可多选）</p>
                    <div
                      v-for="(row, idx) in characterForm.membershipRows"
                      :key="`cm-${idx}`"
                      class="character-custom-fields__row"
                    >
                      <label class="character-custom-fields__pair">
                        势力
                        <div class="workspace-dd">
                          <button
                            type="button"
                            class="workspace-dd__btn workspace-dd__btn--compact"
                            :class="{ 'workspace-dd__btn--open': characterCreateMembershipFactionDropdownOpenId === String(idx) }"
                            :data-dd-key="`character-create-membership-${idx}`"
                            @click="toggleCharacterCreateMembershipFactionDropdown(idx)"
                          >
                            <span class="workspace-dd__btn-text">{{ characterMembershipFactionLabel(row.factionId) }}</span>
                            <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                          </button>
                          <div
                            v-if="characterCreateMembershipFactionDropdownOpenId === String(idx)"
                            class="workspace-dd__panel scrollbar-paper"
                            :class="[
                              dropdownPanelDirectionClass(`character-create-membership-${idx}`),
                              { 'workspace-dd__panel--max4': factions.length > 4 },
                            ]"
                            :data-dd-panel-key="`character-create-membership-${idx}`"
                            role="listbox"
                          >
                            <button
                              type="button"
                              class="workspace-dd__item"
                              :class="{ 'workspace-dd__item--active': !row.factionId }"
                              @click="selectCharacterCreateMembershipFaction(idx, '')"
                            >
                              选择势力
                            </button>
                            <button
                              v-for="f in factions"
                              :key="`cfm-${f.id}`"
                              type="button"
                              class="workspace-dd__item"
                              :class="{ 'workspace-dd__item--active': row.factionId === f.id }"
                              @click="selectCharacterCreateMembershipFaction(idx, f.id)"
                            >
                              {{ factionDisplay(f) }}
                            </button>
                          </div>
                        </div>
                      </label>
                      <label class="character-custom-fields__pair">
                        在该势力中的描述（最多 120 字）
                        <input v-model="row.description" type="text" class="character-custom-fields__input" maxlength="120" />
                      </label>
                      <button
                        type="button"
                        class="btn-danger character-custom-fields__remove"
                        @click="removeCharacterFormMembershipRow(idx)"
                      >
                        删除
                      </button>
                    </div>
                    <button type="button" class="btn-primary" @click="addCharacterFormMembershipRow">
                      添加势力关联
                    </button>
                  </div>

                  <div class="character-custom-fields character-custom-fields--modal workspace-character-create-dialog__section">
                    <p class="character-custom-list__title">自定义字段（可选）</p>
                    <div
                      v-for="a in characterForm.attributes"
                      :key="a.id"
                      class="character-custom-fields__row"
                    >
                      <label class="character-custom-fields__pair">
                        字段名
                        <input v-model="a.key" class="character-custom-fields__input" maxlength="40" />
                      </label>
                      <label class="character-custom-fields__pair">
                        字段说明
                        <input v-model="a.value" class="character-custom-fields__input" maxlength="80" />
                      </label>
                      <button type="button" class="btn-danger character-custom-fields__remove" @click="removeCharacterFormRow(a.id)">
                        删除
                      </button>
                    </div>
                    <button type="button" class="btn-primary" @click="addCharacterFormRow">添加自定义字段</button>
                  </div>

                    <p v-if="characterCreateError" class="muted" style="color: var(--danger-text); margin-top: 4px">
                      {{ characterCreateError }}
                    </p>
                  </div>
                </div>
                <div class="confirm-dialog__actions workspace-character-create-dialog__actions">
                  <button
                    type="button"
                    class="confirm-dialog__btn confirm-dialog__btn--ghost"
                    @click="closeCharacterCreate"
                  >
                    取消
                  </button>
                  <button type="button" class="btn-primary workspace-character__create-confirm" @click="submitCreateCharacter">确定</button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </section>

    <section class="card workspace-items-card ws-tab-panel" v-show="activeTab === 'items'">
      <div class="workspace-items-hero">
        <h2>物品</h2>
        <button type="button" class="btn-primary workspace-items-hero__btn" @click="openItemCreate">新增物品</button>
      </div>

      <div class="workspace-items-toolbar">
        <label class="workspace-items-search">
          <span>搜索物品</span>
          <input v-model="itemKeywordFilter" maxlength="40" placeholder="名称 / 简介 / 持有者…" />
        </label>
        <div class="workspace-items-count" aria-label="物品数量">
          <strong>{{ filteredItems.length }}</strong>
          <span>件物品</span>
        </div>
      </div>

      <section v-if="items.length === 0" class="ws-empty">
        <div class="ws-empty__glow" aria-hidden="true"></div>
        <div class="ws-empty__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l8 4.5v9L12 20 4 15.5v-9L12 2z" />
            <path d="M4 6.5L12 11l8-4.5M12 11v9" />
          </svg>
        </div>
        <h3 class="ws-empty__title">还没有物品</h3>
        <p class="ws-empty__desc">
          记录信物、法宝、关键钥匙或任何会推动剧情的东西。绑定持有者后，物品的流转也会更清晰。
        </p>
        <div class="ws-empty__hints">
          <span class="ws-empty__hint">信物 / 法宝</span>
          <span class="ws-empty__hint">关键道具</span>
          <span class="ws-empty__hint">持有者归属</span>
        </div>
        <div class="ws-empty__actions">
          <button type="button" class="btn-primary ws-empty__cta" @click="openItemCreate">添加第一个物品</button>
        </div>
      </section>
      <p v-else-if="filteredItems.length === 0" class="muted workspace-items-no-result">没有符合条件的物品</p>

      <div v-else class="workspace-item-grid">
        <article v-for="item in filteredItems" :id="`workspace-item-${item.id}`" :key="item.id" class="workspace-item-card" :class="{ 'workspace-item-card--focused': focusedItemId === item.id, 'workspace-item-card--ai-focus': aiFocusId === item.id }" @click="setAiFocus(item.id)">
          <div class="workspace-item-card__head">
            <div>
              <p class="workspace-item-card__kicker">物品<span v-if="aiFocusId === item.id" class="workspace-item-card__focus-tag">AI 聚焦中</span></p>
              <h3>{{ item.name }}</h3>
            </div>
            <div class="workspace-item-card__actions">
              <button type="button" class="faction-row__edit" @click.stop="openItemEdit(item.id)">修改</button>
              <button type="button" class="faction-row__delete" @click.stop="openItemDelete(item.id)">删除</button>
            </div>
          </div>
          <div class="workspace-item-card__meta">
            <span>持有者：{{ itemOwnerLabel(item) }}</span>
            <span>{{ itemFirstAppearanceLabel(item) }}</span>
          </div>
          <p class="workspace-item-card__summary">{{ item.summary || '暂无简介' }}</p>
          <div v-if="(item.attributes?.length ?? 0) > 0" class="workspace-item-card__attrs">
            <span v-for="attr in item.attributes" :key="attr.id" class="workspace-item-card__attr">
              <strong>{{ attr.key }}</strong>
              <em>{{ attr.value }}</em>
            </span>
          </div>
        </article>
      </div>

      <ConfirmDialog
        v-model="itemDeleteOpen"
        title="删除物品"
        :message="itemDeleteMessage"
        confirm-label="删除物品"
        cancel-label="取消"
        danger
        @confirm="confirmItemDelete"
        @cancel="onItemDeleteDialogCancel"
      />
    </section>

    <ConfirmDialog
      v-model="categoryDeleteOpen"
      title="删除分类"
      :message="categoryDeleteMessage"
      confirm-label="删除分类"
      cancel-label="取消"
      danger
      @confirm="confirmCategoryDelete"
      @cancel="onCategoryDeleteDialogCancel"
    />

    <Teleport to="body">
      <Transition name="confirm">
        <div v-if="itemCreateOpen" class="confirm-overlay" role="presentation">
          <div class="confirm-dialog workspace-item-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body workspace-item-dialog__body">
              <h2 class="confirm-dialog__title">新增物品</h2>
              <p class="muted workspace-item-dialog__sub">只保留必要信息，后续可用自定义字段补充特殊设定。</p>
              <form class="workspace-item-dialog__form" @submit.prevent="handleCreateItem">
                <div class="workspace-item-dialog__scroll scrollbar-paper">
                <div class="form-grid grid-2">
                  <label>
                    名称 *
                    <input v-model="itemForm.name" maxlength="50" required autocomplete="off" />
                  </label>
                  <div class="workspace-item-owner-picker" :class="{ 'workspace-item-owner-picker--open': itemOwnerPickerOpen }">
                    <div class="workspace-item-owner-picker__head">
                      <span>持有者</span>
                    </div>
                    <button type="button" class="workspace-item-owner-picker__trigger" @click="toggleItemOwnerPicker">
                      <span class="workspace-item-owner-picker__trigger-main">{{ itemOwnerLabel(parseItemOwnerKey(itemForm.ownerKey)) }}</span>
                      <span class="workspace-item-owner-picker__chevron">⌄</span>
                    </button>
                    <div v-if="itemOwnerPickerOpen" class="workspace-item-owner-picker__popover">
                      <input v-model="itemOwnerPickerQuery" maxlength="40" placeholder="搜索角色或势力…" autocomplete="off" />
                      <div class="workspace-item-owner-picker__list scrollbar-paper">
                        <button
                          type="button"
                          class="workspace-item-owner-picker__option workspace-item-owner-picker__option--empty"
                          :class="{ active: itemForm.ownerKey === '' }"
                          @click="setItemFormOwner('')"
                        >
                          <span class="workspace-item-owner-picker__mark">—</span>
                          <span>未绑定</span>
                        </button>
                        <button
                          v-for="owner in filteredItemCreateOwnerRows"
                          :key="`item-owner-${owner.key}`"
                          type="button"
                          class="workspace-item-owner-picker__option"
                          :class="{ active: itemForm.ownerKey === owner.key, [`workspace-item-owner-picker__option--${owner.type}`]: true }"
                          @click="setItemFormOwner(owner.key)"
                        >
                          <span class="workspace-item-owner-picker__mark">{{ owner.type === 'character' ? '角' : '势' }}</span>
                          <span class="workspace-item-owner-picker__label">{{ owner.label }}</span>
                          <em>{{ owner.meta }}</em>
                        </button>
                        <p v-if="filteredItemCreateOwnerRows.length === 0" class="workspace-item-owner-picker__empty">没有匹配的持有者</p>
                      </div>
                    </div>
                  </div>
                </div>
                <p class="muted workspace-item-dialog__derived">首次出现：保存后由正文自动识别</p>
                <label>
                  简介
                  <textarea v-model="itemForm.summary" rows="4" maxlength="500" placeholder="这个物品是什么、为什么重要。" />
                </label>
                <section class="character-custom-fields workspace-item-dialog__attrs">
                  <div class="faction-custom-fields__head">
                    <p class="character-custom-list__title">自定义字段</p>
                  </div>
                  <div v-for="attr in itemForm.attributes" :key="attr.id" class="character-custom-fields__row">
                    <label class="character-custom-fields__pair">
                      字段名
                      <input v-model="attr.key" class="character-custom-fields__input" maxlength="40" />
                    </label>
                    <label class="character-custom-fields__pair">
                      字段说明
                      <input v-model="attr.value" class="character-custom-fields__input" maxlength="80" />
                    </label>
                    <button type="button" class="btn-danger character-custom-fields__remove" @click="removeItemFormRow(attr.id)">删除</button>
                  </div>
                  <button type="button" class="btn-primary" @click="addItemFormRow">添加自定义字段</button>
                </section>
                <p v-if="itemFormError" class="muted workspace-item-dialog__error">{{ itemFormError }}</p>
                </div>
                <div class="confirm-dialog__actions workspace-item-dialog__actions">
                  <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="requestCloseItemCreate">取消</button>
                  <button type="submit" class="confirm-dialog__btn confirm-dialog__btn--danger">保存</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="confirm">
        <div v-if="itemEditOpen" class="confirm-overlay" role="presentation">
          <div class="confirm-dialog workspace-item-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body workspace-item-dialog__body">
              <h2 class="confirm-dialog__title">修改物品</h2>
              <p class="muted workspace-item-dialog__sub">更新物品当前设定；保存后会回到物品列表。</p>
              <form class="workspace-item-dialog__form" @submit.prevent="saveItemEdit">
                <div class="workspace-item-dialog__scroll scrollbar-paper">
                <div class="form-grid grid-2">
                  <label>
                    名称 *
                    <input v-model="itemEditDraft.name" maxlength="50" required autocomplete="off" />
                  </label>
                  <div class="workspace-item-owner-picker" :class="{ 'workspace-item-owner-picker--open': itemEditOwnerPickerOpen }">
                    <div class="workspace-item-owner-picker__head">
                      <span>持有者</span>
                    </div>
                    <button type="button" class="workspace-item-owner-picker__trigger" @click="toggleItemEditOwnerPicker">
                      <span class="workspace-item-owner-picker__trigger-main">{{ itemOwnerLabel(parseItemOwnerKey(itemEditDraft.ownerKey)) }}</span>
                      <span class="workspace-item-owner-picker__chevron">⌄</span>
                    </button>
                    <div v-if="itemEditOwnerPickerOpen" class="workspace-item-owner-picker__popover">
                      <input v-model="itemEditOwnerPickerQuery" maxlength="40" placeholder="搜索角色或势力…" autocomplete="off" />
                      <div class="workspace-item-owner-picker__list scrollbar-paper">
                        <button
                          type="button"
                          class="workspace-item-owner-picker__option workspace-item-owner-picker__option--empty"
                          :class="{ active: itemEditDraft.ownerKey === '' }"
                          @click="setItemEditOwner('')"
                        >
                          <span class="workspace-item-owner-picker__mark">—</span>
                          <span>未绑定</span>
                        </button>
                        <button
                          v-for="owner in filteredItemEditOwnerRows"
                          :key="`item-edit-owner-${owner.key}`"
                          type="button"
                          class="workspace-item-owner-picker__option"
                          :class="{ active: itemEditDraft.ownerKey === owner.key, [`workspace-item-owner-picker__option--${owner.type}`]: true }"
                          @click="setItemEditOwner(owner.key)"
                        >
                          <span class="workspace-item-owner-picker__mark">{{ owner.type === 'character' ? '角' : '势' }}</span>
                          <span class="workspace-item-owner-picker__label">{{ owner.label }}</span>
                          <em>{{ owner.meta }}</em>
                        </button>
                        <p v-if="filteredItemEditOwnerRows.length === 0" class="workspace-item-owner-picker__empty">没有匹配的持有者</p>
                      </div>
                    </div>
                  </div>
                </div>
                <p class="muted workspace-item-dialog__derived">{{ itemFirstAppearanceLabel(itemEditDraft) }}</p>
                <label>
                  简介
                  <textarea v-model="itemEditDraft.summary" rows="4" maxlength="500" placeholder="这个物品是什么、为什么重要。" />
                </label>
                <section class="character-custom-fields workspace-item-dialog__attrs">
                  <div class="faction-custom-fields__head">
                    <p class="character-custom-list__title">自定义字段</p>
                  </div>
                  <div v-for="attr in itemEditDraft.attributes" :key="attr.id" class="character-custom-fields__row">
                    <label class="character-custom-fields__pair">
                      字段名
                      <input v-model="attr.key" class="character-custom-fields__input" maxlength="40" />
                    </label>
                    <label class="character-custom-fields__pair">
                      字段说明
                      <input v-model="attr.value" class="character-custom-fields__input" maxlength="80" />
                    </label>
                    <button type="button" class="btn-danger character-custom-fields__remove" @click="removeItemEditRow(attr.id)">删除</button>
                  </div>
                  <button type="button" class="btn-primary" @click="addItemEditRow">添加自定义字段</button>
                </section>
                <p v-if="itemFormError" class="muted workspace-item-dialog__error">{{ itemFormError }}</p>
                </div>
                <div class="confirm-dialog__actions workspace-item-dialog__actions">
                  <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="requestCloseItemEdit">取消</button>
                  <button type="submit" class="confirm-dialog__btn confirm-dialog__btn--danger">保存</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ConfirmDialog
      v-model="itemCreateCancelConfirmOpen"
      title="确认取消"
      message="取消将不保存更改，确定取消吗？"
      confirm-label="确定取消"
      cancel-label="继续编辑"
      danger
      @confirm="forceCloseItemCreate"
      @cancel="itemCreateCancelConfirmOpen = false"
    />

    <ConfirmDialog
      v-model="itemEditCancelConfirmOpen"
      title="确认取消"
      message="取消将不保存更改，确定取消吗？"
      confirm-label="确定取消"
      cancel-label="继续编辑"
      danger
      @confirm="forceCloseItemEdit"
      @cancel="itemEditCancelConfirmOpen = false"
    />

    <section class="card ws-tab-panel" v-show="activeTab === 'factions'">
      <h2>势力</h2>

      <h3 class="workspace-subsection-title">新建势力</h3>
      <p v-if="factionSavedNotice" class="faction-edit-saved-note">已保存</p>
      <div class="action-row" style="margin-bottom: 14px">
        <button type="button" class="btn-primary" @click="openFactionCreate">新增势力</button>
      </div>

      <section v-if="filteredFactions.length === 0 && !factionKeywordFilter && !selectedCategoryFilterId" class="ws-empty">
        <div class="ws-empty__glow" aria-hidden="true"></div>
        <div class="ws-empty__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 21V8l9-5 9 5v13" />
            <path d="M3 21h18M9 21v-6h6v6M9 11h.01M15 11h.01" />
          </svg>
        </div>
        <h3 class="ws-empty__title">还没有势力</h3>
        <p class="ws-empty__desc">
          建立门派、家族、组织或国家，理清谁与谁结盟、谁与谁对立。势力关系是大世界冲突的骨架。
        </p>
        <div class="ws-empty__hints">
          <span class="ws-empty__hint">门派 / 家族</span>
          <span class="ws-empty__hint">成员与归属</span>
          <span class="ws-empty__hint">结盟与敌对</span>
        </div>
        <div class="ws-empty__actions">
          <button type="button" class="btn-primary ws-empty__cta" @click="openFactionCreate">新增第一个势力</button>
        </div>
      </section>
      <template v-else>
        <div class="faction-filter-block">
          <h3 class="workspace-subsection-title workspace-subsection-title--spaced">已存在势力</h3>
          <label class="faction-filter-label">
            <span>关键字筛选</span>
            <input v-model="factionKeywordFilter" maxlength="30" placeholder="输入势力名称…" class="faction-filter-input" />
          </label>
          <div class="faction-filter-chips">
            <button
              type="button"
              class="faction-filter-chip"
              :class="{ 'faction-filter-chip--active': !selectedCategoryFilterId }"
              @click="clearCategoryFilter"
            >全部（{{ factions.length }}）</button>
            <button
              v-for="cat in sortedCategories"
              :key="`ffilter-${cat.id}`"
              type="button"
              class="faction-filter-chip"
              :class="{ 'faction-filter-chip--active': selectedCategoryFilterId === cat.id }"
              @click="setCategoryFilter(cat.id)"
            >{{ cat.name }}</button>
          </div>
        </div>
        <p v-if="filteredFactions.length === 0" class="muted" style="margin-top: 8px">没有符合条件的势力</p>
        <ul class="list">
        <li v-for="f in filteredFactions" :key="f.id" class="list-item" :id="`faction-row-${f.id}`">
          <div class="chapter-main">
            <div class="faction-row__head">
              <strong class="faction-row__title">{{ factionDisplay(f) }}</strong>
              <div class="faction-row__actions">
                <button type="button" class="faction-row__edit" title="修改势力" @click="openFactionEdit(f.id)">
                  修改
                </button>
                <button type="button" class="faction-row__delete" title="删除势力" @click="openFactionDelete(f.id)">
                  删除
                </button>
              </div>
            </div>
            <div v-if="categoryNamesByIds(f.categoryIds).length > 0" class="faction-row__attrs">
              <small v-for="name in categoryNamesByIds(f.categoryIds)" :key="`fcat-${f.id}-${name}`" class="muted faction-row__attr-chip">
                分类：{{ name }}
              </small>
            </div>
            <div class="faction-row__members">
              <span class="muted faction-row__members-kicker">成员角色</span>
              <ul v-if="factionMemberDisplayList(f.id).length" class="faction-row__member-list">
                <li v-for="mem in factionMemberDisplayList(f.id)" :key="mem.key" class="faction-row__member-item">
                  <span class="faction-row__member-name">{{ mem.name }}</span>
                  <span v-if="mem.description" class="faction-row__member-desc">{{ mem.description }}</span>
                </li>
              </ul>
              <span v-else class="muted">暂无成员</span>
            </div>
            <div class="faction-row__members">
              <span class="muted faction-row__members-kicker">持有物品</span>
              <ul v-if="factionHeldItems(f.id).length" class="faction-row__member-list">
                <li v-for="item in factionHeldItems(f.id)" :key="`fhi-${item.id}`" class="faction-row__member-item">
                  <span class="faction-row__member-name">{{ item.name }}</span>
                </li>
              </ul>
              <span v-else class="muted">暂无物品</span>
            </div>
          </div>
        </li>
        </ul>
      </template>

      <ConfirmDialog
        v-model="factionDeleteOpen"
        title="删除势力"
        :message="factionDeleteMessage"
        confirm-label="删除势力"
        cancel-label="取消"
        danger
        @confirm="confirmFactionDelete"
        @cancel="onFactionDeleteDialogCancel"
      />
    </section>

    <Teleport to="body">
      <Transition name="confirm">
        <div v-if="factionEditOpen" class="confirm-overlay" role="presentation">
          <div class="confirm-dialog workspace-faction-edit-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <Transition name="chapter-hub-save-toast">
              <div v-if="factionEditSavedToast" class="workspace-faction-edit-save-toast" role="status">已保存</div>
            </Transition>
            <div class="confirm-dialog__body workspace-faction-edit-dialog__body">
              <h2 class="confirm-dialog__title">修改势力</h2>
              <div class="workspace-faction-edit-dialog__scroll scrollbar-paper">
                <div class="form-grid" style="margin-top: 12px">
                  <label>
                    势力名
                    <input v-model="factionEditDraft.name" maxlength="50" />
                  </label>
                </div>

                <div class="character-custom-fields faction-custom-fields" style="margin-top: 14px">
                  <div class="faction-custom-fields__head">
                    <p class="character-custom-list__title">分类</p>
                  </div>
                  <p v-if="sortedCategories.length === 0" class="muted" style="margin: 0 0 8px">
                    暂无分类，请在本页「分类」标签中新建。
                  </p>
                  <div v-else class="character-panel__category-checks" role="group" aria-label="势力分类">
                    <label
                      v-for="cat in sortedCategories"
                      :key="`fedit-cat-${cat.id}`"
                      class="category-bind-chip character-panel__category-chip"
                      :class="
                        factionEditDraft.categoryIds.includes(cat.id)
                          ? 'category-bind-chip--bound'
                          : 'category-bind-chip--unbound'
                      "
                      :for="`ws-fedit-cat-${cat.id}`"
                    >
                      <input
                        :id="`ws-fedit-cat-${cat.id}`"
                        type="checkbox"
                        class="visually-hidden"
                        :checked="factionEditDraft.categoryIds.includes(cat.id)"
                        @change="toggleFactionEditDraftCategory(cat.id)"
                      />
                      <span class="category-bind-chip__state" aria-hidden="true">{{
                        factionEditDraft.categoryIds.includes(cat.id) ? '✓' : '+'
                      }}</span>
                      <span class="character-panel__category-chip-text">{{ cat.name }}</span>
                    </label>
                  </div>
                </div>

                <div class="character-custom-fields faction-custom-fields" style="margin-top: 14px">
                  <div class="faction-custom-fields__head">
                    <p class="character-custom-list__title">绑定角色</p>
                  </div>
                  <label class="character-custom-fields__pair">
                    搜索角色
                    <input v-model="factionEditDraft.memberQuery" class="character-custom-fields__input" maxlength="30" />
                  </label>
                  <div class="faction-row__attrs" style="margin-top: 10px">
                    <button
                      v-for="c in factionEditMemberOptionsModal"
                      :key="`femd-${c.id}`"
                      type="button"
                      class="category-bind-chip"
                      :class="factionEditDraft.memberCharIds.includes(c.id) ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'"
                      @click="toggleFactionEditMemberModal(c.id)"
                    >
                      <span class="category-bind-chip__state">{{ factionEditDraft.memberCharIds.includes(c.id) ? '✓' : '+' }}</span>
                      {{ charDisplay(c) }}
                    </button>
                  </div>
                </div>
                <div v-if="factionEditBoundMembers.length > 0" class="character-custom-fields faction-custom-fields" style="margin-top: 14px">
                  <div class="faction-custom-fields__head">
                    <p class="character-custom-list__title">角色描述（最多10字）</p>
                  </div>
                  <div v-for="m in factionEditBoundMembers" :key="`fmd-${m.id}`" class="character-custom-fields__row">
                    <label class="character-custom-fields__pair">
                      角色
                      <input :value="m.name" class="character-custom-fields__input" readonly />
                    </label>
                    <label class="character-custom-fields__pair">
                      描述
                      <input
                        :value="factionEditDraft.memberDescByCharId[m.id] ?? ''"
                        class="character-custom-fields__input"
                        inputmode="text"
                        @compositionstart="onFactionEditMemberDescCompositionStart(m.id)"
                        @compositionend="onFactionEditMemberDescCompositionEnd(m.id, $event)"
                        @input="onFactionEditMemberDescInput(m.id, $event)"
                      />
                    </label>
                  </div>
                </div>

                <div class="character-custom-fields faction-custom-fields" style="margin-top: 14px">
                  <div class="faction-custom-fields__head">
                    <p class="character-custom-list__title">持有物品</p>
                  </div>
                  <p v-if="items.length === 0" class="muted" style="margin: 0 0 8px">暂无物品，请先到「物品」页创建。</p>
                  <label v-else class="character-custom-fields__pair">
                    搜索物品
                    <input v-model="factionEditDraft.itemQuery" class="character-custom-fields__input" maxlength="40" />
                  </label>
                  <div v-if="items.length > 0" class="faction-row__attrs" style="margin-top: 10px">
                    <button
                      v-for="item in factionEditItemOptions"
                      :key="`fedit-item-${item.id}`"
                      type="button"
                      class="category-bind-chip"
                      :class="factionEditDraft.itemIds.includes(item.id) ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'"
                      @click="toggleFactionEditItem(item.id)"
                    >
                      <span class="category-bind-chip__state">{{ factionEditDraft.itemIds.includes(item.id) ? '✓' : '+' }}</span>
                      {{ item.name }} · {{ itemOwnerLabelForDraft(item, 'faction', factionEditId) }}
                    </button>
                  </div>
                  <p v-if="items.length > 0 && factionEditItemOptions.length === 0" class="muted" style="margin: 8px 0 0">没有匹配的物品。</p>
                </div>

                <p v-if="factionFormError" class="muted" style="color: var(--danger-text); margin-top: 10px">
                  {{ factionFormError }}
                </p>
              </div>

              <div class="confirm-dialog__actions" style="margin-top: 14px">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="requestCloseFactionEdit">
                  取消
                </button>
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="saveFactionEdit">
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ConfirmDialog
      v-model="factionEditCancelConfirmOpen"
      title="确认取消"
      message="取消将不保存更改，确定取消吗？"
      confirm-label="确定取消"
      cancel-label="继续编辑"
      danger
      @confirm="forceCloseFactionEdit"
      @cancel="onFactionEditCancelDialogCancel"
    />

    <Teleport to="body">
      <Transition name="confirm">
        <div
          v-if="factionCreateOpen"
          class="confirm-overlay"
          role="presentation"
        >
          <div class="confirm-dialog workspace-faction-create-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body workspace-faction-create-dialog__body">
              <h2 class="confirm-dialog__title">新增势力</h2>
              <form class="form-grid" style="margin-top: 12px" @submit.prevent="handleCreateFaction">
                <label>
                  势力名 *
                  <input v-model="factionForm.name" maxlength="50" required autocomplete="off" />
                </label>
                <div class="character-custom-fields faction-custom-fields" style="margin-top: 10px">
                  <div class="faction-custom-fields__head">
                    <p class="character-custom-list__title">分类</p>
                  </div>
                  <p v-if="sortedCategories.length === 0" class="muted" style="margin: 0 0 8px">
                    暂无分类，请在本页「分类」标签中新建。
                  </p>
                  <div v-else class="character-panel__category-checks" role="group" aria-label="势力分类">
                    <label
                      v-for="cat in sortedCategories"
                      :key="`fcreate-cat-${cat.id}`"
                      class="category-bind-chip character-panel__category-chip"
                      :class="
                        factionForm.categoryIds.includes(cat.id) ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'
                      "
                      :for="`ws-fcreate-cat-${cat.id}`"
                    >
                      <input
                        :id="`ws-fcreate-cat-${cat.id}`"
                        type="checkbox"
                        class="visually-hidden"
                        :checked="factionForm.categoryIds.includes(cat.id)"
                        @change="toggleFactionCreateCategory(cat.id)"
                      />
                      <span class="category-bind-chip__state" aria-hidden="true">{{
                        factionForm.categoryIds.includes(cat.id) ? '✓' : '+'
                      }}</span>
                      <span class="character-panel__category-chip-text">{{ cat.name }}</span>
                    </label>
                  </div>
                </div>
                <p v-if="factionFormError" class="muted" style="color: var(--danger-text); margin-top: 6px">
                  {{ factionFormError }}
                </p>
                <div class="confirm-dialog__actions" style="margin-top: 14px">
                  <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeFactionCreate">
                    取消
                  </button>
                  <button type="submit" class="confirm-dialog__btn confirm-dialog__btn--danger">确定</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <section class="card workspace-items-card ws-tab-panel" v-show="activeTab === 'categories'">
      <div class="workspace-items-hero">
        <h2>分类</h2>
        <button type="button" class="btn-primary workspace-items-hero__btn" @click="openCategoryCreate">添加分类</button>
      </div>

      <section v-if="categories.length === 0" class="ws-empty">
        <div class="ws-empty__glow" aria-hidden="true"></div>
        <div class="ws-empty__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="8" height="8" rx="2" />
            <rect x="13" y="3" width="8" height="8" rx="2" />
            <rect x="3" y="13" width="8" height="8" rx="2" />
            <rect x="13" y="13" width="8" height="8" rx="2" />
          </svg>
        </div>
        <h3 class="ws-empty__title">还没有分类</h3>
        <p class="ws-empty__desc">
          先建几个分类，再到角色或势力上绑定，就能按阵营、地域或类型快速筛选与归档。
        </p>
        <div class="ws-empty__hints">
          <span class="ws-empty__hint">主角阵营</span>
          <span class="ws-empty__hint">反派势力</span>
          <span class="ws-empty__hint">地理区域</span>
        </div>
        <div class="ws-empty__actions">
          <button type="button" class="btn-primary ws-empty__cta" @click="openCategoryCreate">添加第一个分类</button>
        </div>
      </section>

      <template v-else>
        <div class="workspace-items-toolbar workspace-category-toolbar">
          <label class="workspace-items-search">
            <span>搜索分类</span>
            <input v-model="categoryBindCategoryQuery" maxlength="24" placeholder="分类名称…" />
          </label>
          <label class="workspace-items-search">
            <span>搜索角色</span>
            <input v-model="categoryBindCharacterQuery" maxlength="24" placeholder="按绑定角色筛选…" />
          </label>
          <label class="workspace-items-search">
            <span>搜索势力</span>
            <input v-model="categoryBindFactionQuery" maxlength="24" placeholder="按绑定势力筛选…" />
          </label>
        </div>

        <p v-if="categoryCenterFilteredCategories.length === 0" class="muted workspace-items-no-result">没有符合条件的分类</p>

        <div v-else class="workspace-item-grid">
          <article v-for="cat in categoryCenterFilteredCategories" :key="cat.id" class="workspace-item-card" :class="{ 'workspace-item-card--ai-focus': aiFocusId === cat.id }" @click="setAiFocus(cat.id)">
            <div class="workspace-item-card__head">
              <div>
                <p class="workspace-item-card__kicker">分类<span v-if="aiFocusId === cat.id" class="workspace-item-card__focus-tag">AI 聚焦中</span></p>
                <h3>{{ cat.name }}</h3>
              </div>
              <div class="workspace-item-card__actions">
                <button type="button" class="faction-row__edit" @click.stop="openCategoryEdit(cat.id)">修改</button>
                <button type="button" class="faction-row__edit" @click.stop="openCategoryBindModal(cat.id)">绑定</button>
                <button type="button" class="faction-row__delete" @click.stop="openCategoryDelete(cat.id)">删除</button>
              </div>
            </div>
            <p v-if="(cat.notes ?? '').trim()" class="workspace-item-card__summary">{{ cat.notes }}</p>

            <div class="workspace-category-card__bind">
              <p class="workspace-category-card__bind-title">已绑定角色（{{ categoryBoundCharacterNames(cat.id).length }}）</p>
              <p v-if="categoryBoundCharacterNames(cat.id).length === 0" class="muted workspace-category-card__bind-empty">未绑定</p>
              <div v-else class="workspace-item-card__attrs">
                <span
                  v-for="name in categoryBoundCharacterNames(cat.id).slice(0, 18)"
                  :key="`cat-bound-char-${cat.id}-${name}`"
                  class="category-bind-chip category-bind-chip--bound workspace-category-card__chip"
                >
                  <span class="category-bind-chip__state" aria-hidden="true">✓</span>{{ name }}
                </span>
                <span v-if="categoryBoundCharacterNames(cat.id).length > 18" class="muted workspace-category-card__more">
                  +{{ categoryBoundCharacterNames(cat.id).length - 18 }}
                </span>
              </div>
            </div>

            <div class="workspace-category-card__bind">
              <p class="workspace-category-card__bind-title">已绑定势力（{{ categoryBoundFactionNames(cat.id).length }}）</p>
              <p v-if="categoryBoundFactionNames(cat.id).length === 0" class="muted workspace-category-card__bind-empty">未绑定</p>
              <div v-else class="workspace-item-card__attrs">
                <span
                  v-for="name in categoryBoundFactionNames(cat.id).slice(0, 18)"
                  :key="`cat-bound-fac-${cat.id}-${name}`"
                  class="category-bind-chip category-bind-chip--bound workspace-category-card__chip"
                >
                  <span class="category-bind-chip__state" aria-hidden="true">✓</span>{{ name }}
                </span>
                <span v-if="categoryBoundFactionNames(cat.id).length > 18" class="muted workspace-category-card__more">
                  +{{ categoryBoundFactionNames(cat.id).length - 18 }}
                </span>
              </div>
            </div>
          </article>
        </div>
      </template>
    </section>

    <!-- 分类：编辑绑定弹窗（只编辑单个分类，避免主列表渲染海量按钮） -->
    <Teleport to="body">
      <Transition name="confirm">
        <div
          v-if="categoryBindModalOpen && categoryBindModalCategoryId"
          class="confirm-overlay"
          role="presentation"
        >
          <div class="confirm-dialog chapter-hub__relation-edit-dialog workspace-category-bind-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <Transition name="chapter-hub-save-toast">
              <div v-if="categoryBindSavedToast" class="chapter-hub__faction-save-toast" role="status">已保存</div>
            </Transition>
            <div class="confirm-dialog__body chapter-hub__relation-edit-dialog-body">
              <h2 class="confirm-dialog__title">
                编辑分类绑定 · {{ categories.find((c) => c.id === categoryBindModalCategoryId)?.name || '未知分类' }}
              </h2>

              <div class="chapter-hub__relation-edit-top">
                <div class="characters-graph-ui__link-head">
                  <button
                    type="button"
                    class="confirm-dialog__btn confirm-dialog__btn--ghost"
                    :class="{ 'btn-primary--active': categoryBindModalTab === 'characters' }"
                    @click="categoryBindModalTab = 'characters'"
                  >
                    绑定角色
                  </button>
                  <button
                    type="button"
                    class="confirm-dialog__btn confirm-dialog__btn--ghost"
                    :class="{ 'btn-primary--active': categoryBindModalTab === 'factions' }"
                    @click="categoryBindModalTab = 'factions'"
                  >
                    绑定势力
                  </button>
                </div>

                <label v-if="categoryBindModalTab === 'characters'" class="chapter-hub__relation-edit-field">
                  <span>搜索角色</span>
                  <input v-model="categoryBindModalCharacterQuery" class="characters-graph-ui__input" maxlength="24" />
                </label>
                <label v-else class="chapter-hub__relation-edit-field">
                  <span>搜索势力</span>
                  <input v-model="categoryBindModalFactionQuery" class="characters-graph-ui__input" maxlength="24" />
                </label>
              </div>

              <div class="chapter-hub__relation-edit-scroll scrollbar-paper">
                <template v-if="categoryBindModalTab === 'characters'">
                  <button
                    v-for="c in categoryBindModalCharacters"
                    :key="`cat-bind-char-${categoryBindModalCategoryId}-${c.id}`"
                    type="button"
                    class="category-bind-chip"
                    :class="
                      categoryHasCharacter(categoryBindModalCategoryId, c.id)
                        ? 'category-bind-chip--bound'
                        : 'category-bind-chip--unbound'
                    "
                    @click="toggleCharacterCategory(categoryBindModalCategoryId, c.id)"
                  >
                    <span class="category-bind-chip__state" aria-hidden="true">{{
                      categoryHasCharacter(categoryBindModalCategoryId, c.id) ? '✓' : '+'
                    }}</span>
                    {{ charDisplay(c) }}
                  </button>
                  <div class="action-row" style="margin-top: 10px">
                    <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="loadMoreCategoryBindModalCharacters">
                      加载更多
                    </button>
                  </div>
                </template>
                <template v-else>
                  <button
                    v-for="f in categoryBindModalFactions"
                    :key="`cat-bind-fac-${categoryBindModalCategoryId}-${f.id}`"
                    type="button"
                    class="category-bind-chip"
                    :class="
                      categoryHasFaction(categoryBindModalCategoryId, f.id)
                        ? 'category-bind-chip--bound'
                        : 'category-bind-chip--unbound'
                    "
                    @click="toggleFactionCategory(categoryBindModalCategoryId, f.id)"
                  >
                    <span class="category-bind-chip__state" aria-hidden="true">{{
                      categoryHasFaction(categoryBindModalCategoryId, f.id) ? '✓' : '+'
                    }}</span>
                    {{ factionDisplay(f) }}
                  </button>
                  <div class="action-row" style="margin-top: 10px">
                    <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="loadMoreCategoryBindModalFactions">
                      加载更多
                    </button>
                  </div>
                </template>
              </div>

              <div class="chapter-hub__relation-edit-actions">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="requestCancelCategoryBindModal">
                  取消
                </button>
                <button
                  type="button"
                  class="btn-primary"
                  :disabled="!categoryBindingDirty(categoryBindModalCategoryId)"
                  @click="saveCategoryBindModal"
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
      v-model="categoryBindCancelConfirmOpen"
      title="确认取消"
      message="取消将不保存更改，确定取消吗？"
      confirm-label="确定取消"
      cancel-label="继续编辑"
      danger
      @confirm="cancelCategoryBindModal"
      @cancel="categoryBindCancelConfirmOpen = false"
    />

    <Teleport to="body">
      <Transition name="confirm">
        <div v-if="categoryEditOpen" class="confirm-overlay" role="presentation">
          <div class="confirm-dialog workspace-category-edit-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body workspace-category-edit-dialog__body">
              <h2 class="confirm-dialog__title">修改分类</h2>
              <div class="form-grid" style="margin-top: 12px">
                <label>
                  分类名
                  <input v-model="categoryEditDraft.name" maxlength="24" />
                </label>
                <label>
                  分类备注
                  <input v-model="categoryEditDraft.notes" maxlength="200" />
                </label>
              </div>
              <div class="confirm-dialog__actions" style="margin-top: 14px">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="requestCloseCategoryEdit">
                  取消
                </button>
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="saveCategoryEdit">
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ConfirmDialog
      v-model="categoryEditCancelConfirmOpen"
      title="确认取消"
      message="取消将不保存更改，确定取消吗？"
      confirm-label="确定取消"
      cancel-label="继续编辑"
      danger
      @confirm="forceCloseCategoryEdit"
      @cancel="onCategoryEditCancelDialogCancel"
    />

    <Teleport to="body">
      <Transition name="confirm">
        <div
          v-if="categoryCreateOpen"
          class="confirm-overlay"
          role="presentation"
        >
          <div class="confirm-dialog workspace-category-edit-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body workspace-category-edit-dialog__body">
              <h2 class="confirm-dialog__title">添加分类</h2>
              <form class="form-grid" style="margin-top: 12px" @submit.prevent="submitCategoryCreate">
                <label>
                  新分类名
                  <input v-model="categoryCreateName" maxlength="24" autocomplete="off" />
                </label>
                <label>
                  分类备注
                  <input v-model="categoryCreateNotes" maxlength="200" autocomplete="off" />
                </label>
                <p v-if="categoryCreateError" class="muted" style="color: var(--danger-text); margin-top: 4px">
                  {{ categoryCreateError }}
                </p>
                <div class="confirm-dialog__actions" style="margin-top: 14px">
                  <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeCategoryCreate">
                    取消
                  </button>
                  <button type="submit" class="confirm-dialog__btn confirm-dialog__btn--danger">确定</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <section class="card ws-tab-panel" v-show="activeTab === 'issues'">

      <!-- ══════════ 伏笔追踪 ══════════ -->
      <div class="section-header">
        <h2>伏笔追踪</h2>
        <span class="section-header__count muted">{{ foreshadows.length }} 条</span>
      </div>

      <!-- 伏笔状态筛选 -->
      <div v-if="foreshadows.length > 0" class="faction-filter-chips" style="margin-bottom: 12px">
        <button type="button" class="faction-filter-chip" :class="{ 'faction-filter-chip--active': foreshadowFilter === '' }" @click="foreshadowFilter = ''">
          全部（{{ foreshadows.length }}）
        </button>
        <button type="button" class="faction-filter-chip" :class="{ 'faction-filter-chip--active': foreshadowFilter === 'open' }" @click="foreshadowFilter = 'open'">
          未回收（{{ foreshadows.filter(f => f.status === 'open').length }}）
        </button>
        <button type="button" class="faction-filter-chip" :class="{ 'faction-filter-chip--active': foreshadowFilter === 'fulfilled' }" @click="foreshadowFilter = 'fulfilled'">
          已回收（{{ foreshadows.filter(f => f.status === 'fulfilled').length }}）
        </button>
      </div>

      <section v-if="foreshadows.length === 0" class="ws-empty">
        <div class="ws-empty__glow" aria-hidden="true"></div>
        <div class="ws-empty__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18h6M10 21h4" />
            <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.4 1 2.5h6c0-1.1.3-1.8 1-2.5A6 6 0 0 0 12 3z" />
          </svg>
        </div>
        <h3 class="ws-empty__title">还没有伏笔</h3>
        <p class="ws-empty__desc">
          埋下的线索、未解的悬念都可以记成伏笔，回收时一目了然，避免写到后面忘了前面挖的坑。
        </p>
        <div class="ws-empty__hints ws-empty__hints--howto">
          <span class="ws-empty__howto">在写作页正文中选中一段文字，右键选择「设为伏笔」即可添加。</span>
        </div>
      </section>
      <p v-else-if="filteredForeshadows.length === 0" class="muted">没有符合条件的伏笔</p>

      <ul v-else class="fsw-plant-list">
        <li v-for="plant in filteredForeshadows" :key="plant.id" class="fsw-plant-card">
          <!-- 卡片头部 -->
          <div class="fsw-plant-card__head">
            <div class="fsw-plant-card__meta">
              <span class="issue-tag" :class="plant.status === 'open' ? 'issue-tag--status-open' : 'issue-tag--status-resolved'">
                {{ plant.status === 'open' ? '未回收' : '已回收' }}
              </span>
              <span class="fsw-plant-card__ch-badge">第 {{ plant.plantChapterNo }} 章</span>
              <span class="fsw-plant-card__ch-title muted">{{ plant.plantChapterTitle }}</span>
            </div>
            <div class="fsw-plant-card__actions">
              <button type="button" class="issue-card__btn" @click="openForeshadowEdit(plant)">编辑</button>
              <button type="button" class="issue-card__btn" @click="onForeshadowJumpClick(plant)">跳转</button>
              <button type="button" class="issue-card__btn issue-card__btn--danger" @click="handleDeleteForeshadow(plant.id)">删除</button>
            </div>
          </div>

          <div class="fsw-plant-card__text-block">
            <p class="fsw-plant-card__title-line">
              <strong>{{ plant.title }}</strong>
            </p>
            <p v-if="(plant.description ?? '').trim()" class="fsw-plant-card__desc-line muted">{{ plant.description }}</p>
          </div>

          <!-- 原文引用 -->
          <blockquote class="fsw-plant-card__quote">{{ plant.plantText }}</blockquote>

          <p v-if="plant.fulfillments.length > 0" class="fsw-plant-card__fulfill-summary">
            <span class="muted">照应：</span>
            <template v-for="(ff, fIdx) in plant.fulfillments" :key="ff.id">
              <span v-if="fIdx > 0" class="muted"> · </span>
              第 {{ ff.fulfillChapterNo }} 章<span v-if="(ff.fulfillChapterTitle ?? '').trim()" class="muted"> · {{ ff.fulfillChapterTitle }}</span>
              <span v-if="(ff.fulfillText ?? '').trim()" class="muted"> · {{ ff.fulfillText }}</span>
            </template>
          </p>
        </li>
      </ul>

      <ConfirmDialog
        v-model="foreshadowDeleteOpen"
        title="删除伏笔"
        message="确定删除该伏笔记录及其所有填坑？此操作无法撤销。"
        confirm-label="删除"
        cancel-label="取消"
        danger
        @confirm="confirmDeleteForeshadow"
        @cancel="foreshadowDeleteOpen = false"
      />

    <Teleport to="body">
      <Transition name="confirm">
        <div
          v-if="foreshadowEditOpen"
          class="confirm-overlay"
          role="presentation"
        >
          <div class="confirm-dialog workspace-foreshadow-edit-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body workspace-foreshadow-edit-dialog__body">
              <h2 class="confirm-dialog__title">编辑伏笔</h2>
              <div class="workspace-foreshadow-edit-dialog__scroll scrollbar-paper">
                <div class="workspace-foreshadow-edit-dialog__fields">
                  <label>
                    标题
                    <input v-model="foreshadowEditDraft.title" maxlength="40" />
                  </label>
                  <label>
                    说明
                    <textarea v-model="foreshadowEditDraft.description" maxlength="600" rows="3" />
                  </label>
                  <label>
                    植入原文引用
                    <textarea
                      v-model="foreshadowEditDraft.plantText"
                      class="workspace-foreshadow-edit-dialog__plant-text"
                      maxlength="2000"
                      rows="3"
                    />
                  </label>
                  <div v-if="foreshadowEditDraft.fulfillments.length > 0" class="workspace-foreshadow-edit-dialog__fulfillments">
                    <p class="muted workspace-foreshadow-edit-dialog__fulfill-title">照应内容</p>
                    <div
                      v-for="(ff, idx) in foreshadowEditDraft.fulfillments"
                      :key="ff.id"
                      class="workspace-foreshadow-edit-dialog__fulfill-item"
                    >
                      <p class="muted workspace-foreshadow-edit-dialog__fulfill-index">
                        照应 {{ idx + 1 }} · 第 {{ ff.fulfillChapterNo }} 章<span v-if="(ff.fulfillChapterTitle ?? '').trim()"> · {{ ff.fulfillChapterTitle }}</span>
                      </p>
                      <label>
                        照应文本
                        <textarea
                          v-model="ff.fulfillText"
                          class="workspace-foreshadow-edit-dialog__plant-text workspace-foreshadow-edit-dialog__fulfill-textarea"
                          maxlength="2000"
                          rows="2"
                        />
                      </label>
                      <label>
                        说明（可选）
                        <textarea
                          v-model="ff.notes"
                          class="workspace-foreshadow-edit-dialog__plant-text workspace-foreshadow-edit-dialog__fulfill-textarea"
                          maxlength="600"
                          rows="2"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div class="confirm-dialog__actions workspace-foreshadow-edit-dialog__actions" style="margin-top: 14px">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="requestCloseForeshadowEdit">
                  取消
                </button>
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="saveForeshadowEdit">
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ConfirmDialog
      v-model="foreshadowEditCancelConfirmOpen"
      title="确认取消"
      message="取消将不保存更改，确定取消吗？"
      confirm-label="确定取消"
      cancel-label="继续编辑"
      danger
      @confirm="forceCloseForeshadowEdit"
      @cancel="onForeshadowEditCancelDialogCancel"
    />

    <Teleport to="body">
      <Transition name="confirm">
        <div
          v-if="foreshadowJumpOpen && foreshadowJumpTarget"
          class="confirm-overlay"
          role="presentation"
        >
          <div class="confirm-dialog workspace-foreshadow-jump-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body">
              <h2 class="confirm-dialog__title">跳转到写作页</h2>
              <p class="muted">「{{ foreshadowJumpTarget.title }}」已有照应，请选择要查看的位置。</p>
              <div class="workspace-foreshadow-jump-dialog__choices">
                <button type="button" class="btn-primary workspace-foreshadow-jump-dialog__choice" @click="confirmJumpForeshadow('plant')">
                  植入位置（第 {{ foreshadowJumpTarget.plantChapterNo }} 章）
                </button>
                <button
                  v-for="ff in foreshadowJumpTarget.fulfillments"
                  :key="ff.id"
                  type="button"
                  class="btn-primary workspace-foreshadow-jump-dialog__choice workspace-foreshadow-jump-dialog__choice--secondary"
                  @click="confirmJumpForeshadow('fulfill', ff)"
                >
                  照应：第 {{ ff.fulfillChapterNo }} 章<span v-if="(ff.fulfillChapterTitle ?? '').trim()"> · {{ ff.fulfillChapterTitle }}</span>
                </button>
              </div>
              <div class="confirm-dialog__actions" style="margin-top: 14px">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeForeshadowJumpModal">取消</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    </section>

    <section class="card workspace-items-card ws-tab-panel" v-show="activeTab === 'worldsettings'">
      <div class="workspace-items-hero">
        <h2>世界观设定</h2>
        <div class="workspace-items-hero__actions">
          <button type="button" class="btn-secondary" @click="openWorldSettingAiCreate">AI 生成</button>
          <button type="button" class="btn-primary workspace-items-hero__btn" @click="openWorldSettingCreate">新增设定</button>
        </div>
      </div>

      <section v-if="worldSettings.length === 0" class="ws-empty">
        <div class="ws-empty__glow" aria-hidden="true"></div>
        <div class="ws-empty__icon ws-empty__icon--spin" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z" />
          </svg>
        </div>
        <h3 class="ws-empty__title">搭建你的世界观</h3>
        <p class="ws-empty__desc">
          先写下世界的核心规则、力量体系或历史背景。设定越清晰，AI 设计的大纲与剧情就越贴合你的世界。
        </p>
        <div class="ws-empty__hints">
          <span class="ws-empty__hint">修炼境界体系</span>
          <span class="ws-empty__hint">地理与势力分布</span>
          <span class="ws-empty__hint">世界历史与传说</span>
          <span class="ws-empty__hint">特殊规则 / 禁忌</span>
        </div>
        <div class="ws-empty__actions">
          <button type="button" class="btn-primary ws-empty__cta" @click="openWorldSettingCreate">新增第一条设定</button>
          <button type="button" class="btn-secondary ws-empty__cta" @click="openWorldSettingAiCreate">✦ 让 AI 帮我生成</button>
        </div>
      </section>

      <template v-else>
        <div class="workspace-items-toolbar">
          <label class="workspace-items-search">
            <span>搜索设定</span>
            <input v-model="worldSettingKeywordFilter" maxlength="30" placeholder="名称 / 内容关键字…" />
          </label>
          <div class="workspace-items-count" aria-label="设定数量">
            <strong>{{ filteredWorldSettings.length }}</strong>
            <span>条设定</span>
          </div>
        </div>

        <div v-if="sortedCategories.length > 0" class="faction-filter-chips workspace-ws-filter-chips">
          <button
            type="button"
            class="faction-filter-chip"
            :class="{ 'faction-filter-chip--active': !selectedCategoryFilterId }"
            @click="clearCategoryFilter"
          >全部（{{ worldSettings.length }}）</button>
          <button
            v-for="cat in sortedCategories"
            :key="`wsfilter-${cat.id}`"
            type="button"
            class="faction-filter-chip"
            :class="{ 'faction-filter-chip--active': selectedCategoryFilterId === cat.id }"
            @click="setCategoryFilter(cat.id)"
          >{{ cat.name }}</button>
        </div>

        <p v-if="filteredWorldSettings.length === 0" class="muted workspace-items-no-result">没有符合条件的设定</p>

        <div v-else class="workspace-item-grid">
          <article
            v-for="ws in filteredWorldSettings"
            :id="`world-setting-row-${ws.id}`"
            :key="ws.id"
            class="workspace-item-card"
            :class="{
              'workspace-item-card--ai-focus': aiFocusId === ws.id,
              'workspace-item-card--ai-pending': worldSettingPending.updates.has(ws.id) || worldSettingPending.deletes.has(ws.id),
              'workspace-item-card--ai-update': worldSettingPending.updates.has(ws.id) && !worldSettingPending.deletes.has(ws.id),
              'workspace-item-card--ai-delete': worldSettingPending.deletes.has(ws.id),
            }"
            @click="setAiFocus(ws.id)"
          >
            <div v-if="worldSettingPending.updates.has(ws.id) || worldSettingPending.deletes.has(ws.id)" class="ai-pending-banner" :class="{ 'ai-pending-banner--delete': worldSettingPending.deletes.has(ws.id) }">
              <span class="ai-pending-banner__tag">{{ worldSettingPending.deletes.has(ws.id) ? 'AI 待删除' : 'AI 待修改' }}</span>
              <span class="ai-pending-banner__spacer" />
              <button type="button" class="ai-pending-banner__btn ai-pending-banner__btn--primary" @click.stop="adoptAiPending(worldSettingPending.deletes.get(ws.id) || worldSettingPending.updates.get(ws.id)!.actionId)">采用</button>
              <button type="button" class="ai-pending-banner__btn" @click.stop="discardAiPending(worldSettingPending.deletes.get(ws.id) || worldSettingPending.updates.get(ws.id)!.actionId)">忽略</button>
            </div>
            <div class="workspace-item-card__head">
              <div>
                <p class="workspace-item-card__kicker">世界观<span v-if="aiFocusId === ws.id" class="workspace-item-card__focus-tag">AI 聚焦中</span></p>
                <h3>{{ worldSettingPending.updates.get(ws.id)?.name ?? ws.name }}</h3>
              </div>
              <div class="workspace-item-card__actions">
                <button type="button" class="faction-row__edit" title="修改设定" @click.stop="openWorldSettingEdit(ws.id)">修改</button>
                <button type="button" class="faction-row__edit" title="AI 编辑" @click.stop="openWorldSettingAiEdit(ws.id)">AI</button>
                <button type="button" class="faction-row__delete" title="删除设定" @click.stop="openWorldSettingDelete(ws.id)">删除</button>
              </div>
            </div>
            <div v-if="categoryNamesByIds(ws.categoryIds).length > 0" class="workspace-item-card__meta">
              <span v-for="name in categoryNamesByIds(ws.categoryIds)" :key="`wscat-${ws.id}-${name}`">分类：{{ name }}</span>
            </div>
            <div v-if="worldSettingPending.updates.has(ws.id)" class="ws-subcards scrollbar-paper">
              <div
                v-for="card in worldSettingCardDiff(ws)"
                :key="card.id"
                class="ws-subcard"
                :class="{
                  'ws-subcard--added': card.status === 'added',
                  'ws-subcard--removed': card.status === 'removed',
                  'ws-subcard--changed': card.status === 'changed',
                }"
              >
                <p class="ws-subcard__title">
                  <span v-if="card.status === 'added'" class="ws-subcard__tag ws-subcard__tag--add">新增</span>
                  <span v-else-if="card.status === 'removed'" class="ws-subcard__tag ws-subcard__tag--del">删除</span>
                  <span v-else-if="card.status === 'changed'" class="ws-subcard__tag ws-subcard__tag--chg">修改</span>
                  {{ card.key || '未命名' }}
                </p>
                <p v-if="card.status === 'changed'" class="ws-subcard__old">{{ card.oldValue }}</p>
                <div class="ws-subcard__body ws-ai-md" v-html="renderMarkdown(card.value)"></div>
              </div>
            </div>
            <div v-else-if="(ws.attributes ?? []).length > 0" class="ws-subcards scrollbar-paper">
              <div v-for="card in ws.attributes" :key="card.id" class="ws-subcard">
                <p class="ws-subcard__title">{{ card.key || '未命名' }}</p>
                <div class="ws-subcard__body ws-ai-md" v-html="renderMarkdown(card.value)"></div>
              </div>
            </div>
            <p v-else class="workspace-item-card__summary muted">暂无内容</p>
          </article>

          <article
            v-for="phantom in worldSettingPending.creates"
            :key="phantom.id"
            class="workspace-item-card workspace-item-card--ai-pending workspace-item-card--ai-create"
          >
            <div class="ai-pending-banner ai-pending-banner--create">
              <span class="ai-pending-banner__tag">AI 待新增</span>
              <span class="ai-pending-banner__spacer" />
              <button type="button" class="ai-pending-banner__btn ai-pending-banner__btn--primary" @click="adoptAiPending(phantom.id)">采用</button>
              <button type="button" class="ai-pending-banner__btn" @click="discardAiPending(phantom.id)">忽略</button>
            </div>
            <div class="workspace-item-card__head">
              <div>
                <p class="workspace-item-card__kicker">世界观</p>
                <h3>{{ phantom.name }}</h3>
              </div>
            </div>
            <div v-if="phantom.attributes.length > 0" class="ws-subcards scrollbar-paper">
              <div v-for="card in phantom.attributes" :key="card.id" class="ws-subcard">
                <p class="ws-subcard__title">{{ card.key || '未命名' }}</p>
                <div class="ws-subcard__body ws-ai-md" v-html="renderMarkdown(card.value)"></div>
              </div>
            </div>
          </article>
        </div>
      </template>

      <div v-if="worldSettings.length === 0 && worldSettingPending.creates.length > 0" class="workspace-item-grid">
        <article
          v-for="phantom in worldSettingPending.creates"
          :key="phantom.id"
          class="workspace-item-card workspace-item-card--ai-pending workspace-item-card--ai-create"
        >
          <div class="ai-pending-banner ai-pending-banner--create">
            <span class="ai-pending-banner__tag">AI 待新增</span>
            <span class="ai-pending-banner__spacer" />
            <button type="button" class="ai-pending-banner__btn ai-pending-banner__btn--primary" @click="adoptAiPending(phantom.id)">采用</button>
            <button type="button" class="ai-pending-banner__btn" @click="discardAiPending(phantom.id)">忽略</button>
          </div>
          <div class="workspace-item-card__head">
            <div>
              <p class="workspace-item-card__kicker">世界观</p>
              <h3>{{ phantom.name }}</h3>
            </div>
          </div>
          <div v-if="phantom.attributes.length > 0" class="ws-subcards scrollbar-paper">
            <div v-for="card in phantom.attributes" :key="card.id" class="ws-subcard">
              <p class="ws-subcard__title">{{ card.key || '未命名' }}</p>
              <div class="ws-subcard__body ws-ai-md" v-html="renderMarkdown(card.value)"></div>
            </div>
          </div>
        </article>
      </div>

      <ConfirmDialog
        v-model="worldSettingDeleteOpen"
        title="删除世界观设定"
        message="确定要删除这条世界观设定吗？删除后无法恢复。"
        confirm-label="删除"
        cancel-label="取消"
        danger
        @confirm="confirmWorldSettingDelete"
      />
    </section>

    <Teleport to="body">
      <Transition name="confirm">
        <div
          v-if="worldSettingCreateOpen"
          class="confirm-overlay"
          role="presentation"
        >
          <div class="confirm-dialog workspace-faction-create-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body workspace-faction-create-dialog__body">
              <h2 class="confirm-dialog__title">新增世界观设定</h2>
              <form class="form-grid" style="margin-top: 12px" @submit.prevent="handleCreateWorldSetting">
                <label>
                  设定名称 *
                  <input v-model="worldSettingForm.name" maxlength="100" required autocomplete="off" placeholder="例：修炼境界体系" />
                </label>
                <section class="ws-cards-editor" style="margin-top: 10px">
                  <div class="faction-custom-fields__head">
                    <p class="character-custom-list__title">设定卡片（按维度分块，如 力量体系 / 地理 / 历史）</p>
                  </div>
                  <div v-for="card in worldSettingForm.cards" :key="card.id" class="ws-card-row">
                    <input v-model="card.key" class="ws-card-row__title" maxlength="40" placeholder="卡片标题（如 境界划分）" />
                    <textarea v-model="card.value" class="ws-card-row__body" rows="3" maxlength="2000" placeholder="这一块的具体内容…"></textarea>
                    <button type="button" class="ws-card-row__remove" @click="removeWorldSettingFormCard(card.id)">删除</button>
                  </div>
                  <button type="button" class="btn-primary" @click="addWorldSettingFormCard">＋ 添加卡片</button>
                </section>
                <div class="character-custom-fields faction-custom-fields" style="margin-top: 10px">
                  <div class="faction-custom-fields__head">
                    <p class="character-custom-list__title">分类</p>
                  </div>
                  <p v-if="sortedCategories.length === 0" class="muted" style="margin: 0 0 8px">
                    暂无分类，请在本页「分类」标签中新建。
                  </p>
                  <div v-else class="character-panel__category-checks" role="group" aria-label="设定分类">
                    <label
                      v-for="cat in sortedCategories"
                      :key="`wscreate-cat-${cat.id}`"
                      class="category-bind-chip character-panel__category-chip"
                      :class="
                        worldSettingForm.categoryIds.includes(cat.id) ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'
                      "
                      :for="`ws-create-cat-${cat.id}`"
                    >
                      <input
                        :id="`ws-create-cat-${cat.id}`"
                        type="checkbox"
                        class="visually-hidden"
                        :checked="worldSettingForm.categoryIds.includes(cat.id)"
                        @change="toggleWorldSettingFormCategory(cat.id)"
                      />
                      <span class="category-bind-chip__state" aria-hidden="true">{{
                        worldSettingForm.categoryIds.includes(cat.id) ? '✓' : '+'
                      }}</span>
                      <span class="character-panel__category-chip-text">{{ cat.name }}</span>
                    </label>
                  </div>
                </div>
                <p v-if="worldSettingFormError" class="muted" style="color: var(--danger-text); margin-top: 6px">
                  {{ worldSettingFormError }}
                </p>
                <div class="confirm-dialog__actions" style="margin-top: 14px">
                  <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="worldSettingCreateOpen = false">
                    取消
                  </button>
                  <button type="submit" class="confirm-dialog__btn confirm-dialog__btn--danger">确定</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="confirm">
        <div
          v-if="worldSettingEditOpen"
          class="confirm-overlay"
          role="presentation"
        >
          <div class="confirm-dialog workspace-faction-edit-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body workspace-faction-edit-dialog__body">
              <h2 class="confirm-dialog__title">修改世界观设定</h2>
              <div class="workspace-faction-edit-dialog__scroll scrollbar-paper">
              <div class="form-grid" style="margin-top: 12px">
                <label>
                  设定名称 *
                  <input v-model="worldSettingEditDraft.name" maxlength="100" required />
                </label>
                <section class="ws-cards-editor" style="margin-top: 10px">
                  <div class="faction-custom-fields__head">
                    <p class="character-custom-list__title">设定卡片（按维度分块，如 力量体系 / 地理 / 历史）</p>
                  </div>
                  <div v-for="card in worldSettingEditDraft.cards" :key="card.id" class="ws-card-row">
                    <input v-model="card.key" class="ws-card-row__title" maxlength="40" placeholder="卡片标题（如 境界划分）" />
                    <textarea v-model="card.value" class="ws-card-row__body" rows="3" maxlength="2000" placeholder="这一块的具体内容…"></textarea>
                    <button type="button" class="ws-card-row__remove" @click="removeWorldSettingEditCard(card.id)">删除</button>
                  </div>
                  <button type="button" class="btn-primary" @click="addWorldSettingEditCard">＋ 添加卡片</button>
                </section>
                <div class="character-custom-fields faction-custom-fields" style="margin-top: 10px">
                  <div class="faction-custom-fields__head">
                    <p class="character-custom-list__title">分类</p>
                  </div>
                  <div v-if="sortedCategories.length > 0" class="character-panel__category-checks" role="group" aria-label="设定分类">
                    <label
                      v-for="cat in sortedCategories"
                      :key="`wsedit-cat-${cat.id}`"
                      class="category-bind-chip character-panel__category-chip"
                      :class="
                        worldSettingEditDraft.categoryIds.includes(cat.id) ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'
                      "
                      :for="`ws-edit-cat-${cat.id}`"
                    >
                      <input
                        :id="`ws-edit-cat-${cat.id}`"
                        type="checkbox"
                        class="visually-hidden"
                        :checked="worldSettingEditDraft.categoryIds.includes(cat.id)"
                        @change="toggleWorldSettingEditCategory(cat.id)"
                      />
                      <span class="category-bind-chip__state" aria-hidden="true">{{
                        worldSettingEditDraft.categoryIds.includes(cat.id) ? '✓' : '+'
                      }}</span>
                      <span class="character-panel__category-chip-text">{{ cat.name }}</span>
                    </label>
                  </div>
                </div>
              </div>
              </div>
              <div class="confirm-dialog__actions" style="margin-top: 14px">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="worldSettingEditOpen = false">
                  取消
                </button>
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="handleSaveWorldSettingEdit">
                  保存
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
          v-if="worldSettingAiOpen"
          class="confirm-overlay ws-ai-overlay"
          role="presentation"
        >
          <div class="confirm-dialog ws-ai-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />

            <!-- Header -->
            <div class="ws-ai-dialog__header">
              <div class="ws-ai-dialog__header-left">
                <div class="ws-ai-dialog__icon">W</div>
                <div>
                  <h2 class="ws-ai-dialog__title">AI 世界观构建</h2>
                  <p class="ws-ai-dialog__subtitle">
                    {{ worldSettingAiStep === 'input'
                      ? '用一句话或一段话，说说你想要一个什么样的世界'
                      : '看看 AI 写的世界观，不满意就告诉它怎么改'
                    }}
                  </p>
                </div>
              </div>
              <div class="ws-ai-dialog__header-right">
                <div class="ws-ai-step-indicator">
                  <span class="ws-ai-step-indicator__dot" :class="{ 'ws-ai-step-indicator__dot--done': worldSettingAiStep === 'result' }">1</span>
                  <span class="ws-ai-step-indicator__line" :class="{ 'ws-ai-step-indicator__line--done': worldSettingAiStep === 'result' }"></span>
                  <span class="ws-ai-step-indicator__dot" :class="{ 'ws-ai-step-indicator__dot--active': worldSettingAiStep === 'result' }">2</span>
                </div>
                <button type="button" class="ws-ai-dialog__close" aria-label="关闭" @click="worldSettingAiOpen = false">&times;</button>
              </div>
            </div>

            <!-- Body -->
            <div ref="worldSettingAiBodyRef" class="ws-ai-dialog__body scrollbar-paper">

              <!-- Loading overlay -->
              <Transition name="ws-ai-fade">
                <div v-if="worldSettingAiLoading" class="ws-ai-loading-bar">
                  <div class="ws-ai-loading-bar__track">
                    <div class="ws-ai-loading-bar__fill"></div>
                  </div>
                  <span class="ws-ai-loading-bar__text">
                    <span class="ws-ai-loading-dot"></span>
                    {{ worldSettingAiVersion > 0 ? 'AI 正在按你的意见重写…' : 'AI 正在创作世界观…' }}
                  </span>
                  <button type="button" class="btn-secondary ws-ai-loading-bar__stop" @click="stopWorldSettingAiDraft">停止</button>
                </div>
              </Transition>

              <!-- 生成中：实时流式预览 -->
              <div v-if="worldSettingAiLoading && worldSettingAiStreaming" class="ws-ai-stream">
                <div class="ws-ai-md" v-html="renderMarkdown(worldSettingAiStreaming)"></div>
              </div>

              <!-- Step 1: 填表（一段话描述你想要的世界） -->
              <template v-if="worldSettingAiStep === 'input' && !worldSettingAiLoading">
                <div class="ws-ai-field">
                  <span class="ws-ai-field__label">你想要一个什么样的世界？</span>
                  <textarea
                    v-model="worldSettingAiBrief"
                    class="ws-ai-textarea ws-ai-textarea--tall"
                    rows="10"
                    placeholder="用你自己的话随便说，比如：&#10;一个修仙者其实是在改写世界源代码的世界，灵气是算力，渡劫是系统在查杀越权进程……&#10;&#10;说得越具体，AI 写得越贴近你的想法；只写一句话也行，AI 会替你补全。"
                  />
                  <p class="ws-ai-question__hint">不限字数，想到什么写什么。AI 会据此创作一份完整的世界观，生成后你还能继续让它改。</p>
                </div>

                <label class="ws-ai-checkbox">
                  <input type="checkbox" v-model="worldSettingAiUseNovelInfo" />
                  <span class="ws-ai-checkbox__box">{{ worldSettingAiUseNovelInfo ? '✓' : '' }}</span>
                  <span class="ws-ai-checkbox__text">
                    参考本书的书名《{{ novel?.title || '未命名' }}》和简介来生成
                    <span class="ws-ai-checkbox__hint">不勾选则只按你上面写的内容来写，忽略书名简介</span>
                  </span>
                </label>

                <div class="ws-ai-actions ws-ai-actions--spread">
                  <button type="button" class="ws-ai-btn ws-ai-btn--ghost" @click="worldSettingAiOpen = false">
                    取消
                  </button>
                  <button
                    type="button"
                    class="ws-ai-btn ws-ai-btn--primary"
                    @click="generateWorldSettingAiDraft"
                  >
                    开始生成
                  </button>
                </div>
              </template>

              <!-- Step 2: 结果（看长文 + 提修改意见 + 保存） -->
              <template v-else-if="worldSettingAiStep === 'result' && !worldSettingAiLoading">
                <div class="ws-ai-draft-header">
                  <p class="ws-ai-draft-header__text">
                    {{ worldSettingAiVersion > 1 ? `这是第 ${worldSettingAiVersion} 版。` : '' }}下面是 AI 写的世界观，满意就保存；不满意在最下方说说哪里要改，让它重写。
                  </p>
                </div>

                <div class="ws-ai-draft-editor">
                  <label class="ws-ai-field">
                    <span class="ws-ai-field__label">设定名称</span>
                    <input
                      v-model="worldSettingAiDraftName"
                      class="ws-ai-input"
                      maxlength="100"
                      placeholder="输入世界观设定名称…"
                    />
                  </label>

                  <!-- 完整长文预览 -->
                  <div class="ws-ai-field">
                    <span class="ws-ai-field__label">世界观全文</span>
                    <div class="ws-ai-longread ws-ai-md" v-html="renderMarkdown(worldSettingAiDraftContent)"></div>
                  </div>

                  <!-- 自动切分出的卡片（可逐张修改、增删） -->
                  <div class="ws-ai-field">
                    <span class="ws-ai-field__label">设定卡片（自动按维度拆分，可逐张修改、增删）</span>
                    <div class="ws-cards-editor">
                      <div v-for="card in worldSettingAiDraftCards" :key="card.id" class="ws-card-row">
                        <input v-model="card.key" class="ws-card-row__title" maxlength="40" placeholder="卡片标题（如 力量体系）" />
                        <textarea v-model="card.value" class="ws-card-row__body" rows="3" placeholder="这一块的具体内容…"></textarea>
                        <button type="button" class="ws-card-row__remove" @click="removeWorldSettingAiDraftCard(card.id)">删除</button>
                      </div>
                      <button type="button" class="btn-primary" @click="addWorldSettingAiDraftCard">＋ 添加卡片</button>
                    </div>
                  </div>

                  <!-- 修改意见 → 让 AI 重写 -->
                  <div class="ws-ai-field ws-ai-revise">
                    <span class="ws-ai-field__label">哪里不满意？想怎么改？</span>
                    <textarea
                      v-model="worldSettingAiFeedback"
                      class="ws-ai-textarea"
                      rows="3"
                      placeholder="比如：力量体系再硬核一些，加入明确的等级；历史部分太长了精简一下；整体氛围改成更压抑黑暗……"
                    />
                    <button
                      type="button"
                      class="ws-ai-btn ws-ai-btn--revise"
                      :disabled="!worldSettingAiFeedback.trim()"
                      @click="reviseWorldSettingAiDraft"
                    >
                      按意见重写
                    </button>
                  </div>

                  <div class="ws-ai-field">
                    <span class="ws-ai-field__label">分类标签</span>
                    <div v-if="sortedCategories.length === 0" class="ws-ai-field__empty">暂无分类，请先在「分类」标签中新建。</div>
                    <div v-else class="ws-ai-categories">
                      <label
                        v-for="cat in sortedCategories"
                        :key="`wsai-cat-${cat.id}`"
                        class="ws-ai-cat-chip"
                        :class="worldSettingAiDraftCategoryIds.includes(cat.id) ? 'ws-ai-cat-chip--active' : ''"
                      >
                        <input
                          type="checkbox"
                          class="visually-hidden"
                          :checked="worldSettingAiDraftCategoryIds.includes(cat.id)"
                          @change="toggleWorldSettingAiDraftCategory(cat.id)"
                        />
                        <span class="ws-ai-cat-chip__check">{{ worldSettingAiDraftCategoryIds.includes(cat.id) ? '✓' : '+' }}</span>
                        {{ cat.name }}
                      </label>
                    </div>
                  </div>
                </div>

                <div class="ws-ai-actions ws-ai-actions--spread">
                  <button
                    type="button"
                    class="ws-ai-btn ws-ai-btn--ghost"
                    @click="worldSettingAiStep = 'input'"
                  >
                    ← 重新描述
                  </button>
                  <div class="ws-ai-actions__right">
                    <button type="button" class="ws-ai-btn ws-ai-btn--ghost" @click="worldSettingAiOpen = false">
                      取消
                    </button>
                    <button
                      type="button"
                      class="ws-ai-btn ws-ai-btn--primary"
                      :disabled="!worldSettingAiDraftName.trim()"
                      @click="saveWorldSettingAiDraft"
                    >
                      {{ worldSettingAiTargetId ? '更新设定' : '保存为新设定' }}
                    </button>
                  </div>
                </div>
              </template>

              <!-- Error -->
              <Transition name="ws-ai-fade">
                <div v-if="worldSettingAiError" class="ws-ai-error">
                  <span class="ws-ai-error__icon">!</span>
                  <span>{{ worldSettingAiError }}</span>
                  <button type="button" class="ws-ai-error__dismiss" @click="worldSettingAiError = ''">&times;</button>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <section class="card workspace-items-card ws-tab-panel" v-show="activeTab === 'scenes'">
      <div class="workspace-items-hero">
        <h2>场景</h2>
        <div class="workspace-items-hero__actions">
          <select v-if="novel" v-model="selectedVisualStyle" class="ws-style-picker" @change="saveVisualStyle">
            <option value="">🎨 未选画风</option>
            <option v-for="p in VISUAL_STYLE_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
          <button type="button" class="btn-primary workspace-items-hero__btn" @click="openSceneCreate">新增场景</button>
        </div>
      </div>

      <p class="muted" style="margin: 0 0 16px;">
        场景是漫剧素材的一部分：描述每个地点的环境、氛围与外观。后续生成漫剧时，AI 会按剧情调用对应场景。
      </p>

      <section v-if="scenes.length === 0" class="ws-empty">
        <h3 class="ws-empty__title">还没有场景</h3>
        <p class="ws-empty__desc">添加故事里的关键地点（书院、街道、宫殿…），写清它长什么样，方便后续生成画面。</p>
        <div class="ws-empty__actions">
          <button type="button" class="btn-primary ws-empty__cta" @click="openSceneCreate">新增第一个场景</button>
        </div>
      </section>

      <div v-else class="ws-scene-gallery">
        <article
          v-for="scene in scenes"
          :key="scene.id"
          class="ws-scene-tile"
          @click="openSceneDetail(scene)"
        >
          <div class="ws-scene-tile__name">{{ scene.name }}</div>
          <div class="ws-scene-tile__thumb">
            <img
              v-if="scene.views && scene.views.length > 0 && scene.views[scene.views.length - 1].imageUrl"
              :src="scene.views[scene.views.length - 1].imageUrl"
              :alt="scene.name"
            />
            <div v-else class="ws-scene-tile__placeholder">
              <i class="fa-solid fa-image"></i>
              <span>暂无形象</span>
            </div>
          </div>
          <p class="ws-scene-tile__desc">{{ scene.description || '暂无描述' }}</p>
        </article>
      </div>
    </section>

    <WorkspaceAiSidebar
      ref="workspaceAiSidebarRef"
      v-if="activeTab !== 'write'"
      :novel-id="novelId"
      :novel="novel ?? null"
      :focus-entity="aiFocusEntity"
      @applied="reloadWorkspaceFromAi"
      @pending-change="onAiPendingChange"
      @open-change="(v) => (aiSidebarOpen = v)"
      @width-change="(w) => (aiSidebarWidth = w)"
    />

  </section>

  <section v-else class="page-block">
    <div class="card">
      <h2>作品不存在</h2>
      <p class="muted">这个作品可能已被删除，或链接无效。</p>
      <button type="button" class="link-back btn-as-link" @click="backFromPage">返回</button>
    </div>
  </section>

  <EditNovelDialog :open="editNovelOpen" :novel="novel" @close="editNovelOpen = false" @saved="onNovelSaved" />

  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="sceneFormOpen" class="confirm-overlay" @pointerdown.self="closeSceneForm">
        <div class="confirm-dialog ws-scene-form" role="dialog" aria-modal="true" @pointerdown.stop>
          <div class="confirm-dialog__accent" aria-hidden="true"></div>
          <div class="ws-scene-form__body">
            <div class="ws-scene-form__head">
              <h2 class="ws-scene-form__title">{{ sceneEditId ? '编辑场景' : '新增场景' }}</h2>
              <button type="button" class="ws-scene-form__close" aria-label="关闭" @click="closeSceneForm">&times;</button>
            </div>
            <form class="ws-scene-form__form" @submit.prevent="saveSceneForm">
              <label class="ws-scene-form__field">
                <span class="ws-scene-form__label">场景名称</span>
                <input v-model="sceneFormName" class="ws-scene-form__input" required maxlength="40" placeholder="如：青云书院" />
              </label>
              <label class="ws-scene-form__field">
                <span class="ws-scene-form__label">场景描述</span>
                <textarea v-model="sceneFormDescription" class="ws-scene-form__input ws-scene-form__textarea" rows="6" maxlength="2000" placeholder="环境、时代背景、氛围、外观特征…描述越清楚，后续生成画面越贴合"></textarea>
                <span class="ws-scene-form__count">{{ sceneFormDescription.length }}/2000</span>
              </label>
              <div class="ws-scene-form__actions">
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeSceneForm">取消</button>
                <button type="submit" class="btn-primary ws-scene-form__submit" :disabled="!sceneFormName.trim()">保存</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="sceneDetail" class="confirm-overlay" @pointerdown.self="closeSceneDetail">
        <div class="confirm-dialog ws-scene-detail" role="dialog" aria-modal="true" @pointerdown.stop>
          <button type="button" class="ws-scene-detail__close" aria-label="关闭" @click="closeSceneDetail">&times;</button>
          <div class="ws-scene-detail__body">
            <div class="ws-scene-detail__main">
              <img
                v-if="sceneDetailImage"
                :src="sceneDetailImage"
                :alt="sceneDetail.name"
                class="ws-scene-detail__img"
              />
              <div v-else class="ws-scene-detail__img ws-scene-detail__placeholder">
                <i class="fa-solid fa-image"></i>
                <span>暂无形象，点击下方按钮生成</span>
              </div>
            </div>
            <div class="ws-scene-detail__side">
              <h2 class="ws-scene-detail__name">{{ sceneDetail.name }}</h2>
              <p class="ws-scene-detail__desc">{{ sceneDetail.description || '暂无描述' }}</p>

              <p v-if="sceneGenError" class="ws-scene-detail__error">{{ sceneGenError }}</p>

              <div class="ws-scene-detail__actions">
                <button
                  type="button"
                  class="btn-primary"
                  :disabled="sceneGenningId === sceneDetail.id"
                  @click="generateSceneImage(sceneDetail)"
                >
                  {{ sceneGenningId === sceneDetail.id ? '生成中…' : (sceneDetailImage ? '重新生成形象' : 'AI 生成形象') }}
                </button>
                <button type="button" class="btn-secondary" @click="openSceneEdit(sceneDetail); closeSceneDetail()">编辑</button>
                <button type="button" class="btn-as-link ws-scene-detail__del" @click="removeScene(sceneDetail); closeSceneDetail()">删除</button>
              </div>

              <div v-if="sceneDetailImage" class="ws-scene-detail__adjust">
                <span class="ws-scene-detail__adjust-label">不满意？告诉 AI 怎么改（在当前图上调整）</span>
                <div class="ws-scene-detail__adjust-row">
                  <input
                    v-model="sceneAdjustText"
                    class="ws-scene-form__input"
                    maxlength="200"
                    placeholder="如：光线再暗一点 / 加点晨雾 / 换成黄昏 / 多些树木"
                    :disabled="sceneGenningId === sceneDetail.id"
                    @keydown.enter.prevent="adjustSceneImage(sceneDetail)"
                  />
                  <button
                    type="button"
                    class="btn-primary"
                    :disabled="sceneGenningId === sceneDetail.id || !sceneAdjustText.trim()"
                    @click="adjustSceneImage(sceneDetail)"
                  >
                    {{ sceneGenningId === sceneDetail.id ? '调整中…' : '调整' }}
                  </button>
                </div>
              </div>

              <div v-if="sceneDetail.views && sceneDetail.views.length > 1" class="ws-scene-detail__history">
                <span class="ws-scene-detail__history-label">历史形象</span>
                <div class="ws-scene-detail__thumbs">
                  <img
                    v-for="(v, i) in sceneDetail.views"
                    :key="v.id || i"
                    :src="v.imageUrl"
                    :alt="`形象 ${i + 1}`"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
defineOptions({ name: 'NovelWorkspaceView' })
import { useRoute, useRouter } from 'vue-router'
import {
  createCategory,
  createCharacter,
  createCharacterRelation,
  createFaction,
  createItem,
  createOutlineItem,
  createOutlineStoryline,
  createTimelineEvent,
  getOutlineStorylinesByNovelId,
  resolveOutlineStorylineColor,
  buildNovelWorkspacePayload,
  deleteCategory,
  deleteCharacter,
  deleteFaction,
  deleteItem,
  deleteOutlineItem,
  deleteForeshadowPlant,
  replaceItemOwnersForEntity,
  replaceMembershipsForCharacter,
  replaceMembershipsForFaction,
  deleteTimelineEvent,
  updateCategory,
  updateForeshadowPlant,
  updateForeshadowFulfillment,
  getForeshadowsByNovelId,
  getCharacterFactionMembershipsByNovelId,
  getCategoriesByNovelId,
  getCharactersByNovelId,
  getChaptersByNovelId,
  getCharacterRelationsByNovelId,
  getFactionsByNovelId,
  getItemsByNovelId,
  getNovelById,
  getOutlineByNovelId,
  migrateOutlineHierarchy,
  getTimelineByNovelId,
  moveTimelineEvent,
  normalizeCategoryIds,
  upsertNovelRecord,
  recordFactionChangeFields,
  type CharacterChangeDetail,
  updateCharacter,
  updateFaction,
  updateItem,
  updateChapter,
  updateOutlineItem,
  updateTimelineEvent,
  getWorldSettingsByNovelId,
  createWorldSetting,
  updateWorldSetting,
  deleteWorldSetting,
  getScenesByNovelId,
  createScene,
  updateScene,
  deleteScene,
} from '../../lib/storage'
import { characterMatchLabels, normalizeCharacterAliases, buildDisplayNameMap } from '../../lib/characterLabels'
import {
  designOutlineInterviewTurnByAi,
  designOutlineOptionsByAi,
  expandOutlineDesignByAi,
  expandOutlineItemByAi,
  expandOutlineFromExistingByAi,
  expandOutlineScenesForSkeletonByAi,
  expandOutlineSkeletonByAi,
  generateWorldSettingDraftByAi,
  refineOutlineOptionsByAi,
} from '../../lib/localAi'
import { lintOutlineDraftItems } from '../../lib/outlineDraftLint'
import { renderMarkdown } from '../../lib/renderMarkdown'
import {
  childLevelOf,
  levelRank,
  levelText as outlineLevelTextFromLib,
  canHaveChildren,
  OUTLINE_LEVEL_ORDER,
} from '../../lib/outlineHierarchy'
import { syncAllNovelsWithCloud } from '../../lib/cloudSync'
import { getCurrentSession } from '../../lib/auth'
import { generateComicImage } from '../../lib/comicImage'
import { setChromeAnchor } from '../../composables/useChromeAnchor'
import type {
  Category,
  Character,
  Chapter,
  CharacterAttribute,
  AiPendingToolAction,
  CharacterFactionMembership,
  CharacterRelation,
  Faction,
  ForeshadowFulfillment,
  Item,
  ItemOwnerType,
  ForeshadowPlant,
  NewCharacterInput,
  NewItemInput,
  Scene,
  AssetView,
  OutlineItem,
  OutlineNodeLevel,
  OutlinePlotStage,
  OutlineStatus,
  OutlineStoryline,
  OutlineStorylineType,
  OutlineTension,
  TimelineEvent,
  WorldSetting,
  VisualStyleId,
} from '../../types'
import { VISUAL_STYLE_PRESETS } from '../../types'
import CharacterGraphRelationToolbar from '../../components/CharacterGraphRelationToolbar.vue'
import CharacterRelationSphere from '../../components/CharacterRelationSphere.vue'
import CharacterRelationFocusSphere from '../../components/CharacterRelationFocusSphere.vue'
import CharacterProfilePanel from '../../components/character/CharacterProfilePanel.vue'
import CharacterChangeTimeline from '../../components/character/CharacterChangeTimeline.vue'
import EditNovelDialog from '../../components/EditNovelDialog.vue'
import CharacterEditForm from '../../components/character/CharacterEditForm.vue'
import { useCharacterEditor } from '../../composables/useCharacterEditor'
import {
  useWorkspaceGenAi,
  type OutlineAiDraft,
  type OutlineAiOption,
  type OutlineAiFollowupTurn,
  type OutlineAiInterviewQuestion,
  type OutlineAiMode,
  type OutlineAiExpandPreset,
  type OutlineAiDesignerStep,
  type WorldSettingAiStep,
} from '../../composables/useWorkspaceGenAi'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import OutlineBoardView from './components/outline-map/OutlineBoardView.vue'
import OutlineVerticalView from './components/outline-map/OutlineVerticalView.vue'
import WorkspaceAiSidebar from './components/WorkspaceAiSidebar.vue'
import OutlineMindMapInspector from './components/outline-map/OutlineMindMapInspector.vue'
import { useOutlineChapterMapping } from '../../features/outline-map/composables/useOutlineChapterMapping'
import { useOutlineStorylineFilter } from '../../features/outline-map/composables/useOutlineStorylineFilter'
const route = useRoute()
const router = useRouter()
const workspaceChromeAnchorRef = ref<HTMLElement | null>(null)
watch(workspaceChromeAnchorRef, (el) => setChromeAnchor(el), { immediate: true })
onUnmounted(() => {
  setChromeAnchor(null)
  if (focusedItemTimer != null) window.clearTimeout(focusedItemTimer)
})

type WorkspaceTab =
  | 'write'
  | 'outline'
  | 'characters'
  | 'items'
  | 'factions'
  | 'categories'
  | 'issues'
  | 'worldsettings'
  | 'scenes'

const novelId = computed(() => String(route.params.id ?? ''))
const novel = computed(() => getNovelById(novelId.value))
const editNovelOpen = ref(false)

function onNovelSaved(): void {
  editNovelOpen.value = false
}

// 世界观生成 / 大纲设计器的进行中状态走模块级单例（按 novelId 分桶）：
// 切到章节页（跨路由组件销毁）再切回来，生成不中断、结果不丢。下方所有 .value 用法保持不变。
const wsGen = useWorkspaceGenAi(String(route.params.id ?? ''))
const {
  worldSettingAiOpen,
  worldSettingAiStep,
  worldSettingAiLoading,
  worldSettingAiError,
  worldSettingAiTargetId,
  worldSettingAiBrief,
  worldSettingAiUseNovelInfo,
  worldSettingAiFeedback,
  worldSettingAiStreaming,
  worldSettingAiVersion,
  worldSettingAiDraftName,
  worldSettingAiDraftContent,
  worldSettingAiDraftCards,
  worldSettingAiDraftCategoryIds,
  outlineAiDesignerOpen,
  outlineAiMode,
  outlineAiDesignerStep,
  outlineAiDraftIsSkeletonOnly,
  outlineAiAppendMode,
  outlineAiLintDismissed,
  outlineAiExpandAnchorId,
  outlineAiExpandNote,
  outlineAiExpandPreset,
  outlineAiDesignerLoading,
  outlineAiDesignerStreaming,
  outlineAiDesignerWriting,
  outlineAiDesignerError,
  outlineAiDesignerRationale,
  outlineAiDesignerBrief,
  outlineAiDesignerOptions,
  outlineAiDesignerSelectedOptionId,
  outlineAiDesignerDraft,
  outlineAiWriteToast,
  outlineAiInterviewHistory,
  outlineAiCurrentQuestion,
  outlineAiBrief,
  outlineAiUseNovelInfo,
  outlineAiGuideConflict,
  outlineAiGuideProtagonist,
  outlineAiGuideEnding,
  outlineAiCurrentAnswer,
  outlineAiCurrentCustom,
  outlineAiOptionNotes,
  outlineAiOptionRevisionHistory,
  outlineAiCoveredDimensions,
  outlineAiLoadingById,
} = wsGen
const wsGenAborts = wsGen.aborts
const activeTab = ref<WorkspaceTab>('write')
const lastTabBeforeCharacters = ref<Exclude<WorkspaceTab, 'characters'> | ''>('')
const chapters = ref<Chapter[]>([])
const outlineItems = ref<OutlineItem[]>([])
const outlineStorylines = ref<OutlineStoryline[]>([])
const outlineStorylineFilterId = ref('')
const { dimmedOutlineIdSet, matchedCount: storylineMatchedCount } = useOutlineStorylineFilter({
  outlineItems,
  filterStorylineId: outlineStorylineFilterId,
})
const expandedOutlineId = ref<string>('')
const outlineCreateOpen = ref(false)
const outlineAiExpandPresets: Array<{ id: OutlineAiExpandPreset; label: string }> = [
  { id: 'auto', label: '智能判断' },
  { id: 'next_chapters', label: '往后扩章' },
  { id: 'split_scenes', label: '细化场景' },
  { id: 'subplot', label: '补支线' },
]
let outlineAiWriteToastTimer: ReturnType<typeof setTimeout> | null = null
const outlineAiScrollRef = ref<HTMLElement | null>(null)
// 访谈每弹出新问题时，弹窗滚动到底部跟随
watch([outlineAiCurrentQuestion, () => outlineAiInterviewHistory.value.length], () => {
  void nextTick(() => {
    const el = outlineAiScrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})
const outlineDetailOpenId = ref('')
const activeOutlineDetailItem = computed(() =>
  outlineItems.value.find((item) => item.id === outlineDetailOpenId.value) ?? null,
)
const outlineFilter = reactive({
  keyword: '',
  stage: '' as '' | OutlinePlotStage,
  level: '' as '' | OutlineNodeLevel,
  storylineId: '',
})
const outlineViewMode = ref<'console' | 'storyline' | 'structure' | 'rhythm'>('console')
const activeOutlineMapId = ref('')
const outlineMapViewMode = ref<'vertical' | 'board'>('vertical')

// 删除情节点：使用自定义弹窗替代原生 confirm()
const outlineDeleteOpen = ref(false)
const outlineDeleteId = ref<string>('')

const characters = ref<Character[]>([])
const characterRelations = ref<CharacterRelation[]>([])
const factions = ref<Faction[]>([])
const items = ref<Item[]>([])
const scenes = ref<Scene[]>([])
const sceneFormOpen = ref(false)
const sceneEditId = ref<string>('')
const sceneFormName = ref('')
const sceneFormDescription = ref('')
const sceneGenningId = ref<string>('')
const sceneGenError = ref<string>('')
const sceneAdjustText = ref('')
const sceneDetail = ref<Scene | null>(null)
const sceneDetailImage = computed(() => {
  const v = sceneDetail.value?.views
  if (!v || v.length === 0) return ''
  return v[v.length - 1].imageUrl || ''
})
const categories = ref<Category[]>([])
const categoryCreateName = ref('')
const categoryCreateNotes = ref('')
const categoryCreateOpen = ref(false)
const categoryCreateError = ref('')
const categoryEditOpen = ref(false)
const categoryEditId = ref('')
const categoryEditDraft = reactive({ name: '', notes: '' })
const categoryEditInitial = ref({ name: '', notes: '' })
const categoryEditCancelConfirmOpen = ref(false)
const categoryDeleteOpen = ref(false)
const pendingDeleteCategoryId = ref<string | null>(null)
const selectedCategoryFilterId = ref('')
const characterKeywordFilter = ref('')
const itemKeywordFilter = ref('')
const itemOwnerPickerQuery = ref('')
const itemEditOwnerPickerQuery = ref('')
const itemOwnerPickerOpen = ref(false)
const itemEditOwnerPickerOpen = ref(false)
const focusedItemId = ref('')
let focusedItemTimer: number | null = null
const factionKeywordFilter = ref('')
const categoryBindCharacterQuery = ref('')
const categoryBindFactionQuery = ref('')
const categoryBindCategoryQuery = ref('')
const categoryCharacterDraftById = ref<Record<string, string[]>>({})
const categoryFactionDraftById = ref<Record<string, string[]>>({})
// 性能：includes() 在大列表下很慢；用 Set 做 O(1) 绑定判断
const categoryCharacterDraftSetById = ref<Record<string, Set<string>>>({})
const categoryFactionDraftSetById = ref<Record<string, Set<string>>>({})
// 分类页：改为“列表仅展示已绑定 + 弹窗编辑”，避免主列表渲染海量按钮
const categoryBindModalOpen = ref(false)
const categoryBindModalCategoryId = ref('')
const categoryBindModalTab = ref<'characters' | 'factions'>('characters')
const categoryBindModalCharacterQuery = ref('')
const categoryBindModalFactionQuery = ref('')
const categoryBindModalCharLimit = ref(250)
const categoryBindModalFactionLimit = ref(250)
const categoryBindCancelConfirmOpen = ref(false)
const categoryBindSavedToast = ref(false)
let categoryBindSavedToastTimer: number | null = null
const characterFactionMemberships = ref<CharacterFactionMembership[]>([])
const timelineEvents = ref<TimelineEvent[]>([])

// （角色页两行布局：由 CSS grid 负责对齐）

function chapterWordCount(content?: string | null): number {
  return String(content ?? '').replace(/\s/g, '').length
}

function chapterDisplayLabel(ch: Pick<Chapter, 'chapterNo' | 'title' | 'content'>): string {
  return `第 ${ch.chapterNo} 章 · ${ch.title} · ${chapterWordCount(ch.content)} 字`
}
const foreshadows = ref<ForeshadowPlant[]>([])
const foreshadowFilter = ref<'' | 'open' | 'fulfilled'>('')
const foreshadowDeleteOpen = ref(false)
const pendingDeleteForeshadowId = ref<string | null>(null)
const foreshadowEditOpen = ref(false)
const foreshadowEditCancelConfirmOpen = ref(false)
const foreshadowEditDraft = reactive({
  id: '',
  title: '',
  description: '',
  plantText: '',
  fulfillments: [] as Array<{
    id: string
    fulfillText: string
    notes: string
    fulfillChapterNo: number
    fulfillChapterTitle: string
  }>,
})
const foreshadowEditInitial = ref({
  id: '',
  title: '',
  description: '',
  plantText: '',
  fulfillmentsSnapshot: '[]',
})
const foreshadowJumpOpen = ref(false)
const foreshadowJumpTarget = ref<ForeshadowPlant | null>(null)
const worldSettings = ref<WorldSetting[]>([])
const worldSettingKeywordFilter = ref('')
const worldSettingCreateOpen = ref(false)
const worldSettingForm = reactive({ name: '', content: '', categoryIds: [] as string[], cards: [] as CharacterAttribute[] })
const worldSettingFormError = ref('')
const worldSettingEditOpen = ref(false)
const worldSettingEditId = ref('')
const worldSettingEditDraft = reactive({ name: '', content: '', categoryIds: [] as string[], cards: [] as CharacterAttribute[] })
const worldSettingDeleteOpen = ref(false)
const worldSettingDeleteId = ref('')
// 世界观弹窗滚动容器，用于流式输出时自动跟随到底部
const worldSettingAiBodyRef = ref<HTMLElement | null>(null)
// 流式输出跟随：生成中无条件跟随；否则仅当用户已贴近底部（<80px）时跟随，
// 用户手动上滚后即暂停，滚回底部附近自动恢复。
watch(
  () => worldSettingAiStreaming.value,
  () => {
    const el = worldSettingAiBodyRef.value
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (!worldSettingAiLoading.value && !nearBottom) return
    void nextTick(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'instant' as ScrollBehavior })
    })
  },
)
const timelineForm = reactive({
  storyLabel: '',
  title: '',
  summary: '',
  chapterNoStart: '',
  chapterNoEnd: '',
  outlineItemId: '',
})
const timelineCreateOpen = ref(false)
const timelineDeleteOpen = ref(false)
const timelineDeleteId = ref<string>('')
const outlineForm = reactive({
  title: '',
  status: 'todo' as OutlineStatus,
  goal: '',
  summary: '',
})

function normalizeOutlineTensionForUi(value: unknown): OutlineTension {
  const n = Math.round(Number(value))
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n
  return 3
}

const outlineTemplate = reactive({
  event: '',
  conflict: '',
  result: '',
  hook: '',
})

const canFillOutlineSummaryFromTemplate = computed(() =>
  Boolean(
    String(outlineTemplate.event ?? '').trim() ||
      String(outlineTemplate.conflict ?? '').trim() ||
      String(outlineTemplate.result ?? '').trim() ||
      String(outlineTemplate.hook ?? '').trim(),
  ),
)
const filteredOutlineItems = computed(() => {
  const q = outlineFilter.keyword.trim().toLowerCase()
  const all = outlineItems.value
  const byId = new Map(all.map((i) => [i.id, i]))

  const passStage = (item: OutlineItem): boolean =>
    !outlineFilter.stage || (item.plotStage ?? 'idea') === outlineFilter.stage
  const matchKeyword = (item: OutlineItem): boolean => {
    if (!q) return true
    const text = [
      item.title,
      item.summary,
      item.proseSummary ?? '',
      item.goal ?? '',
      item.conflict ?? '',
      item.twist ?? '',
      item.result ?? '',
      item.suspense ?? '',
      item.location ?? '',
      item.timeLabel ?? '',
      outlinePovName(item),
    ]
      .join(' ')
      .toLowerCase()
    return text.includes(q)
  }

  // 层级筛选 = 「展开到该层级为止」的 maxDepth 语义（不是精确匹配）。
  // 选「章」→ 显示卷/幕/章、不展开场景；「全部」→ 不设上限。
  const maxRank = outlineFilter.level ? levelRank(outlineFilter.level) : Infinity

  // 搜索时忽略层级上限（保证深层场景也能被搜到）；无搜索时按上限折叠。
  const baseKeep = all.filter((item) => {
    if (!passStage(item)) return false
    if (q) return matchKeyword(item)
    return levelRank(item.level) <= maxRank
  })

  if (!q) return baseKeep

  // 搜索命中后，把命中节点的祖先链一并纳入，保证树不断裂、能看清归属。
  const keepIds = new Set(baseKeep.map((i) => i.id))
  for (const hit of baseKeep) {
    let cur = hit.parentId ? byId.get(hit.parentId) : undefined
    while (cur && !keepIds.has(cur.id)) {
      keepIds.add(cur.id)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
  }
  return all.filter((i) => keepIds.has(i.id))
})
const outlineLevelOrder: OutlineNodeLevel[] = ['volume', 'act', 'chapter', 'scene']
function nextOutlineLevelDown(level: OutlineNodeLevel): OutlineNodeLevel {
  const idx = outlineLevelOrder.indexOf(level)
  if (idx < 0) return 'scene'
  return outlineLevelOrder[Math.min(idx + 1, outlineLevelOrder.length - 1)]
}
const groupedOutlineItems = computed(() =>
  outlineLevelOrder
    .map((level) => ({
      level,
      label: outlineLevelText(level),
      items: filteredOutlineItems.value.filter((item) => (item.level ?? 'scene') === level),
    }))
    .filter((group) => group.items.length > 0),
)
const outlineStorylineGroups = computed(() => [])

type OutlineTreeNode = { item: OutlineItem; depth: number; children: OutlineTreeNode[] }
const outlineTree = computed<OutlineTreeNode[]>(() => {
  const visible = filteredOutlineItems.value
  const visibleIds = new Set(visible.map((i) => i.id))
  const byParent = new Map<string, OutlineItem[]>()
  for (const item of visible) {
    const pid = item.parentId && visibleIds.has(item.parentId) ? item.parentId : '__root__'
    const arr = byParent.get(pid) ?? []
    arr.push(item)
    byParent.set(pid, arr)
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.order - b.order)
  const build = (pid: string, depth: number): OutlineTreeNode[] =>
    (byParent.get(pid) ?? []).map((item) => ({ item, depth, children: build(item.id, depth + 1) }))
  return build('__root__', 0)
})
const outlineRhythmItems = computed(() =>
  filteredOutlineItems.value.map((item) => ({
    item,
    tension: normalizeOutlineTensionForUi(item.tension),
    linkedCount: getLinkedChaptersCount(item.id),
  })),
)
const outlineConsoleStats = computed(() => {
  const total = outlineItems.value.length
  const linked = outlineItems.value.filter((item) => getLinkedChaptersCount(item.id) > 0).length
  const withCharacters = outlineItems.value.filter((item) => (item.characterIds ?? []).length > 0).length
  const withFactions = outlineItems.value.filter((item) => (item.factionIds ?? []).length > 0).length
  const withForeshadows = outlineItems.value.filter((item) => (item.foreshadowIds ?? []).length > 0).length
  return {
    total,
    linked,
    withCharacters,
    withFactions,
    withForeshadows,
    done: outlineItems.value.filter((i) => i.status === 'done').length,
    doing: outlineItems.value.filter((i) => i.status === 'doing').length,
    todo: outlineItems.value.filter((i) => i.status === 'todo').length,
  }
})
const outlineAiInterviewTurnCount = computed(() =>
  outlineAiInterviewHistory.value.length + (outlineAiCurrentQuestion.value ? 1 : 0),
)
// === 总览页（概览落地页）computed —— 全部基于已有 ref，不改数据模型 ===
const overviewLatestWrittenChapterNo = computed(() => {
  const written = chapters.value.filter((ch) => String(ch.content ?? '').trim().length > 0)
  if (written.length === 0) return 0
  return Math.max(...written.map((ch) => ch.chapterNo))
})
const overviewProgress = computed(() => {
  const all = chapters.value
  const written = all.filter((ch) => String(ch.content ?? '').trim().length > 0)
  const totalChars = all.reduce((sum, ch) => sum + chapterWordCount(ch.content), 0)
  const totalChapters = all.length
  const writtenChapters = written.length
  const outlineTotal = outlineConsoleStats.value.total
  const outlineDone = outlineConsoleStats.value.done
  const pct = outlineTotal > 0 ? Math.round((outlineDone / outlineTotal) * 100) : 0
  return { totalChapters, writtenChapters, totalChars, outlineTotal, outlineDone, outlineLinked: outlineConsoleStats.value.linked, pct }
})
const overviewForeshadow = computed(() => {
  const all = foreshadows.value
  const open = all.filter((f) => f.status === 'open')
  const fulfilled = all.filter((f) => f.status === 'fulfilled')
  const now = overviewLatestWrittenChapterNo.value
  const overdue = open.filter(
    (f) => typeof f.expectedFulfillChapterNo === 'number' && f.expectedFulfillChapterNo > 0 && f.expectedFulfillChapterNo < now,
  )
  const pending = [...open]
    .sort((a, b) => (a.expectedFulfillChapterNo ?? Infinity) - (b.expectedFulfillChapterNo ?? Infinity))
    .slice(0, 4)
  return { openCount: open.length, fulfilledCount: fulfilled.length, overdue, pending }
})
const overviewCast = computed(() => {
  const mains = [...characters.value]
    .sort((a, b) => (a.firstAppearanceChapterNo ?? 9999) - (b.firstAppearanceChapterNo ?? 9999))
    .slice(0, 6)
  return {
    characterCount: characters.value.length,
    factionCount: factions.value.length,
    relationCount: characterRelations.value.length,
    mains,
  }
})
const overviewHealth = computed(() => {
  const items: Array<{ key: string; label: string; tab?: WorkspaceTab }> = []
  const written = chapters.value.filter((ch) => String(ch.content ?? '').trim().length > 0)
  // 1) 已写但未绑定大纲的章
  const unbound = written.filter((ch) => (ch.outlineItemIds ?? []).length === 0)
  if (unbound.length > 0) {
    items.push({ key: 'unbound', label: `${unbound.length} 章已写但未绑定大纲`, tab: 'outline' })
  }
  // 2) 伏笔逾期未回收
  const overdue = overviewForeshadow.value.overdue
  if (overdue.length > 0) {
    items.push({ key: 'overdue', label: `${overdue.length} 条伏笔已过预计回收章仍未收`, tab: 'issues' })
  }
  // 3) 连续性摘要过期（落后最新已写章 5 章以上）
  const now = overviewLatestWrittenChapterNo.value
  const briefEmpty = !String(novel.value?.continuityBrief ?? '').trim()
  if (now >= 6 && briefEmpty) {
    items.push({ key: 'brief-missing', label: `已写 ${now} 章但尚无连续性摘要`, tab: 'write' })
  }
  return items
})
const overviewNextBeat = computed(() => {
  const now = overviewLatestWrittenChapterNo.value
  const next = chapters.value
    .filter((ch) => ch.chapterNo > now)
    .sort((a, b) => a.chapterNo - b.chapterNo)[0]
  const currentArc = (novel.value?.arcSummaries ?? []).find(
    (arc) => now >= arc.chapterRange[0] && now <= arc.chapterRange[1],
  )
  return {
    arcTitle: currentArc?.title ?? '',
    nextChapterNo: next?.chapterNo ?? null,
    nextChapterTitle: next?.title ?? '',
  }
})
const outlineAiResolvedAnswer = computed(() => {
  const custom = outlineAiCurrentCustom.value.trim()
  const selected = outlineAiCurrentAnswer.value.trim()
  if (selected === '__custom__') return custom
  if (selected && custom) return `${selected}（补充：${custom}）`
  if (selected) return selected
  return custom
})
const outlineAiCanSubmitInterview = computed(() => {
  const custom = outlineAiCurrentCustom.value.trim()
  const selected = outlineAiCurrentAnswer.value.trim()
  if (selected && selected !== '__custom__') return true
  return custom.length > 0
})
const outlineAiInterviewCustomPlaceholder = computed(() => {
  const base = outlineAiCurrentQuestion.value?.placeholder || '用一句到几句话回答这轮问题'
  const selected = outlineAiCurrentAnswer.value.trim()
  if (selected && selected !== '__custom__') {
    return `已选「${selected}」；可在此补充你的想法（会与选项一并提交）`
  }
  return base
})
const outlineAiSelectedOptionNote = computed(() => {
  const id = outlineAiDesignerSelectedOptionId.value
  if (!id) return ''
  return String(outlineAiOptionNotes.value[id] ?? '').trim()
})
const selectedOutlineAiOption = computed(() =>
  outlineAiDesignerOptions.value.find((item) => item.id === outlineAiDesignerSelectedOptionId.value) ?? null,
)

const {
  linkedChapterCountByOutlineId,
  getLinkedChaptersForOutline,
} = useOutlineChapterMapping({
  chapters,
})

/** chapter 级大纲节点 → 绑定正文章节的「第N章 · 标题」标签（取最小章号那条）。 */
function getOutlineChapterLabel(outlineId: string): string {
  const linked = getLinkedChaptersForOutline(outlineId)
  if (linked.length === 0) return ''
  const primary = [...linked].sort((a, b) => a.chapterNo - b.chapterNo)[0]
  const title = String(primary.title ?? '').trim()
  const extra = linked.length > 1 ? ` +${linked.length - 1}` : ''
  return `第${primary.chapterNo}章${title ? ` · ${title}` : ''}${extra}`
}

const outlineAiDraftLintIssues = computed(() => {
  const draft = outlineAiDesignerDraft.value
  if (!draft) return []
  // 骨架步骤也校验：此时正好能查「每幕章节是否够」（场景尚未生成）。
  if (outlineAiDesignerStep.value !== 'preview' && outlineAiDesignerStep.value !== 'skeleton') return []
  return lintOutlineDraftItems(draft.items)
})

watch(activeOutlineMapId, (id) => {
  if (!outlineAiDesignerOpen.value || outlineAiMode.value !== 'expand') return
  if (outlineAiDesignerStep.value !== 'expand') return
  if (id) outlineAiExpandAnchorId.value = id
})

const outlineAiSkeletonItemCount = computed(() => {
  const draft = outlineAiDesignerDraft.value
  if (!draft) return 0
  return draft.items.filter((row) => row.level === 'volume' || row.level === 'act' || row.level === 'chapter').length
})

const outlineAiExpandAnchorLabel = computed(() => {
  const item = outlineItems.value.find((row) => row.id === outlineAiExpandAnchorId.value)
  if (!item) return '请先在导图选中一个节点'
  const level = item.level === 'volume' ? '卷' : item.level === 'act' ? '幕' : item.level === 'chapter' ? '章' : '场景'
  return `${level} · ${item.title || '未命名'}`
})

const activeOutlineMapItem = computed(() =>
  outlineItems.value.find((item) => item.id === activeOutlineMapId.value) ?? null,
)

const activeOutlineMapLinkedChapters = computed(() => {
  if (!activeOutlineMapId.value) return []
  return getLinkedChaptersForOutline(activeOutlineMapId.value)
})

const activeOutlineAssocStart = computed(() => {
  const id = activeOutlineMapId.value
  if (!id) return ''
  ensureOutlineAssocRangeState(id)
  return outlineAssocStartByItemId[id] ?? ''
})

const activeOutlineAssocEnd = computed(() => {
  const id = activeOutlineMapId.value
  if (!id) return ''
  ensureOutlineAssocRangeState(id)
  return outlineAssocEndByItemId[id] ?? ''
})

const activeOutlineAssocDirty = computed(() => {
  const id = activeOutlineMapId.value
  if (!id) return false
  return isOutlineAssocDirty(id)
})

watch(outlineItems, (items) => {
  if (items.length === 0) {
    activeOutlineMapId.value = ''
    return
  }
  if (!items.some((item) => item.id === activeOutlineMapId.value)) {
    activeOutlineMapId.value = items[0].id
  }
}, { immediate: true })

watch(activeOutlineMapId, (id) => {
  if (id) syncOutlineAssocRangeState(id)
}, { immediate: true })

function selectOutlineMindMapNode(outlineId: string): void {
  if (!outlineItems.value.some((item) => item.id === outlineId)) return
  activeOutlineMapId.value = outlineId
}

function patchOutlineFromMindMap(outlineId: string, patch: Partial<OutlineItem>): void {
  updateOutlineItem({ id: outlineId, ...patch })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function createOutlineNodeFromMindMap(
  action: 'child' | 'sibling' | 'root',
  anchorId?: string,
): void {
  const currentNovel = novel.value
  if (!currentNovel) return

  const anchor = anchorId
    ? outlineItems.value.find((item) => item.id === anchorId) ?? null
    : null

  let parentId: string | null = null
  if (action === 'child') {
    parentId = anchor?.id ?? (activeOutlineMapId.value || null)
  } else if (action === 'sibling') {
    const siblingAnchor = anchor ?? outlineItems.value.find((item) => item.id === activeOutlineMapId.value) ?? null
    parentId = siblingAnchor?.parentId ?? null
  }

  const level: OutlineNodeLevel = action === 'root'
    ? 'volume'
    : action === 'child'
      ? nextOutlineLevelDown(anchor?.level ?? 'chapter')
      : (anchor?.level ?? 'scene')

  const created = createOutlineItem({
    novelId: currentNovel.id,
    title: '新节点',
    summary: '',
    level,
    parentId,
    storylineIds: anchor?.storylineIds ?? [],
    timeLabel: '',
    location: '',
    povCharacterId: null,
    tension: 3,
    goal: '',
    conflict: '',
    twist: '',
    result: '',
    suspense: '',
  })

  outlineItems.value = getOutlineByNovelId(currentNovel.id)
  activeOutlineMapId.value = created.id
}

function reorderOutlineNode(payload: { draggedId: string; targetId: string; position: 'before' | 'after' | 'child' }): void {
  const { draggedId, targetId, position } = payload
  if (!novelId.value || draggedId === targetId) return
  const items = outlineItems.value
  const dragged = items.find((i) => i.id === draggedId)
  const target = items.find((i) => i.id === targetId)
  if (!dragged || !target) return

  // 禁止拖入自己的子孙，避免成环
  const isDescendant = (ancestorId: string, nodeId: string): boolean => {
    let cur = items.find((i) => i.id === nodeId)
    while (cur?.parentId) {
      if (cur.parentId === ancestorId) return true
      cur = items.find((i) => i.id === cur!.parentId)
    }
    return false
  }
  if (isDescendant(draggedId, targetId)) return

  // 拖成 target 的子节点时，target 必须能有子层（场景是末级，禁止）
  if (position === 'child' && !canHaveChildren(target.level ?? 'volume')) return

  const newParentId = position === 'child' ? target.id : (target.parentId ?? null)
  const newParent = newParentId ? items.find((i) => i.id === newParentId) : null
  const newLevel = childLevelOf(newParent?.level ?? null)

  const siblings = items
    .filter((i) => (i.parentId ?? null) === newParentId && i.id !== draggedId)
    .sort((a, b) => a.order - b.order)
  let insertAt = siblings.length
  if (position !== 'child') {
    const idx = siblings.findIndex((i) => i.id === targetId)
    insertAt = position === 'before' ? idx : idx + 1
  }
  siblings.splice(insertAt, 0, dragged)

  updateOutlineItem({ id: dragged.id, parentId: newParentId, level: newLevel })
  siblings.forEach((sib, idx) => updateOutlineItem({ id: sib.id, order: idx }))
  // 跨级拖动后，子孙的 level 需要按新深度逐层重算，否则层级错乱
  recomputeSubtreeLevels(dragged.id)
  outlineItems.value = getOutlineByNovelId(novelId.value)
  activeOutlineMapId.value = dragged.id
}

/** DFS 重设某节点所有子孙的 level（按 parentId 推导），用于拖动子树后修正层级。 */
function recomputeSubtreeLevels(rootId: string): void {
  const all = getOutlineByNovelId(novelId.value)
  const byParent = new Map<string, OutlineItem[]>()
  for (const it of all) {
    if (!it.parentId) continue
    const list = byParent.get(it.parentId) ?? []
    list.push(it)
    byParent.set(it.parentId, list)
  }
  const root = all.find((i) => i.id === rootId)
  if (!root) return
  const walk = (node: OutlineItem): void => {
    for (const child of byParent.get(node.id) ?? []) {
      const expected = childLevelOf(node.level ?? null)
      if ((child.level ?? null) !== expected) {
        updateOutlineItem({ id: child.id, level: expected })
        child.level = expected
      }
      walk(child)
    }
  }
  walk(root)
}

function jumpToWritingChapterFromOutline(chapterId: string): void {
  if (!novelId.value) return
  void router.push({
    path: `/novels/${novelId.value}/chapter-writing`,
    query: { chapterId },
  })
}
const genderOptions = [
  { value: '', label: '未设', mark: '—' },
  { value: '男', label: '男', mark: '♂' },
  { value: '女', label: '女', mark: '♀' },
]

const characterForm = reactive({
  name: '',
  age: '',
  gender: '',
  attributes: [] as CharacterAttribute[],
  aliasRows: [] as { id: string; value: string }[],
  categoryIds: [] as string[],
  /** 新建角色时加入的势力及描述 */
  membershipRows: [] as { factionId: string; description: string }[],
})
const characterCreateError = ref('')
const itemFormError = ref('')
const factionFormError = ref('')
const characterCreateOpen = ref(false)
const itemForm = reactive({
  name: '',
  summary: '',
  ownerKey: '',
  attributes: [] as CharacterAttribute[],
})
const itemCreateCancelConfirmOpen = ref(false)
const itemEditDraft = reactive({
  id: '',
  name: '',
  summary: '',
  ownerKey: '',
  firstAppearanceChapterNo: null as number | null,
  attributes: [] as CharacterAttribute[],
})
const itemEditInitial = ref({
  name: '',
  summary: '',
  ownerKey: '',
  attrs: [] as Array<{ key: string; value: string }>,
})
const itemEditCancelConfirmOpen = ref(false)
const itemCreateOpen = ref(false)
const itemEditOpen = ref(false)
const itemDeleteOpen = ref(false)
const pendingDeleteItemId = ref<string | null>(null)
const factionForm = reactive({
  name: '',
  categoryIds: [] as string[],
})
const factionCreateOpen = ref(false)
const factionEditOpen = ref(false)
const factionEditId = ref('')
const factionEditDraft = reactive({
  name: '',
  memberQuery: '',
  itemQuery: '',
  memberCharIds: [] as string[],
  itemIds: [] as string[],
  memberDescByCharId: {} as Record<string, string>,
  categoryIds: [] as string[],
})
const factionEditMemberDescComposing = reactive<Record<string, boolean>>({})
const factionEditInitial = ref({
  name: '',
  memberCharIds: [] as string[],
  itemIds: [] as string[],
  memberDescByCharId: {} as Record<string, string>,
  categoryIds: [] as string[],
})
const factionEditCancelConfirmOpen = ref(false)
const factionEditSavedToast = ref(false)
const factionSavedNotice = ref(false)
// （势力编辑）改为弹窗草稿形态，memberQuery/memberCharIds 在 factionEditDraft 内维护
const characterDeleteOpen = ref(false)
const pendingDeleteCharacterId = ref<string | null>(null)
const factionDeleteOpen = ref(false)
const pendingDeleteFactionId = ref<string | null>(null)

// 角色关系网：当前聚焦角色（用于显示/编辑属性与关系）
const graphFocusCharacterId = ref<string>('')
const graphFocusCharacterDropdownOpen = ref(false)
/** 右侧「角色信息」：须先点「修改」，再点「保存」 */
const characterEditCancelConfirmOpen = ref(false)
const timelineChapterDropdownOpen = ref(false)
const timelineChapterEndDropdownOpen = ref(false)
const timelineOutlineDropdownOpen = ref(false)
/** 首次出场改为自动绑定；保留调用点以兼容现有下拉收起流程 */
function closeCharacterChapterPickers(): void {
  // no-op
}
const timelineEventChapterStartDropdownOpenId = ref('')
const timelineEventChapterEndDropdownOpenId = ref('')
const timelineEventOutlineDropdownOpenId = ref('')
const characterCreateMembershipFactionDropdownOpenId = ref('')
const dropdownDirectionByKey = reactive<Record<string, 'up' | 'down'>>({})
const outlineAssocStartDropdownOpenId = ref('')
const outlineAssocEndDropdownOpenId = ref('')
const outlineAssocStartByItemId = reactive<Record<string, string>>({})
const outlineAssocEndByItemId = reactive<Record<string, string>>({})
const outlineAssocApplyConfirmOpen = ref(false)
const outlineAssocCancelConfirmOpen = ref(false)
const pendingOutlineAssocActionId = ref('')
const graphAttributeKey = ref('')
const graphAttributeValue = ref('')

/** 与章节写作弹窗同款：编辑关系 / 已有关系列表 */
const graphLinkMode = ref(false)
/** 下方聚焦图中点击的节点（非中心时展示与中心的双向关系） */
const graphFocusSphereSelectedId = ref('')
const graphSphereSearchQuery = ref('')

const timelineChapterDropdownLabel = computed(() => {
  if (!timelineForm.chapterNoStart) return '不关联'
  const no = Number(timelineForm.chapterNoStart)
  const ch = chapters.value.find((x) => x.chapterNo === no)
  return ch ? `第 ${ch.chapterNo} 章 · ${ch.title}` : '不关联'
})

const timelineChapterEndDropdownLabel = computed(() => {
  if (!timelineForm.chapterNoEnd) return '不设置'
  const no = Number(timelineForm.chapterNoEnd)
  const ch = chapters.value.find((x) => x.chapterNo === no)
  return ch ? `第 ${ch.chapterNo} 章 · ${ch.title}` : '不设置'
})

const timelineOutlineDropdownLabel = computed(() => {
  if (!timelineForm.outlineItemId) return '不关联'
  const o = outlineItems.value.find((x) => x.id === timelineForm.outlineItemId)
  return o ? `#${o.order} · ${o.title}` : '不关联'
})

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

function selectTimelineChapter(value: string): void {
  timelineForm.chapterNoStart = value
  timelineChapterDropdownOpen.value = false
}

function toggleTimelineChapterDropdown(): void {
  timelineChapterDropdownOpen.value = !timelineChapterDropdownOpen.value
  if (timelineChapterDropdownOpen.value) {
    resolveDropdownDirection('timeline-create-start')
    timelineChapterEndDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    timelineEventChapterStartDropdownOpenId.value = ''
    timelineEventChapterEndDropdownOpenId.value = ''
    timelineEventOutlineDropdownOpenId.value = ''
  }
}

function selectTimelineChapterEnd(value: string): void {
  timelineForm.chapterNoEnd = value
  timelineChapterEndDropdownOpen.value = false
}

function toggleTimelineChapterEndDropdown(): void {
  timelineChapterEndDropdownOpen.value = !timelineChapterEndDropdownOpen.value
  if (timelineChapterEndDropdownOpen.value) {
    resolveDropdownDirection('timeline-create-end')
    timelineChapterDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    timelineEventChapterStartDropdownOpenId.value = ''
    timelineEventChapterEndDropdownOpenId.value = ''
    timelineEventOutlineDropdownOpenId.value = ''
  }
}

function selectTimelineOutline(value: string): void {
  timelineForm.outlineItemId = value
  timelineOutlineDropdownOpen.value = false
}

function toggleTimelineOutlineDropdown(): void {
  timelineOutlineDropdownOpen.value = !timelineOutlineDropdownOpen.value
  if (timelineOutlineDropdownOpen.value) {
    resolveDropdownDirection('timeline-create-outline')
    timelineChapterDropdownOpen.value = false
    timelineChapterEndDropdownOpen.value = false
    timelineEventChapterStartDropdownOpenId.value = ''
    timelineEventChapterEndDropdownOpenId.value = ''
    timelineEventOutlineDropdownOpenId.value = ''
  }
}

function timelineEventChapterStartLabel(ev: TimelineEvent): string {
  if (ev.chapterNoStart == null) return '不关联'
  const ch = chapters.value.find((x) => x.chapterNo === ev.chapterNoStart)
  return ch ? `第 ${ch.chapterNo} 章 · ${ch.title}` : `第 ${ev.chapterNoStart} 章`
}

function timelineEventChapterEndLabel(ev: TimelineEvent): string {
  if (ev.chapterNoEnd == null) return '不设置'
  const ch = chapters.value.find((x) => x.chapterNo === ev.chapterNoEnd)
  return ch ? `第 ${ch.chapterNo} 章 · ${ch.title}` : `第 ${ev.chapterNoEnd} 章`
}

function timelineEventOutlineLabel(ev: TimelineEvent): string {
  if (!ev.outlineItemId) return '不关联'
  const o = outlineItems.value.find((x) => x.id === ev.outlineItemId)
  return o ? `#${o.order} · ${o.title}` : '不关联'
}

function toggleTimelineEventChapterStartDropdown(eventId: string): void {
  timelineEventChapterStartDropdownOpenId.value =
    timelineEventChapterStartDropdownOpenId.value === eventId ? '' : eventId
  if (timelineEventChapterStartDropdownOpenId.value) {
    resolveDropdownDirection(`timeline-event-start-${eventId}`)
    timelineEventChapterEndDropdownOpenId.value = ''
    timelineEventOutlineDropdownOpenId.value = ''
    timelineChapterDropdownOpen.value = false
    timelineChapterEndDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    closeCharacterChapterPickers()
  }
}

function toggleTimelineEventChapterEndDropdown(eventId: string): void {
  timelineEventChapterEndDropdownOpenId.value =
    timelineEventChapterEndDropdownOpenId.value === eventId ? '' : eventId
  if (timelineEventChapterEndDropdownOpenId.value) {
    resolveDropdownDirection(`timeline-event-end-${eventId}`)
    timelineEventChapterStartDropdownOpenId.value = ''
    timelineEventOutlineDropdownOpenId.value = ''
    timelineChapterDropdownOpen.value = false
    timelineChapterEndDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    closeCharacterChapterPickers()
  }
}

function toggleTimelineEventOutlineDropdown(eventId: string): void {
  timelineEventOutlineDropdownOpenId.value =
    timelineEventOutlineDropdownOpenId.value === eventId ? '' : eventId
  if (timelineEventOutlineDropdownOpenId.value) {
    resolveDropdownDirection(`timeline-event-outline-${eventId}`)
    timelineEventChapterStartDropdownOpenId.value = ''
    timelineEventChapterEndDropdownOpenId.value = ''
    timelineChapterDropdownOpen.value = false
    timelineChapterEndDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    closeCharacterChapterPickers()
  }
}

function setTimelineEventChapterStart(id: string, value: string): void {
  const chapterNoStart = parseOptionalChapterNo(value)
  updateTimelineEvent({ id, chapterNoStart })
  timelineEvents.value = getTimelineByNovelId(novelId.value)
  timelineEventChapterStartDropdownOpenId.value = ''
}

function setTimelineEventChapterEnd(id: string, value: string): void {
  const chapterNoEnd = parseOptionalChapterNo(value)
  updateTimelineEvent({ id, chapterNoEnd })
  timelineEvents.value = getTimelineByNovelId(novelId.value)
  timelineEventChapterEndDropdownOpenId.value = ''
}

function setTimelineEventOutline(id: string, value: string): void {
  updateTimelineEvent({ id, outlineItemId: value || null })
  timelineEvents.value = getTimelineByNovelId(novelId.value)
  timelineEventOutlineDropdownOpenId.value = ''
}

function characterMembershipFactionLabel(factionId: string): string {
  if (!factionId) return '选择势力'
  return factions.value.find((f) => f.id === factionId)?.name ?? '选择势力'
}

function selectCharacterCreateMembershipFaction(index: number, factionId: string): void {
  const row = characterForm.membershipRows[index]
  if (!row) return
  row.factionId = factionId
  characterCreateMembershipFactionDropdownOpenId.value = ''
}

function toggleCharacterCreateMembershipFactionDropdown(index: number): void {
  const id = String(index)
  characterCreateMembershipFactionDropdownOpenId.value =
    characterCreateMembershipFactionDropdownOpenId.value === id ? '' : id
  if (characterCreateMembershipFactionDropdownOpenId.value) {
    resolveDropdownDirection(`character-create-membership-${id}`)
    timelineChapterDropdownOpen.value = false
    timelineChapterEndDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    closeCharacterChapterPickers()
    timelineEventChapterStartDropdownOpenId.value = ''
    timelineEventChapterEndDropdownOpenId.value = ''
    timelineEventOutlineDropdownOpenId.value = ''
    outlineAssocStartDropdownOpenId.value = ''
    outlineAssocEndDropdownOpenId.value = ''
  }
}

function getOutlineLinkedChapterRange(outlineId: string): { start: string; end: string } {
  const linked = chapters.value
    .filter((c) => (c.outlineItemIds ?? []).includes(outlineId))
    .map((c) => c.chapterNo)
    .sort((a, b) => a - b)
  if (linked.length === 0) return { start: '', end: '' }
  return { start: String(linked[0]), end: String(linked[linked.length - 1]) }
}

function syncOutlineAssocRangeState(outlineId: string): void {
  const range = getOutlineLinkedChapterRange(outlineId)
  outlineAssocStartByItemId[outlineId] = range.start
  outlineAssocEndByItemId[outlineId] = range.end
}

function ensureOutlineAssocRangeState(outlineId: string): void {
  if (outlineAssocStartByItemId[outlineId] !== undefined && outlineAssocEndByItemId[outlineId] !== undefined) return
  syncOutlineAssocRangeState(outlineId)
}

function isOutlineAssocDirty(outlineId: string): boolean {
  ensureOutlineAssocRangeState(outlineId)
  const current = getOutlineLinkedChapterRange(outlineId)
  const start = outlineAssocStartByItemId[outlineId] ?? ''
  const end = outlineAssocEndByItemId[outlineId] ?? ''
  return start !== current.start || end !== current.end
}

function outlineAssocStartLabel(outlineId: string): string {
  ensureOutlineAssocRangeState(outlineId)
  const v = outlineAssocStartByItemId[outlineId] ?? ''
  if (!v) return '不设置'
  const no = Number(v)
  const ch = chapters.value.find((x) => x.chapterNo === no)
  return ch ? `第 ${ch.chapterNo} 章 · ${ch.title}` : '不设置'
}

function outlineAssocEndLabel(outlineId: string): string {
  ensureOutlineAssocRangeState(outlineId)
  const v = outlineAssocEndByItemId[outlineId] ?? ''
  if (!v) return '不设置'
  const no = Number(v)
  const ch = chapters.value.find((x) => x.chapterNo === no)
  return ch ? `第 ${ch.chapterNo} 章 · ${ch.title}` : '不设置'
}

function setOutlineAssocStart(outlineId: string, value: string): void {
  const nextStart = Number(value || 0)
  const currentEnd = Number(outlineAssocEndByItemId[outlineId] || 0)
  outlineAssocStartByItemId[outlineId] = value
  if (nextStart > 0 && currentEnd > 0 && currentEnd <= nextStart) {
    outlineAssocEndByItemId[outlineId] = ''
  }
  outlineAssocStartDropdownOpenId.value = ''
}

function setOutlineAssocEnd(outlineId: string, value: string): void {
  const currentStart = Number(outlineAssocStartByItemId[outlineId] || 0)
  const nextEnd = Number(value || 0)
  outlineAssocEndByItemId[outlineId] = value
  if (currentStart > 0 && nextEnd > 0 && currentStart >= nextEnd) {
    outlineAssocStartByItemId[outlineId] = ''
  }
  outlineAssocEndDropdownOpenId.value = ''
}

function toggleOutlineAssocStartDropdown(outlineId: string): void {
  ensureOutlineAssocRangeState(outlineId)
  outlineAssocStartDropdownOpenId.value = outlineAssocStartDropdownOpenId.value === outlineId ? '' : outlineId
  if (outlineAssocStartDropdownOpenId.value) {
    resolveDropdownDirection(`outline-assoc-start-${outlineId}`)
    outlineAssocEndDropdownOpenId.value = ''
    timelineChapterDropdownOpen.value = false
    timelineChapterEndDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    closeCharacterChapterPickers()
    timelineEventChapterStartDropdownOpenId.value = ''
    timelineEventChapterEndDropdownOpenId.value = ''
    timelineEventOutlineDropdownOpenId.value = ''
  }
}

function toggleOutlineAssocEndDropdown(outlineId: string): void {
  ensureOutlineAssocRangeState(outlineId)
  outlineAssocEndDropdownOpenId.value = outlineAssocEndDropdownOpenId.value === outlineId ? '' : outlineId
  if (outlineAssocEndDropdownOpenId.value) {
    resolveDropdownDirection(`outline-assoc-end-${outlineId}`)
    outlineAssocStartDropdownOpenId.value = ''
    timelineChapterDropdownOpen.value = false
    timelineChapterEndDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    closeCharacterChapterPickers()
    timelineEventChapterStartDropdownOpenId.value = ''
    timelineEventChapterEndDropdownOpenId.value = ''
    timelineEventOutlineDropdownOpenId.value = ''
  }
}

function applyOutlineAssocRange(outlineId: string): void {
  ensureOutlineAssocRangeState(outlineId)
  const startRaw = outlineAssocStartByItemId[outlineId] ?? ''
  const endRaw = outlineAssocEndByItemId[outlineId] ?? ''
  const startNo = parseOptionalChapterNo(startRaw)
  const endNo = parseOptionalChapterNo(endRaw)
  if (startNo == null && endNo == null) return
  const minNo = startNo == null ? Number.NEGATIVE_INFINITY : startNo
  const maxNo = endNo == null ? Number.POSITIVE_INFINITY : endNo
  const low = Math.min(minNo, maxNo)
  const high = Math.max(minNo, maxNo)
  chapters.value.forEach((ch) => {
    const set = new Set(ch.outlineItemIds ?? [])
    if (ch.chapterNo >= low && ch.chapterNo <= high) set.add(outlineId)
    else set.delete(outlineId)
    updateChapter({ id: ch.id, outlineItemIds: Array.from(set) })
  })
  chapters.value = getChaptersByNovelId(novelId.value)
  syncOutlineAssocRangeState(outlineId)
}

function requestApplyOutlineAssoc(outlineId: string): void {
  ensureOutlineAssocRangeState(outlineId)
  pendingOutlineAssocActionId.value = outlineId
  outlineAssocApplyConfirmOpen.value = true
}

function confirmApplyOutlineAssoc(): void {
  const id = pendingOutlineAssocActionId.value
  if (!id) return
  applyOutlineAssocRange(id)
  outlineAssocApplyConfirmOpen.value = false
  pendingOutlineAssocActionId.value = ''
}

function onOutlineAssocApplyDialogCancel(): void {
  outlineAssocApplyConfirmOpen.value = false
  pendingOutlineAssocActionId.value = ''
}

function requestCancelOutlineAssoc(outlineId: string): void {
  ensureOutlineAssocRangeState(outlineId)
  if (!isOutlineAssocDirty(outlineId)) {
    syncOutlineAssocRangeState(outlineId)
    return
  }
  pendingOutlineAssocActionId.value = outlineId
  outlineAssocCancelConfirmOpen.value = true
}

function confirmCancelOutlineAssoc(): void {
  const id = pendingOutlineAssocActionId.value
  if (!id) return
  syncOutlineAssocRangeState(id)
  outlineAssocCancelConfirmOpen.value = false
  pendingOutlineAssocActionId.value = ''
  outlineAssocStartDropdownOpenId.value = ''
  outlineAssocEndDropdownOpenId.value = ''
}

function onOutlineAssocCancelDialogCancel(): void {
  outlineAssocCancelConfirmOpen.value = false
  pendingOutlineAssocActionId.value = ''
}

function closeWorkspaceDropdowns(): void {
  timelineChapterDropdownOpen.value = false
  timelineChapterEndDropdownOpen.value = false
  timelineOutlineDropdownOpen.value = false
  closeCharacterChapterPickers()
  timelineEventChapterStartDropdownOpenId.value = ''
  timelineEventChapterEndDropdownOpenId.value = ''
  timelineEventOutlineDropdownOpenId.value = ''
  characterCreateMembershipFactionDropdownOpenId.value = ''
  outlineAssocStartDropdownOpenId.value = ''
  outlineAssocEndDropdownOpenId.value = ''
}

function onCharacterRelationsChanged(): void {
  characterRelations.value = getCharacterRelationsByNovelId(novelId.value)
}

function onFocusSphereNodeSelect(id: string): void {
  if (!id || id === graphFocusCharacterId.value) return
  if (id === graphFocusSphereSelectedId.value) {
    graphFocusSphereSelectedId.value = ''
    return
  }
  graphFocusSphereSelectedId.value = id
}

function reloadWorkspaceEntities(id: string): void {
  chapters.value = getChaptersByNovelId(id)
  migrateOutlineHierarchy(id)
  outlineItems.value = getOutlineByNovelId(id)
  outlineStorylines.value = getOutlineStorylinesByNovelId(id)
  characters.value = getCharactersByNovelId(id)
  characterRelations.value = getCharacterRelationsByNovelId(id)
  factions.value = getFactionsByNovelId(id)
  items.value = getItemsByNovelId(id)
  scenes.value = getScenesByNovelId(id)
  categories.value = getCategoriesByNovelId(id)
  characterFactionMemberships.value = getCharacterFactionMembershipsByNovelId(id)
  timelineEvents.value = getTimelineByNovelId(id)
  foreshadows.value = getForeshadowsByNovelId(id)
  worldSettings.value = getWorldSettingsByNovelId(id)
}

function reloadWorkspaceFromAi(): void {
  if (novelId.value) reloadWorkspaceEntities(novelId.value)
}

function openSceneCreate(): void {
  sceneEditId.value = ''
  sceneFormName.value = ''
  sceneFormDescription.value = ''
  sceneFormOpen.value = true
}

function openSceneEdit(scene: Scene): void {
  sceneEditId.value = scene.id
  sceneFormName.value = scene.name
  sceneFormDescription.value = scene.description
  sceneFormOpen.value = true
}

function closeSceneForm(): void {
  sceneFormOpen.value = false
  sceneEditId.value = ''
  sceneFormName.value = ''
  sceneFormDescription.value = ''
}

function saveSceneForm(): void {
  const id = novelId.value
  if (!id) return
  const name = sceneFormName.value.trim()
  if (!name) return
  const description = sceneFormDescription.value.trim()
  if (sceneEditId.value) {
    updateScene({ id: sceneEditId.value, name, description })
  } else {
    createScene({ novelId: id, name, description })
  }
  scenes.value = getScenesByNovelId(id)
  closeSceneForm()
}

function removeScene(scene: Scene): void {
  if (!window.confirm(`确认删除场景「${scene.name}」？`)) return
  deleteScene(scene.id)
  if (novelId.value) scenes.value = getScenesByNovelId(novelId.value)
}

function openSceneDetail(scene: Scene): void {
  sceneDetail.value = scene
  sceneGenError.value = ''
}

function closeSceneDetail(): void {
  sceneDetail.value = null
}

/** 返回当前选定画风的英文提示词后缀（空串=未选） */
function visualStyleSuffix(): string {
  const id = (novel.value?.visualStyle ?? '').trim()
  if (!id) return ''
  const preset = VISUAL_STYLE_PRESETS.find((p) => p.id === id)
  // 画风指令前置并加重语气，避免被中文描述淹没
  return preset ? `，视觉风格：${preset.en}。重要——整张图必须严格采用此画风。` : ''
}

const selectedVisualStyle = computed({
  get: () => (novel.value?.visualStyle ?? '') as VisualStyleId | '',
  set: (_val: VisualStyleId | '') => {
    // setter handled by saveVisualStyle
  },
})

function saveVisualStyle(): void {
  const n = novel.value
  if (!n) return
  upsertNovelRecord({ ...n, visualStyle: selectedVisualStyle.value, updatedAt: new Date().toISOString() })
}

function buildScenePrompt(scene: Scene): string {
  const desc = scene.description.trim()
  // 强引导为「动画背景美术 / 建立镜头」而非有焦点主体的插画：
  // 广角空镜、无人物、纵深开阔、中前景留白可放角色。
  const vs = visualStyleSuffix()
  return [
    `${scene.name}。${desc}。`,
    vs,
    '场景背景美术，建立镜头（establishing shot），广角，开阔纵深，',
    '环境氛围渲染，丰富的环境细节，',
    '画面为空镜——不要出现任何人物或角色，不要有单一焦点主体，',
    '构图为可供角色站位演出的舞台背景，中前景留白。',
  ].filter(Boolean).join('')
}

/** 形象历史最多保留 3 张，多的丢弃不入库 */
function capSceneViews(views: NonNullable<Scene['views']>): NonNullable<Scene['views']> {
  return views.slice(-3)
}

async function generateSceneImage(scene: Scene): Promise<void> {
  if (sceneGenningId.value) return
  const desc = scene.description.trim()
  if (!desc) {
    sceneGenError.value = '请先填写场景描述再生成形象'
    return
  }
  sceneGenningId.value = scene.id
  sceneGenError.value = ''
  try {
    const prompt = buildScenePrompt(scene)
    const url = await generateComicImage({ prompt, size: '1024x768' })
    const view = { id: `view-${Date.now()}`, kind: 'establishing', imageUrl: url, description: desc, prompt }
    const existing = Array.isArray(scene.views) ? scene.views : []
    updateScene({ id: scene.id, views: capSceneViews([...existing, view]) })
    if (novelId.value) scenes.value = getScenesByNovelId(novelId.value)
    if (sceneDetail.value && sceneDetail.value.id === scene.id) {
      sceneDetail.value = scenes.value.find((s) => s.id === scene.id) ?? sceneDetail.value
    }
  } catch (e) {
    sceneGenError.value = e instanceof Error ? e.message : '生成失败'
  } finally {
    sceneGenningId.value = ''
  }
}

async function adjustSceneImage(scene: Scene): Promise<void> {
  if (sceneGenningId.value) return
  const instruction = sceneAdjustText.value.trim()
  if (!instruction) {
    sceneGenError.value = '请先输入调整要求'
    return
  }
  const baseUrl = sceneDetailImage.value
  if (!baseUrl) {
    sceneGenError.value = '请先生成形象后再调整'
    return
  }
  sceneGenningId.value = scene.id
  sceneGenError.value = ''
  try {
    // 「你的话优先」：用户要求独立成句、放最前、占绝对主导，
    // 只挂一句最低限度约束（仍是场景背景、无人物），不堆模板词稀释诉求。
    const vs = visualStyleSuffix()
    const prompt = `${vs ? vs + '。' : ''}${instruction}。（这是一张场景背景图，按上面的要求修改它，保持是无人物的场景背景。）`
    const url = await generateComicImage({ prompt, size: '1024x768', image: [baseUrl] })
    const view = { id: `view-${Date.now()}`, kind: 'establishing', imageUrl: url, description: scene.description.trim(), prompt }
    const existing = Array.isArray(scene.views) ? scene.views : []
    updateScene({ id: scene.id, views: capSceneViews([...existing, view]) })
    if (novelId.value) scenes.value = getScenesByNovelId(novelId.value)
    if (sceneDetail.value && sceneDetail.value.id === scene.id) {
      sceneDetail.value = scenes.value.find((s) => s.id === scene.id) ?? sceneDetail.value
    }
    sceneAdjustText.value = ''
  } catch (e) {
    sceneGenError.value = e instanceof Error ? e.message : '调整失败'
  } finally {
    sceneGenningId.value = ''
  }
}

// ── 角色形象：多视图生成（正面 text2img → 侧/背 img2img 锁同一角色）──
const charGenningKey = ref<string>('')   // 形如 `${characterId}:${kind}`
const charGenError = ref<string>('')
const charAdjustText = ref('')

const CHAR_VIEW_KINDS: Array<{ kind: string; label: string; angle: string }> = [
  { kind: 'front', label: '正面', angle: '正面全身像，面向镜头' },
  { kind: 'side', label: '侧面', angle: '侧面全身像，90度侧视' },
  { kind: 'back', label: '背面', angle: '背面全身像，背对镜头' },
]

function charBaseDesc(c: Character): string {
  const parts: string[] = []
  if (c.gender) parts.push(c.gender)
  if (c.age) parts.push(`${c.age}`)
  const attrs = (c.attributes ?? []).map((a) => `${a.key}:${a.value}`).join('，')
  const body = [c.notes, attrs].filter(Boolean).join('，')
  return [c.name, parts.join('、'), body].filter(Boolean).join('，')
}

function charView(c: Character, kind: string): AssetView | undefined {
  return (c.views ?? []).find((v) => v.kind === kind)
}

function frontViewImage(c: Character): string {
  return charView(c, 'front')?.imageUrl || ''
}

/** 生成某个视图。front 用文生图；side/back 用 front 当参考图生图锁同一角色 */
async function generateCharacterView(c: Character, kind: string): Promise<void> {
  if (charGenningKey.value) return
  const desc = charBaseDesc(c)
  if (!desc.trim()) {
    charGenError.value = '请先完善角色档案（外貌/性别/年龄等）再生成形象'
    return
  }
  const meta = CHAR_VIEW_KINDS.find((k) => k.kind === kind)
  if (!meta) return

  // 侧/背必须先有正面作为锁角色的参考
  const frontImg = frontViewImage(c)
  if (kind !== 'front' && !frontImg) {
    charGenError.value = '请先生成「正面」形象，再生成其它角度（用于锁定同一角色）'
    return
  }

  charGenningKey.value = `${c.id}:${kind}`
  charGenError.value = ''
  try {
    let url: string
    const style = (c.stylePrompt ?? '').trim()
    if (kind === 'front') {
      const vs = visualStyleSuffix()
      const parts = [desc, meta.angle, style, vs, '角色设定立绘，白色背景，全身，清晰一致的人物外观。'].filter(Boolean)
      const prompt = parts.join('。')
      url = await generateComicImage({ prompt, size: '768x1024' })
    } else {
      const vs = visualStyleSuffix()
      const parts = [`保持与参考图完全相同的角色（同样的脸、发型、服饰、配色），改为${meta.angle}。`, vs, '角色设定立绘，白色背景，全身。'].filter(Boolean)
      const prompt = parts.join('')
      url = await generateComicImage({ prompt, size: '768x1024', image: [frontImg] })
    }
    const view: AssetView = { id: `cv-${Date.now()}`, kind, imageUrl: url, description: `${c.name}·${meta.label}`, prompt: meta.angle }
    const views = (c.views ?? []).filter((v) => v.kind !== kind)
    views.push(view)
    updateCharacter({ id: c.id, views })
    if (novelId.value) characters.value = getCharactersByNovelId(novelId.value)
  } catch (e) {
    charGenError.value = e instanceof Error ? e.message : '生成失败'
  } finally {
    charGenningKey.value = ''
  }
}

// ── AI 待采用修改：原位 diff 预览 ──────────────────────────────────────────
const workspaceAiSidebarRef = ref<{ applyOneById: (id: string) => void; ignoreOneById: (id: string) => void } | null>(null)
const aiPendingActions = ref<AiPendingToolAction[]>([])
const aiSidebarOpen = ref(false)
const aiSidebarWidth = ref(420)
function onAiPendingChange(actions: AiPendingToolAction[]): void {
  aiPendingActions.value = actions
}
function adoptAiPending(id: string): void {
  workspaceAiSidebarRef.value?.applyOneById(id)
}
function discardAiPending(id: string): void {
  workspaceAiSidebarRef.value?.ignoreOneById(id)
}
function parsePendingArgs(json: string): Record<string, any> {
  try {
    return JSON.parse(json) ?? {}
  } catch {
    return {}
  }
}
function pendingCardsToAttrs(raw: unknown): CharacterAttribute[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((c) => c as { key?: string; title?: string; value?: string; content?: string })
    .map((c) => ({ id: uid(), key: String(c.key ?? c.title ?? '').trim(), value: String(c.value ?? c.content ?? '').trim() }))
    .filter((c) => c.key || c.value)
}

/** 世界观的待采用项：新建（phantom）/ 修改（overlay）/ 删除（标记） */
const worldSettingPending = computed(() => {
  const creates: Array<{ id: string; name: string; attributes: CharacterAttribute[] }> = []
  const updates = new Map<string, { actionId: string; name?: string; attributes?: CharacterAttribute[] }>()
  const deletes = new Map<string, string>()
  for (const action of aiPendingActions.value) {
    const fn = action.toolCall.function.name
    const args = parsePendingArgs(action.toolCall.function.arguments)
    if (fn === 'create_world_setting') {
      creates.push({
        id: action.id,
        name: String(args.name ?? '未命名设定'),
        attributes: pendingCardsToAttrs(args.cards) || [],
      })
    } else if (fn === 'update_world_setting' && args.id) {
      updates.set(String(args.id), {
        actionId: action.id,
        name: args.name != null ? String(args.name) : undefined,
        attributes: args.cards != null ? pendingCardsToAttrs(args.cards) : undefined,
      })
    } else if (fn === 'delete_world_setting' && args.id) {
      deletes.set(String(args.id), action.id)
    }
  }
  return { creates, updates, deletes }
})

type WsCardDiff = { id: string; key: string; value: string; status: 'same' | 'added' | 'removed' | 'changed'; oldValue?: string }
/** 某条世界观若有待修改，按卡片标题(key)对比新旧，返回带 added/removed/changed 标记的合并列表 */
function worldSettingCardDiff(ws: WorldSetting): WsCardDiff[] {
  const pending = worldSettingPending.value.updates.get(ws.id)
  const oldCards = (ws.attributes ?? []).filter((c) => c && (c.key || c.value))
  if (!pending || pending.attributes === undefined) {
    return oldCards.map((c) => ({ id: c.id, key: c.key, value: c.value, status: 'same' as const }))
  }
  const newCards = pending.attributes
  const oldByKey = new Map(oldCards.map((c) => [c.key.trim(), c]))
  const newByKey = new Map(newCards.map((c) => [c.key.trim(), c]))
  const out: WsCardDiff[] = []
  // 旧卡片：保留 / 修改 / 删除
  for (const oc of oldCards) {
    const match = newByKey.get(oc.key.trim())
    if (!match) {
      out.push({ id: oc.id, key: oc.key, value: oc.value, status: 'removed' })
    } else if (match.value.trim() !== oc.value.trim()) {
      out.push({ id: oc.id, key: oc.key, value: match.value, oldValue: oc.value, status: 'changed' })
    } else {
      out.push({ id: oc.id, key: oc.key, value: oc.value, status: 'same' })
    }
  }
  // 新增卡片（旧里没有的 key）
  for (const nc of newCards) {
    if (!oldByKey.has(nc.key.trim())) {
      out.push({ id: nc.id, key: nc.key, value: nc.value, status: 'added' })
    }
  }
  return out
}

const aiFocusId = ref('')
function setAiFocus(id: string): void {
  aiFocusId.value = aiFocusId.value === id ? '' : id
}

const aiFocusEntity = computed<{ kind: string; id: string; label: string } | null>(() => {
  if (activeTab.value === 'outline' && activeOutlineMapId.value) {
    const it = outlineItems.value.find((o) => o.id === activeOutlineMapId.value)
    if (it) return { kind: '大纲节点', id: it.id, label: it.title || '未命名节点' }
  }
  if (activeTab.value === 'characters' && graphFocusCharacterId.value) {
    const c = characters.value.find((x) => x.id === graphFocusCharacterId.value)
    if (c) return { kind: '角色', id: c.id, label: c.name || '未命名角色' }
  }
  if (activeTab.value === 'factions' && aiFocusId.value) {
    const f = factions.value.find((x) => x.id === aiFocusId.value)
    if (f) return { kind: '势力', id: f.id, label: f.name || '未命名势力' }
  }
  if (activeTab.value === 'items' && aiFocusId.value) {
    const it = items.value.find((x) => x.id === aiFocusId.value)
    if (it) return { kind: '物品', id: it.id, label: it.name || '未命名物品' }
  }
  if (activeTab.value === 'categories' && aiFocusId.value) {
    const c = categories.value.find((x) => x.id === aiFocusId.value)
    if (c) return { kind: '分类', id: c.id, label: c.name || '未命名分类' }
  }
  if (activeTab.value === 'worldsettings' && aiFocusId.value) {
    const w = worldSettings.value.find((x) => x.id === aiFocusId.value)
    if (w) return { kind: '世界观设定', id: w.id, label: w.name || '未命名设定' }
  }
  return null
})

watch(
  novelId,
  (id) => {
    reloadWorkspaceEntities(id)
    graphFocusCharacterId.value = characters.value[0]?.id ?? ''
    factionEditOpen.value = false
    factionEditId.value = ''
    applyRoutePrefill()
  },
  { immediate: true }
)

watch(
  () => route.query,
  () => {
    applyRoutePrefill()
  }
)

watch(
  [characters, selectedCategoryFilterId],
  ([listRaw, categoryId]) => {
    const list = !categoryId
      ? listRaw
      : listRaw.filter((c) => (c.categoryIds ?? []).includes(categoryId))
    if (list.length === 0) {
      graphFocusCharacterId.value = ''
      return
    }
    if (!graphFocusCharacterId.value || !list.some((c) => c.id === graphFocusCharacterId.value)) {
      graphFocusCharacterId.value = list[0].id
    }
  },
  { immediate: true }
)

watch(categories, (list) => {
  if (!selectedCategoryFilterId.value) return
  if (!list.some((c) => c.id === selectedCategoryFilterId.value)) selectedCategoryFilterId.value = ''
})

watch(graphFocusCharacterId, () => {
  hoverRelationId.value = ''
  forceCancelCharacterEdit()
  graphLinkMode.value = false
  graphFocusSphereSelectedId.value = ''
  closeWorkspaceDropdowns()
})

/** 使用 click 冒泡阶段：避免 capture 阶段先关掉下拉导致同一次点击无法触发按钮 */
function onWorkspaceClickOutside(e: MouseEvent): void {
  const anyDdOpen =
    timelineChapterDropdownOpen.value ||
    timelineChapterEndDropdownOpen.value ||
    timelineOutlineDropdownOpen.value ||
    !!timelineEventChapterStartDropdownOpenId.value ||
    !!timelineEventChapterEndDropdownOpenId.value ||
    !!timelineEventOutlineDropdownOpenId.value ||
    !!outlineAssocStartDropdownOpenId.value ||
    !!outlineAssocEndDropdownOpenId.value
  if (!anyDdOpen) return
  const t = e.target as HTMLElement | null
  if (!t) return
  if (t.closest('.workspace-dd')) return
  closeWorkspaceDropdowns()
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', onWorkspaceClickOutside, false)
}

watch(
  () =>
    characterCreateOpen.value ||
    factionCreateOpen.value ||
    categoryCreateOpen.value ||
    timelineCreateOpen.value ||
    outlineCreateOpen.value ||
    !!outlineDetailOpenId.value,
  (open) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
  },
)

function resetTimelineCreateForm(): void {
  timelineForm.storyLabel = ''
  timelineForm.title = ''
  timelineForm.summary = ''
  timelineForm.chapterNoStart = ''
  timelineForm.chapterNoEnd = ''
  timelineForm.outlineItemId = ''
}

function openTimelineCreate(): void {
  closeWorkspaceDropdowns()
  resetTimelineCreateForm()
  timelineCreateOpen.value = true
}

function closeTimelineCreate(): void {
  timelineCreateOpen.value = false
  timelineChapterDropdownOpen.value = false
  timelineChapterEndDropdownOpen.value = false
  timelineOutlineDropdownOpen.value = false
}

function openCharacterCreate(): void {
  closeWorkspaceDropdowns()
  characterCreateError.value = ''
  characterForm.name = ''
  characterForm.age = ''
  characterForm.gender = ''
  characterForm.attributes = []
  characterForm.aliasRows = []
  characterForm.categoryIds = selectedCategoryFilterId.value ? [selectedCategoryFilterId.value] : []
  characterForm.membershipRows = []
  characterCreateOpen.value = true
}

function closeCharacterCreate(): void {
  characterCreateOpen.value = false
  characterCreateError.value = ''
}

function openOutlineCreate(): void {
  closeWorkspaceDropdowns()
  outlineCreateOpen.value = true
}

function resetOutlineAiDesignerState(): void {
  outlineAiMode.value = outlineItems.value.length > 0 ? 'expand' : 'create'
  outlineAiDesignerStep.value = outlineItems.value.length > 0 ? 'expand' : 'brief'
  outlineAiDraftIsSkeletonOnly.value = false
  outlineAiAppendMode.value = false
  outlineAiLintDismissed.value = false
  outlineAiExpandAnchorId.value = activeOutlineMapId.value || outlineItems.value[0]?.id || ''
  outlineAiExpandNote.value = ''
  outlineAiExpandPreset.value = 'auto'
  outlineAiDesignerLoading.value = false
  outlineAiDesignerWriting.value = false
  outlineAiDesignerError.value = ''
  outlineAiDesignerRationale.value = ''
  outlineAiDesignerBrief.value = ''
  outlineAiDesignerOptions.value = []
  outlineAiDesignerSelectedOptionId.value = ''
  outlineAiDesignerDraft.value = null
  outlineAiInterviewHistory.value = []
  outlineAiCurrentQuestion.value = null
  outlineAiCurrentAnswer.value = ''
  outlineAiCurrentCustom.value = ''
  outlineAiBrief.value = ''
  outlineAiUseNovelInfo.value = true
  outlineAiGuideConflict.value = ''
  outlineAiGuideProtagonist.value = ''
  outlineAiGuideEnding.value = ''
  outlineAiOptionNotes.value = {}
  outlineAiOptionRevisionHistory.value = []
  outlineAiCoveredDimensions.value = []
}

function setOutlineAiOptionNote(optionId: string, value: string): void {
  outlineAiOptionNotes.value = { ...outlineAiOptionNotes.value, [optionId]: value }
}

function switchOutlineAiMode(mode: OutlineAiMode): void {
  if (outlineAiDesignerLoading.value || outlineAiDesignerWriting.value) return
  outlineAiMode.value = mode
  outlineAiDesignerError.value = ''
  outlineAiDesignerDraft.value = null
  outlineAiAppendMode.value = false
  if (mode === 'expand') {
    outlineAiDesignerStep.value = 'expand'
    if (!outlineAiExpandAnchorId.value) {
      outlineAiExpandAnchorId.value = activeOutlineMapId.value || outlineItems.value[0]?.id || ''
    }
    return
  }
  if (outlineAiInterviewHistory.value.length > 0) {
    outlineAiDesignerStep.value = 'options'
    return
  }
  // 从零规划尚未开始时，进入「描述构想」步骤
  outlineAiDesignerStep.value = 'brief'
}

function openOutlineAiExpand(): void {
  closeWorkspaceDropdowns()
  resetOutlineAiDesignerState()
  outlineAiMode.value = 'expand'
  outlineAiDesignerStep.value = 'expand'
  outlineAiExpandAnchorId.value = activeOutlineMapId.value || outlineItems.value[0]?.id || ''
  outlineAiDesignerOpen.value = true
}

function openOutlineAiExpandFromNode(outlineId: string): void {
  if (outlineId) activeOutlineMapId.value = outlineId
  openOutlineAiExpand()
}

async function openOutlineAiDesignerCreate(): Promise<void> {
  closeWorkspaceDropdowns()
  resetOutlineAiDesignerState()
  outlineAiMode.value = 'create'
  outlineAiDesignerStep.value = 'intro'
  outlineAiDesignerOpen.value = true
}

const hasWorldviewForOutline = computed(
  () => worldSettings.value.some((row) => String(row.content ?? '').trim() || String(row.name ?? '').trim()),
)

function goCompleteWorldviewFromOutlineAi(): void {
  outlineAiDesignerOpen.value = false
  switchTab('worldsettings')
}

async function startOutlineAiInterview(): Promise<void> {
  if (outlineAiDesignerLoading.value) return
  if (!hasWorldviewForOutline.value) return
  // 不再走多轮问答，直接进入「一段话描述构想」步骤
  outlineAiDesignerStep.value = 'brief'
}

/** 把构想描述+可选引导合成为一条访谈记录，交给既有的方案生成逻辑 */
function buildOutlineAiBriefHistory(): OutlineAiFollowupTurn[] {
  const brief = outlineAiBrief.value.trim()
  const turns: OutlineAiFollowupTurn[] = []
  if (brief) {
    turns.push({ label: '故事构想', prompt: '你想要一个什么样的故事走向？', answer: brief })
  }
  const conflict = outlineAiGuideConflict.value.trim()
  if (conflict) turns.push({ label: '核心冲突', prompt: '故事的核心冲突/主线矛盾是什么？', answer: conflict })
  const protagonist = outlineAiGuideProtagonist.value.trim()
  if (protagonist) turns.push({ label: '主角目标', prompt: '主角想要什么、要克服什么？', answer: protagonist })
  const ending = outlineAiGuideEnding.value.trim()
  if (ending) turns.push({ label: '结局基调', prompt: '你期待的结局基调/走向？', answer: ending })
  return turns
}

const outlineAiBriefReady = computed(() =>
  Boolean(
    outlineAiBrief.value.trim() ||
    outlineAiGuideConflict.value.trim() ||
    outlineAiGuideProtagonist.value.trim() ||
    outlineAiGuideEnding.value.trim(),
  ),
)

/** 提交构想，直接生成大纲方案（跳过多轮问答）；留空则让 AI 基于世界观自由发挥 */
async function submitOutlineAiBrief(): Promise<void> {
  if (outlineAiDesignerLoading.value) return
  const history = buildOutlineAiBriefHistory()
  if (history.length === 0) {
    history.push({
      label: '故事构想',
      prompt: '你想要一个什么样的故事走向？',
      answer: '（作者未指定具体方向）请完全基于已有的世界观设定自由发挥，构思 2-3 套贴合该世界观、彼此差异明显的大纲方向。',
    })
  }
  outlineAiInterviewHistory.value = history
  await generateOutlineAiOptions()
}

function backToOutlineAiExpand(): void {
  if (outlineAiDesignerLoading.value) return
  outlineAiDesignerStep.value = 'expand'
  outlineAiDesignerDraft.value = null
  outlineAiAppendMode.value = false
}

function closeOutlineAiDesigner(): void {
  // 写入磁盘期间不可关闭（避免写一半丢失）；仅 AI 生成中（loading）允许点外部关闭
  if (outlineAiDesignerWriting.value) return
  outlineAiDesignerLoading.value = false
  outlineAiDesignerOpen.value = false
}

function chooseOutlineAiOption(optionId: string): void {
  outlineAiDesignerSelectedOptionId.value = optionId
}

function collectOutlineAiInterviewHistory(): Array<{ label: string; prompt: string; answer: string }> {
  return outlineAiInterviewHistory.value.map((row) => ({
    label: row.label,
    prompt: row.prompt,
    answer: row.answer,
  }))
}

/** 按「是否参考书名/简介」开关解析书名：不勾选则返回空串（题材/视角/基调仍由 novel 其余字段保留）。 */
function outlineAiResolvedTitle(): string {
  return outlineAiUseNovelInfo.value ? (novel.value?.title ?? '') : ''
}
/** 同上，解析简介。 */
function outlineAiResolvedSummary(): string {
  return outlineAiUseNovelInfo.value ? (novel.value?.summary ?? '') : ''
}
/** 传给大纲 AI 的 novel 对象：不勾选「参考书名/简介」时清空其 title/summary，其余字段（题材/视角/基调等）保留。 */
function outlineAiResolvedNovel<T extends { title: string; summary?: string }>(n: T): T {
  return outlineAiUseNovelInfo.value ? n : { ...n, title: '', summary: '' }
}

async function requestNextOutlineAiQuestion(): Promise<boolean> {
  if (!novel.value) return false
  outlineAiDesignerLoading.value = true
  outlineAiDesignerError.value = ''
  try {
    const result = await designOutlineInterviewTurnByAi(
      buildNovelWorkspacePayload(novel.value.id),
      {
        novelTitle: outlineAiResolvedTitle(),
        novelSummary: outlineAiResolvedSummary(),
        novel: {
          title: outlineAiResolvedTitle(),
          summary: outlineAiResolvedSummary(),
          continuityBrief: novel.value.continuityBrief,
          genre: novel.value.genre,
          perspective: novel.value.perspective,
          tone: novel.value.tone,
        },
        aiStylePrompt: novel.value.aiStylePrompt,
        history: collectOutlineAiInterviewHistory(),
        remainingRounds: Math.max(0, 12 - outlineAiInterviewHistory.value.length),
      },
    )
    outlineAiDesignerRationale.value = result.rationale
    // Merge covered dimensions
    const newDims = result.coveredDimensions ?? []
    for (const d of newDims) {
      if (!outlineAiCoveredDimensions.value.includes(d)) {
        outlineAiCoveredDimensions.value.push(d)
      }
    }
    if (result.shouldAsk && result.question) {
      outlineAiCurrentQuestion.value = result.question
      outlineAiCurrentAnswer.value = ''
      outlineAiCurrentCustom.value = ''
      outlineAiDesignerStep.value = 'interview'
      return true
    }
    outlineAiCurrentQuestion.value = null
    return false
  } catch (error: unknown) {
    outlineAiDesignerError.value = error instanceof Error ? error.message : 'AI 生成问题失败，请稍后重试。'
    return true
  } finally {
    outlineAiDesignerLoading.value = false
  }
}

async function generateOutlineAiOptions(): Promise<void> {
  if (!novel.value) return
  outlineAiDesignerBrief.value = ''
  outlineAiDesignerOptions.value = []
  outlineAiDesignerSelectedOptionId.value = ''
  outlineAiDesignerDraft.value = null
  outlineAiOptionNotes.value = {}
  outlineAiOptionRevisionHistory.value = []
  outlineAiDesignerLoading.value = true
  outlineAiDesignerError.value = ''
  try {
    const result = await designOutlineOptionsByAi(
      buildNovelWorkspacePayload(novel.value.id),
      {
        novelTitle: outlineAiResolvedTitle(),
        novelSummary: outlineAiResolvedSummary(),
        novel: outlineAiResolvedNovel(novel.value),
        aiStylePrompt: novel.value.aiStylePrompt,
        history: collectOutlineAiInterviewHistory(),
      },
    )
    if (result.options.length === 0) throw new Error('AI 这次没有给出可用的大纲方案。')
    outlineAiDesignerBrief.value = result.brief
    outlineAiDesignerOptions.value = result.options
    outlineAiDesignerSelectedOptionId.value = result.options[0]?.id ?? ''
    outlineAiDesignerStep.value = 'options'
  } catch (error: unknown) {
    outlineAiDesignerError.value = error instanceof Error ? error.message : 'AI 生成大纲方案失败，请稍后重试。'
  } finally {
    outlineAiDesignerLoading.value = false
  }
}

async function submitOutlineAiInterviewAnswer(): Promise<void> {
  const question = outlineAiCurrentQuestion.value
  const answer = outlineAiResolvedAnswer.value
  if (!question || !answer) return
  outlineAiInterviewHistory.value = [
    ...outlineAiInterviewHistory.value,
    {
      label: question.label,
      prompt: question.prompt,
      answer,
    },
  ]
  outlineAiCurrentQuestion.value = null
  outlineAiCurrentAnswer.value = ''
  outlineAiCurrentCustom.value = ''
  if (outlineAiInterviewHistory.value.length >= 12) {
    await generateOutlineAiOptions()
    return
  }
  const hasNext = await requestNextOutlineAiQuestion()
  if (!hasNext && !outlineAiDesignerError.value) {
    await generateOutlineAiOptions()
  }
}

async function refineOutlineAiOptions(): Promise<void> {
  if (!novel.value || !selectedOutlineAiOption.value) return
  const refineNote = outlineAiSelectedOptionNote.value
  if (!refineNote) {
    outlineAiDesignerError.value = '请先在选中的方案下填写调整意见。'
    return
  }

  outlineAiDesignerLoading.value = true
  outlineAiDesignerError.value = ''
  const selected = selectedOutlineAiOption.value
  try {
    const result = await refineOutlineOptionsByAi(
      buildNovelWorkspacePayload(novel.value.id),
      {
        novelTitle: outlineAiResolvedTitle(),
        novelSummary: outlineAiResolvedSummary(),
        novel: outlineAiResolvedNovel(novel.value),
        aiStylePrompt: novel.value.aiStylePrompt,
        history: collectOutlineAiInterviewHistory(),
        currentOptions: outlineAiDesignerOptions.value,
        selectedOptionId: selected.id,
        refineNote,
        allOptionNotes: outlineAiOptionNotes.value,
        priorRevisions: outlineAiOptionRevisionHistory.value,
      },
    )
    if (result.options.length === 0) throw new Error('AI 这次没有返回可用方案，请换个说法再试。')

    outlineAiOptionRevisionHistory.value = [
      ...outlineAiOptionRevisionHistory.value,
      { selectedOptionId: selected.id, selectedTitle: selected.title, note: refineNote },
    ]
    outlineAiDesignerBrief.value = result.brief
    outlineAiDesignerOptions.value = result.options
    outlineAiDesignerSelectedOptionId.value = result.options[0]?.id ?? ''
    outlineAiOptionNotes.value = {}
  } catch (error: unknown) {
    outlineAiDesignerError.value = error instanceof Error ? error.message : 'AI 调整方案失败，请稍后重试。'
  } finally {
    outlineAiDesignerLoading.value = false
  }
}

function buildOutlineAiDraftInput() {
  if (!novel.value || !selectedOutlineAiOption.value) return null
  return {
    novelTitle: outlineAiResolvedTitle(),
    novelSummary: outlineAiResolvedSummary(),
    novel: outlineAiResolvedNovel(novel.value),
    aiStylePrompt: novel.value.aiStylePrompt,
    history: collectOutlineAiInterviewHistory(),
    selectedOption: selectedOutlineAiOption.value,
    selectedOptionId: outlineAiDesignerSelectedOptionId.value,
    optionRefinement: outlineAiSelectedOptionNote.value,
    optionRevisionHistory: outlineAiOptionRevisionHistory.value,
  }
}

function skeletonItemsToDraftItems(
  items: Array<{
    tempId: string
    parentTempId: string
    title: string
    summary: string
    level: 'volume' | 'act' | 'chapter'
    goal: string
    storylineNames: string[]
  }>,
): OutlineAiDraft['items'] {
  return items.map((row) => ({
    tempId: row.tempId,
    parentTempId: row.parentTempId,
    title: row.title,
    summary: row.summary,
    level: row.level,
    goal: row.goal,
    conflict: '',
    twist: '',
    result: '',
    suspense: '',
    plotStage: 'idea',
    storylineNames: row.storylineNames ?? [],
    tension: 3,
    location: '',
    timeLabel: '',
    characterNames: [],
    povCharacterName: '',
    emotionalTurn: '',
    proseHint: '',
  }))
}

async function generateOutlineAiExpand(): Promise<void> {
  if (!novel.value) return
  const anchorId = outlineAiExpandAnchorId.value
  if (!anchorId) {
    outlineAiDesignerError.value = '请先在导图选中要扩展的节点，或确保大纲里至少有一个节点。'
    return
  }
  outlineAiDesignerLoading.value = true
  outlineAiDesignerError.value = ''
  outlineAiDesignerDraft.value = null
  outlineAiAppendMode.value = true
  outlineAiLintDismissed.value = false
  try {
    const payload = buildNovelWorkspacePayload(novel.value.id)
    const result = await expandOutlineFromExistingByAi(payload, {
      novel: novel.value,
      aiStylePrompt: novel.value.aiStylePrompt,
      anchorOutlineId: anchorId,
      expandNote: outlineAiExpandNote.value,
      expandPreset: outlineAiExpandPreset.value,
    })
    if (result.items.length === 0) throw new Error('AI 没有生成可追加的情节点，请换种说法或换个锚点再试。')
    outlineAiDesignerDraft.value = {
      title: novel.value.title,
      summary: result.brief,
      items: result.items,
    }
    outlineAiDesignerStep.value = 'preview'
  } catch (error: unknown) {
    outlineAiDesignerError.value = error instanceof Error ? error.message : 'AI 扩展大纲失败，请稍后重试。'
  } finally {
    outlineAiDesignerLoading.value = false
  }
}

async function generateOutlineAiDraft(): Promise<void> {
  const input = buildOutlineAiDraftInput()
  if (!novel.value || !input) return
  outlineAiDesignerLoading.value = true
  outlineAiDesignerError.value = ''
  outlineAiDesignerDraft.value = null
  outlineAiDraftIsSkeletonOnly.value = false
  outlineAiAppendMode.value = false
  outlineAiLintDismissed.value = false
  outlineAiDesignerStreaming.value = ''
  wsGenAborts.outlineDesigner?.abort()
  wsGenAborts.outlineDesigner = new AbortController()
  try {
    const result = await expandOutlineDesignByAi(
      buildNovelWorkspacePayload(novel.value.id),
      { ...input, onChunk: (d) => { outlineAiDesignerStreaming.value += d } },
      wsGenAborts.outlineDesigner.signal,
    )
    if (result.items.length === 0) throw new Error('AI 这次没有展开出可用的大纲节点。')
    outlineAiDesignerDraft.value = result
    outlineAiDesignerStep.value = 'preview'
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') return
    outlineAiDesignerError.value = error instanceof Error ? error.message : 'AI 展开大纲失败，请稍后重试。'
  } finally {
    outlineAiDesignerLoading.value = false
    outlineAiDesignerStreaming.value = ''
    wsGenAborts.outlineDesigner = null
  }
}

function stopOutlineAiDesignerGeneration(): void {
  wsGenAborts.outlineDesigner?.abort()
  outlineAiDesignerLoading.value = false
  outlineAiDesignerStreaming.value = ''
}

const outlineAiDesignerStreamLines = computed(() => {
  const raw = outlineAiDesignerStreaming.value
  if (!raw) return []
  const lines: Array<{ level: string; text: string }> = []
  const levelLabels: Record<string, string> = { volume: '卷', act: '幕', chapter: '章', scene: '场景' }
  const re = /"level"\s*:\s*"(volume|act|chapter|scene)"[^}]*?"title"\s*:\s*"([^"]*?)"/g
  const reAlt = /"title"\s*:\s*"([^"]*?)"[^}]*?"level"\s*:\s*"(volume|act|chapter|scene)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw)) !== null) {
    const level = match[1]
    const title = match[2]
    if (title) {
      const prefix = level === 'volume' ? '◆' : level === 'act' ? '  ▸' : level === 'chapter' ? '    ·' : '      ○'
      lines.push({ level, text: `${prefix} ${levelLabels[level]}：${title}` })
    }
  }
  if (lines.length === 0) {
    while ((match = reAlt.exec(raw)) !== null) {
      const title = match[1]
      const level = match[2]
      if (title) {
        const prefix = level === 'volume' ? '◆' : level === 'act' ? '  ▸' : level === 'chapter' ? '    ·' : '      ○'
        lines.push({ level, text: `${prefix} ${levelLabels[level]}：${title}` })
      }
    }
  }
  return lines
})

async function generateOutlineAiSkeleton(): Promise<void> {
  const input = buildOutlineAiDraftInput()
  if (!novel.value || !input) return
  outlineAiDesignerLoading.value = true
  outlineAiDesignerError.value = ''
  outlineAiDesignerDraft.value = null
  outlineAiDraftIsSkeletonOnly.value = false
  outlineAiLintDismissed.value = false
  try {
    const result = await expandOutlineSkeletonByAi(buildNovelWorkspacePayload(novel.value.id), input)
    if (result.items.length === 0) throw new Error('AI 这次没有生成可用的章节骨架。')
    outlineAiDesignerDraft.value = {
      title: result.title,
      summary: result.summary,
      storylines: result.storylines,
      characterCast: [],
      items: skeletonItemsToDraftItems(result.items),
    }
    outlineAiDraftIsSkeletonOnly.value = true
    outlineAiDesignerStep.value = 'skeleton'
  } catch (error: unknown) {
    outlineAiDesignerError.value = error instanceof Error ? error.message : 'AI 生成章节骨架失败，请稍后重试。'
  } finally {
    outlineAiDesignerLoading.value = false
  }
}

async function generateOutlineAiScenesFromSkeleton(): Promise<void> {
  const input = buildOutlineAiDraftInput()
  const draft = outlineAiDesignerDraft.value
  if (!novel.value || !input || !draft) return
  const skeletonItems = draft.items.filter((row) => row.level === 'volume' || row.level === 'act' || row.level === 'chapter')
  if (skeletonItems.length === 0) {
    outlineAiDesignerError.value = '当前没有可补充的章节骨架。'
    return
  }
  outlineAiDesignerLoading.value = true
  outlineAiDesignerError.value = ''
  outlineAiLintDismissed.value = false
  try {
    const result = await expandOutlineScenesForSkeletonByAi(buildNovelWorkspacePayload(novel.value.id), {
      ...input,
      skeletonItems: skeletonItems.map((row) => ({
        tempId: row.tempId,
        parentTempId: row.parentTempId,
        title: row.title,
        summary: row.summary,
        level: row.level as 'volume' | 'act' | 'chapter',
        goal: row.goal,
        storylineNames: row.storylineNames ?? [],
      })),
      characterCast: draft.characterCast,
    })
    outlineAiDesignerDraft.value = {
      ...draft,
      characterCast: result.characterCast.length > 0 ? result.characterCast : draft.characterCast,
      relationCast: [...(draft.relationCast ?? []), ...result.relationCast],
      items: [...skeletonItems, ...result.items],
      critiqueNotes: result.critiqueNotes ?? draft.critiqueNotes,
    }
    outlineAiDraftIsSkeletonOnly.value = false
    outlineAiDesignerStep.value = 'preview'
  } catch (error: unknown) {
    outlineAiDesignerError.value = error instanceof Error ? error.message : 'AI 补充场景失败，请稍后重试。'
  } finally {
    outlineAiDesignerLoading.value = false
  }
}

function backToOutlineAiInterview(): void {
  if (outlineAiDesignerLoading.value) return
  outlineAiDesignerStep.value = 'brief'
}

function backToOutlineAiOptions(): void {
  if (outlineAiDesignerLoading.value) return
  outlineAiDesignerStep.value = 'options'
}

function mergeOutlineCharacterNotes(existing: string, incomingParts: string[]): string {
  const chunks = [String(existing ?? '').trim(), ...incomingParts.map((row) => String(row ?? '').trim()).filter(Boolean)]
  const seen = new Set<string>()
  const out: string[] = []
  for (const chunk of chunks) {
    const key = chunk.toLowerCase()
    if (!chunk || seen.has(key)) continue
    seen.add(key)
    out.push(chunk)
  }
  return out.join('；').slice(0, 480)
}

async function applyOutlineAiDraft(): Promise<void> {
  if (!novel.value) {
    outlineAiDesignerError.value = '作品不存在，无法写入大纲。'
    return
  }
  if (!outlineAiDesignerDraft.value) {
    outlineAiDesignerError.value = '没有可写入的大纲草案，请先生成正式大纲。'
    return
  }
  const writeNovelId = novel.value.id
  if (outlineAiDesignerDraft.value.items.length === 0) {
    outlineAiDesignerError.value = '大纲草案里没有节点，请返回重新生成。'
    return
  }

  outlineAiDesignerWriting.value = true
  outlineAiDesignerError.value = ''
  const itemCount = outlineAiDesignerDraft.value.items.length
  const castCount = outlineAiDesignerDraft.value.characterCast?.length ?? 0

  try {
    const nameToId = new Map<string, string>()
    for (const row of characters.value) {
      const name = String(row.name ?? '').trim()
      if (name) nameToId.set(name.toLowerCase(), row.id)
    }

    let createdCharacterCount = 0
    let updatedCharacterCount = 0

    for (const cast of outlineAiDesignerDraft.value.characterCast ?? []) {
      const name = String(cast.name ?? '').trim()
      if (!name) continue
      const key = name.toLowerCase()
      const noteParts = [cast.role, cast.voice, cast.personality, cast.fear].map((row) => String(row ?? '').trim()).filter(Boolean)
      const existingId = nameToId.get(key)
      if (existingId) {
        const existing = characters.value.find((row) => row.id === existingId)
        if (existing) {
          updateCharacter({
            id: existingId,
            goal: String(cast.desire ?? '').trim() || existing.goal,
            secret: String(cast.secret ?? '').trim() || existing.secret,
            arc: String(cast.arc ?? '').trim() || existing.arc,
            notes: mergeOutlineCharacterNotes(existing.notes, noteParts),
          })
          updatedCharacterCount += 1
        }
        continue
      }
      const created = createCharacter({
        novelId: novel.value.id,
        name,
        age: '',
        gender: '',
        goal: cast.desire ?? '',
        secret: cast.secret ?? '',
        arc: cast.arc ?? '',
        notes: noteParts.join('；'),
      })
      nameToId.set(key, created.id)
      createdCharacterCount += 1
    }

    let createdRelationCount = 0
    const existingRelations = getCharacterRelationsByNovelId(novel.value.id)
    for (const rel of outlineAiDesignerDraft.value.relationCast ?? []) {
      const fromName = String(rel.fromName ?? '').trim()
      const toName = String(rel.toName ?? '').trim()
      const relationType = String(rel.relationType ?? '').trim()
      if (!fromName || !toName || !relationType) continue
      const fromId = nameToId.get(fromName.toLowerCase())
      const toId = nameToId.get(toName.toLowerCase())
      if (!fromId || !toId || fromId === toId) continue
      const note = [String(rel.note ?? '').trim(), String(rel.dynamic ?? '').trim()].filter(Boolean).join('；')
      const duplicated = existingRelations.some(
        (row) =>
          row.fromCharacterId === fromId &&
          row.toCharacterId === toId &&
          String(row.relationType ?? '').trim() === relationType,
      )
      if (duplicated) continue
      createCharacterRelation({
        novelId: novel.value.id,
        fromCharacterId: fromId,
        toCharacterId: toId,
        relationType,
        note,
      })
      existingRelations.push({
        id: `pending-${fromId}-${toId}`,
        novelId: novel.value.id,
        fromCharacterId: fromId,
        toCharacterId: toId,
        relationType,
        note,
        createdAt: '',
        updatedAt: '',
      })
      createdRelationCount += 1
    }

    const storylineNameToId = new Map<string, string>()
    for (const row of outlineStorylines.value) {
      const name = String(row.name ?? '').trim()
      if (name) storylineNameToId.set(name.toLowerCase(), row.id)
    }
    for (const sl of outlineAiDesignerDraft.value.storylines ?? []) {
      const name = String(sl.name ?? '').trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (storylineNameToId.has(key)) continue
      const type = sl.type ?? 'custom'
      const createdStoryline = createOutlineStoryline({
        novelId: novel.value.id,
        name,
        type,
        color: resolveOutlineStorylineColor(type, sl.colorHint),
        description: sl.description ?? '',
      })
      storylineNameToId.set(key, createdStoryline.id)
    }

    const mapStorylineIds = (names: string[]): string[] => {
      const ids: string[] = []
      for (const rawName of names) {
        const id = storylineNameToId.get(String(rawName).trim().toLowerCase())
        if (id && !ids.includes(id)) ids.push(id)
      }
      return ids
    }

    const createdIdMap = new Map<string, string>()
    const appendAnchorId = outlineAiAppendMode.value ? outlineAiExpandAnchorId.value : ''
    if (appendAnchorId) createdIdMap.set('anchor', appendAnchorId)

    const resolveParentId = (parentTempId: string): string | null => {
      const key = String(parentTempId ?? '').trim()
      if (!key) return appendAnchorId || null
      if (key === 'anchor' || key === 'ANCHOR') return appendAnchorId || null
      return createdIdMap.get(key) ?? null
    }

    // 拓扑安全：按 level 深度升序排序，保证父节点先于子节点入库；
    // 数组内同级保持原序。否则子节点先建会找不到父→变成顶层孤儿。
    const orderedDraftItems = [...outlineAiDesignerDraft.value.items]
      .map((item, idx) => ({ item, idx }))
      .sort((a, b) => {
        const r = levelRank(a.item.level) - levelRank(b.item.level)
        return r !== 0 ? r : a.idx - b.idx
      })
      .map((x) => x.item)

    let fallbackVolumeId = ''
    let orphanCount = 0
    let bridgeCount = 0
    const ensureFallbackVolume = (): string => {
      if (fallbackVolumeId) return fallbackVolumeId
      const created = createOutlineItem({
        novelId: writeNovelId,
        title: '未归类卷',
        summary: 'AI 生成时父节点缺失，自动归集于此，可手动整理。',
        level: 'volume',
        parentId: null,
      })
      fallbackVolumeId = created.id
      return fallbackVolumeId
    }

    // 缓存为「补层」自动插入的中间节点，使同一父下的多个子节点共用同一座桥（如同一卷下多个章共用一个自动幕）。
    const bridgeCache = new Map<string, string>()
    /**
     * 在父节点与子 level 不相邻时，自动补齐缺失的中间层级（如章挂在卷下→在中间插入一个幕），
     * 返回子节点真正应挂的父 id。信任 AI 声明的子 level，不再把子节点强行 relabel 成父的下一级。
     */
    const bridgeParentForLevel = (parentId: string | null, parentLevel: OutlineNodeLevel | null, childLevel: OutlineNodeLevel): string | null => {
      let curParentId = parentId
      let curParentLevel = parentLevel
      // 逐级下探，直到父的下一级正好等于子 level
      while (childLevelOf(curParentLevel) !== childLevel && levelRank(curParentLevel) < levelRank(childLevel) - 1) {
        const midLevel = childLevelOf(curParentLevel)
        const cacheKey = `${curParentId ?? 'root'}::${midLevel}`
        const cached = bridgeCache.get(cacheKey)
        if (cached) {
          curParentId = cached
          curParentLevel = midLevel
          continue
        }
        const mid = createOutlineItem({
          novelId: writeNovelId,
          title: `（自动补充的${outlineLevelTextFromLib(midLevel)}）`,
          summary: 'AI 大纲缺少该层级，已自动补充以保持卷→幕→章→场景的完整结构，可手动重命名或整理。',
          level: midLevel,
          parentId: curParentId,
        })
        bridgeCache.set(cacheKey, mid.id)
        bridgeCount += 1
        curParentId = mid.id
        curParentLevel = midLevel
      }
      return curParentId
    }

    for (const item of orderedDraftItems) {
      const characterIds = (item.characterNames ?? [])
        .map((name) => nameToId.get(String(name).trim().toLowerCase()))
        .filter((id): id is string => Boolean(id))
      const povCharacterId = item.povCharacterName
        ? nameToId.get(String(item.povCharacterName).trim().toLowerCase()) ?? null
        : null
      // 解析父；解析失败且本身不是顶层卷时，挂到「未归类卷」兜底，绝不留顶层孤儿
      let parentId = resolveParentId(item.parentTempId)
      if (!parentId && item.level !== 'volume') {
        parentId = ensureFallbackVolume()
        orphanCount += 1
      }
      // 信任 AI 声明的 level：若与父级不相邻（跳级，如章直接挂卷下），自动补齐中间层（插入幕），
      // 而不是把本节点 relabel 成父的下一级——后者正是「章被改写成幕」的根源。
      const initialParent = parentId ? getOutlineByNovelId(novel.value.id).find((i) => i.id === parentId) : null
      const expectedChildLevel = childLevelOf(initialParent?.level ?? null)
      const declaredLevel = OUTLINE_LEVEL_ORDER.includes(item.level as OutlineNodeLevel)
        ? (item.level as OutlineNodeLevel)
        : expectedChildLevel
      // 子 level 必须比父更深；若声明的 level 不比父深（畸形，如幕挂幕下），回退为父的下一级
      let itemLevel: OutlineNodeLevel =
        levelRank(declaredLevel) > levelRank(initialParent?.level ?? null) ? declaredLevel : expectedChildLevel
      if (parentId && initialParent && levelRank(initialParent.level) < levelRank(itemLevel) - 1) {
        parentId = bridgeParentForLevel(parentId, initialParent.level ?? null, itemLevel)
      }
      const created = createOutlineItem({
        novelId: novel.value.id,
        title: item.title,
        summary: item.summary,
        level: itemLevel,
        goal: item.goal,
        conflict: item.conflict,
        twist: item.twist,
        result: item.result,
        suspense: item.suspense,
        plotStage: item.plotStage,
        parentId,
        location: item.location,
        timeLabel: item.timeLabel,
        povCharacterId,
        tension: item.tension,
        characterIds,
        storylineIds: mapStorylineIds(item.storylineNames ?? []),
        emotionalTurn: item.emotionalTurn ?? '',
        proseHint: item.proseHint ?? '',
      })
      createdIdMap.set(item.tempId, created.id)
    }

    if (orphanCount > 0) {
      showOutlineAiWriteToast(`有 ${orphanCount} 个节点未能匹配父级，已归入「未归类卷」，请手动整理。`)
    }
    if (bridgeCount > 0) {
      showOutlineAiWriteToast(`AI 大纲缺少中间层级，已自动补充 ${bridgeCount} 个节点以保持「卷→幕→章→场景」结构，可手动重命名。`)
    }


    upsertNovelRecord({ ...novel.value, updatedAt: new Date().toISOString() })

    if (getCurrentSession()?.token) {
      try {
        await syncAllNovelsWithCloud()
      } catch (syncError: unknown) {
        const syncMessage = syncError instanceof Error ? syncError.message : '云同步失败'
        showOutlineAiWriteToast(`已写入 ${itemCount} 个节点，但云同步失败：${syncMessage}`)
      }
    }

    characters.value = getCharactersByNovelId(novel.value.id)
    characterRelations.value = getCharacterRelationsByNovelId(novel.value.id)
    outlineItems.value = getOutlineByNovelId(novel.value.id)
    outlineStorylines.value = getOutlineStorylinesByNovelId(novel.value.id)
    activeOutlineMapId.value = outlineItems.value[outlineItems.value.length - 1]?.id ?? ''
    outlineAiDesignerOpen.value = false

    if (!outlineAiWriteToast.value) {
      const profileBits = [
        createdCharacterCount > 0 ? `新建 ${createdCharacterCount} 个角色` : '',
        updatedCharacterCount > 0 ? `丰富 ${updatedCharacterCount} 个角色` : '',
        createdRelationCount > 0 ? `补充 ${createdRelationCount} 条关系` : '',
      ].filter(Boolean)
      const castNote = profileBits.length > 0 ? `，${profileBits.join('、')}` : castCount > 0 ? `，角色表 ${castCount} 人` : ''
      const verb = outlineAiAppendMode.value ? '已追加' : '已写入'
      showOutlineAiWriteToast(`${verb} ${itemCount} 个大纲节点${castNote}`)
    }
    outlineAiAppendMode.value = false
  } catch (error: unknown) {
    outlineAiDesignerError.value = error instanceof Error ? error.message : '写入大纲失败，请稍后重试。'
  } finally {
    outlineAiDesignerWriting.value = false
  }
}

function showOutlineAiWriteToast(message: string): void {
  outlineAiWriteToast.value = message
  if (outlineAiWriteToastTimer) clearTimeout(outlineAiWriteToastTimer)
  outlineAiWriteToastTimer = setTimeout(() => {
    outlineAiWriteToast.value = ''
  }, 3200)
}

function closeOutlineCreate(): void {
  outlineCreateOpen.value = false
}

function submitOutlineCreate(): void {
  handleCreateOutline()
  outlineCreateOpen.value = false
}

function openOutlineDetail(outlineId: string): void {
  if (!outlineItems.value.some((item) => item.id === outlineId)) return
  closeWorkspaceDropdowns()
  syncOutlineAssocRangeState(outlineId)
  outlineDetailOpenId.value = outlineId
}

function closeOutlineDetail(): void {
  closeWorkspaceDropdowns()
  outlineDetailOpenId.value = ''
}

function handleCreateOutline() {
  if (!novel.value) return
  const created = createOutlineItem({
    novelId: novel.value.id,
    title: outlineForm.title,
    summary: outlineForm.summary,
    level: 'scene',
    storylineIds: [],
    timeLabel: '',
    location: '',
    povCharacterId: null,
    tension: 3,
    goal: outlineForm.goal,
    conflict: '',
    twist: '',
    result: '',
    suspense: '',
  })
  if (outlineForm.status !== 'todo') {
    updateOutlineItem({ id: created.id, status: outlineForm.status })
  }
  resetOutlineCreateForm()
  outlineItems.value = getOutlineByNovelId(novel.value.id)
  activeOutlineMapId.value = created.id
}

function fillOutlineSummaryFromTemplate(): void {
  const parts = [
    { label: '事件', value: String(outlineTemplate.event ?? '').trim() },
    { label: '冲突', value: String(outlineTemplate.conflict ?? '').trim() },
    { label: '结果', value: String(outlineTemplate.result ?? '').trim() },
    { label: '钩子', value: String(outlineTemplate.hook ?? '').trim() },
  ]
    .filter((x) => x.value)
    .map((x) => `${x.label}：${x.value}`)

  if (parts.length === 0) return
  const summary = parts.join('；')
  outlineForm.summary = summary.slice(0, 240)
  if (!outlineForm.title.trim()) {
    const event = String(outlineTemplate.event ?? '').trim()
    if (event) outlineForm.title = event.slice(0, 80)
  }
}

function resetOutlineCreateForm(): void {
  outlineForm.title = ''
  outlineForm.status = 'todo'
  outlineForm.goal = ''
  outlineForm.summary = ''
  outlineTemplate.event = ''
  outlineTemplate.conflict = ''
  outlineTemplate.result = ''
  outlineTemplate.hook = ''
}

function outlinePovName(item: OutlineItem): string {
  if (!item.povCharacterId) return '未设置 POV'
  return characterNameByIdMap.value.get(item.povCharacterId) ?? characters.value.find((c) => c.id === item.povCharacterId)?.name ?? '未设置 POV'
}

function outlineTensionText(value?: OutlineTension): string {
  const tension = normalizeOutlineTensionForUi(value)
  if (tension === 1) return '低潮'
  if (tension === 2) return '铺垫'
  if (tension === 3) return '推进'
  if (tension === 4) return '紧张'
  return '爆点'
}

function onOutlineContextFieldChange(id: string, field: 'timeLabel' | 'location', event: Event): void {
  const target = event.target as HTMLInputElement | null
  updateOutlineItem({ id, [field]: target?.value ?? '' })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function onOutlinePovChange(id: string, event: Event): void {
  const target = event.target as HTMLSelectElement | null
  updateOutlineItem({ id, povCharacterId: target?.value || null })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function onOutlineTensionChange(id: string, event: Event): void {
  const target = event.target as HTMLSelectElement | null
  updateOutlineItem({ id, tension: normalizeOutlineTensionForUi(target?.value) })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function outlineLevelText(level?: OutlineNodeLevel): string {
  return outlineLevelTextFromLib(level)
}

function plotStageText(stage?: OutlinePlotStage): string {
  if (stage === 'drafted') return '已成型'
  if (stage === 'written') return '已写入正文'
  if (stage === 'resolved') return '已回收伏笔'
  return '待构思'
}

function cycleOutlinePlotStage(id: string): void {
  const current = outlineItems.value.find((i) => i.id === id)
  if (!current) return
  const stage = current.plotStage ?? 'idea'
  const next: OutlinePlotStage =
    stage === 'idea' ? 'drafted' : stage === 'drafted' ? 'written' : stage === 'written' ? 'resolved' : 'idea'
  updateOutlineItem({ id, plotStage: next })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function onOutlineFieldChange(id: string, field: 'goal' | 'conflict' | 'twist' | 'result' | 'suspense', event: Event): void {
  const target = event.target as HTMLInputElement | null
  updateOutlineItem({ id, [field]: target?.value ?? '' })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function onOutlineLevelChange(id: string, event: Event): void {
  const target = event.target as HTMLSelectElement | null
  const level = (target?.value ?? 'scene') as OutlineNodeLevel
  updateOutlineItem({ id, level })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function toggleOutlineCharacterBind(outlineId: string, charId: string): void {
  const item = outlineItems.value.find((i) => i.id === outlineId)
  if (!item) return
  const set = new Set(item.characterIds ?? [])
  if (set.has(charId)) set.delete(charId)
  else set.add(charId)
  updateOutlineItem({ id: outlineId, characterIds: Array.from(set) })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function isOutlineCharacterBound(item: OutlineItem, charId: string): boolean {
  return (item.characterIds ?? []).includes(charId)
}

function outlineCharacterNames(item: OutlineItem): string {
  const map = characterNameByIdMap.value
  const names = (item.characterIds ?? [])
    .map((id) => map.get(id) ?? characters.value.find((c) => c.id === id)?.name ?? '')
    .filter(Boolean)
  return names.length ? names.join('、') : '未关联角色'
}

function toggleOutlineFactionBind(outlineId: string, factionId: string): void {
  const item = outlineItems.value.find((i) => i.id === outlineId)
  if (!item) return
  const set = new Set(item.factionIds ?? [])
  if (set.has(factionId)) set.delete(factionId)
  else set.add(factionId)
  updateOutlineItem({ id: outlineId, factionIds: Array.from(set) })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function isOutlineFactionBound(item: OutlineItem, factionId: string): boolean {
  return (item.factionIds ?? []).includes(factionId)
}

function outlineFactionNames(item: OutlineItem): string {
  const map = factionNameByIdMap.value
  const names = (item.factionIds ?? [])
    .map((id) => map.get(id) ?? factions.value.find((f) => f.id === id)?.name ?? '')
    .filter(Boolean)
  return names.length ? names.join('、') : '未关联势力'
}

function toggleOutlineForeshadowBind(outlineId: string, foreshadowId: string): void {
  const item = outlineItems.value.find((i) => i.id === outlineId)
  if (!item) return
  const set = new Set(item.foreshadowIds ?? [])
  if (set.has(foreshadowId)) set.delete(foreshadowId)
  else set.add(foreshadowId)
  updateOutlineItem({ id: outlineId, foreshadowIds: Array.from(set) })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function isOutlineForeshadowBound(item: OutlineItem, foreshadowId: string): boolean {
  return (item.foreshadowIds ?? []).includes(foreshadowId)
}

function outlineForeshadowNames(item: OutlineItem): string {
  const names = (item.foreshadowIds ?? [])
    .map((id) => foreshadows.value.find((f) => f.id === id)?.title ?? '')
    .filter(Boolean)
  return names.length ? names.join('、') : '未关联伏笔'
}

async function enhanceOutlineByAi(id: string, mode: 'full' | 'conflict' | 'twist' | 'suspense'): Promise<void> {
  const item = outlineItems.value.find((i) => i.id === id)
  if (!item) return
  outlineAiLoadingById[id] = true
  try {
    const data = await expandOutlineItemByAi(item, mode)
    const patch: Partial<OutlineItem> & Pick<OutlineItem, 'id'> = { id }
    if (mode === 'full' || mode === 'conflict') patch.conflict = String(data.conflict ?? '').trim() || (item.conflict ?? '')
    if (mode === 'full' || mode === 'twist') patch.twist = String(data.twist ?? '').trim() || (item.twist ?? '')
    if (mode === 'full' || mode === 'suspense') patch.suspense = String(data.suspense ?? '').trim() || (item.suspense ?? '')
    updateOutlineItem(patch)
    outlineItems.value = getOutlineByNovelId(novelId.value)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    window.alert(`AI 生成失败：${msg}`)
  } finally {
    outlineAiLoadingById[id] = false
  }
}

function outlineStatusText(status: OutlineStatus): string {
  if (status === 'todo') return '待写'
  if (status === 'doing') return '进行中'
  return '已完成'
}

function cycleOutlineStatus(id: string) {
  const current = outlineItems.value.find((i) => i.id === id)
  if (!current) return
  const next: OutlineStatus =
    current.status === 'todo' ? 'doing' : current.status === 'doing' ? 'done' : 'todo'
  updateOutlineItem({ id, status: next })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function toggleOutlineStoryline(payload: { outlineId: string; storylineId: string }): void {
  const current = outlineItems.value.find((i) => i.id === payload.outlineId)
  if (!current) return
  const set = new Set(current.storylineIds ?? [])
  if (set.has(payload.storylineId)) set.delete(payload.storylineId)
  else set.add(payload.storylineId)
  updateOutlineItem({ id: payload.outlineId, storylineIds: Array.from(set) })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function onOutlineSummaryChange(id: string, event: Event) {
  const target = event.target as HTMLInputElement | null
  updateOutlineItem({ id, summary: target?.value ?? '' })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function onOutlineTitleChange(id: string, event: Event) {
  const target = event.target as HTMLInputElement | null
  const t = target?.value?.trim() || '未命名情节点'
  updateOutlineItem({ id, title: t })
  outlineItems.value = getOutlineByNovelId(novelId.value)
}


function getLinkedChaptersCount(outlineId: string): number {
  return chapters.value.filter((c) => (c.outlineItemIds ?? []).includes(outlineId)).length
}

function toggleOutlineAssocPanel(outlineId: string): void {
  openOutlineDetail(outlineId)
}

function handleDeleteOutline(id: string) {
  outlineDeleteId.value = id
  outlineDeleteOpen.value = true
}

function confirmDeleteOutline() {
  const id = outlineDeleteId.value
  if (!id) return
  deleteOutlineItem(id)

  outlineItems.value = getOutlineByNovelId(novelId.value)
  chapters.value = getChaptersByNovelId(novelId.value)

  expandedOutlineId.value = ''
  outlineDeleteOpen.value = false
  outlineDeleteId.value = ''
}

function onOutlineDeleteDialogCancel() {
  outlineDeleteOpen.value = false
  outlineDeleteId.value = ''
}

function handleCreateCharacter() {
  characterCreateError.value = ''
  if (!novel.value) {
    characterCreateError.value = '作品不存在，无法新增角色。'
    return
  }
  if (!characterForm.name.trim()) {
    characterCreateError.value = '请填写「角色名」。'
    return
  }

  const parsedAttrs = parseAttributesInput(characterForm.attributes)
  if (!parsedAttrs.ok) {
    characterCreateError.value = parsedAttrs.message
    return
  }

  try {
    const created = createCharacter({
      novelId: novel.value.id,
      name: characterForm.name,
      firstAppearanceChapterNo: null,
      age: characterForm.age,
      gender: characterForm.gender,
      goal: '',
      secret: '',
      arc: '',
      notes: '',
      attributes: parsedAttrs.value,
      aliases: normalizeCharacterAliases(characterForm.aliasRows.map((r) => r.value)),
      categoryIds: normalizeCategoryIds(characterForm.categoryIds),
    } satisfies NewCharacterInput)

    const memRows = characterForm.membershipRows.filter((r) => r.factionId.trim())
    const seenF = new Set<string>()
    const uniq = memRows.filter((r) => {
      const id = r.factionId.trim()
      if (seenF.has(id)) return false
      seenF.add(id)
      return true
    })
    if (uniq.length > 0) {
      replaceMembershipsForCharacter(novel.value.id, created.id, uniq)
    }

    characters.value = getCharactersByNovelId(novel.value.id)
    characterFactionMemberships.value = getCharacterFactionMembershipsByNovelId(novel.value.id)
    characterRelations.value = getCharacterRelationsByNovelId(novel.value.id)
    graphFocusCharacterId.value = created.id
  } catch (e) {
    console.error(e)
    characterCreateError.value = '新增角色失败（已记录到控制台）。'
    return
  }

  characterForm.name = ''
  characterForm.age = ''
  characterForm.gender = ''
  characterForm.attributes = []
  characterForm.aliasRows = []
  characterForm.categoryIds = []
  characterForm.membershipRows = []

  characterCreateOpen.value = false
  characterCreateError.value = ''
}

function submitCreateCharacter(): void {
  handleCreateCharacter()
}

const characterDeleteMessage = computed(() => {
  const id = pendingDeleteCharacterId.value
  if (!id) return ''
  const c = characters.value.find((x) => x.id === id)
  if (!c) return '确定删除该角色？将自动删除与该角色相关的所有关系。'
  return `确定删除「${c.name}」？将自动删除与该角色相关的所有关系。此操作无法撤销。`
})

function openCharacterDelete(id: string): void {
  pendingDeleteCharacterId.value = id
  characterDeleteOpen.value = true
}

function confirmCharacterDelete(): void {
  const id = pendingDeleteCharacterId.value
  pendingDeleteCharacterId.value = null
  if (!id) return
  if (!deleteCharacter(id)) {
    characterDeleteOpen.value = false
    return
  }

  if (!novel.value) return
  characters.value = getCharactersByNovelId(novel.value.id)
  characterRelations.value = getCharacterRelationsByNovelId(novel.value.id)
  characterFactionMemberships.value = getCharacterFactionMembershipsByNovelId(novel.value.id)

  // 清空右侧表单，避免继续编辑已不存在的角色
  graphAttributeKey.value = ''
  graphAttributeValue.value = ''
  graphLinkMode.value = false
  characterDeleteOpen.value = false
}

function onCharacterDeleteDialogCancel(): void {
  characterDeleteOpen.value = false
  pendingDeleteCharacterId.value = null
}

function resetItemForm(): void {
  itemForm.name = ''
  itemForm.summary = ''
  itemForm.ownerKey = ''
  itemOwnerPickerQuery.value = ''
  itemOwnerPickerOpen.value = false
  itemForm.attributes = []
}

function parseItemOwnerKey(key: string): { ownerType: ItemOwnerType | null; ownerId: string | null } {
  const [type, ...rest] = String(key ?? '').split(':')
  const id = rest.join(':').trim()
  if ((type === 'character' || type === 'faction') && id) return { ownerType: type, ownerId: id }
  return { ownerType: null, ownerId: null }
}

function itemOwnerKey(item: Pick<Item, 'ownerType' | 'ownerId'>): string {
  return item.ownerType && item.ownerId ? `${item.ownerType}:${item.ownerId}` : ''
}

function itemOwnerLabel(item: Pick<Item, 'ownerType' | 'ownerId'>): string {
  if (item.ownerType === 'character' && item.ownerId) {
    const character = characters.value.find((c) => c.id === item.ownerId)
    return character ? `角色：${character.name}` : '未绑定'
  }
  if (item.ownerType === 'faction' && item.ownerId) {
    const faction = factions.value.find((f) => f.id === item.ownerId)
    return faction ? `势力：${faction.name}` : '未绑定'
  }
  return '未绑定'
}

type ItemOwnerPickerRow = {
  key: string
  type: 'character' | 'faction'
  label: string
  meta: string
}

const itemOwnerPickerRows = computed<ItemOwnerPickerRow[]>(() => {
  const characterRows = characters.value.map((character) => ({
    key: `character:${character.id}`,
    type: 'character' as const,
    label: character.name,
    meta: '角色',
  }))
  const factionRows = factions.value.map((faction) => ({
    key: `faction:${faction.id}`,
    type: 'faction' as const,
    label: faction.name,
    meta: '势力',
  }))
  return [...characterRows, ...factionRows]
})

function filteredItemOwnerPickerRows(query: string): ItemOwnerPickerRow[] {
  const q = query.trim().toLowerCase()
  const rows = itemOwnerPickerRows.value
  if (!q) return rows.slice(0, 12)
  return rows
    .filter((row) => [row.label, row.meta].some((value) => value.toLowerCase().includes(q)))
    .slice(0, 12)
}

const filteredItemCreateOwnerRows = computed(() => filteredItemOwnerPickerRows(itemOwnerPickerQuery.value))
const filteredItemEditOwnerRows = computed(() => filteredItemOwnerPickerRows(itemEditOwnerPickerQuery.value))

function toggleItemOwnerPicker(): void {
  itemOwnerPickerOpen.value = !itemOwnerPickerOpen.value
  if (itemOwnerPickerOpen.value) itemEditOwnerPickerOpen.value = false
}

function toggleItemEditOwnerPicker(): void {
  itemEditOwnerPickerOpen.value = !itemEditOwnerPickerOpen.value
  if (itemEditOwnerPickerOpen.value) itemOwnerPickerOpen.value = false
}

function setItemFormOwner(key: string): void {
  itemForm.ownerKey = key
  itemOwnerPickerOpen.value = false
}

function setItemEditOwner(key: string): void {
  itemEditDraft.ownerKey = key
  itemEditOwnerPickerOpen.value = false
}

function itemFirstAppearanceLabel(item: Pick<Item, 'firstAppearanceChapterNo'>): string {
  const no = item.firstAppearanceChapterNo
  return typeof no === 'number' && no > 0 ? `首次出现：第 ${no} 章` : '首次出现：未出场'
}

function refreshItems(): void {
  items.value = getItemsByNovelId(novelId.value)
}

function openItemCreate(): void {
  itemFormError.value = ''
  resetItemForm()
  itemEditOwnerPickerOpen.value = false
  itemCreateOpen.value = true
}

function itemCreateDirty(): boolean {
  if (itemForm.name.trim()) return true
  if (itemForm.summary.trim()) return true
  if (itemForm.ownerKey) return true
  return itemForm.attributes.some((attr) => attr.key.trim() || attr.value.trim())
}

function requestCloseItemCreate(): void {
  if (itemCreateDirty()) {
    itemCreateCancelConfirmOpen.value = true
    return
  }
  forceCloseItemCreate()
}

function closeItemCreate(): void {
  requestCloseItemCreate()
}

function forceCloseItemCreate(): void {
  itemCreateOpen.value = false
  itemCreateCancelConfirmOpen.value = false
  itemOwnerPickerOpen.value = false
  itemFormError.value = ''
}

function handleCreateItem(): void {
  itemFormError.value = ''
  if (!novel.value) {
    itemFormError.value = '作品不存在，无法新增物品。'
    return
  }
  if (!itemForm.name.trim()) {
    itemFormError.value = '请填写「名称」。'
    return
  }
  const parsedAttrs = parseAttributesInput(itemForm.attributes)
  if (!parsedAttrs.ok) {
    itemFormError.value = parsedAttrs.message
    return
  }
  const owner = parseItemOwnerKey(itemForm.ownerKey)
  createItem({
    novelId: novel.value.id,
    name: itemForm.name,
    summary: itemForm.summary,
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    attributes: parsedAttrs.value,
  } satisfies NewItemInput)
  refreshItems()
  forceCloseItemCreate()
  resetItemForm()
}

function openItemEdit(itemId: string): void {
  itemFormError.value = ''
  const item = items.value.find((x) => x.id === itemId)
  if (!item) return
  itemEditDraft.id = item.id
  itemEditDraft.name = item.name ?? ''
  itemEditDraft.summary = item.summary ?? ''
  itemEditDraft.ownerKey = itemOwnerKey(item)
  itemEditOwnerPickerQuery.value = ''
  itemEditOwnerPickerOpen.value = false
  itemEditDraft.firstAppearanceChapterNo = item.firstAppearanceChapterNo ?? null
  itemEditDraft.attributes = (item.attributes ?? []).map((attr) => ({ ...attr }))
  itemEditInitial.value = {
    name: itemEditDraft.name.trim(),
    summary: itemEditDraft.summary.trim(),
    ownerKey: itemEditDraft.ownerKey,
    attrs: itemEditDraft.attributes.map((attr) => ({ key: attr.key.trim(), value: attr.value.trim() })),
  }
  itemEditCancelConfirmOpen.value = false
  itemEditOpen.value = true
}

function itemEditDirty(): boolean {
  if (itemEditDraft.name.trim() !== itemEditInitial.value.name) return true
  if (itemEditDraft.summary.trim() !== itemEditInitial.value.summary) return true
  if (itemEditDraft.ownerKey !== itemEditInitial.value.ownerKey) return true
  const attrs = itemEditDraft.attributes.map((attr) => ({ key: attr.key.trim(), value: attr.value.trim() }))
  if (attrs.length !== itemEditInitial.value.attrs.length) return true
  return attrs.some((attr, i) => attr.key !== itemEditInitial.value.attrs[i]?.key || attr.value !== itemEditInitial.value.attrs[i]?.value)
}

function requestCloseItemEdit(): void {
  if (itemEditDirty()) {
    itemEditCancelConfirmOpen.value = true
    return
  }
  forceCloseItemEdit()
}

function closeItemEdit(): void {
  requestCloseItemEdit()
}

function forceCloseItemEdit(): void {
  itemEditOpen.value = false
  itemEditCancelConfirmOpen.value = false
  itemEditOwnerPickerOpen.value = false
  itemFormError.value = ''
  itemEditDraft.id = ''
  itemEditDraft.name = ''
  itemEditDraft.summary = ''
  itemEditDraft.ownerKey = ''
  itemEditOwnerPickerQuery.value = ''
  itemEditOwnerPickerOpen.value = false
  itemEditDraft.firstAppearanceChapterNo = null
  itemEditDraft.attributes = []
  itemEditInitial.value = { name: '', summary: '', ownerKey: '', attrs: [] }
}

function saveItemEdit(): void {
  itemFormError.value = ''
  if (!itemEditDraft.id) return
  if (!itemEditDraft.name.trim()) {
    itemFormError.value = '请填写「名称」。'
    return
  }
  const parsedAttrs = parseAttributesInput(itemEditDraft.attributes)
  if (!parsedAttrs.ok) {
    itemFormError.value = parsedAttrs.message
    return
  }
  const owner = parseItemOwnerKey(itemEditDraft.ownerKey)
  updateItem({
    id: itemEditDraft.id,
    name: itemEditDraft.name,
    summary: itemEditDraft.summary,
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    attributes: parsedAttrs.value,
  })
  refreshItems()
  forceCloseItemEdit()
}

const itemDeleteMessage = computed(() => {
  const id = pendingDeleteItemId.value
  if (!id) return ''
  const item = items.value.find((x) => x.id === id)
  if (!item) return '确定删除该物品？此操作无法撤销。'
  return `确定删除「${item.name}」？此操作无法撤销。`
})

function openItemDelete(itemId: string): void {
  pendingDeleteItemId.value = itemId
  itemDeleteOpen.value = true
}

function confirmItemDelete(): void {
  const id = pendingDeleteItemId.value
  pendingDeleteItemId.value = null
  if (!id) return
  deleteItem(id)
  refreshItems()
  itemDeleteOpen.value = false
}

function onItemDeleteDialogCancel(): void {
  itemDeleteOpen.value = false
  pendingDeleteItemId.value = null
}

function addItemFormRow(): void {
  itemForm.attributes.push({ id: uid(), key: '', value: '' })
}

function removeItemFormRow(id: string): void {
  const i = itemForm.attributes.findIndex((x) => x.id === id)
  if (i >= 0) itemForm.attributes.splice(i, 1)
}

function addItemEditRow(): void {
  itemEditDraft.attributes.push({ id: uid(), key: '', value: '' })
}

function removeItemEditRow(id: string): void {
  const i = itemEditDraft.attributes.findIndex((x) => x.id === id)
  if (i >= 0) itemEditDraft.attributes.splice(i, 1)
}

function parseAttributesInput(
  attrs: CharacterAttribute[]
): { ok: true; value: CharacterAttribute[] } | { ok: false; message: string } {
  const out: CharacterAttribute[] = []
  for (const a of attrs) {
    const k = a.key.trim()
    const v = a.value.trim()
    if (!k && !v) continue
    if (!k) return { ok: false, message: '自定义字段需填写「字段名」。' }
    if (!v) return { ok: false, message: '自定义字段需填写「字段说明」。' }
    out.push({ id: a.id || uid(), key: k, value: v })
  }
  return { ok: true, value: out }
}

function addCharacterFormRow(): void {
  characterForm.attributes.push({ id: uid(), key: '', value: '' })
}

function removeCharacterFormRow(id: string): void {
  const i = characterForm.attributes.findIndex((x) => x.id === id)
  if (i >= 0) characterForm.attributes.splice(i, 1)
}

function addCharacterFormAliasRow(): void {
  characterForm.aliasRows.push({ id: uid(), value: '' })
}

function removeCharacterFormAliasRow(id: string): void {
  const i = characterForm.aliasRows.findIndex((x) => x.id === id)
  if (i >= 0) characterForm.aliasRows.splice(i, 1)
}

function addCharacterFormMembershipRow(): void {
  characterForm.membershipRows.push({ factionId: '', description: '' })
}

function removeCharacterFormMembershipRow(index: number): void {
  characterForm.membershipRows.splice(index, 1)
  if (characterCreateMembershipFactionDropdownOpenId.value === String(index)) {
    characterCreateMembershipFactionDropdownOpenId.value = ''
  } else if (characterCreateMembershipFactionDropdownOpenId.value) {
    const openIndex = Number(characterCreateMembershipFactionDropdownOpenId.value)
    if (!Number.isNaN(openIndex) && openIndex > index) {
      characterCreateMembershipFactionDropdownOpenId.value = String(openIndex - 1)
    }
  }
}

function toggleFactionCreateCategory(categoryId: string): void {
  const id = String(categoryId ?? '').trim()
  if (!id) return
  const i = factionForm.categoryIds.indexOf(id)
  if (i >= 0) factionForm.categoryIds.splice(i, 1)
  else factionForm.categoryIds.push(id)
}

function toggleFactionEditDraftCategory(categoryId: string): void {
  const id = String(categoryId ?? '').trim()
  if (!id) return
  const i = factionEditDraft.categoryIds.indexOf(id)
  if (i >= 0) factionEditDraft.categoryIds.splice(i, 1)
  else factionEditDraft.categoryIds.push(id)
}

function toggleWorldSettingFormCategory(categoryId: string): void {
  const id = String(categoryId ?? '').trim()
  if (!id) return
  const i = worldSettingForm.categoryIds.indexOf(id)
  if (i >= 0) worldSettingForm.categoryIds.splice(i, 1)
  else worldSettingForm.categoryIds.push(id)
}

function toggleWorldSettingEditCategory(categoryId: string): void {
  const id = String(categoryId ?? '').trim()
  if (!id) return
  const i = worldSettingEditDraft.categoryIds.indexOf(id)
  if (i >= 0) worldSettingEditDraft.categoryIds.splice(i, 1)
  else worldSettingEditDraft.categoryIds.push(id)
}

function toggleWorldSettingAiDraftCategory(categoryId: string): void {
  const id = String(categoryId ?? '').trim()
  if (!id) return
  const i = worldSettingAiDraftCategoryIds.value.indexOf(id)
  if (i >= 0) worldSettingAiDraftCategoryIds.value.splice(i, 1)
  else worldSettingAiDraftCategoryIds.value.push(id)
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function normalizeItemIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hans'))
}

function itemNameById(itemId: string): string {
  return items.value.find((item) => item.id === itemId)?.name ?? itemId
}

function itemOwnerLabelForDraft(item: Item, ownerType: ItemOwnerType, ownerId: string): string {
  if (!item.ownerType || !item.ownerId) return `保存后绑定到当前${ownerType === 'character' ? '角色' : '势力'}`
  if (item.ownerType === ownerType && item.ownerId === ownerId) return `当前${ownerType === 'character' ? '角色' : '势力'}已绑定`
  return `保存后将转移自：${itemOwnerLabel(item)}`
}

const zhPinyinCollator = new Intl.Collator('zh-Hans-u-co-pinyin', {
  sensitivity: 'base',
  numeric: true,
})

function sortByPinyinName<T extends { name?: string | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const an = (a.name ?? '').trim()
    const bn = (b.name ?? '').trim()
    return zhPinyinCollator.compare(an, bn)
  })
}

function categoryNameById(id?: string | null): string {
  if (!id) return ''
  return categories.value.find((c) => c.id === id)?.name ?? ''
}

function categoryNamesByIds(ids?: string[] | null): string[] {
  if (!Array.isArray(ids) || ids.length === 0) return []
  return ids
    .map((id) => categoryNameById(id))
    .filter((x) => x.trim())
}

function ensureCategoryIdByName(nameRaw: string): string | null {
  if (!novel.value) return null
  const name = nameRaw.trim()
  if (!name) return null
  const existed = categories.value.find((c) => c.name.toLowerCase() === name.toLowerCase())
  if (existed) return existed.id
  const created = createCategory({ novelId: novel.value.id, name })
  categories.value = getCategoriesByNovelId(novel.value.id)
  return created.id
}

function addCategoryToIds(target: string[], inputName: string): string {
  const id = ensureCategoryIdByName(inputName)
  if (!id) return ''
  if (!target.includes(id)) target.push(id)
  return id
}

function removeCategoryFromIds(target: string[], id: string): void {
  const i = target.findIndex((x) => x === id)
  if (i >= 0) target.splice(i, 1)
}

const filteredCharacters = computed(() => {
  const cid = selectedCategoryFilterId.value
  const q = characterKeywordFilter.value.trim().toLowerCase()
  const list = characters.value.filter((c) => {
    if (cid && !(c.categoryIds ?? []).includes(cid)) return false
    if (!q) return true
    return characterMatchLabels(c).some((l) => l.toLowerCase().includes(q))
  })
  return sortByPinyinName(list)
})

const graphScopedCharacters = computed(() => {
  const cid = selectedCategoryFilterId.value
  const list = characters.value.filter((c) => {
    if (cid && !(c.categoryIds ?? []).includes(cid)) return false
    return true
  })
  return sortByPinyinName(list)
})

const graphFocusCharacterDropdownLabel = computed(() => {
  const selected = graphScopedCharacters.value.find((c) => c.id === graphFocusCharacterId.value)
  if (selected) return selected.name
  return graphScopedCharacters.value[0]?.name ?? '暂无角色'
})

const filteredItems = computed(() => {
  const q = itemKeywordFilter.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((item) => {
    return [item.name, item.summary, itemOwnerLabel(item)]
      .map((v) => String(v ?? '').toLowerCase())
      .some((v) => v.includes(q))
  })
})

const filteredFactions = computed(() => {
  const cid = selectedCategoryFilterId.value
  const q = factionKeywordFilter.value.trim().toLowerCase()
  const list = factions.value.filter((f) => {
    if (cid && !(f.categoryIds ?? []).includes(cid)) return false
    if (!q) return true
    return f.name.toLowerCase().includes(q)
  })
  return sortByPinyinName(list)
})

const filteredWorldSettings = computed(() => {
  const cid = selectedCategoryFilterId.value
  const q = worldSettingKeywordFilter.value.trim().toLowerCase()
  const list = worldSettings.value.filter((ws) => {
    if (cid && !(ws.categoryIds ?? []).includes(cid)) return false
    if (!q) return true
    return ws.name.toLowerCase().includes(q) || ws.content.toLowerCase().includes(q)
  })
  return sortByPinyinName(list)
})

const sortedCategories = computed(() => sortByPinyinName(categories.value))

const categoryCenterCategories = computed(() => {
  const q = categoryBindCategoryQuery.value.trim().toLowerCase()
  const list = !q
    ? sortedCategories.value
    : sortedCategories.value.filter((cat) => {
        const name = String(cat.name ?? '').toLowerCase()
        const notes = String(cat.notes ?? '').toLowerCase()
        return name.includes(q) || notes.includes(q)
      })
  return list
})

const selectedCategoryFilterName = computed(() => {
  if (!selectedCategoryFilterId.value) return ''
  return categoryNameById(selectedCategoryFilterId.value)
})

function setCategoryFilter(categoryId: string): void {
  selectedCategoryFilterId.value = categoryId
}

function clearCategoryFilter(): void {
  selectedCategoryFilterId.value = ''
}

function openCategoryCreate(): void {
  categoryCreateError.value = ''
  categoryCreateName.value = ''
  categoryCreateNotes.value = ''
  categoryCreateOpen.value = true
}

function closeCategoryCreate(): void {
  categoryCreateOpen.value = false
  categoryCreateError.value = ''
}

function submitCategoryCreate(): void {
  if (!novel.value) return
  categoryCreateError.value = ''
  const name = categoryCreateName.value.trim()
  if (!name) {
    categoryCreateError.value = '请填写分类名。'
    return
  }
  const existed = categories.value.find((c) => c.name.toLowerCase() === name.toLowerCase())
  if (existed) {
    categoryCreateError.value = '已存在同名分类。'
    return
  }
  const created = createCategory({ novelId: novel.value.id, name })
  updateCategory({ id: created.id, notes: categoryCreateNotes.value })
  categories.value = getCategoriesByNovelId(novel.value.id)
  categoryCreateName.value = ''
  categoryCreateNotes.value = ''
  categoryCreateOpen.value = false
}

function openCategoryEdit(categoryId: string): void {
  const c = categories.value.find((x) => x.id === categoryId)
  if (!c) return
  categoryEditId.value = categoryId
  categoryEditDraft.name = c.name ?? ''
  categoryEditDraft.notes = c.notes ?? ''
  categoryEditInitial.value = { name: categoryEditDraft.name.trim(), notes: categoryEditDraft.notes.trim() }
  categoryEditOpen.value = true
  categoryEditCancelConfirmOpen.value = false
}

function categoryEditDirty(): boolean {
  return (
    categoryEditDraft.name.trim() !== categoryEditInitial.value.name ||
    categoryEditDraft.notes.trim() !== categoryEditInitial.value.notes
  )
}

function requestCloseCategoryEdit(): void {
  if (categoryEditDirty()) {
    categoryEditCancelConfirmOpen.value = true
    return
  }
  forceCloseCategoryEdit()
}

function forceCloseCategoryEdit(): void {
  categoryEditOpen.value = false
  categoryEditId.value = ''
  categoryEditCancelConfirmOpen.value = false
}

function onCategoryEditCancelDialogCancel(): void {
  categoryEditCancelConfirmOpen.value = false
}

const categoryDeleteMessage = computed(() => {
  const id = pendingDeleteCategoryId.value
  if (!id) return ''
  const category = categories.value.find((item) => item.id === id)
  if (!category) return '确定删除该分类？该分类会同时从已绑定的角色和势力中移除，此操作无法撤销。'
  return `确定删除「${category.name}」？该分类会同时从已绑定的角色和势力中移除，此操作无法撤销。`
})

function saveCategoryEdit(): void {
  if (!novel.value) return
  const id = categoryEditId.value
  if (!id) return
  const name = categoryEditDraft.name.trim()
  if (!name) return
  updateCategory({ id, name, notes: categoryEditDraft.notes })
  categories.value = getCategoriesByNovelId(novel.value.id)
  forceCloseCategoryEdit()
}

function openCategoryDelete(categoryId: string): void {
  pendingDeleteCategoryId.value = categoryId
  categoryDeleteOpen.value = true
}

function confirmCategoryDelete(): void {
  const id = String(pendingDeleteCategoryId.value ?? '').trim()
  pendingDeleteCategoryId.value = null
  if (!id) return

  if (categoryEditId.value === id) forceCloseCategoryEdit()
  if (categoryBindModalCategoryId.value === id) closeCategoryBindModal()
  if (selectedCategoryFilterId.value === id) clearCategoryFilter()

  delete categoryCharacterDraftById.value[id]
  delete categoryFactionDraftById.value[id]
  delete categoryCharacterDraftSetById.value[id]
  delete categoryFactionDraftSetById.value[id]

  if (!deleteCategory(id)) {
    categoryDeleteOpen.value = false
    return
  }

  categories.value = getCategoriesByNovelId(novelId.value)
  characters.value = getCharactersByNovelId(novelId.value)
  factions.value = getFactionsByNovelId(novelId.value)
  categoryDeleteOpen.value = false
}

function onCategoryDeleteDialogCancel(): void {
  categoryDeleteOpen.value = false
  pendingDeleteCategoryId.value = null
}

const categoryCenterCharacters = computed(() => {
  const q = categoryBindCharacterQuery.value.trim().toLowerCase()
  const list = !q
    ? characters.value
    : characters.value.filter((c) => characterMatchLabels(c).some((l) => l.toLowerCase().includes(q)))
  return sortByPinyinName(list)
})

const categoryCenterFactions = computed(() => {
  const q = categoryBindFactionQuery.value.trim().toLowerCase()
  const list = !q
    ? factions.value
    : factions.value.filter((f) => f.name.toLowerCase().includes(q))
  return sortByPinyinName(list)
})

const categoryCenterFilteredCategories = computed(() => {
  const characterQuery = categoryBindCharacterQuery.value.trim().toLowerCase()
  const factionQuery = categoryBindFactionQuery.value.trim().toLowerCase()
  const characterMap = characterNameByIdMap.value
  const factionMap = factionNameByIdMap.value
  return categoryCenterCategories.value.filter((cat) => {
    if (characterQuery) {
      const characterIds = getCharacterIdsByCategory(cat.id)
      const matched = characterIds.some((id) => {
        const name = characterMap.get(id) ?? ''
        const labels = characters.value.find((c) => c.id === id) ? characterMatchLabels(characters.value.find((c) => c.id === id)!) : [name]
        return labels.some((label) => label.toLowerCase().includes(characterQuery))
      })
      if (!matched) return false
    }
    if (factionQuery) {
      const factionIds = getFactionIdsByCategory(cat.id)
      const matched = factionIds.some((id) => (factionMap.get(id) ?? '').toLowerCase().includes(factionQuery))
      if (!matched) return false
    }
    return true
  })
})

// 性能：持久化绑定（来自 entities.categoryIds）按 category 一次性预计算
const persistedCharacterIdsByCategory = computed<Record<string, string[]>>(() => {
  const map: Record<string, string[]> = {}
  for (const c of characters.value) {
    for (const cid of c.categoryIds ?? []) {
      if (!map[cid]) map[cid] = []
      map[cid].push(c.id)
    }
  }
  return map
})

const persistedFactionIdsByCategory = computed<Record<string, string[]>>(() => {
  const map: Record<string, string[]> = {}
  for (const f of factions.value) {
    for (const cid of f.categoryIds ?? []) {
      if (!map[cid]) map[cid] = []
      map[cid].push(f.id)
    }
  }
  return map
})

function getCharacterIdsByCategory(categoryId: string): string[] {
  return persistedCharacterIdsByCategory.value[categoryId] ?? []
}

function getFactionIdsByCategory(categoryId: string): string[] {
  return persistedFactionIdsByCategory.value[categoryId] ?? []
}

function ensureCategoryDraft(categoryId: string): void {
  if (!categoryCharacterDraftById.value[categoryId]) {
    const ids = getCharacterIdsByCategory(categoryId)
    categoryCharacterDraftById.value[categoryId] = ids
    categoryCharacterDraftSetById.value[categoryId] = new Set(ids)
  }
  if (!categoryFactionDraftById.value[categoryId]) {
    const ids = getFactionIdsByCategory(categoryId)
    categoryFactionDraftById.value[categoryId] = ids
    categoryFactionDraftSetById.value[categoryId] = new Set(ids)
  }
}

function categoryHasCharacter(categoryId: string, characterId: string): boolean {
  ensureCategoryDraft(categoryId)
  return categoryCharacterDraftSetById.value[categoryId]?.has(characterId) ?? false
}

function categoryHasFaction(categoryId: string, factionId: string): boolean {
  ensureCategoryDraft(categoryId)
  return categoryFactionDraftSetById.value[categoryId]?.has(factionId) ?? false
}

function toggleCharacterCategory(categoryId: string, characterId: string): void {
  ensureCategoryDraft(categoryId)
  const ids = [...(categoryCharacterDraftById.value[categoryId] ?? [])]
  if (ids.includes(characterId)) removeCategoryFromIds(ids, characterId)
  else ids.push(characterId)
  categoryCharacterDraftById.value[categoryId] = ids
  categoryCharacterDraftSetById.value[categoryId] = new Set(ids)
}

function toggleFactionCategory(categoryId: string, factionId: string): void {
  ensureCategoryDraft(categoryId)
  const ids = [...(categoryFactionDraftById.value[categoryId] ?? [])]
  if (ids.includes(factionId)) removeCategoryFromIds(ids, factionId)
  else ids.push(factionId)
  categoryFactionDraftById.value[categoryId] = ids
  categoryFactionDraftSetById.value[categoryId] = new Set(ids)
}

function categoryBindingDirty(categoryId: string): boolean {
  ensureCategoryDraft(categoryId)
  const persistedChars = getCharacterIdsByCategory(categoryId).sort().join('|')
  const draftChars = [...(categoryCharacterDraftById.value[categoryId] ?? [])].sort().join('|')
  if (persistedChars !== draftChars) return true
  const persistedFactions = getFactionIdsByCategory(categoryId).sort().join('|')
  const draftFactions = [...(categoryFactionDraftById.value[categoryId] ?? [])].sort().join('|')
  return persistedFactions !== draftFactions
}

function cancelCategoryBindingChanges(categoryId: string): void {
  const chars = getCharacterIdsByCategory(categoryId)
  const facs = getFactionIdsByCategory(categoryId)
  categoryCharacterDraftById.value[categoryId] = chars
  categoryFactionDraftById.value[categoryId] = facs
  categoryCharacterDraftSetById.value[categoryId] = new Set(chars)
  categoryFactionDraftSetById.value[categoryId] = new Set(facs)
}

function saveCategoryBindingChanges(categoryId: string): void {
  ensureCategoryDraft(categoryId)
  const charSet = new Set(categoryCharacterDraftById.value[categoryId] ?? [])
  for (const c of characters.value) {
    const ids = [...(c.categoryIds ?? [])]
    const has = ids.includes(categoryId)
    const nextHas = charSet.has(c.id)
    if (has === nextHas) continue
    if (nextHas) ids.push(categoryId)
    else removeCategoryFromIds(ids, categoryId)
    updateCharacter({ id: c.id, categoryIds: ids })
  }
  const factionSet = new Set(categoryFactionDraftById.value[categoryId] ?? [])
  for (const f of factions.value) {
    const ids = [...(f.categoryIds ?? [])]
    const has = ids.includes(categoryId)
    const nextHas = factionSet.has(f.id)
    if (has === nextHas) continue
    if (nextHas) ids.push(categoryId)
    else removeCategoryFromIds(ids, categoryId)
    updateFaction({ id: f.id, categoryIds: ids })
  }
  characters.value = getCharactersByNovelId(novelId.value)
  factions.value = getFactionsByNovelId(novelId.value)
  cancelCategoryBindingChanges(categoryId)
}

const characterNameByIdMap = computed(() =>
  buildDisplayNameMap(characters.value.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt }))),
)
const factionNameByIdMap = computed(() =>
  buildDisplayNameMap(factions.value.map((f) => ({ id: f.id, name: f.name, createdAt: f.createdAt }))),
)
// 模板用:取角色/势力的显示名(同名加后缀 张三1/张三2)
function charDisplay(c: { id: string; name?: string | null }): string {
  return characterNameByIdMap.value.get(c.id) ?? (c.name ?? '')
}
function factionDisplay(f: { id: string; name?: string | null }): string {
  return factionNameByIdMap.value.get(f.id) ?? (f.name ?? '')
}

function categoryBoundCharacterNames(categoryId: string): string[] {
  ensureCategoryDraft(categoryId)
  const ids = categoryCharacterDraftById.value[categoryId] ?? []
  const map = characterNameByIdMap.value
  return ids
    .map((id) => map.get(id) ?? '未知角色')
    .sort((a, b) => a.localeCompare(b, 'zh-Hans'))
}

function categoryBoundFactionNames(categoryId: string): string[] {
  ensureCategoryDraft(categoryId)
  const ids = categoryFactionDraftById.value[categoryId] ?? []
  const map = factionNameByIdMap.value
  return ids
    .map((id) => map.get(id) ?? '未知势力')
    .sort((a, b) => a.localeCompare(b, 'zh-Hans'))
}

function openCategoryBindModal(categoryId: string): void {
  ensureCategoryDraft(categoryId)
  categoryBindModalCategoryId.value = categoryId
  categoryBindModalTab.value = 'characters'
  categoryBindModalCharacterQuery.value = ''
  categoryBindModalFactionQuery.value = ''
  categoryBindModalCharLimit.value = 250
  categoryBindModalFactionLimit.value = 250
  categoryBindSavedToast.value = false
  categoryBindModalOpen.value = true
}

function closeCategoryBindModal(): void {
  categoryBindModalOpen.value = false
  categoryBindModalCategoryId.value = ''
  categoryBindCancelConfirmOpen.value = false
  categoryBindSavedToast.value = false
  if (categoryBindSavedToastTimer != null) window.clearTimeout(categoryBindSavedToastTimer)
  categoryBindSavedToastTimer = null
}

function requestCancelCategoryBindModal(): void {
  const id = String(categoryBindModalCategoryId.value ?? '').trim()
  if (id && categoryBindingDirty(id)) {
    categoryBindCancelConfirmOpen.value = true
    return
  }
  cancelCategoryBindModal()
}

function cancelCategoryBindModal(): void {
  const id = String(categoryBindModalCategoryId.value ?? '').trim()
  if (id) cancelCategoryBindingChanges(id)
  closeCategoryBindModal()
}

function saveCategoryBindModal(): void {
  const id = String(categoryBindModalCategoryId.value ?? '').trim()
  if (!id) return
  saveCategoryBindingChanges(id)
  categoryBindSavedToast.value = true
  if (categoryBindSavedToastTimer != null) window.clearTimeout(categoryBindSavedToastTimer)
  categoryBindSavedToastTimer = window.setTimeout(() => {
    categoryBindSavedToast.value = false
    categoryBindSavedToastTimer = null
  }, 2200)
}

const categoryBindModalCharacters = computed(() => {
  const q = categoryBindModalCharacterQuery.value.trim().toLowerCase()
  const list = !q
    ? characters.value
    : characters.value.filter((c) => characterMatchLabels(c).some((l) => l.toLowerCase().includes(q)))
  return sortByPinyinName(list).slice(0, categoryBindModalCharLimit.value)
})

const categoryBindModalFactions = computed(() => {
  const q = categoryBindModalFactionQuery.value.trim().toLowerCase()
  const list = !q ? factions.value : factions.value.filter((f) => f.name.toLowerCase().includes(q))
  return sortByPinyinName(list).slice(0, categoryBindModalFactionLimit.value)
})

function loadMoreCategoryBindModalCharacters(): void {
  categoryBindModalCharLimit.value = Math.min(5000, categoryBindModalCharLimit.value + 250)
}

function loadMoreCategoryBindModalFactions(): void {
  categoryBindModalFactionLimit.value = Math.min(5000, categoryBindModalFactionLimit.value + 250)
}

const selectedGraphCharacter = computed(() => {
  return characters.value.find((c) => c.id === graphFocusCharacterId.value) ?? null
})

function reloadCharacterEditorSources(): void {
  characters.value = getCharactersByNovelId(novelId.value)
  characterFactionMemberships.value = getCharacterFactionMembershipsByNovelId(novelId.value)
  factions.value = getFactionsByNovelId(novelId.value)
  refreshItems()
}

const characterEditor = useCharacterEditor({
  novelId,
  chapterId: computed(() => undefined),
  sourceTextRange: computed(() => null),
  categories: computed(() => categories.value),
  characters: computed(() => characters.value),
  items: computed(() => items.value),
  editingCharacter: selectedGraphCharacter,
  membershipSource: characterFactionMemberships,
  factionOptions: factions,
  reloadModalSources: reloadCharacterEditorSources,
  onSaved: () => {},
})

let pendingCharacterEditDiscard: null | (() => void) = null

function startCharacterEdit(): void {
  if (!selectedGraphCharacter.value) return
  characterEditor.openCharacterEditModal()
}

function requestCloseCharacterEdit(): void {
  if (characterEditor.closeCharacterEditModal()) return
  pendingCharacterEditDiscard = () => characterEditor.closeCharacterEditModal(true)
  characterEditCancelConfirmOpen.value = true
}

function forceCancelCharacterEdit(): void {
  const action = pendingCharacterEditDiscard
  pendingCharacterEditDiscard = null
  characterEditCancelConfirmOpen.value = false
  if (action) action()
  else characterEditor.closeCharacterEditModal(true)
}

function onCharacterEditCancelDialogCancel(): void {
  pendingCharacterEditDiscard = null
  characterEditCancelConfirmOpen.value = false
}

// ── 角色：全部更改弹窗（复用 CharacterChangeTimeline 组件） ────────────────
const characterAllChangesModalOpen = ref(false)

function openWorkspaceCharacterAllChangesModal(): void {
  if (!selectedGraphCharacter.value) return
  characterAllChangesModalOpen.value = true
}

function closeWorkspaceCharacterAllChangesModal(): void {
  characterAllChangesModalOpen.value = false
}

function jumpToWorkspaceCharacterChange(row: { chapterId: string; anchorStart: number | null; anchorEnd: number | null }): void {
  const chapterId = String(row.chapterId ?? '').trim()
  if (!chapterId || !novelId.value) return
  const nextQuery: Record<string, string> = {
    chapterId,
    focusChapter: chapterId,
    focusRangeToken: String(Date.now()),
  }
  if (typeof row.anchorStart === 'number' && typeof row.anchorEnd === 'number' && row.anchorEnd > row.anchorStart) {
    nextQuery.focusRangeStart = String(row.anchorStart)
    nextQuery.focusRangeEnd = String(row.anchorEnd)
  }
  closeWorkspaceCharacterAllChangesModal()
  void router.push({ path: `/novels/${novelId.value}/chapter-writing`, query: nextQuery })
}

const graphCharacterMemberships = computed(() => {
  const c = selectedGraphCharacter.value
  if (!c) return []
  return characterFactionMemberships.value.filter((m) => m.characterId === c.id)
})

const graphCharacterHeldItems = computed(() => {
  const c = selectedGraphCharacter.value
  if (!c) return [] as Item[]
  return items.value
    .filter((item) => item.ownerType === 'character' && item.ownerId === c.id)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans'))
})

const graphScopedCharacterIdSet = computed(() => new Set(graphScopedCharacters.value.map((c) => c.id)))

const filteredCharacterRelations = computed(() =>
  characterRelations.value.filter(
    (r) => graphScopedCharacterIdSet.value.has(r.fromCharacterId) && graphScopedCharacterIdSet.value.has(r.toCharacterId),
  ),
)

const nodePos = computed<Record<string, { x: number; y: number }>>(() => {
  const n = characters.value.length
  const map: Record<string, { x: number; y: number }> = {}
  if (n === 0) return map
  const W = 1000
  const H = 600
  const cx = 500
  const cy = 300
  const radius = n === 1 ? 0 : 220
  const base = -Math.PI / 2
  characters.value.forEach((c, i) => {
    const angle = base + (i / n) * Math.PI * 2
    map[c.id] = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  })
  return map
})

const relatedRelations = computed(() => {
  const id = graphFocusCharacterId.value
  return filteredCharacterRelations.value.filter((r) => r.fromCharacterId === id || r.toCharacterId === id)
})

const visibleGraphCharacterIds = computed(() => {
  const ids = new Set<string>()
  if (graphFocusCharacterId.value) ids.add(graphFocusCharacterId.value)
  relatedRelations.value.forEach((r) => {
    if (r.fromCharacterId) ids.add(r.fromCharacterId)
    if (r.toCharacterId) ids.add(r.toCharacterId)
  })
  return ids
})

const visibleCharacters = computed(() => {
  const q = graphSphereSearchQuery.value.trim().toLowerCase()
  return graphScopedCharacters.value.filter((c) => {
    if (!visibleGraphCharacterIds.value.has(c.id)) return false
    if (!q) return true
    if (c.id === graphFocusCharacterId.value) return true
    return (c.name ?? '').toLowerCase().includes(q)
  })
})

function factionNameById(id?: string | null): string {
  if (!id) return ''
  return factionNameByIdMap.value.get(id) ?? factions.value.find((f) => f.id === id)?.name ?? ''
}

function characterNameById(id?: string | null): string {
  if (!id) return ''
  return characters.value.find((c) => c.id === id)?.name ?? ''
}

/** 势力列表：成员 + 在该势力中的描述（按角色名排序） */
function factionMemberDisplayList(factionId: string): { key: string; name: string; description: string }[] {
  return characterFactionMemberships.value
    .filter((m) => m.factionId === factionId)
    .map((m) => ({
      key: m.id,
      name: characters.value.find((c) => c.id === m.characterId)?.name ?? '未知',
      description: (m.description ?? '').trim(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans'))
}

function factionHeldItems(factionId: string): Item[] {
  return items.value
    .filter((item) => item.ownerType === 'faction' && item.ownerId === factionId)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans'))
}

const hoverRelationId = ref<string>('')
const hoverTooltipX = ref(0)
const hoverTooltipY = ref(0)

const hoverRelation = computed(() => {
  if (!hoverRelationId.value) return null
  return relatedRelations.value.find((r) => r.id === hoverRelationId.value) ?? null
})

function onRelationLineMove(e: MouseEvent, relationId: string): void {
  hoverRelationId.value = relationId
  hoverTooltipX.value = e.clientX + 12
  hoverTooltipY.value = e.clientY + 12
}

function getRelationOtherName(r: CharacterRelation): string {
  const focusId = graphFocusCharacterId.value
  const otherId = r.fromCharacterId === focusId ? r.toCharacterId : r.fromCharacterId
  return characters.value.find((c) => c.id === otherId)?.name ?? '未知'
}

function onSphereSelect(id: string): void {
  graphFocusCharacterId.value = id
  graphFocusCharacterDropdownOpen.value = false
  hoverRelationId.value = ''
  graphFocusSphereSelectedId.value = ''
}

function selectGraphFocusCharacter(id: string): void {
  graphFocusCharacterId.value = id
  graphFocusCharacterDropdownOpen.value = false
}

function toggleGraphFocusCharacterDropdown(): void {
  graphFocusCharacterDropdownOpen.value = !graphFocusCharacterDropdownOpen.value
  if (graphFocusCharacterDropdownOpen.value) {
    resolveDropdownDirection('graph-focus-character')
  }
}

function addGraphAttribute(): void {
  if (!selectedGraphCharacter.value) return
  const key = graphAttributeKey.value.trim()
  const value = graphAttributeValue.value.trim()
  if (!key) return

  const currentAttrs = selectedGraphCharacter.value.attributes ?? []
  const nextAttrs: CharacterAttribute[] = [
    ...currentAttrs,
    { id: uid(), key, value },
  ]

  updateCharacter({ id: selectedGraphCharacter.value.id, attributes: nextAttrs })
  characters.value = getCharactersByNovelId(novelId.value)

  graphAttributeKey.value = ''
  graphAttributeValue.value = ''
}

function removeGraphAttribute(attrId: string): void {
  if (!selectedGraphCharacter.value) return
  const currentAttrs = selectedGraphCharacter.value.attributes ?? []
  const nextAttrs = currentAttrs.filter((a) => a.id !== attrId)
  updateCharacter({ id: selectedGraphCharacter.value.id, attributes: nextAttrs })
  characters.value = getCharactersByNovelId(novelId.value)
}

function onGraphAttributeValueChange(attrId: string, event: Event): void {
  if (!selectedGraphCharacter.value) return
  const target = event.target as HTMLInputElement | null
  const nextValue = target?.value ?? ''

  const currentAttrs = selectedGraphCharacter.value.attributes ?? []
  const nextAttrs = currentAttrs.map((a) => (a.id === attrId ? { ...a, value: nextValue } : a))
  updateCharacter({ id: selectedGraphCharacter.value.id, attributes: nextAttrs })
  characters.value = getCharactersByNovelId(novelId.value)
}

function openFactionCreate(): void {
  factionFormError.value = ''
  factionForm.name = ''
  factionForm.categoryIds = []
  factionCreateOpen.value = true
}

function closeFactionCreate(): void {
  factionCreateOpen.value = false
  factionFormError.value = ''
}

function handleCreateFaction() {
  factionFormError.value = ''
  if (!novel.value || !factionForm.name.trim()) {
    factionFormError.value = '请填写势力名。'
    return
  }
  createFaction({
    novelId: novel.value.id,
    name: factionForm.name,
    leader: '',
    notes: '',
    attributes: undefined,
    categoryIds: normalizeCategoryIds(factionForm.categoryIds),
  })
  factionForm.name = ''
  factionForm.categoryIds = []
  factions.value = getFactionsByNovelId(novel.value.id)
  categories.value = getCategoriesByNovelId(novel.value.id)
  factionCreateOpen.value = false
  factionSavedNotice.value = true
  window.setTimeout(() => {
    factionSavedNotice.value = false
  }, 1200)
}

function openFactionEdit(factionId: string): void {
  factionFormError.value = ''
  const f = factions.value.find((x) => x.id === factionId)
  if (!f) return
  factionEditId.value = factionId
  factionEditDraft.name = f.name ?? ''
  factionEditDraft.categoryIds = [...normalizeCategoryIds(f.categoryIds)]
  const mems = characterFactionMemberships.value.filter((m) => m.factionId === factionId)
  factionEditDraft.memberCharIds = mems.map((m) => m.characterId)
  factionEditDraft.memberDescByCharId = Object.fromEntries(
    mems.map((m) => [m.characterId, (m.description ?? '').trim()]),
  )
  factionEditDraft.itemIds = normalizeItemIds(
    items.value
      .filter((item) => item.ownerType === 'faction' && item.ownerId === factionId)
      .map((item) => item.id),
  )
  factionEditDraft.memberQuery = ''
  factionEditDraft.itemQuery = ''
  factionEditInitial.value = {
    name: factionEditDraft.name.trim(),
    memberCharIds: [...factionEditDraft.memberCharIds].sort(),
    itemIds: normalizeItemIds(factionEditDraft.itemIds),
    memberDescByCharId: { ...factionEditDraft.memberDescByCharId },
    categoryIds: [...normalizeCategoryIds(f.categoryIds)].sort(),
  }
  factionEditOpen.value = true
  factionEditCancelConfirmOpen.value = false
  factionEditSavedToast.value = false
}

function factionEditDirty(): boolean {
  if (factionEditDraft.name.trim() !== factionEditInitial.value.name) return true
  const curCat = normalizeCategoryIds(factionEditDraft.categoryIds).slice().sort().join('|')
  const initCat = [...factionEditInitial.value.categoryIds].sort().join('|')
  if (curCat !== initCat) return true
  const curIds = [...factionEditDraft.memberCharIds].sort().join('|')
  const oldIds = [...factionEditInitial.value.memberCharIds].sort().join('|')
  if (curIds !== oldIds) return true
  const curItemIds = normalizeItemIds(factionEditDraft.itemIds).join('|')
  const oldItemIds = normalizeItemIds(factionEditInitial.value.itemIds).join('|')
  if (curItemIds !== oldItemIds) return true
  for (const cid of factionEditDraft.memberCharIds) {
    const next = (factionEditDraft.memberDescByCharId[cid] ?? '').trim()
    const prev = (factionEditInitial.value.memberDescByCharId[cid] ?? '').trim()
    if (next !== prev) return true
  }
  return false
}

function requestCloseFactionEdit(): void {
  if (factionEditDirty()) {
    factionEditCancelConfirmOpen.value = true
    return
  }
  forceCloseFactionEdit()
}

function forceCloseFactionEdit(): void {
  factionEditOpen.value = false
  factionEditId.value = ''
  factionEditCancelConfirmOpen.value = false
  factionFormError.value = ''
  factionEditSavedToast.value = false
}

function onFactionEditCancelDialogCancel(): void {
  factionEditCancelConfirmOpen.value = false
}

const factionEditMemberOptionsModal = computed(() => {
  const q = factionEditDraft.memberQuery.trim().toLowerCase()
  if (!q) return characters.value
  return characters.value.filter((c) => c.name.toLowerCase().includes(q))
})

function toggleFactionEditMemberModal(characterId: string): void {
  const ids = [...factionEditDraft.memberCharIds]
  const i = ids.indexOf(characterId)
  if (i >= 0) ids.splice(i, 1)
  else ids.push(characterId)
  factionEditDraft.memberCharIds = ids
  if (!ids.includes(characterId)) {
    delete factionEditDraft.memberDescByCharId[characterId]
    delete factionEditMemberDescComposing[characterId]
  }
}

const factionEditBoundMembers = computed(() => {
  return factionEditDraft.memberCharIds
    .map((id) => ({ id, name: characterNameById(id) || '未知角色' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
})

const factionEditItemOptions = computed(() => {
  const q = factionEditDraft.itemQuery.trim().toLowerCase()
  const rows = items.value.filter((item) => !q || `${item.name ?? ''} ${item.summary ?? ''}`.toLowerCase().includes(q))
  return rows.sort((a, b) => {
    const aBound = factionEditDraft.itemIds.includes(a.id)
    const bBound = factionEditDraft.itemIds.includes(b.id)
    const groupA = aBound ? 0 : !a.ownerType ? 1 : 2
    const groupB = bBound ? 0 : !b.ownerType ? 1 : 2
    if (groupA !== groupB) return groupA - groupB
    return (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans')
  })
})

function toggleFactionEditItem(itemId: string): void {
  const id = String(itemId ?? '').trim()
  if (!id) return
  const idx = factionEditDraft.itemIds.indexOf(id)
  if (idx >= 0) factionEditDraft.itemIds.splice(idx, 1)
  else factionEditDraft.itemIds.push(id)
}

function onFactionEditMemberDescInput(characterId: string, event: Event): void {
  const target = event.target as HTMLInputElement | null
  const raw = target?.value ?? ''
  // 中文输入法组合阶段不截断，避免拼音超过 10 字母时输入异常。
  if (factionEditMemberDescComposing[characterId]) {
    factionEditDraft.memberDescByCharId[characterId] = raw
    return
  }
  const limited = limitFactionMemberDescription(raw)
  factionEditDraft.memberDescByCharId[characterId] = limited
  if (target && target.value !== limited) target.value = limited
}

function onFactionEditMemberDescCompositionStart(characterId: string): void {
  factionEditMemberDescComposing[characterId] = true
}

function onFactionEditMemberDescCompositionEnd(characterId: string, event: Event): void {
  factionEditMemberDescComposing[characterId] = false
  onFactionEditMemberDescInput(characterId, event)
}

function limitFactionMemberDescription(value: string): string {
  return Array.from(value).slice(0, 10).join('')
}

function normalizeFactionWorkspaceMemberRows(
  ids: string[],
  descById: Record<string, string>,
): Array<{ characterId: string; description: string }> {
  return [...new Set(ids.map((x) => String(x ?? '').trim()).filter(Boolean))]
    .map((cid) => ({
      characterId: cid,
      description: limitFactionMemberDescription((descById[cid] ?? '').trim()),
    }))
    .sort((a, b) => a.characterId.localeCompare(b.characterId))
}

function computeFactionWorkspaceSaveChangePayload(): {
  fields: string[]
  details: CharacterChangeDetail[]
  fieldValues: Record<string, string>
} {
  const init = factionEditInitial.value
  const changed = new Set<string>()
  const details: CharacterChangeDetail[] = []
  const pushDetail = (field: string, location: string, before: unknown, after: unknown): void => {
    details.push({ field, location, before: String(before ?? ''), after: String(after ?? '') })
  }
  const name = factionEditDraft.name.trim()
  if (name !== init.name) {
    changed.add('name')
    pushDetail('name', '势力档案/名称', init.name, name)
  }
  const curCat = normalizeCategoryIds(factionEditDraft.categoryIds).slice().sort().join('|')
  const initCat = [...init.categoryIds].sort().join('|')
  if (curCat !== initCat) {
    changed.add('categoryIds')
    const nameById = new Map(categories.value.map((c) => [c.id, c.name]))
    const label = (ids: string[]) =>
      normalizeCategoryIds(ids)
        .map((cid) => nameById.get(cid) ?? cid)
        .join('、')
    pushDetail('categoryIds', '势力档案/分类', label(init.categoryIds), label(factionEditDraft.categoryIds))
  }
  const memA = normalizeFactionWorkspaceMemberRows(
    factionEditDraft.memberCharIds,
    factionEditDraft.memberDescByCharId,
  )
  const memB = normalizeFactionWorkspaceMemberRows(init.memberCharIds, init.memberDescByCharId)
  const memChanged =
    memA.length !== memB.length ||
    memA.some((m, i) => m.characterId !== memB[i]?.characterId || m.description !== memB[i]?.description)
  if (memChanged) {
    changed.add('memberships')
    const fmt = (rows: typeof memA) =>
      rows.map((m) => `${characterNameById(m.characterId)}:${m.description}`).join('；')
    pushDetail('memberships', '势力档案/绑定角色', fmt(memB), fmt(memA))
  }
  const itemA = normalizeItemIds(factionEditDraft.itemIds)
  const itemB = normalizeItemIds(init.itemIds)
  const itemsChanged = itemA.length !== itemB.length || itemA.some((itemId, i) => itemId !== itemB[i])
  if (itemsChanged) {
    changed.add('items')
    const label = (ids: string[]) => ids.map((itemId) => itemNameById(itemId)).join('、')
    pushDetail('items', '势力档案/持有物品', label(itemB), label(itemA))
  }
  const fields = Array.from(changed)
  const fieldValues: Record<string, string> = {}
  if (fields.includes('name')) fieldValues.name = name
  if (fields.includes('categoryIds')) {
    const nameById = new Map(categories.value.map((c) => [c.id, c.name]))
    fieldValues.categoryIds = normalizeCategoryIds(factionEditDraft.categoryIds)
      .map((cid) => nameById.get(cid) ?? cid)
      .join('、')
  }
  if (fields.includes('memberships')) {
    fieldValues.memberships = memA.map((m) => `${characterNameById(m.characterId)}:${m.description}`).join('；')
  }
  if (fields.includes('items')) {
    fieldValues.items = itemA.map((itemId) => itemNameById(itemId)).join('、')
  }
  return { fields, details, fieldValues }
}

function saveFactionEdit(): void {
  const id = factionEditId.value
  if (!id) return
  const name = factionEditDraft.name.trim()
  if (!name) return
  factionFormError.value = ''
  const changePayload = computeFactionWorkspaceSaveChangePayload()
  updateFaction({
    id,
    name,
    leader: '',
    notes: '',
    attributes: undefined,
    categoryIds: normalizeCategoryIds(factionEditDraft.categoryIds),
  })
  const memRows = [...new Set(factionEditDraft.memberCharIds)]
    .filter((cid) => cid.trim())
    .map((cid) => ({
      characterId: cid,
      description: limitFactionMemberDescription((factionEditDraft.memberDescByCharId[cid] ?? '').trim()),
    }))
  replaceMembershipsForFaction(novelId.value, id, memRows)
  const nextItemIds = normalizeItemIds(factionEditDraft.itemIds)
  replaceItemOwnersForEntity(novelId.value, 'faction', id, nextItemIds)
  if (changePayload.fields.length > 0) {
    recordFactionChangeFields(id, changePayload.fields, {
      details: changePayload.details,
      fieldValues: changePayload.fieldValues,
    })
  }
  characterFactionMemberships.value = getCharacterFactionMembershipsByNovelId(novelId.value)
  factions.value = getFactionsByNovelId(novelId.value)
  categories.value = getCategoriesByNovelId(novelId.value)
  refreshItems()
  const syncedDesc: Record<string, string> = {}
  for (const cid of factionEditDraft.memberCharIds) {
    syncedDesc[cid] = limitFactionMemberDescription((factionEditDraft.memberDescByCharId[cid] ?? '').trim())
  }
  factionEditInitial.value = {
    name: factionEditDraft.name.trim(),
    memberCharIds: [...factionEditDraft.memberCharIds].sort(),
    itemIds: nextItemIds,
    memberDescByCharId: syncedDesc,
    categoryIds: [...normalizeCategoryIds(factionEditDraft.categoryIds)].sort(),
  }
  forceCloseFactionEdit()
}

const factionDeleteMessage = computed(() => {
  const id = pendingDeleteFactionId.value
  if (!id) return ''
  const f = factions.value.find((x) => x.id === id)
  if (!f) return '确定删除该势力？此操作无法撤销。'
  return `确定删除「${f.name}」？此操作无法撤销。`
})

function openFactionDelete(id: string): void {
  pendingDeleteFactionId.value = id
  factionDeleteOpen.value = true
}

function confirmFactionDelete(): void {
  const id = pendingDeleteFactionId.value
  pendingDeleteFactionId.value = null
  if (!id) return

  if (factionEditId.value === id) {
    forceCloseFactionEdit()
  }
  deleteFaction(id)
  factions.value = getFactionsByNovelId(novelId.value)
  characterFactionMemberships.value = getCharacterFactionMembershipsByNovelId(novelId.value)

  factionDeleteOpen.value = false
}

function onFactionDeleteDialogCancel(): void {
  factionDeleteOpen.value = false
  pendingDeleteFactionId.value = null
}

// ── World Setting handlers ──────────────────────────────────────────────────

function openWorldSettingCreate(): void {
  worldSettingForm.name = ''
  worldSettingForm.content = ''
  worldSettingForm.categoryIds = []
  worldSettingForm.cards = [{ id: uid(), key: '', value: '' }]
  worldSettingFormError.value = ''
  worldSettingCreateOpen.value = true
}

function addWorldSettingFormCard(): void {
  worldSettingForm.cards.push({ id: uid(), key: '', value: '' })
}
function removeWorldSettingFormCard(id: string): void {
  const i = worldSettingForm.cards.findIndex((c) => c.id === id)
  if (i >= 0) worldSettingForm.cards.splice(i, 1)
}
function addWorldSettingEditCard(): void {
  worldSettingEditDraft.cards.push({ id: uid(), key: '', value: '' })
}
function removeWorldSettingEditCard(id: string): void {
  const i = worldSettingEditDraft.cards.findIndex((c) => c.id === id)
  if (i >= 0) worldSettingEditDraft.cards.splice(i, 1)
}

function handleCreateWorldSetting(): void {
  if (!novelId.value) return
  if (!worldSettingForm.name.trim()) {
    worldSettingFormError.value = '请输入设定名称。'
    return
  }
  createWorldSetting({
    novelId: novelId.value,
    name: worldSettingForm.name,
    content: '',
    attributes: worldSettingForm.cards,
    categoryIds: worldSettingForm.categoryIds,
  })
  worldSettings.value = getWorldSettingsByNovelId(novelId.value)
  worldSettingCreateOpen.value = false
}

function openWorldSettingEdit(id: string): void {
  const ws = worldSettings.value.find((w) => w.id === id)
  if (!ws) return
  worldSettingEditId.value = id
  worldSettingEditDraft.name = ws.name
  worldSettingEditDraft.content = ws.content
  worldSettingEditDraft.categoryIds = [...(ws.categoryIds ?? [])]
  const cards = (ws.attributes ?? []).map((a) => ({ id: a.id || uid(), key: a.key, value: a.value }))
  worldSettingEditDraft.cards = cards.length > 0 ? cards : [{ id: uid(), key: '', value: '' }]
  worldSettingEditOpen.value = true
}

function handleSaveWorldSettingEdit(): void {
  if (!worldSettingEditId.value) return
  if (!worldSettingEditDraft.name.trim()) return
  updateWorldSetting({
    id: worldSettingEditId.value,
    name: worldSettingEditDraft.name,
    content: '',
    attributes: worldSettingEditDraft.cards,
    categoryIds: worldSettingEditDraft.categoryIds,
  })
  worldSettings.value = getWorldSettingsByNovelId(novelId.value)
  worldSettingEditOpen.value = false
  worldSettingEditId.value = ''
}

function openWorldSettingDelete(id: string): void {
  worldSettingDeleteId.value = id
  worldSettingDeleteOpen.value = true
}

function confirmWorldSettingDelete(): void {
  const id = worldSettingDeleteId.value
  if (!id) return
  if (worldSettingEditId.value === id) {
    worldSettingEditOpen.value = false
    worldSettingEditId.value = ''
  }
  deleteWorldSetting(id)
  worldSettings.value = getWorldSettingsByNovelId(novelId.value)
  worldSettingDeleteOpen.value = false
  worldSettingDeleteId.value = ''
}

// ── World Setting AI（填表 → 生成 → 迭代修改）──────────────────────────────

function resetWorldSettingAiState(): void {
  worldSettingAiStep.value = 'input'
  worldSettingAiLoading.value = false
  worldSettingAiError.value = ''
  worldSettingAiTargetId.value = ''
  worldSettingAiBrief.value = ''
  worldSettingAiUseNovelInfo.value = true
  worldSettingAiFeedback.value = ''
  worldSettingAiStreaming.value = ''
  worldSettingAiVersion.value = 0
  worldSettingAiDraftName.value = ''
  worldSettingAiDraftContent.value = ''
  worldSettingAiDraftCards.value = []
  worldSettingAiDraftCategoryIds.value = []
}

function openWorldSettingAiCreate(): void {
  resetWorldSettingAiState()
  worldSettingAiOpen.value = true
}

function openWorldSettingAiEdit(id: string): void {
  resetWorldSettingAiState()
  worldSettingAiTargetId.value = id
  const ws = worldSettings.value.find((w) => w.id === id)
  if (ws) {
    worldSettingAiDraftCategoryIds.value = [...(ws.categoryIds ?? [])]
    worldSettingAiDraftName.value = ws.name
    // 已有设定：把原内容作为「上一版」，进入结果步骤，用户可直接提修改意见
    const existingContent = String(ws.content ?? '') || (ws.attributes ?? []).map((c) => `## ${String(c.key ?? '')}\n${String(c.value ?? '')}`).join('\n\n')
    worldSettingAiDraftContent.value = existingContent
    worldSettingAiDraftCards.value = (ws.attributes ?? []).map((c) => ({ id: uid(), key: String(c.key ?? ''), value: String(c.value ?? '') }))
    worldSettingAiVersion.value = worldSettingAiDraftCards.value.length > 0 ? 1 : 0
    worldSettingAiStep.value = worldSettingAiVersion.value > 0 ? 'result' : 'input'
  }
  worldSettingAiOpen.value = true
}

/** 首次生成：根据用户的自由描述创作世界观 */
async function generateWorldSettingAiDraft(): Promise<void> {
  if (!novel.value) return
  worldSettingAiLoading.value = true
  worldSettingAiError.value = ''
  worldSettingAiStreaming.value = ''
  wsGenAborts.worldSetting?.abort()
  wsGenAborts.worldSetting = new AbortController()
  try {
    const result = await generateWorldSettingDraftByAi(
      buildNovelWorkspacePayload(novel.value.id),
      {
        ...worldSettingAiNovelInfo(),
        aiStylePrompt: novel.value.aiStylePrompt,
        userBrief: worldSettingAiBrief.value,
        onChunk: (d) => { worldSettingAiStreaming.value += d },
      },
      wsGenAborts.worldSetting.signal,
    )
    applyWorldSettingAiResult(result)
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') return
    worldSettingAiError.value = error instanceof Error ? error.message : 'AI 生成世界观失败，请稍后重试。'
  } finally {
    worldSettingAiLoading.value = false
    worldSettingAiStreaming.value = ''
    wsGenAborts.worldSetting = null
  }
}

/** 停止正在进行的世界观生成（用户主动点停止时调用） */
function stopWorldSettingAiDraft(): void {
  wsGenAborts.worldSetting?.abort()
  worldSettingAiLoading.value = false
}

/** 根据「是否参考书名/简介」开关，组装传给 AI 的作品信息 */
function worldSettingAiNovelInfo(): {
  novelTitle: string
  novelSummary?: string
  novel?: { title: string; summary?: string; genre?: string; perspective?: string; tone?: string }
} {
  const n = novel.value
  if (!n) return { novelTitle: '' }
  if (!worldSettingAiUseNovelInfo.value) {
    // 不参考书名/简介：题材仍保留（它决定世界观大方向），但不传书名与简介
    return { novelTitle: '', novelSummary: '', novel: { title: '', summary: '', genre: n.genre, perspective: n.perspective, tone: n.tone } }
  }
  return {
    novelTitle: n.title,
    novelSummary: n.summary,
    novel: { title: n.title, summary: n.summary, genre: n.genre, perspective: n.perspective, tone: n.tone },
  }
}

/** 迭代修订：基于上一版 + 修改意见重新生成 */
async function reviseWorldSettingAiDraft(): Promise<void> {
  if (!novel.value) return
  if (!worldSettingAiDraftContent.value.trim()) return
  worldSettingAiLoading.value = true
  worldSettingAiError.value = ''
  worldSettingAiStreaming.value = ''
  wsGenAborts.worldSetting?.abort()
  wsGenAborts.worldSetting = new AbortController()
  try {
    const result = await generateWorldSettingDraftByAi(
      buildNovelWorkspacePayload(novel.value.id),
      {
        ...worldSettingAiNovelInfo(),
        aiStylePrompt: novel.value.aiStylePrompt,
        userBrief: worldSettingAiBrief.value,
        revise: {
          previousName: worldSettingAiDraftName.value,
          previousContent: worldSettingAiDraftContent.value,
          feedback: worldSettingAiFeedback.value,
        },
        onChunk: (d) => { worldSettingAiStreaming.value += d },
      },
      wsGenAborts.worldSetting.signal,
    )
    applyWorldSettingAiResult(result)
    worldSettingAiFeedback.value = ''
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') return
    worldSettingAiError.value = error instanceof Error ? error.message : 'AI 修改世界观失败，请稍后重试。'
  } finally {
    worldSettingAiLoading.value = false
    worldSettingAiStreaming.value = ''
    wsGenAborts.worldSetting = null
  }
}

function applyWorldSettingAiResult(result: { name: string; content: string; cards: Array<{ key: string; value: string }> }): void {
  worldSettingAiDraftName.value = result.name
  worldSettingAiDraftContent.value = result.content
  worldSettingAiDraftCards.value = (result.cards ?? []).map((c) => ({ id: uid(), key: c.key, value: c.value }))
  if (worldSettingAiDraftCards.value.length === 0) {
    const fallback = String(result.content ?? '').trim()
    worldSettingAiDraftCards.value = fallback ? [{ id: uid(), key: '概述', value: fallback }] : [{ id: uid(), key: '', value: '' }]
  }
  worldSettingAiVersion.value += 1
  worldSettingAiStep.value = 'result'
}

function addWorldSettingAiDraftCard(): void {
  worldSettingAiDraftCards.value.push({ id: uid(), key: '', value: '' })
}
function removeWorldSettingAiDraftCard(id: string): void {
  worldSettingAiDraftCards.value = worldSettingAiDraftCards.value.filter((c) => c.id !== id)
}

function saveWorldSettingAiDraft(): void {
  if (!novel.value) return
  if (!worldSettingAiDraftName.value.trim()) return
  if (worldSettingAiTargetId.value) {
    updateWorldSetting({
      id: worldSettingAiTargetId.value,
      name: worldSettingAiDraftName.value.trim(),
      content: worldSettingAiDraftContent.value,
      attributes: worldSettingAiDraftCards.value,
      categoryIds: worldSettingAiDraftCategoryIds.value,
    })
  } else {
    createWorldSetting({
      novelId: novel.value.id,
      name: worldSettingAiDraftName.value.trim(),
      content: worldSettingAiDraftContent.value,
      attributes: worldSettingAiDraftCards.value,
      categoryIds: worldSettingAiDraftCategoryIds.value,
    })
  }
  worldSettings.value = getWorldSettingsByNovelId(novel.value.id)
  worldSettingAiOpen.value = false
}

// ── Foreshadow handlers ──────────────────────────────────────────────────────

const filteredForeshadows = computed(() => {
  const f = foreshadowFilter.value
  if (!f) return foreshadows.value
  return foreshadows.value.filter((p) => p.status === f)
})

function openForeshadowEdit(plant: ForeshadowPlant): void {
  foreshadowEditDraft.id = plant.id
  foreshadowEditDraft.title = plant.title
  foreshadowEditDraft.description = plant.description ?? ''
  foreshadowEditDraft.plantText = plant.plantText ?? ''
  foreshadowEditDraft.fulfillments = (plant.fulfillments ?? []).map((ff) => ({
    id: ff.id,
    fulfillText: ff.fulfillText ?? '',
    notes: ff.notes ?? '',
    fulfillChapterNo: ff.fulfillChapterNo,
    fulfillChapterTitle: ff.fulfillChapterTitle ?? '',
  }))
  foreshadowEditInitial.value = {
    id: foreshadowEditDraft.id,
    title: foreshadowEditDraft.title,
    description: foreshadowEditDraft.description,
    plantText: foreshadowEditDraft.plantText,
    fulfillmentsSnapshot: JSON.stringify(foreshadowEditDraft.fulfillments),
  }
  foreshadowEditCancelConfirmOpen.value = false
  foreshadowEditOpen.value = true
}

function foreshadowEditDirty(): boolean {
  const i = foreshadowEditInitial.value
  const d = foreshadowEditDraft
  return (
    d.title !== i.title ||
    d.description !== i.description ||
    d.plantText !== i.plantText ||
    JSON.stringify(d.fulfillments) !== i.fulfillmentsSnapshot
  )
}

function forceCloseForeshadowEdit(): void {
  foreshadowEditOpen.value = false
  foreshadowEditCancelConfirmOpen.value = false
}

function requestCloseForeshadowEdit(): void {
  if (foreshadowEditDirty()) {
    foreshadowEditCancelConfirmOpen.value = true
    return
  }
  forceCloseForeshadowEdit()
}

function onForeshadowEditCancelDialogCancel(): void {
  foreshadowEditCancelConfirmOpen.value = false
}

function replaceChapterRangeContentInWorkspace(
  chapterId: string,
  start: number,
  end: number,
  replacementText: string,
): void {
  const ch = chapters.value.find((x) => x.id === chapterId)
  if (!ch) return
  const content = ch.content ?? ''
  const s = Math.max(0, Math.min(content.length, Math.floor(start)))
  const e = Math.max(s, Math.min(content.length, Math.floor(end)))
  const nextContent = `${content.slice(0, s)}${replacementText}${content.slice(e)}`
  if (nextContent === content) return
  updateChapter({ id: chapterId, content: nextContent })
  chapters.value = chapters.value.map((item) =>
    item.id === chapterId ? { ...item, content: nextContent } : item,
  )
}

function saveForeshadowEdit(): void {
  if (!foreshadowEditDraft.id) return
  const plant = foreshadows.value.find((p) => p.id === foreshadowEditDraft.id) ?? null
  const nextPlantText = foreshadowEditDraft.plantText
  if (
    plant &&
    typeof plant.plantStart === 'number' &&
    typeof plant.plantEnd === 'number' &&
    plant.plantEnd > plant.plantStart
  ) {
    replaceChapterRangeContentInWorkspace(
      plant.plantChapterId,
      plant.plantStart,
      plant.plantEnd,
      nextPlantText,
    )
  }
  updateForeshadowPlant({
    id: foreshadowEditDraft.id,
    title: foreshadowEditDraft.title.trim() || '未命名伏笔',
    description: foreshadowEditDraft.description.trim(),
    plantText: nextPlantText,
  })
  if (plant) {
    for (const draftFf of foreshadowEditDraft.fulfillments) {
      const oldFf = plant.fulfillments.find((x) => x.id === draftFf.id)
      if (!oldFf) continue
      const nextFulfillText = draftFf.fulfillText.trim()
      const nextNotes = draftFf.notes.trim()
      if (
        typeof oldFf.fulfillStart === 'number' &&
        typeof oldFf.fulfillEnd === 'number' &&
        oldFf.fulfillEnd > oldFf.fulfillStart &&
        nextFulfillText &&
        nextFulfillText !== (oldFf.fulfillText ?? '')
      ) {
        replaceChapterRangeContentInWorkspace(
          oldFf.fulfillChapterId,
          oldFf.fulfillStart,
          oldFf.fulfillEnd,
          nextFulfillText,
        )
      }
      if (nextFulfillText !== (oldFf.fulfillText ?? '') || nextNotes !== (oldFf.notes ?? '')) {
        updateForeshadowFulfillment(plant.id, oldFf.id, {
          fulfillText: nextFulfillText || (oldFf.fulfillText ?? ''),
          notes: nextNotes,
        })
      }
    }
  }
  foreshadows.value = getForeshadowsByNovelId(novelId.value)
  forceCloseForeshadowEdit()
}

function closeForeshadowJumpModal(): void {
  foreshadowJumpOpen.value = false
  foreshadowJumpTarget.value = null
}

function confirmJumpForeshadowDirect(plant: ForeshadowPlant, kind: 'plant' | 'fulfill', ff?: ForeshadowFulfillment): void {
  const ffx = ff ?? plant.fulfillments[0]
  const chapterId = kind === 'plant' ? plant.plantChapterId : ffx?.fulfillChapterId ?? ''
  if (!chapterId) return
  const query: Record<string, string> = {
    chapterId,
    focusChapter: chapterId,
    focusForeshadow: plant.id,
    focusForeshadowKind: kind,
    // 与正文悬停跳转保持一致：即便重复跳同一目标，也强制触发一次定位
    focusForeshadowToken: String(Date.now()),
  }
  if (kind === 'fulfill' && ffx) {
    query.focusFulfillmentId = ffx.id
    if (
      typeof ffx.fulfillStart === 'number' &&
      typeof ffx.fulfillEnd === 'number' &&
      ffx.fulfillEnd > ffx.fulfillStart
    ) {
      query.focusForeshadowStart = String(ffx.fulfillStart)
      query.focusForeshadowEnd = String(ffx.fulfillEnd)
    }
    const fulfillText = String(ffx.fulfillText ?? '').trim()
    if (fulfillText) query.focusForeshadowText = fulfillText
  } else {
    if (
      typeof plant.plantStart === 'number' &&
      typeof plant.plantEnd === 'number' &&
      plant.plantEnd > plant.plantStart
    ) {
      query.focusForeshadowStart = String(plant.plantStart)
      query.focusForeshadowEnd = String(plant.plantEnd)
    }
    const plantText = String(plant.plantText ?? '').trim()
    if (plantText) query.focusForeshadowText = plantText
  }
  void router.push({ path: `/novels/${novelId.value}/chapter-writing`, query })
}

function onForeshadowJumpClick(plant: ForeshadowPlant): void {
  if (!plant.fulfillments.length) {
    confirmJumpForeshadowDirect(plant, 'plant')
    return
  }
  foreshadowJumpTarget.value = plant
  foreshadowJumpOpen.value = true
}

function confirmJumpForeshadow(kind: 'plant' | 'fulfill', ff?: ForeshadowFulfillment): void {
  const plant = foreshadowJumpTarget.value
  if (!plant) return
  confirmJumpForeshadowDirect(plant, kind, ff)
  closeForeshadowJumpModal()
}

function handleDeleteForeshadow(id: string): void {
  pendingDeleteForeshadowId.value = id
  foreshadowDeleteOpen.value = true
}

function confirmDeleteForeshadow(): void {
  const id = pendingDeleteForeshadowId.value
  pendingDeleteForeshadowId.value = null
  if (!id) return
  deleteForeshadowPlant(id)
  foreshadows.value = getForeshadowsByNovelId(novelId.value)
  foreshadowDeleteOpen.value = false
}

function applyRoutePrefill(): void {
  const routeTab = String(route.query.tab ?? '')
  const tab = routeTab === 'timeline' ? 'write' : routeTab
  if (
    tab === 'write' ||
    tab === 'outline' ||
    tab === 'characters' ||
    tab === 'items' ||
    tab === 'factions' ||
    tab === 'categories' ||
    tab === 'issues' ||
    tab === 'worldsettings' ||
    tab === 'scenes'
  ) {
    activeTab.value = tab
  }
  if (routeTab === 'ai') {
    activeTab.value = 'write'
    void router.replace({ query: { ...route.query, tab: 'write' } })
  }
  if (routeTab === 'timeline') {
    const nextQuery = { ...route.query, tab: 'write' }
    void router.replace({ query: nextQuery })
  }

  const focusCharacterId = String(route.query.focusCharacterId ?? '')
  if (focusCharacterId && characters.value.some((c) => c.id === focusCharacterId)) {
    graphFocusCharacterId.value = focusCharacterId
  }

  const shouldScrollCharactersBottom =
    String(route.query.scrollTo ?? '') === 'characters-bottom' && activeTab.value === 'characters'
  if (shouldScrollCharactersBottom && typeof window !== 'undefined') {
    void nextTick(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
      const nextQuery = { ...route.query }
      delete nextQuery.scrollTo
      void router.replace({ query: nextQuery })
    })
  }

  const focusFactionId = String(route.query.focusFactionId ?? '')
  const shouldScrollFactionItem =
    String(route.query.scrollTo ?? '') === 'factions-item' && activeTab.value === 'factions' && !!focusFactionId
  if (shouldScrollFactionItem && typeof window !== 'undefined') {
    void nextTick(() => {
      const el = document.getElementById(`faction-row-${focusFactionId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const nextQuery = { ...route.query }
      delete nextQuery.scrollTo
      delete nextQuery.focusFactionId
      void router.replace({ query: nextQuery })
    })
  }

  const focusItemId = String(route.query.focusItemId ?? '')
  const shouldScrollItem =
    String(route.query.scrollTo ?? '') === 'items-item' && activeTab.value === 'items' && !!focusItemId
  if (shouldScrollItem && typeof window !== 'undefined') {
    void nextTick(() => {
      const el = document.getElementById(`workspace-item-${focusItemId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (el) {
        focusedItemId.value = focusItemId
        if (focusedItemTimer != null) window.clearTimeout(focusedItemTimer)
        focusedItemTimer = window.setTimeout(() => {
          focusedItemId.value = ''
          focusedItemTimer = null
        }, 1600)
      }
      const nextQuery = { ...route.query }
      delete nextQuery.scrollTo
      delete nextQuery.focusItemId
      void router.replace({ query: nextQuery })
    })
  }

  const focusOutlineId = String(route.query.focusOutlineId ?? '')
  if (focusOutlineId && activeTab.value === 'outline' && outlineItems.value.some((o) => o.id === focusOutlineId)) {
    void nextTick(() => {
      activeOutlineMapId.value = focusOutlineId
      const nextQuery = { ...route.query }
      delete nextQuery.focusOutlineId
      void router.replace({ query: nextQuery })
    })
  }
}

/** 始终回到首页「新建作品」列表，不使用浏览器历史返回，避免从章节写作等入口进入时误回到中间页 */
function backFromPage(): void {
  void router.push({ name: 'novels' })
}

function goToWritingChapter(): void {
  if (!novelId.value) return
  const hasContent = (v: string | null | undefined) => String(v ?? '').trim().length > 0
  const contentChapters = chapters.value.filter((ch) => hasContent(ch.content))
  const target =
    [...contentChapters].sort((a, b) => b.chapterNo - a.chapterNo)[0] ??
    chapters.value[0] ??
    null

  if (target) {
    void router.push({
      path: `/novels/${novelId.value}/chapter-writing`,
      query: { chapterId: target.id },
    })
    return
  }
  void router.push({ path: `/novels/${novelId.value}/chapter-writing` })
}

function switchTab(tab: WorkspaceTab): void {
  closeWorkspaceDropdowns()
  if (tab === 'characters' && activeTab.value !== 'characters') {
    lastTabBeforeCharacters.value = activeTab.value as Exclude<WorkspaceTab, 'characters'>
  }
  activeTab.value = tab
  const nextQuery = { ...route.query, tab }
  void router.replace({ path: route.path, query: nextQuery })
}

function parseOptionalChapterNo(raw: string): number | null {
  if (raw === '') return null
  const n = parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function handleCreateTimeline(): void {
  if (!novel.value) return
  if (!timelineForm.title.trim()) return
  const start = parseOptionalChapterNo(timelineForm.chapterNoStart)
  const end = parseOptionalChapterNo(timelineForm.chapterNoEnd)
  const chapterNoStart = start != null && end != null ? Math.min(start, end) : start
  const chapterNoEnd = start != null && end != null ? Math.max(start, end) : end
  createTimelineEvent({
    novelId: novel.value.id,
    storyLabel: timelineForm.storyLabel,
    title: timelineForm.title,
    summary: timelineForm.summary,
    chapterNoStart,
    chapterNoEnd,
    outlineItemId: timelineForm.outlineItemId.trim() || null,
  })
  resetTimelineCreateForm()
  closeTimelineCreate()
  timelineEvents.value = getTimelineByNovelId(novelId.value)
}

function onTimelineStoryLabelChange(id: string, event: Event): void {
  const target = event.target as HTMLInputElement | null
  updateTimelineEvent({ id, storyLabel: target?.value ?? '' })
  timelineEvents.value = getTimelineByNovelId(novelId.value)
}

function onTimelineTitleChange(id: string, event: Event): void {
  const target = event.target as HTMLInputElement | null
  updateTimelineEvent({ id, title: target?.value?.trim() || '未命名事件' })
  timelineEvents.value = getTimelineByNovelId(novelId.value)
}

function onTimelineSummaryChange(id: string, event: Event): void {
  const target = event.target as HTMLInputElement | null
  updateTimelineEvent({ id, summary: target?.value ?? '' })
  timelineEvents.value = getTimelineByNovelId(novelId.value)
}

function onTimelineChapterChange(id: string, event: Event): void {
  const target = event.target as HTMLSelectElement | null
  const chapterNoStart = parseOptionalChapterNo(target?.value ?? '')
  updateTimelineEvent({ id, chapterNoStart })
  timelineEvents.value = getTimelineByNovelId(novelId.value)
}

function onTimelineOutlineChange(id: string, event: Event): void {
  const target = event.target as HTMLSelectElement | null
  const v = target?.value?.trim() ?? ''
  updateTimelineEvent({ id, outlineItemId: v || null })
  timelineEvents.value = getTimelineByNovelId(novelId.value)
}

function moveTimeline(id: string, direction: 'up' | 'down'): void {
  moveTimelineEvent(id, direction)
  timelineEvents.value = getTimelineByNovelId(novelId.value)
}

function openTimelineDelete(id: string): void {
  timelineDeleteId.value = id
  timelineDeleteOpen.value = true
}

function confirmDeleteTimeline(): void {
  const id = timelineDeleteId.value
  timelineDeleteId.value = ''
  if (!id) return
  deleteTimelineEvent(id)
  timelineEvents.value = getTimelineByNovelId(novelId.value)
}

function onTimelineDeleteDialogCancel(): void {
  timelineDeleteId.value = ''
}

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', onWorkspaceClickOutside, false)
  }
})

</script>

<style scoped>
.ws-edit-novel-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  margin-left: 6px;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted, #888);
  font-size: 14px;
  cursor: pointer;
  vertical-align: middle;
  transition: background 0.15s, color 0.15s;
}
.ws-edit-novel-btn:hover {
  background: var(--color-bg-hover, #f5f5f5);
  color: var(--color-text, #333);
}

.ws-tab-panel {
  animation: ws-tab-panel-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

/* 世界观空状态 */
.ws-empty {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
  margin: 8px auto 0;
  padding: 48px 28px 44px;
  max-width: 560px;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background:
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--color-primary-soft) 40%, transparent) 0%, transparent 60%),
    color-mix(in srgb, var(--color-surface) 92%, transparent);
  overflow: hidden;
  animation: ws-empty-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.ws-empty__glow {
  position: absolute;
  top: -40%;
  left: 50%;
  width: 320px;
  height: 320px;
  transform: translateX(-50%);
  background: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 18%, transparent) 0%, transparent 70%);
  pointer-events: none;
}

.ws-empty__icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 22px;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 56%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.ws-empty__icon--spin svg {
  animation: ws-empty-spin 26s linear infinite;
}

.ws-empty__title {
  position: relative;
  margin: 4px 0 0;
  font-size: 1.32rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  color: var(--color-text);
}

.ws-empty__desc {
  position: relative;
  margin: 0;
  max-width: 40rem;
  font-size: 0.92rem;
  line-height: 1.7;
  color: var(--color-text-muted);
}

.ws-empty__hints {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 2px;
}

.ws-empty__hint {
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  color: color-mix(in srgb, var(--color-text) 72%, var(--color-primary) 28%);
  background: color-mix(in srgb, var(--color-surface-muted) 50%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border) 72%, transparent);
}

.ws-empty__hints--howto {
  margin-top: 6px;
}

.ws-empty__howto {
  padding: 9px 16px;
  border-radius: 12px;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  background: color-mix(in srgb, var(--color-primary-soft) 28%, var(--color-surface));
  border: 1px dashed color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
}

.ws-empty__actions {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
}

.ws-empty__cta {
  min-width: 148px;
}

@keyframes ws-empty-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ws-empty-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ws-empty {
    animation: none;
  }

  .ws-empty__icon--spin svg {
    animation: none;
  }
}

@keyframes ws-tab-panel-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ws-tab-panel {
    animation: none;
  }
}

.workspace-item-grid > .workspace-item-card,
.list > .list-item,
.fsw-plant-list > .fsw-plant-card {
  animation: ws-card-in 0.36s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: 0.18s;
}

.workspace-item-grid > .workspace-item-card:nth-child(1),
.list > .list-item:nth-child(1),
.fsw-plant-list > .fsw-plant-card:nth-child(1) { animation-delay: 0.04s; }

.workspace-item-grid > .workspace-item-card:nth-child(2),
.list > .list-item:nth-child(2),
.fsw-plant-list > .fsw-plant-card:nth-child(2) { animation-delay: 0.08s; }

.workspace-item-grid > .workspace-item-card:nth-child(3),
.list > .list-item:nth-child(3),
.fsw-plant-list > .fsw-plant-card:nth-child(3) { animation-delay: 0.11s; }

.workspace-item-grid > .workspace-item-card:nth-child(4),
.list > .list-item:nth-child(4),
.fsw-plant-list > .fsw-plant-card:nth-child(4) { animation-delay: 0.135s; }

.workspace-item-grid > .workspace-item-card:nth-child(5),
.list > .list-item:nth-child(5),
.fsw-plant-list > .fsw-plant-card:nth-child(5) { animation-delay: 0.155s; }

.workspace-item-grid > .workspace-item-card:nth-child(6),
.list > .list-item:nth-child(6),
.fsw-plant-list > .fsw-plant-card:nth-child(6) { animation-delay: 0.17s; }

@keyframes ws-card-in {
  from {
    opacity: 0;
    transform: translateY(9px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-item-grid > .workspace-item-card,
  .list > .list-item,
  .fsw-plant-list > .fsw-plant-card {
    animation: none;
  }
}

/* === 总览落地页 === */
.ws-overview {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.ws-ov-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 24px;
  border-radius: 16px;
  border: 1px solid var(--color-border, #e5e7eb);
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary, #6366f1) 8%, var(--color-surface, #fff)), var(--color-surface, #fff));
}
.ws-ov-hero__eyebrow {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted, #6b7280);
}
.ws-ov-hero__premise {
  margin: 8px 0 12px;
  font-size: 18px;
  line-height: 1.6;
  color: var(--color-text, #111827);
}
.ws-ov-hero__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ws-ov-badge {
  padding: 3px 11px;
  border-radius: 999px;
  font-size: 12px;
  background: color-mix(in srgb, var(--color-primary, #6366f1) 12%, transparent);
  color: var(--color-primary, #6366f1);
}
.ws-ov-hero__edit {
  flex: none;
  border: 1px solid var(--color-border-strong, #d1d5db);
  background: var(--color-surface, #fff);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}
.ws-ov-hero__edit:hover { background: var(--color-surface-hover, #f9fafb); }
/* __WS_OV_CSS_ANCHOR__ */
.ws-ov-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.ws-ov-card {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 14px;
  background: var(--color-surface, #fff);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ws-ov-card--wide { grid-column: 1 / -1; }
.ws-ov-card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text, #111827);
}
.ws-ov-progress-nums {
  display: flex;
  gap: 24px;
  align-items: baseline;
}
.ws-ov-progress-nums strong { font-size: 26px; font-weight: 700; }
.ws-ov-progress-nums span { font-size: 13px; color: var(--color-text-muted, #6b7280); margin-left: 4px; }
.ws-ov-progress-sub { margin: 0; font-size: 13px; color: var(--color-text-muted, #6b7280); }
.ws-ov-bar {
  height: 6px;
  border-radius: 999px;
  background: var(--color-border, #e5e7eb);
  overflow: hidden;
}
.ws-ov-bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--color-primary, #6366f1);
  transition: width 0.3s ease;
}
.ws-ov-next-arc { margin: 0; font-size: 13px; color: var(--color-primary, #6366f1); }
.ws-ov-next-beat { margin: 0; font-size: 14px; line-height: 1.5; }
/* __WS_OV_CSS_ANCHOR2__ */
.ws-ov-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.ws-ov-btn {
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
  align-self: flex-start;
}
.ws-ov-btn--primary {
  background: var(--color-primary, #6366f1);
  color: #fff;
}
.ws-ov-btn--primary:hover { background: color-mix(in srgb, var(--color-primary, #6366f1) 88%, #000); }
.ws-ov-btn--ghost {
  background: var(--color-surface, #fff);
  border-color: var(--color-border-strong, #d1d5db);
  color: var(--color-text, #111827);
}
.ws-ov-btn--ghost:hover { background: var(--color-surface-hover, #f9fafb); }
.ws-ov-health-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.ws-ov-health-item { display: flex; align-items: center; gap: 10px; }
.ws-ov-health-dot {
  flex: none;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--color-warning, #d97706);
}
.ws-ov-health-label { flex: 1; font-size: 14px; }
.ws-ov-chip {
  flex: none;
  border: 1px solid var(--color-border-strong, #d1d5db);
  background: var(--color-surface, #fff);
  border-radius: 8px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}
.ws-ov-chip:hover { background: var(--color-surface-hover, #f9fafb); }
.ws-ov-health-ok { margin: 0; font-size: 14px; }
.ws-ov-recent-brief {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  max-height: 160px;
  overflow-y: auto;
  white-space: pre-wrap;
}
/* __WS_OV_CSS_ANCHOR3__ */
.ws-ov-cast-counts, .ws-ov-fs-counts { margin: 0; font-size: 13px; color: var(--color-text-muted, #6b7280); }
.ws-ov-cast-names { display: flex; flex-wrap: wrap; gap: 8px; }
.ws-ov-cast-chip {
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 13px;
  background: color-mix(in srgb, var(--color-primary, #6366f1) 8%, var(--color-surface, #fff));
  border: 1px solid var(--color-border, #e5e7eb);
}
.ws-ov-fs-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ws-ov-fs-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; }
.ws-ov-fs-due { flex: none; font-size: 12px; color: var(--color-warning, #d97706); }
@media (max-width: 720px) {
  .ws-ov-grid { grid-template-columns: 1fr; }
  .ws-ov-hero { flex-direction: column; }
}




.outline-map-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.outline-level-filter {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--color-surface-muted);
}
.outline-level-filter button {
  font-size: 0.74rem;
  padding: 4px 11px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}
.outline-level-filter button.is-active {
  background: var(--color-surface);
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px color-mix(in srgb, #000 10%, transparent);
}
.outline-view-toggle {
  display: inline-flex;
  border: 1px solid color-mix(in srgb, var(--color-border) 76%, transparent);
  border-radius: 999px;
  overflow: hidden;
}
.outline-view-toggle button {
  border: 0;
  background: transparent;
  padding: 5px 16px;
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-muted, #6b7280);
}
.outline-view-toggle button.is-active {
  background: var(--color-primary, #0d9488);
  color: var(--btn-on-primary, #fff);
}
.outline-search-input {
  font-size: 0.78rem;
  padding: 5px 11px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent);
  background: var(--color-surface);
  color: var(--color-text);
  min-width: 160px;
}
.outline-search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.outline-map-hero__storyline-filter {
  grid-area: filter;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.outline-map-hero__filter-empty {
  align-self: center;
  font-size: 0.78rem;
  color: var(--color-text-muted);
  padding: 2px 8px;
}

.outline-map-hero__filter-chip {
  border: 1px solid color-mix(in srgb, var(--storyline-color, var(--color-border-strong)) 45%, transparent);
  background: var(--color-surface);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}

.outline-map-hero__filter-chip.is-active {
  background: color-mix(in srgb, var(--storyline-color, var(--color-primary)) 18%, var(--color-surface));
  font-weight: 600;
}

.workspace-outline-ai-lint {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--color-warning, #d97706) 35%, transparent);
  background: color-mix(in srgb, var(--color-warning, #d97706) 8%, var(--color-surface));
  font-size: 13px;
}

.workspace-outline-ai-lint--info {
  color: var(--color-text-muted);
}

.workspace-outline-ai-lint--warn {
  color: var(--color-text);
}

.workspace-outline-ai-lint__dismiss {
  justify-self: start;
  border: none;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}

.workspace-outline-ai-critique {
  padding: 10px 14px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-info, #3b82f6) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-info, #3b82f6) 20%, transparent);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.workspace-outline-ai-dialog__link-btn {
  font-size: 13px;
}

.workspace-outline-ai-mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.workspace-outline-ai-mode-tabs button {
  flex: 1;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 30%, transparent);
  border-radius: 10px;
  padding: 8px 10px;
  background: var(--color-surface);
  cursor: pointer;
  font-size: 13px;
}

.workspace-outline-ai-mode-tabs button.is-active {
  border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 30%, var(--color-surface));
  font-weight: 600;
}

.workspace-outline-ai-expand-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workspace-outline-ai-expand-note {
  display: grid;
  gap: 6px;
}

.workspace-outline-ai-expand-hint {
  font-size: 12px;
  margin: 0;
}

.workspace-outline-ai-dialog {
  width: min(980px, calc(100vw - 32px));
}

.workspace-outline-ai-dialog__head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.workspace-outline-ai-dialog__progress {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary-soft) 34%, var(--color-surface));
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.workspace-outline-ai-dialog__scroll {
  display: grid;
  gap: 14px;
}

.workspace-outline-ai-panel {
  display: grid;
  gap: 14px;
}

.workspace-outline-ai-stream {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  max-height: 320px;
  overflow-y: auto;
}
.workspace-outline-ai-stream__hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}
.workspace-outline-ai-stream__lines {
  display: grid;
  gap: 2px;
}
.workspace-outline-ai-stream__line {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.6;
  white-space: pre;
  color: var(--color-text);
}
.workspace-outline-ai-stream__line--volume {
  font-weight: 700;
  color: var(--color-primary);
}
.workspace-outline-ai-stream__line--act {
  font-weight: 600;
}
.workspace-outline-ai-stream__cursor {
  display: inline-block;
  width: 6px;
  height: 14px;
  background: var(--color-primary);
  border-radius: 1px;
  animation: outline-ai-blink 0.8s step-end infinite;
  vertical-align: text-bottom;
  margin-left: 2px;
}
@keyframes outline-ai-blink {
  50% { opacity: 0; }
}

.workspace-outline-ai-gate {
  justify-items: center;
  text-align: center;
  gap: 12px;
  padding: 26px 22px 30px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 26%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-surface-muted) 32%, transparent);
}

.workspace-outline-ai-gate__icon {
  font-size: 2rem;
  line-height: 1;
  color: var(--color-primary);
}

.workspace-outline-ai-gate__title {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 760;
}

.workspace-outline-ai-gate__desc {
  margin: 0;
  max-width: 420px;
  color: var(--color-text-muted);
  font-size: 0.88rem;
  line-height: 1.7;
}

.workspace-outline-ai-gate__hint {
  margin: 0;
  font-size: 0.78rem;
}

.workspace-outline-ai-gate__cta {
  margin-top: 4px;
}

.workspace-outline-ai-panel__summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 24%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-primary-soft) 14%, var(--color-surface));
}

.workspace-outline-ai-dimensions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 0;
}

.workspace-outline-ai-dim-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 12px;
  background: color-mix(in srgb, var(--color-border) 20%, transparent);
  color: var(--color-text-muted);
  transition: all 0.2s;
}

.workspace-outline-ai-dim-tag--done {
  background: color-mix(in srgb, var(--color-success, #22c55e) 18%, transparent);
  color: var(--color-success, #22c55e);
}

.workspace-outline-ai-dim-tag--done::before {
  content: '✓';
  font-size: 11px;
}

.workspace-outline-ai-question-list,
.workspace-outline-ai-plan-list,
.workspace-outline-ai-draft-list,
.workspace-outline-ai-storylines,
.workspace-outline-ai-followup-history {
  display: grid;
  gap: 12px;
}

.workspace-outline-ai-question,
.workspace-outline-ai-plan,
.workspace-outline-ai-draft-item,
.workspace-outline-ai-storyline,
.workspace-outline-ai-followup-turn {
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 22%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-surface) 94%, var(--color-surface-muted));
}

.workspace-outline-ai-question__head,
.workspace-outline-ai-draft-item__head,
.workspace-outline-ai-plan__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.workspace-outline-ai-question__head {
  margin-bottom: 10px;
}

.workspace-outline-ai-question__head,
.workspace-outline-ai-question__head span,
.workspace-outline-ai-plan__head p,
.workspace-outline-ai-preview-head p,
.workspace-outline-ai-storyline p,
.workspace-outline-ai-draft-item p {
  margin: 0;
}

.workspace-outline-ai-question__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workspace-outline-ai-option {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 26%, transparent);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}

.workspace-outline-ai-option--active {
  border-color: color-mix(in srgb, var(--color-primary) 52%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 28%, var(--color-surface));
  color: color-mix(in srgb, var(--color-primary) 74%, var(--color-text) 26%);
}

.workspace-outline-ai-question__input {
  width: 100%;
  margin-top: 10px;
}

.workspace-outline-ai-question__textarea {
  min-height: 112px;
  resize: none;
}

.workspace-outline-ai-brief-field {
  display: grid;
  gap: 6px;
}
.workspace-outline-ai-brief-intro {
  margin: 0 0 4px;
  font-size: 13px;
  line-height: 1.6;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-primary-soft) 22%, var(--color-surface));
}
.workspace-outline-ai-brief-field__label {
  font-size: 13.5px;
  font-weight: 650;
  color: var(--color-text);
}
.workspace-outline-ai-brief-field__label em {
  font-style: normal;
  font-weight: 400;
  font-size: 12px;
  color: var(--color-text-muted);
}
.workspace-outline-ai-brief-field__main {
  min-height: 180px;
}
.workspace-outline-ai-brief-guides {
  display: grid;
  gap: 12px;
  margin-top: 4px;
}
.workspace-outline-ai-brief-guides .workspace-outline-ai-question__textarea {
  min-height: 56px;
}

.workspace-outline-ai-question--followup {
  background: color-mix(in srgb, var(--color-primary-soft) 12%, var(--color-surface));
}

.workspace-outline-ai-followup-prompt {
  margin: 0 0 12px;
}

.workspace-outline-ai-followup-turn {
  display: grid;
  gap: 8px;
}

.workspace-outline-ai-followup-turn p {
  margin: 0;
}

.workspace-outline-ai-followup-turn__index {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.workspace-outline-ai-followup-turn__answer {
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-primary-soft) 18%, var(--color-surface));
  color: var(--color-text);
}

.workspace-outline-ai-brief {
  margin: 0;
  padding: 12px 14px;
  border-left: 3px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-primary-soft) 18%, var(--color-surface));
}

.workspace-outline-ai-plan {
  cursor: pointer;
}

.workspace-outline-ai-plan--active {
  border-color: color-mix(in srgb, var(--color-primary) 48%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.workspace-outline-ai-plan__head h3,
.workspace-outline-ai-preview-head h3 {
  margin: 0 0 4px;
}

.workspace-outline-ai-plan__head span,
.workspace-outline-ai-draft-item__head span,
.workspace-outline-ai-storyline span {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary-soft) 22%, var(--color-surface));
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.workspace-outline-ai-plan__section {
  margin-top: 12px;
}

.workspace-outline-ai-plan__section strong,
.workspace-outline-ai-plan__ending {
  display: block;
  margin-bottom: 6px;
}

.workspace-outline-ai-plan__section ul,
.workspace-outline-ai-plan__section ol {
  margin: 0;
  padding-left: 18px;
}

.workspace-outline-ai-plan__note {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed color-mix(in srgb, var(--color-border-strong) 22%, transparent);
}

.workspace-outline-ai-plan__note span {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.workspace-outline-ai-plan__note-input {
  margin-top: 0;
  min-height: 84px;
}

.workspace-outline-ai-plan-revision-hint,
.workspace-outline-ai-question__hint {
  margin: 8px 0 0;
  font-size: 0.86rem;
}

.workspace-outline-ai-preview-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 14px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-primary-soft) 18%, var(--color-surface));
}

.workspace-outline-ai-preview-head dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.workspace-outline-ai-preview-head dt,
.workspace-outline-ai-preview-head dd {
  margin: 0;
}

.workspace-outline-ai-preview-head dd {
  font-size: 18px;
  font-weight: 700;
}

.workspace-outline-ai-storyline strong,
.workspace-outline-ai-draft-item strong {
  display: block;
}

.workspace-outline-ai-storyline {
  display: grid;
  gap: 8px;
}

.workspace-outline-ai-draft-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.workspace-outline-ai-draft-item__meta span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.workspace-outline-ai-dialog__error {
  margin: 0;
}

@media (max-width: 900px) {
  .workspace-outline-ai-dialog__head,
  .workspace-outline-ai-preview-head,
  .workspace-outline-ai-panel__summary,
  .workspace-outline-ai-question__head,
  .workspace-outline-ai-plan__head,
  .workspace-outline-ai-draft-item__head {
    grid-auto-flow: row;
    display: grid;
  }
}

/* ── World Setting AI Dialog ──────────────────────────────────────── */

.ws-ai-overlay {
  backdrop-filter: blur(8px);
  background: color-mix(in srgb, var(--color-surface) 40%, transparent);
}

.ws-ai-dialog {
  width: min(720px, calc(100vw - 32px));
  max-height: min(88vh, 820px);
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  overflow: hidden;
}

.ws-ai-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary-soft) 16%, var(--color-surface)), var(--color-surface));
  flex-shrink: 0;
}

.ws-ai-dialog__header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ws-ai-dialog__icon {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1.5px solid color-mix(in srgb, var(--color-border-strong) 40%, transparent);
  background: transparent;
  color: var(--color-text-muted);
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.5px;
  flex-shrink: 0;
}

.ws-ai-dialog__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1.2;
}

.ws-ai-dialog__subtitle {
  margin: 3px 0 0;
  font-size: 12.5px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.ws-ai-dialog__header-right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.ws-ai-dialog__close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-border) 30%, transparent);
  color: var(--color-text-muted);
  font-size: 18px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.ws-ai-dialog__close:hover {
  background: color-mix(in srgb, var(--color-primary) 16%, transparent);
  color: var(--color-text);
}

/* Step indicator */
.ws-ai-step-indicator {
  display: flex;
  align-items: center;
  gap: 0;
}

.ws-ai-step-indicator__dot {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  background: color-mix(in srgb, var(--color-border) 30%, transparent);
  color: var(--color-text-muted);
  transition: all 0.25s ease;
}

.ws-ai-step-indicator__dot--done {
  background: color-mix(in srgb, var(--color-success, #22c55e) 20%, transparent);
  color: var(--color-success, #22c55e);
}

.ws-ai-step-indicator__dot--active {
  background: var(--color-primary);
  color: var(--color-primary-contrast, #fff);
}

.ws-ai-step-indicator__line {
  width: 28px;
  height: 2px;
  background: color-mix(in srgb, var(--color-border) 40%, transparent);
  transition: background 0.25s ease;
}

.ws-ai-step-indicator__line--done {
  background: var(--color-success, #22c55e);
}

/* Body */
.ws-ai-dialog__body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 20px 24px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-text-muted) 28%, transparent) transparent;
}

.ws-ai-dialog__body::-webkit-scrollbar {
  width: 5px;
}

.ws-ai-dialog__body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-muted) 28%, transparent);
}

/* Loading bar */
.ws-ai-loading-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-primary-soft) 12%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.ws-ai-loading-bar__track {
  height: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  overflow: hidden;
}

.ws-ai-loading-bar__fill {
  height: 100%;
  width: 40%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 50%, var(--color-surface)));
  animation: ws-ai-loading-slide 1.4s ease-in-out infinite;
}

@keyframes ws-ai-loading-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

.ws-ai-loading-bar__text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-muted);
  font-weight: 500;
}

.ws-ai-loading-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: ws-ai-dot-pulse 1s ease-in-out infinite;
}

@keyframes ws-ai-dot-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1); }
}

/* Dimensions */
.ws-ai-dimensions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ws-ai-dim-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 500;
  background: color-mix(in srgb, var(--color-border) 16%, transparent);
  color: var(--color-text-muted);
  border: 1px solid color-mix(in srgb, var(--color-border) 24%, transparent);
  transition: all 0.2s ease;
}

.ws-ai-dim-tag__icon {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  opacity: 0.5;
  font-variant-numeric: tabular-nums;
}

.ws-ai-dim-tag--done {
  background: color-mix(in srgb, var(--color-success, #22c55e) 12%, transparent);
  color: var(--color-success, #22c55e);
  border-color: color-mix(in srgb, var(--color-success, #22c55e) 28%, transparent);
}

.ws-ai-dim-tag--done::after {
  content: '✓';
  font-size: 11px;
  margin-left: 2px;
}

/* History */
.ws-ai-history {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ws-ai-history__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ws-ai-history__count {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.ws-ai-history__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 260px;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
}

.ws-ai-history__turn {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--color-border) 30%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 96%, rgba(255,255,255,0.5)), color-mix(in srgb, var(--color-surface-muted) 88%, transparent));
}

.ws-ai-history__turn-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ws-ai-history__turn-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 20px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.ws-ai-history__turn-label {
  font-size: 13px;
  font-weight: 600;
  color: color-mix(in srgb, var(--color-text) 80%, var(--color-primary) 20%);
}

.ws-ai-history__turn-question {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.ws-ai-history__turn-answer {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-primary-soft) 14%, var(--color-surface));
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text);
}

.ws-ai-history__turn-answer-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--color-primary) 20%, transparent);
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 800;
  flex-shrink: 0;
  margin-top: 1px;
}

/* Rationale */
.ws-ai-rationale {
  margin: 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  border-left: 3px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 12%, var(--color-surface));
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.ws-ai-rationale__icon {
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 300;
  color: var(--color-text-muted);
  margin-top: 0;
  line-height: 1;
}

/* Question card */
.ws-ai-question {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 24%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary-soft) 10%, var(--color-surface)), var(--color-surface));
  box-shadow: 0 2px 12px color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.ws-ai-question__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ws-ai-question__round {
  display: inline-flex;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--color-primary);
  color: var(--color-primary-contrast, #fff);
  font-size: 11px;
  font-weight: 700;
}

.ws-ai-question__label {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

.ws-ai-question__prompt {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text);
}

.ws-ai-question__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ws-ai-option-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 30%, transparent);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ws-ai-option-btn:hover {
  border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 10%, var(--color-surface));
}

.ws-ai-option-btn--active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 24%, var(--color-surface));
  color: color-mix(in srgb, var(--color-primary) 80%, var(--color-text) 20%);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.ws-ai-option-btn--custom {
  border-style: dashed;
}

.ws-ai-option-btn__check {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary);
}

.ws-ai-question__input-area {
  position: relative;
}

.ws-ai-question__hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

/* Textarea */
.ws-ai-textarea {
  width: 100%;
  resize: none;
  min-height: 80px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 40%, transparent);
  border-radius: 12px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 98%, rgba(255,255,255,0.6)), var(--color-surface));
  color: var(--color-text);
  font: inherit;
  font-size: 13.5px;
  line-height: 1.7;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ws-ai-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.ws-ai-textarea--large {
  min-height: 280px;
  font-size: 14px;
  line-height: 1.8;
  padding: 16px 18px;
  background:
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 27px,
      color-mix(in srgb, var(--color-border) 22%, transparent) 28px
    ),
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 98%, rgba(255,255,255,0.6)), var(--color-surface));
  background-attachment: local;
}

.ws-ai-textarea--tall {
  min-height: 220px;
  font-size: 14px;
  line-height: 1.9;
}

/* 生成中的流式预览 */
.ws-ai-stream {
  padding: 16px 18px;
  border: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-surface-muted) 30%, var(--color-surface));
  margin-bottom: 8px;
}

/* 世界观全文只读预览（不独立滚动，跟随弹窗整体滚动） */
.ws-ai-longread {
  padding: 16px 18px;
  border: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
  border-radius: 12px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 98%, rgba(255,255,255,0.6)), var(--color-surface));
  word-break: break-word;
  color: var(--color-text);
}

/* Markdown 渲染样式：标题分级、段落、列表、强调 */
.ws-ai-md {
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--color-text);
}
.ws-ai-md h1 {
  font-size: 19px;
  font-weight: 700;
  margin: 0 0 14px;
  padding-bottom: 8px;
  border-bottom: 2px solid color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
  color: var(--color-text);
}
.ws-ai-md h2 {
  font-size: 16px;
  font-weight: 700;
  margin: 20px 0 8px;
  padding-left: 10px;
  border-left: 3px solid var(--color-primary);
  color: var(--color-text);
}
.ws-ai-md h3 {
  font-size: 14.5px;
  font-weight: 600;
  margin: 14px 0 6px;
  color: color-mix(in srgb, var(--color-text) 85%, var(--color-primary));
}
.ws-ai-md h4 {
  font-size: 13.5px;
  font-weight: 600;
  margin: 12px 0 5px;
  color: var(--color-text);
}
.ws-ai-md p {
  margin: 0 0 9px;
}
.ws-ai-md ul {
  margin: 0 0 10px;
  padding-left: 22px;
}
.ws-ai-md li {
  margin: 2px 0;
}
.ws-ai-md strong {
  font-weight: 700;
  color: color-mix(in srgb, var(--color-text) 80%, var(--color-primary));
}
.ws-ai-md em {
  font-style: italic;
}
.ws-ai-md code {
  font-family: var(--font-mono, monospace);
  font-size: 0.92em;
  padding: 1px 5px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--color-border) 35%, transparent);
}
.ws-ai-md h1:first-child,
.ws-ai-md h2:first-child,
.ws-ai-md p:first-child {
  margin-top: 0;
}

/* 「参考书名」勾选框 */
.ws-ai-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 4px 0 8px;
  cursor: pointer;
  user-select: none;
}
.ws-ai-checkbox input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.ws-ai-checkbox__box {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border: 1.5px solid color-mix(in srgb, var(--color-border-strong) 55%, transparent);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  transition: background 0.15s, border-color 0.15s;
}
.ws-ai-checkbox input:checked + .ws-ai-checkbox__box {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.ws-ai-checkbox__text {
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.5;
}
.ws-ai-checkbox__hint {
  display: block;
  font-size: 11.5px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* 卡片编辑器：去掉默认拖动柄 */
.ws-cards-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ws-card-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--color-border) 45%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-surface-muted) 22%, var(--color-surface));
}
.ws-card-row__title {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 35%, transparent);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  outline: none;
}
.ws-card-row__body {
  width: 100%;
  resize: none;
  min-height: 64px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 30%, transparent);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 13px;
  line-height: 1.7;
  outline: none;
}
.ws-card-row__title:focus,
.ws-card-row__body:focus {
  border-color: var(--color-primary);
}
.ws-card-row__remove {
  align-self: flex-end;
  padding: 4px 12px;
  border: 1px solid color-mix(in srgb, var(--color-danger, #d9534f) 40%, transparent);
  border-radius: 7px;
  background: transparent;
  color: var(--color-danger, #d9534f);
  font-size: 12px;
  cursor: pointer;
}

/* 修改意见区 */
.ws-ai-revise {
  padding: 14px;
  border: 1px dashed color-mix(in srgb, var(--color-primary) 38%, var(--color-border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));
}
.ws-ai-btn--revise {
  align-self: flex-start;
  margin-top: 10px;
  padding: 9px 18px;
  border: none;
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.ws-ai-btn--revise:hover:not(:disabled) {
  opacity: 0.9;
}
.ws-ai-btn--revise:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ws-ai-textarea__counter {
  position: absolute;
  right: 12px;
  bottom: 8px;
  font-size: 11px;
  color: var(--color-text-muted);
  pointer-events: none;
}

/* Input */
.ws-ai-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 40%, transparent);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ws-ai-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
}

/* Draft header */
.ws-ai-draft-header {
  padding: 14px 16px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-primary-soft) 10%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.ws-ai-draft-header__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-muted);
}

/* Draft editor */
.ws-ai-draft-editor {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ws-ai-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ws-ai-field__label {
  font-size: 13px;
  font-weight: 700;
  color: color-mix(in srgb, var(--color-text) 80%, var(--color-primary) 20%);
}

.ws-ai-field__hint {
  font-size: 12px;
  color: var(--color-text-muted);
  align-self: flex-end;
}

.ws-ai-field__empty {
  font-size: 12px;
  color: var(--color-text-muted);
  font-style: italic;
}

/* Categories */
.ws-ai-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ws-ai-cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 36%, transparent);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ws-ai-cat-chip:hover {
  border-color: color-mix(in srgb, var(--color-primary) 36%, transparent);
}

.ws-ai-cat-chip--active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 22%, var(--color-surface));
  color: color-mix(in srgb, var(--color-primary) 70%, var(--color-text) 30%);
}

.ws-ai-cat-chip__check {
  font-size: 11px;
  font-weight: 700;
  width: 14px;
  text-align: center;
}

/* Actions */
.ws-ai-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

.ws-ai-actions--spread {
  justify-content: space-between;
}

.ws-ai-actions__right {
  display: flex;
  gap: 10px;
}

.ws-ai-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.ws-ai-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ws-ai-btn--primary {
  background: var(--color-primary);
  color: var(--color-primary-contrast, #fff);
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 24%, transparent);
}

.ws-ai-btn--primary:hover:not(:disabled) {
  box-shadow: 0 4px 16px color-mix(in srgb, var(--color-primary) 32%, transparent);
  transform: translateY(-1px);
}

.ws-ai-btn--ghost {
  background: transparent;
  color: var(--color-text-muted);
  border-color: color-mix(in srgb, var(--color-border-strong) 36%, transparent);
}

.ws-ai-btn--ghost:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary-soft) 12%, var(--color-surface));
  color: var(--color-text);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
}

/* Empty state */
.ws-ai-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--color-text-muted);
  font-size: 14px;
}

.ws-ai-empty__icon {
  font-size: 28px;
  font-weight: 200;
  color: var(--color-text-muted);
  animation: ws-ai-dot-pulse 1.5s ease-in-out infinite;
}

/* Error */
.ws-ai-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-danger, #ef4444) 10%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-danger, #ef4444) 24%, transparent);
  color: var(--color-danger, #ef4444);
  font-size: 13px;
}

.ws-ai-error__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid var(--color-danger, #ef4444);
  color: var(--color-danger, #ef4444);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  background: transparent;
}

.ws-ai-error__dismiss {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--color-danger, #ef4444);
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  opacity: 0.7;
}

.ws-ai-error__dismiss:hover {
  opacity: 1;
}

/* Transitions */
.ws-ai-fade-enter-active,
.ws-ai-fade-leave-active {
  transition: opacity 0.2s ease;
}

.ws-ai-fade-enter-from,
.ws-ai-fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .ws-ai-dialog__header {
    flex-direction: column;
    align-items: flex-start;
  }
  .ws-ai-dialog__header-right {
    align-self: flex-end;
  }
  .ws-ai-question__options {
    flex-direction: column;
  }
  .ws-ai-actions--spread {
    flex-direction: column;
    gap: 8px;
  }
  .ws-ai-actions__right {
    justify-content: flex-end;
  }
}

.ws-scene-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}
.ws-scene-tile {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.ws-scene-tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: var(--color-border-strong);
}
.ws-scene-tile__name {
  padding: 10px 14px;
  font-weight: 600;
  font-size: 0.95rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ws-scene-tile__thumb {
  aspect-ratio: 4 / 3;
  background: color-mix(in srgb, var(--color-surface-muted) 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.ws-scene-tile__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ws-scene-tile__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}
.ws-scene-tile__placeholder i {
  font-size: 1.6rem;
  opacity: 0.5;
}
.ws-scene-tile__desc {
  margin: 0;
  padding: 10px 14px;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 场景详情弹窗 */
.ws-scene-detail {
  position: relative;
  width: min(880px, calc(100vw - 32px));
  max-width: min(880px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  overflow: hidden;
}
.ws-scene-detail__close {
  position: absolute;
  top: 12px;
  right: 14px;
  z-index: 2;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}
.ws-scene-detail__close:hover {
  background: rgba(0, 0, 0, 0.55);
}
.ws-scene-detail__body {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  max-height: calc(100vh - 64px);
}
.ws-scene-detail__main {
  background: #0d0d0d;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}
.ws-scene-detail__img {
  width: 100%;
  height: 100%;
  max-height: calc(100vh - 64px);
  object-fit: contain;
}
.ws-scene-detail__placeholder {
  flex-direction: column;
  gap: 10px;
  color: #888;
  font-size: 0.9rem;
}
.ws-scene-detail__placeholder i {
  font-size: 2.4rem;
  opacity: 0.5;
}
.ws-scene-detail__side {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.ws-scene-detail__name {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}
.ws-scene-detail__desc {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--color-text-muted);
  white-space: pre-wrap;
  word-break: break-word;
}
.ws-scene-detail__error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-danger, #e53935);
}
.ws-scene-detail__adjust {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}
.ws-scene-detail__adjust-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
.ws-scene-detail__adjust-row {
  display: flex;
  gap: 8px;
}
.ws-scene-detail__adjust-row .ws-scene-form__input {
  flex: 1;
}
.ws-scene-detail__adjust-row .btn-primary {
  flex-shrink: 0;
}
.ws-scene-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: auto;
}
.ws-scene-detail__del {
  color: var(--color-danger, #e53935);
}
.ws-scene-detail__history-label {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}
.ws-scene-detail__thumbs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
}
.ws-scene-detail__thumbs img {
  width: 56px;
  height: 42px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}
@media (max-width: 640px) {
  .ws-scene-detail__body {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
}

/* 场景编辑弹窗 */
.ws-scene-form {
  width: min(520px, calc(100vw - 28px));
  max-width: min(520px, calc(100vw - 28px));
}
.ws-scene-form__body {
  padding: 20px 22px 22px;
}
.ws-scene-form__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.ws-scene-form__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}
.ws-scene-form__close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}
.ws-scene-form__close:hover {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
.ws-scene-form__form {
  display: grid;
  gap: 16px;
}
.ws-scene-form__field {
  display: grid;
  gap: 7px;
  position: relative;
}
.ws-scene-form__label {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--color-text-muted);
}
.ws-scene-form__input {
  width: 100%;
  padding: 10px 13px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 55%, transparent);
  background: color-mix(in srgb, var(--color-surface) 96%, transparent);
  color: var(--color-text);
  font-size: 0.92rem;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}
.ws-scene-form__input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--color-primary) 65%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
}
.ws-scene-form__textarea {
  min-height: 132px;
  resize: vertical;
  line-height: 1.65;
}
.ws-scene-form__count {
  position: absolute;
  right: 4px;
  bottom: -18px;
  font-size: 0.72rem;
  color: var(--color-text-muted);
}
.ws-scene-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
.ws-scene-form__submit {
  min-width: 100px;
}

/* 角色形象多视图 */
.char-figure {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
}
.char-figure__title {
  margin: 0 0 10px;
  font-size: 0.9rem;
  font-weight: 600;
}
.char-figure__views {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.char-figure__view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.char-figure__thumb {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  overflow: hidden;
  background: color-mix(in srgb, var(--color-surface-muted) 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}
.char-figure__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.char-figure__placeholder {
  color: var(--color-text-muted);
  font-size: 1.4rem;
  opacity: 0.45;
}
.char-figure__label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
.char-figure__btn {
  font-size: 0.78rem;
  padding: 3px 10px;
  border: 1px solid var(--color-border-strong);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}
.char-figure__btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.char-figure__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.char-figure__hint {
  margin: 10px 0 0;
  font-size: 0.76rem;
  color: var(--color-text-muted);
}
.char-figure__error {
  margin: 6px 0 0;
  font-size: 0.8rem;
  color: var(--color-danger, #e53935);
}

/* 画风选择器 */
.ws-style-picker {
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.82rem;
  cursor: pointer;
}
.ws-style-picker--sm {
  padding: 3px 8px;
  font-size: 0.76rem;
}
.char-figure__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.char-figure__head .char-figure__title {
  margin: 0;
}
</style>
