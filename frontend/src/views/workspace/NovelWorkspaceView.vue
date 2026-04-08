<template>
  <section class="page-block" v-if="novel">
    <header ref="workspaceChromeAnchorRef" class="header-row">
      <div>
        <h1>{{ novel.title }}</h1>
        <p class="muted workspace-sub one-line">{{ novel.summary || '暂无简介' }}</p>
        <nav class="tabs">
          <button type="button" class="tab" :class="{ active: activeTab === 'write' }" @click="switchTab('write')">
            写作
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
            :class="{ active: activeTab === 'timeline' }"
            @click="switchTab('timeline')"
          >
            时间线
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
            伏笔/坑点
          </button>
        </nav>
      </div>
      <button
        v-if="activeTab === 'characters'"
        type="button"
        class="link-back btn-as-link"
        @click="backFromCharacters"
      >
        返回
      </button>
      <button v-else type="button" class="link-back btn-as-link" @click="backFromPage">
        返回
      </button>
    </header>

    <section class="card" v-if="activeTab === 'write'">
      <h2>概览</h2>
      <div class="meta-grid">
        <div><span class="k">题材</span><span>{{ novel.genre || '未设置' }}</span></div>
        <div><span class="k">叙事视角</span><span>{{ novel.perspective || '未设置' }}</span></div>
        <div><span class="k">基调</span><span>{{ novel.tone || '未设置' }}</span></div>
        <div><span class="k">多线叙事</span><span>{{ novel.isMultiLineNarrative ? '是' : '否' }}</span></div>
      </div>
      <div class="action-row workspace-write-entry">
        <RouterLink class="workspace-write-entry__btn" :to="{ name: 'novel-chapter-writing', params: { novelId: novel.id } }">
          去写作
        </RouterLink>
      </div>
    </section>

    <section class="card" v-if="activeTab === 'outline'">
      <h2>大纲</h2>

      <form class="form-grid" @submit.prevent="handleCreateOutline">
        <div class="grid-2">
          <label>
            情节点标题
            <input v-model="outlineForm.title" maxlength="80" />
          </label>
          <label>
            情节点摘要
            <input v-model="outlineForm.summary" maxlength="240" />
          </label>
        </div>
        <div class="action-row">
          <button type="submit">新增节点</button>
        </div>
      </form>

      <p v-if="outlineItems.length === 0" class="muted">暂无节点</p>
      <ul v-else class="list">
        <li v-for="item in outlineItems" :key="item.id" class="list-item">
          <div class="chapter-main">
            <div class="chapter-title-row">
              <span class="muted">#{{ item.order }}</span>
              <input
                class="inline-input"
                type="text"
                :value="item.title"
                maxlength="80"
                @change="onOutlineTitleChange(item.id, $event)"
              />
            </div>
            <span class="tag outline-status" :class="`outline-status--${item.status}`">
              {{ outlineStatusText(item.status) }}
            </span>
            <input
              class="inline-input"
              :value="item.summary"
              maxlength="240"
              @change="onOutlineSummaryChange(item.id, $event)"
            />

            <div class="outline-assoc">
              <div class="outline-assoc__row">
                <span class="muted">关联章节：{{ getLinkedChaptersCount(item.id) }}</span>
                <button
                  type="button"
                  class="outline-assoc__toggle"
                  @click="expandedOutlineId = expandedOutlineId === item.id ? '' : item.id"
                  :disabled="chapters.length === 0"
                >
                  {{ expandedOutlineId === item.id ? '收起' : '选择关联章节' }}
                </button>
              </div>

              <div v-if="expandedOutlineId === item.id" class="outline-assoc__picker">
                <p v-if="chapters.length === 0" class="muted">请先新增章节后再进行关联。</p>
                <div v-else class="checklist">
                  <label v-for="ch in chapters" :key="ch.id" class="check-item">
                    <input
                      type="checkbox"
                      :checked="(ch.outlineItemIds ?? []).includes(item.id)"
                      @change="toggleChapterOutline(ch.id, item.id)"
                    />
                    <span>
                      第 {{ ch.chapterNo }} 章 · {{ ch.title }}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div class="chapter-actions chapter-actions-row">
            <button type="button" @click="moveOutline(item.id, 'up')">上移</button>
            <button type="button" @click="moveOutline(item.id, 'down')">下移</button>
            <button type="button" class="btn-danger" @click="handleDeleteOutline(item.id)">删除</button>
            <button type="button" @click="cycleOutlineStatus(item.id)">切换状态</button>
          </div>
        </li>
      </ul>

      <ConfirmDialog
        v-model="outlineDeleteOpen"
        title="删除情节点"
        message="确定删除该情节点？已勾选该节点的章节关联会自动取消。"
        confirm-label="删除"
        cancel-label="取消"
        danger
        @confirm="confirmDeleteOutline"
        @cancel="onOutlineDeleteDialogCancel"
      />
    </section>

    <section class="card" v-if="activeTab === 'timeline'">
      <h2>时间线</h2>

      <form class="form-grid" @submit.prevent="handleCreateTimeline">
        <div class="grid-2">
          <label>
            故事时间
            <input
              v-model="timelineForm.storyLabel"
              maxlength="40"
            />
          </label>
          <label>
            事件标题
            <input v-model="timelineForm.title" maxlength="80" />
          </label>
        </div>
        <label>
          说明
          <input v-model="timelineForm.summary" maxlength="240" />
        </label>
        <div class="grid-2">
          <label>
            关联章节（范围）
            <div class="story-timeline__chapter-range">
              <div class="workspace-dd">
                <button
                  type="button"
                  class="workspace-dd__btn"
                  :class="{ 'workspace-dd__btn--open': timelineChapterDropdownOpen }"
                  @click="toggleTimelineChapterDropdown"
                >
                  <span class="workspace-dd__btn-text">开始：{{ timelineChapterDropdownLabel }}</span>
                  <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                </button>
                <div
                  v-if="timelineChapterDropdownOpen"
                  class="workspace-dd__panel scrollbar-paper"
                  role="listbox"
                >
                  <button
                    type="button"
                    class="workspace-dd__item"
                    :class="{ 'workspace-dd__item--active': timelineForm.chapterNoStart === '' }"
                    @click="selectTimelineChapter('')"
                  >
                    不关联
                  </button>
                  <button
                    v-for="ch in chapters"
                    :key="`tl-form-ch-start-${ch.id}`"
                    type="button"
                    class="workspace-dd__item"
                    :class="{ 'workspace-dd__item--active': timelineForm.chapterNoStart === String(ch.chapterNo) }"
                    @click="selectTimelineChapter(String(ch.chapterNo))"
                  >
                    第 {{ ch.chapterNo }} 章 · {{ ch.title }}
                  </button>
                </div>
              </div>
              <div class="workspace-dd">
                <button
                  type="button"
                  class="workspace-dd__btn"
                  :class="{ 'workspace-dd__btn--open': timelineChapterEndDropdownOpen }"
                  @click="toggleTimelineChapterEndDropdown"
                >
                  <span class="workspace-dd__btn-text">结束：{{ timelineChapterEndDropdownLabel }}</span>
                  <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                </button>
                <div
                  v-if="timelineChapterEndDropdownOpen"
                  class="workspace-dd__panel scrollbar-paper"
                  role="listbox"
                >
                  <button
                    type="button"
                    class="workspace-dd__item"
                    :class="{ 'workspace-dd__item--active': timelineForm.chapterNoEnd === '' }"
                    @click="selectTimelineChapterEnd('')"
                  >
                    不设置
                  </button>
                  <button
                    v-for="ch in chapters"
                    :key="`tl-form-ch-end-${ch.id}`"
                    type="button"
                    class="workspace-dd__item"
                    :class="{ 'workspace-dd__item--active': timelineForm.chapterNoEnd === String(ch.chapterNo) }"
                    @click="selectTimelineChapterEnd(String(ch.chapterNo))"
                  >
                    第 {{ ch.chapterNo }} 章 · {{ ch.title }}
                  </button>
                </div>
              </div>
            </div>
          </label>
          <label>
            关联大纲节点
            <div class="workspace-dd">
              <button
                type="button"
                class="workspace-dd__btn"
                :class="{ 'workspace-dd__btn--open': timelineOutlineDropdownOpen }"
                @click="toggleTimelineOutlineDropdown"
              >
                <span class="workspace-dd__btn-text">{{ timelineOutlineDropdownLabel }}</span>
                <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
              </button>
              <div
                v-if="timelineOutlineDropdownOpen"
                class="workspace-dd__panel scrollbar-paper"
                role="listbox"
              >
                <button
                  type="button"
                  class="workspace-dd__item"
                  :class="{ 'workspace-dd__item--active': timelineForm.outlineItemId === '' }"
                  @click="selectTimelineOutline('')"
                >
                  不关联
                </button>
                <button
                  v-for="o in outlineItems"
                  :key="`tl-form-ol-${o.id}`"
                  type="button"
                  class="workspace-dd__item"
                  :class="{ 'workspace-dd__item--active': timelineForm.outlineItemId === o.id }"
                  @click="selectTimelineOutline(o.id)"
                >
                  #{{ o.order }} · {{ o.title }}
                </button>
              </div>
            </div>
          </label>
        </div>
        <div class="action-row">
          <button type="submit">添加事件</button>
        </div>
      </form>

      <p v-if="timelineEvents.length === 0" class="muted">暂无事件，从上表添加。</p>

      <div v-else class="story-timeline">
        <p class="muted story-timeline__scroll-hint">横向时间轴 · 可左右滑动</p>
        <div class="story-timeline__scroll">
          <div class="story-timeline__entries" role="list">
            <template v-for="(ev, i) in timelineEvents" :key="ev.id">
              <div v-if="i > 0" class="story-timeline__bridge" aria-hidden="true">
                <span class="story-timeline__seg" />
              </div>
              <article class="story-timeline__item" role="listitem">
                <div class="story-timeline__node">
                  <span class="story-timeline__dot" />
                </div>
                <div class="story-timeline__body">
                  <div class="story-timeline__meta">
                    <input
                      class="inline-input story-timeline__label-input"
                      type="text"
                      :value="ev.storyLabel"
                      maxlength="40"
                      @change="onTimelineStoryLabelChange(ev.id, $event)"
                    />
                    <span class="story-timeline__order muted">#{{ ev.order }}</span>
                  </div>
                  <input
                    class="inline-input story-timeline__title-input"
                    type="text"
                    :value="ev.title"
                    maxlength="80"
                    @change="onTimelineTitleChange(ev.id, $event)"
                  />
                  <input
                    class="inline-input"
                    type="text"
                    :value="ev.summary"
                    maxlength="240"
                    @change="onTimelineSummaryChange(ev.id, $event)"
                  />
                  <div class="story-timeline__links grid-2">
                    <label class="story-timeline__select-label story-timeline__select-label--range">
                      <span class="muted story-timeline__select-kicker">章节范围</span>
                      <div class="story-timeline__chapter-range">
                        <div class="workspace-dd">
                          <button
                            type="button"
                            class="workspace-dd__btn workspace-dd__btn--compact"
                            :class="{ 'workspace-dd__btn--open': timelineEventChapterStartDropdownOpenId === ev.id }"
                            @click="toggleTimelineEventChapterStartDropdown(ev.id)"
                          >
                            <span class="workspace-dd__btn-text">开始：{{ timelineEventChapterStartLabel(ev) }}</span>
                            <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                          </button>
                          <div
                            v-if="timelineEventChapterStartDropdownOpenId === ev.id"
                            class="workspace-dd__panel workspace-dd__panel--up scrollbar-paper"
                            role="listbox"
                          >
                            <button
                              type="button"
                              class="workspace-dd__item"
                              :class="{ 'workspace-dd__item--active': ev.chapterNoStart == null }"
                              @click="setTimelineEventChapterStart(ev.id, '')"
                            >
                              不关联
                            </button>
                            <button
                              v-for="ch in chapters"
                              :key="`tl-start-${ev.id}-${ch.id}`"
                              type="button"
                              class="workspace-dd__item"
                              :class="{ 'workspace-dd__item--active': ev.chapterNoStart === ch.chapterNo }"
                              @click="setTimelineEventChapterStart(ev.id, String(ch.chapterNo))"
                            >
                              第 {{ ch.chapterNo }} 章
                            </button>
                          </div>
                        </div>
                        <div class="workspace-dd">
                          <button
                            type="button"
                            class="workspace-dd__btn workspace-dd__btn--compact"
                            :class="{ 'workspace-dd__btn--open': timelineEventChapterEndDropdownOpenId === ev.id }"
                            @click="toggleTimelineEventChapterEndDropdown(ev.id)"
                          >
                            <span class="workspace-dd__btn-text">结束：{{ timelineEventChapterEndLabel(ev) }}</span>
                            <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                          </button>
                          <div
                            v-if="timelineEventChapterEndDropdownOpenId === ev.id"
                            class="workspace-dd__panel workspace-dd__panel--up scrollbar-paper"
                            role="listbox"
                          >
                            <button
                              type="button"
                              class="workspace-dd__item"
                              :class="{ 'workspace-dd__item--active': ev.chapterNoEnd == null }"
                              @click="setTimelineEventChapterEnd(ev.id, '')"
                            >
                              不设置
                            </button>
                            <button
                              v-for="ch in chapters"
                              :key="`tl-end-${ev.id}-${ch.id}`"
                              type="button"
                              class="workspace-dd__item"
                              :class="{ 'workspace-dd__item--active': ev.chapterNoEnd === ch.chapterNo }"
                              @click="setTimelineEventChapterEnd(ev.id, String(ch.chapterNo))"
                            >
                              第 {{ ch.chapterNo }} 章
                            </button>
                          </div>
                        </div>
                      </div>
                    </label>
                    <label class="story-timeline__select-label">
                      <span class="muted story-timeline__select-kicker">大纲</span>
                      <div class="workspace-dd">
                        <button
                          type="button"
                          class="workspace-dd__btn workspace-dd__btn--compact"
                          :class="{ 'workspace-dd__btn--open': timelineEventOutlineDropdownOpenId === ev.id }"
                          @click="toggleTimelineEventOutlineDropdown(ev.id)"
                        >
                          <span class="workspace-dd__btn-text">{{ timelineEventOutlineLabel(ev) }}</span>
                          <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                        </button>
                        <div
                          v-if="timelineEventOutlineDropdownOpenId === ev.id"
                          class="workspace-dd__panel workspace-dd__panel--up scrollbar-paper"
                          role="listbox"
                        >
                          <button
                            type="button"
                            class="workspace-dd__item"
                            :class="{ 'workspace-dd__item--active': !ev.outlineItemId }"
                            @click="setTimelineEventOutline(ev.id, '')"
                          >
                            不关联
                          </button>
                          <button
                            v-for="o in outlineItems"
                            :key="`tl-o-${ev.id}-${o.id}`"
                            type="button"
                            class="workspace-dd__item"
                            :class="{ 'workspace-dd__item--active': ev.outlineItemId === o.id }"
                            @click="setTimelineEventOutline(ev.id, o.id)"
                          >
                            #{{ o.order }} · {{ o.title }}
                          </button>
                        </div>
                      </div>
                    </label>
                  </div>
                  <div class="story-timeline__actions chapter-actions-row">
                    <button type="button" @click="moveTimeline(ev.id, 'up')">左移</button>
                    <button type="button" @click="moveTimeline(ev.id, 'down')">右移</button>
                    <button type="button" class="btn-danger" @click="openTimelineDelete(ev.id)">删除</button>
                  </div>
                </div>
              </article>
            </template>
          </div>
        </div>
      </div>

      <ConfirmDialog
        v-model="timelineDeleteOpen"
        title="删除时间线事件"
        message="确定删除该事件？此操作无法撤销。"
        confirm-label="删除"
        cancel-label="取消"
        danger
        @confirm="confirmDeleteTimeline"
        @cancel="onTimelineDeleteDialogCancel"
      />
    </section>

    <section class="card" v-if="activeTab === 'characters'">
      <label style="display: block; margin-bottom: 10px">
        筛选角色（关键字）
        <input v-model="characterKeywordFilter" maxlength="30" />
      </label>
      <p v-if="selectedCategoryFilterId" class="muted" style="margin-bottom: 8px">
        当前筛选：{{ selectedCategoryFilterName || '未命名分类' }}（{{ filteredCharacters.length }}/{{ characters.length }}）
      </p>
      <div class="faction-row__attrs" style="margin-bottom: 12px">
        <small
          class="muted faction-row__attr-chip"
          :class="{ 'workspace-dd__item--active': !selectedCategoryFilterId }"
          @click="clearCategoryFilter"
        >
          全部
        </small>
        <small
          v-for="cat in categories"
          :key="`cfilter-${cat.id}`"
          class="muted faction-row__attr-chip"
          :class="{ 'workspace-dd__item--active': selectedCategoryFilterId === cat.id }"
          @click="setCategoryFilter(cat.id)"
        >
          {{ cat.name }}
        </small>
      </div>
      <section v-if="filteredCharacters.length === 0" class="panel characters-empty">
        <h2>角色</h2>
        <p class="muted">暂无角色</p>
        <div class="action-row">
          <button type="button" class="btn-primary" @click="openCharacterCreate">新增角色</button>
        </div>
      </section>

      <section class="panel characters-graph-block" v-else>
        <h2 class="characters-graph-block__title">角色</h2>

        <div class="characters-graph-ui">
          <div class="characters-graph-ui__left">
            <div class="characters-graph-3d-wrap">
              <CharacterRelationSphere
                :characters="filteredCharacters"
                :relations="filteredCharacterRelations"
                :focus-character-id="graphFocusCharacterId"
                @select="onSphereSelect"
              />

              <button type="button" class="characters-graph-3d-add" @click="openCharacterCreate">
                新增角色
              </button>
            </div>

            <div class="characters-graph-ui__viz">
              <div class="characters-graph-ui__viz-main">
                <CharacterRelationFocusSphere
                  v-if="graphFocusCharacterId && visibleCharacters.length > 0"
                  selectable
                  :characters="visibleCharacters"
                  :relations="relatedRelations"
                  :focus-character-id="graphFocusCharacterId"
                  @select="onFocusSphereNodeSelect"
                />

                <p v-else class="muted">暂无关系。</p>
              </div>
            </div>
          </div>

          <div class="characters-graph-ui__right">
            <article class="characters-graph-ui__section character-panel">
              <header class="character-panel__head">
                <h3 class="character-panel__title">档案</h3>
              </header>

              <div v-if="selectedGraphCharacter" class="character-panel__main">
                <template v-if="!characterEditMode">
                  <div class="character-panel__body">
                    <div class="character-panel__hero">
                      <p class="character-panel__name">{{ selectedGraphCharacter.name }}</p>
                      <span class="character-panel__chip">
                        {{
                          selectedGraphCharacter.firstAppearanceChapterNo != null
                            ? `首见 · 第 ${selectedGraphCharacter.firstAppearanceChapterNo} 章`
                            : '首见 · 未标注'
                        }}
                      </span>
                    </div>

                    <dl class="character-panel__spec">
                      <div class="character-panel__spec-item">
                        <dt>年龄</dt>
                        <dd>{{ selectedGraphCharacter.age || '—' }}</dd>
                      </div>
                      <div class="character-panel__spec-item">
                        <dt>性别</dt>
                        <dd>{{ selectedGraphCharacter.gender || '—' }}</dd>
                      </div>
                      <div class="character-panel__spec-item character-panel__spec-item--block">
                        <dt>所属势力</dt>
                        <dd>
                          <ul
                            v-if="graphCharacterMemberships.length > 0"
                            class="character-panel__faction-list"
                          >
                            <li v-for="m in graphCharacterMemberships" :key="m.factionId">
                              <strong>{{ factionNameById(m.factionId) }}</strong>
                              <span v-if="(m.description ?? '').trim()" class="muted">
                                — {{ m.description }}
                              </span>
                            </li>
                          </ul>
                          <template v-else>—</template>
                        </dd>
                      </div>
                      <div class="character-panel__spec-item character-panel__spec-item--block">
                        <dt>分类</dt>
                        <dd>
                          <ul v-if="categoryNamesByIds(selectedGraphCharacter.categoryIds).length" class="character-panel__faction-list">
                            <li v-for="name in categoryNamesByIds(selectedGraphCharacter.categoryIds)" :key="`cc-${name}`">
                              <strong>{{ name }}</strong>
                            </li>
                          </ul>
                          <template v-else>—</template>
                        </dd>
                      </div>
                    </dl>

                    <section class="character-panel__block">
                      <h4 class="character-panel__block-title">扩展条目</h4>
                      <ul
                        v-if="(selectedGraphCharacter.attributes?.length ?? 0) > 0"
                        class="character-panel__extra-list"
                      >
                        <li
                          v-for="a in selectedGraphCharacter.attributes"
                          :key="a.id"
                          class="character-panel__extra"
                        >
                          <span class="character-panel__extra-key">{{ a.key }}</span>
                          <p class="character-panel__extra-val">{{ a.value }}</p>
                        </li>
                      </ul>
                      <p v-else class="character-panel__empty">无扩展条目</p>
                    </section>
                  </div>
                </template>

                <template v-else>
                  <div class="character-panel__body character-panel__body--edit">
                    <p v-if="characterEditError" class="character-panel__alert">{{ characterEditError }}</p>

                    <div class="character-panel__form-grid">
                      <label class="character-panel__field">
                        <span class="character-panel__field-label">姓名</span>
                        <input v-model="characterDraft.name" class="character-panel__input" maxlength="40" />
                      </label>
                      <label class="character-panel__field">
                        <span class="character-panel__field-label">首次出场</span>
                        <div class="workspace-dd">
                          <button
                            type="button"
                            class="workspace-dd__btn workspace-dd__btn--compact"
                            :class="{ 'workspace-dd__btn--open': characterFirstAppearDropdownOpen }"
                            @click="toggleCharacterFirstAppearDropdown"
                          >
                            <span class="workspace-dd__btn-text">{{ characterFirstAppearDropdownLabel }}</span>
                            <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                          </button>
                          <div
                            v-if="characterFirstAppearDropdownOpen"
                            class="workspace-dd__panel scrollbar-paper"
                            role="listbox"
                          >
                            <button
                              type="button"
                              class="workspace-dd__item"
                              :class="{ 'workspace-dd__item--active': characterDraft.firstAppearanceChapterNo === '' }"
                              @click="selectCharacterFirstAppearance('')"
                            >
                              未设置
                            </button>
                            <button
                              v-for="ch in chapters"
                              :key="`fa-${ch.id}`"
                              type="button"
                              class="workspace-dd__item"
                              :class="{
                                'workspace-dd__item--active':
                                  characterDraft.firstAppearanceChapterNo === String(ch.chapterNo),
                              }"
                              @click="selectCharacterFirstAppearance(String(ch.chapterNo))"
                            >
                              第 {{ ch.chapterNo }} 章 · {{ ch.title }}
                            </button>
                          </div>
                        </div>
                      </label>
                      <section class="character-panel__block character-panel__block--edit">
                        <div class="character-panel__block-head">
                          <h4 class="character-panel__block-title">所属势力</h4>
                          <span class="character-panel__block-hint">可加入多个；同一势力仅一条</span>
                        </div>
                        <div
                          v-for="(row, idx) in characterDraft.membershipRows"
                          :key="`mem-${idx}-${row.factionId}`"
                          class="character-panel__custom-card"
                        >
                          <label class="character-panel__field character-panel__field--tight">
                            <span class="character-panel__field-label">势力</span>
                            <select v-model="row.factionId" class="character-panel__input">
                              <option value="">选择势力</option>
                              <option v-for="f in factions" :key="`cfd-${f.id}`" :value="f.id">{{ f.name }}</option>
                            </select>
                          </label>
                          <label class="character-panel__field">
                            <span class="character-panel__field-label">在该势力中的描述（最多 120 字）</span>
                            <input
                              v-model="row.description"
                              type="text"
                              class="character-panel__input"
                              maxlength="120"
                            />
                          </label>
                          <button
                            type="button"
                            class="character-panel__icon-btn"
                            title="移除此条"
                            @click="removeCharacterDraftMembershipRow(idx)"
                          >
                            移除
                          </button>
                        </div>
                        <button
                          type="button"
                          class="character-panel__btn character-panel__btn--dashed"
                          @click="addCharacterDraftMembershipRow"
                        >
                          ＋ 添加势力关联
                        </button>
                      </section>
                      <label class="character-panel__field">
                        <span class="character-panel__field-label">年龄</span>
                        <input v-model="characterDraft.age" class="character-panel__input" maxlength="20" />
                      </label>
                      <label class="character-panel__field">
                        <span class="character-panel__field-label">性别</span>
                        <select v-model="characterDraft.gender" class="character-panel__input">
                          <option value="">未设置</option>
                          <option value="男">男</option>
                          <option value="女">女</option>
                          <option value="非二元">非二元</option>
                          <option value="其他">其他</option>
                        </select>
                      </label>
                    </div>

                    <section class="character-panel__block character-panel__block--edit">
                      <div class="character-panel__block-head">
                        <h4 class="character-panel__block-title">扩展条目</h4>
                        <span class="character-panel__block-hint">名与说明需成对填写</span>
                      </div>
                      <div
                        v-for="a in characterDraft.attributes"
                        :key="a.id"
                        class="character-panel__custom-card"
                      >
                        <label class="character-panel__field character-panel__field--tight">
                          <span class="character-panel__field-label">名称</span>
                          <input v-model="a.key" class="character-panel__input" maxlength="40" />
                        </label>
                        <label class="character-panel__field">
                          <span class="character-panel__field-label">说明</span>
                          <input v-model="a.value" class="character-panel__input" maxlength="80" />
                        </label>
                        <button
                          type="button"
                          class="character-panel__icon-btn"
                          title="移除此条"
                          @click="removeCharacterDraftRow(a.id)"
                        >
                          移除
                        </button>
                      </div>
                      <button type="button" class="character-panel__btn character-panel__btn--dashed" @click="addCharacterDraftRow">
                        ＋ 新建条目
                      </button>
                    </section>
                  </div>
                </template>

                <footer class="character-panel__foot">
                  <template v-if="!characterEditMode">
                    <button type="button" class="character-panel__btn character-panel__btn--primary" @click="startCharacterEdit">
                      编辑
                    </button>
                  </template>
                  <template v-else>
                    <button type="button" class="character-panel__btn character-panel__btn--primary" @click="saveCharacterEdit">
                      保存
                    </button>
                    <button type="button" class="character-panel__btn character-panel__btn--ghost" @click="cancelCharacterEdit">
                      取消
                    </button>
                  </template>
                  <button
                    type="button"
                    class="character-panel__btn character-panel__btn--danger"
                    @click="openCharacterDelete(selectedGraphCharacter.id)"
                  >
                    删除角色
                  </button>
                </footer>
              </div>

              <p v-else class="character-panel__placeholder">在上方图谱中选择角色以查看档案</p>
            </article>

            <section class="characters-graph-ui__section characters-graph-ui__toolbar">
              <label class="characters-graph-ui__field">
                <span class="characters-graph-ui__field-label">当前聚焦角色</span>
                <select v-model="graphFocusCharacterId" class="characters-graph-ui__select">
                  <option v-for="c in filteredCharacters" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </label>

              <CharacterGraphRelationToolbar
                v-model:link-mode="graph3dLinkMode"
                :novel-id="novelId"
                :focus-character-id="graphFocusCharacterId"
                :pair-character-id="graphFocusSphereSelectedId"
                :characters="characters"
                :relations="characterRelations"
                @relations-changed="onCharacterRelationsChanged"
              />
            </section>

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
          </div>
        </div>
      </section>

      <!-- 新增角色弹框 -->
      <Teleport to="body">
        <Transition name="confirm">
          <div
            v-if="characterCreateOpen"
            class="confirm-overlay"
            role="presentation"
            @click.self="closeCharacterCreate"
          >
            <div class="confirm-dialog" role="dialog" aria-modal="true">
              <div class="confirm-dialog__body">
                <h2 class="confirm-dialog__title">新增角色</h2>

                <form class="form-grid" @submit.prevent="submitCreateCharacter">
                  <div class="grid-4">
                    <label>
                      角色名 *
                      <input v-model="characterForm.name" maxlength="40" required />
                    </label>
                    <label>
                      首次出场章节
                      <select v-model="characterForm.firstAppearanceChapterNo">
                        <option value="">未设置</option>
                        <option v-for="ch in chapters" :key="`create-fa-${ch.id}`" :value="String(ch.chapterNo)">
                          第 {{ ch.chapterNo }} 章 · {{ ch.title }}
                        </option>
                      </select>
                    </label>
                    <label>
                      年龄
                      <input v-model="characterForm.age" maxlength="20" />
                    </label>
                    <label>
                      性别
                      <select v-model="characterForm.gender">
                        <option value="">未设置</option>
                        <option value="男">男</option>
                        <option value="女">女</option>
                        <option value="非二元">非二元</option>
                        <option value="其他">其他</option>
                      </select>
                    </label>
                  </div>

                  <div class="character-custom-fields character-custom-fields--modal">
                    <p class="character-custom-list__title">所属势力（可选，可多选）</p>
                    <div
                      v-for="(row, idx) in characterForm.membershipRows"
                      :key="`cm-${idx}`"
                      class="character-custom-fields__row"
                    >
                      <label class="character-custom-fields__pair">
                        势力
                        <select v-model="row.factionId">
                          <option value="">选择势力</option>
                          <option v-for="f in factions" :key="`cfm-${f.id}`" :value="f.id">{{ f.name }}</option>
                        </select>
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

                  <div class="character-custom-fields character-custom-fields--modal">
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

                  <div class="confirm-dialog__actions">
                    <button
                      type="button"
                      class="confirm-dialog__btn confirm-dialog__btn--ghost"
                      @click="closeCharacterCreate"
                    >
                      取消
                    </button>
                    <button type="submit" class="btn-primary">确定</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </section>

    <section class="card" v-if="activeTab === 'factions'">
      <h2>势力</h2>

      <h3 class="workspace-subsection-title">新建势力</h3>
      <p v-if="factionSavedNotice" class="faction-edit-saved-note">已保存</p>
      <form class="form-grid" @submit.prevent="handleCreateFaction">
        <label>
          势力名 *
          <input v-model="factionForm.name" maxlength="50" required />
        </label>
        <div class="character-custom-fields faction-custom-fields">
          <div class="faction-custom-fields__head">
            <p class="character-custom-list__title">自定义字段（可选）</p>
            <button type="button" class="faction-custom-fields__btn" @click="addFactionFormAttrRow">添加一行</button>
          </div>
          <div v-for="a in factionForm.attributes" :key="a.id" class="character-custom-fields__row">
            <label class="character-custom-fields__pair">
              字段名
              <input v-model="a.key" class="character-custom-fields__input" maxlength="40" />
            </label>
            <label class="character-custom-fields__pair">
              内容
              <input v-model="a.value" class="character-custom-fields__input" maxlength="80" />
            </label>
            <button type="button" class="btn-danger character-custom-fields__remove" @click="removeFactionFormAttrRow(a.id)">
              删除
            </button>
          </div>
        </div>
        <p v-if="factionFormError" class="muted" style="color: var(--danger-text); margin-top: 6px">
          {{ factionFormError }}
        </p>
        <div class="action-row">
          <button type="submit">新增势力</button>
        </div>
      </form>

      <p v-if="filteredFactions.length === 0 && !factionKeywordFilter && !selectedCategoryFilterId" class="muted">暂无势力</p>
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
              v-for="cat in categories"
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
              <strong class="faction-row__title">{{ f.name }}</strong>
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
            <div v-if="(f.attributes?.length ?? 0) > 0" class="faction-row__attrs">
              <small v-for="attr in f.attributes" :key="attr.id" class="muted faction-row__attr-chip">
                {{ attr.key }}：{{ attr.value }}
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
        <div v-if="factionEditOpen" class="confirm-overlay" role="presentation" @click.self="requestCloseFactionEdit">
          <div class="confirm-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body">
              <h2 class="confirm-dialog__title">修改势力</h2>
              <div class="form-grid" style="margin-top: 12px">
                <label>
                  势力名
                  <input v-model="factionEditDraft.name" maxlength="50" />
                </label>
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
                  <small
                    v-for="c in factionEditMemberOptionsModal"
                    :key="`femd-${c.id}`"
                    class="muted faction-row__attr-chip category-bind-chip"
                    :class="factionEditDraft.memberCharIds.includes(c.id) ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'"
                    @click="toggleFactionEditMemberModal(c.id)"
                  >
                    <span class="category-bind-chip__state">{{ factionEditDraft.memberCharIds.includes(c.id) ? '已绑定' : '未绑定' }}</span>
                    {{ c.name }}
                  </small>
                </div>
              </div>

              <div class="character-custom-fields faction-custom-fields" style="margin-top: 14px">
                <div class="faction-custom-fields__head">
                  <p class="character-custom-list__title">自定义字段</p>
                  <button type="button" class="faction-custom-fields__btn" @click="addFactionEditAttrRowModal">添加一行</button>
                </div>
                <div v-for="a in factionEditDraft.attributes" :key="a.id" class="character-custom-fields__row">
                  <label class="character-custom-fields__pair">
                    字段名
                    <input v-model="a.key" class="character-custom-fields__input" maxlength="40" />
                  </label>
                  <label class="character-custom-fields__pair">
                    内容
                    <input v-model="a.value" class="character-custom-fields__input" maxlength="80" />
                  </label>
                  <button type="button" class="btn-danger character-custom-fields__remove" @click="removeFactionEditAttrRowModal(a.id)">
                    删除
                  </button>
                </div>
              </div>

              <p v-if="factionFormError" class="muted" style="color: var(--danger-text); margin-top: 10px">
                {{ factionFormError }}
              </p>

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

    <section class="card" v-if="activeTab === 'categories'">
      <h2>分类</h2>
      <form class="form-grid" @submit.prevent="createCategoryFromCenter">
        <label>
          新分类名
          <input v-model="categoryCreateName" maxlength="24" />
        </label>
        <label>
          分类备注
          <input v-model="categoryCreateNotes" maxlength="200" />
        </label>
        <div class="action-row">
          <button type="submit">添加分类</button>
        </div>
      </form>
      <div class="grid-2" style="margin: 8px 0 14px">
        <label>
          搜索角色
          <input v-model="categoryBindCharacterQuery" maxlength="24" />
        </label>
        <label>
          搜索势力
          <input v-model="categoryBindFactionQuery" maxlength="24" />
        </label>
      </div>

      <p v-if="categories.length === 0" class="muted">暂无分类</p>
      <ul v-else class="list">
        <li v-for="cat in categories" :key="cat.id" class="list-item">
          <div class="chapter-main">
            <div class="faction-row__head">
              <strong class="faction-row__title">{{ cat.name }}</strong>
              <div class="action-row action-row--inline">
                <button type="button" class="faction-row__edit" @click="openCategoryEdit(cat.id)">修改</button>
                <button
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--ghost"
                  :disabled="!categoryBindingDirty(cat.id)"
                  @click="cancelCategoryBindingChanges(cat.id)"
                >
                  取消更改
                </button>
                <button
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--danger"
                  :disabled="!categoryBindingDirty(cat.id)"
                  @click="saveCategoryBindingChanges(cat.id)"
                >
                  确定更改
                </button>
              </div>
            </div>
            <p v-if="(cat.notes ?? '').trim()" class="muted" style="margin: 6px 0 10px">
              分类备注：{{ cat.notes }}
            </p>
            <div class="character-custom-fields faction-custom-fields">
              <div class="faction-custom-fields__head">
                <p class="character-custom-list__title">绑定角色</p>
              </div>
              <div class="faction-row__attrs">
                <small
                  v-for="c in categoryCenterCharacters"
                  :key="`cat-char-${cat.id}-${c.id}`"
                  class="muted faction-row__attr-chip category-bind-chip"
                  :class="categoryHasCharacter(cat.id, c.id) ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'"
                  @click="toggleCharacterCategory(cat.id, c.id)"
                >
                  <span class="category-bind-chip__state">{{ categoryHasCharacter(cat.id, c.id) ? '已绑定' : '未绑定' }}</span>
                  {{ c.name }}
                </small>
              </div>
            </div>
            <div class="character-custom-fields faction-custom-fields">
              <div class="faction-custom-fields__head">
                <p class="character-custom-list__title">绑定势力</p>
              </div>
              <div class="faction-row__attrs">
                <small
                  v-for="f in categoryCenterFactions"
                  :key="`cat-fac-${cat.id}-${f.id}`"
                  class="muted faction-row__attr-chip category-bind-chip"
                  :class="categoryHasFaction(cat.id, f.id) ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'"
                  @click="toggleFactionCategory(cat.id, f.id)"
                >
                  <span class="category-bind-chip__state">{{ categoryHasFaction(cat.id, f.id) ? '已绑定' : '未绑定' }}</span>
                  {{ f.name }}
                </small>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <Teleport to="body">
      <Transition name="confirm">
        <div v-if="categoryEditOpen" class="confirm-overlay" role="presentation" @click.self="requestCloseCategoryEdit">
          <div class="confirm-dialog" role="dialog" aria-modal="true">
            <div class="confirm-dialog__accent" aria-hidden="true" />
            <div class="confirm-dialog__body">
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

    <section class="card" v-if="activeTab === 'issues'">
      <h2>伏笔 / 坑点</h2>

      <form class="form-grid" @submit.prevent="handleCreateIssue">
        <div class="grid-3">
          <label>
            问题标题 *
            <input
              v-model="issueForm.title"
              maxlength="80"
              required
            />
          </label>
          <label>
            问题类型
            <select v-model="issueForm.type">
              <option value="foreshadow">伏笔</option>
              <option value="logic">逻辑</option>
              <option value="timeline">时间线</option>
              <option value="motivation">动机</option>
              <option value="other">其他</option>
            </select>
          </label>
          <label>
            处理计划
            <input v-model="issueForm.plan" maxlength="120" />
          </label>
        </div>
        <label>
          备注
          <input v-model="issueForm.notes" maxlength="200" />
        </label>
        <div class="action-row">
          <button type="submit">新增问题</button>
        </div>
      </form>

      <p v-if="issues.length === 0" class="muted">暂无记录</p>
      <ul v-else class="list">
        <li v-for="i in issues" :key="i.id" class="list-item">
          <div class="chapter-main">
            <strong>{{ i.title }}</strong>
            <small class="muted">类型：{{ issueTypeText(i.type) }} · 状态：{{ issueStatusText(i.status) }}</small>
            <small class="muted">处理计划：{{ i.plan || '未设置' }}</small>
            <input
              class="inline-input"
              :value="i.notes"
              maxlength="200"
              @change="onIssueNotesChange(i.id, $event)"
            />
          </div>
          <div class="chapter-actions">
            <button type="button" @click="cycleIssueStatus(i.id)">切换状态</button>
          </div>
        </li>
      </ul>
    </section>
  </section>

  <section v-else class="page-block">
    <div class="card">
      <h2>作品不存在</h2>
      <p class="muted">这个作品可能已被删除，或链接无效。</p>
      <button type="button" class="link-back btn-as-link" @click="backFromPage">返回</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  createCategory,
  createCharacter,
  createFaction,
  createIssue,
  createOutlineItem,
  createTimelineEvent,
  deleteCharacter,
  deleteFaction,
  deleteOutlineItem,
  replaceMembershipsForCharacter,
  replaceMembershipsForFaction,
  deleteTimelineEvent,
  updateCategory,
  getCharacterFactionMembershipsByNovelId,
  getCategoriesByNovelId,
  getCharactersByNovelId,
  getChaptersByNovelId,
  getCharacterRelationsByNovelId,
  getFactionsByNovelId,
  getIssuesByNovelId,
  getNovelById,
  getOutlineByNovelId,
  getTimelineByNovelId,
  moveOutlineItem,
  moveTimelineEvent,
  updateCharacter,
  updateFaction,
  updateChapter,
  updateIssue,
  updateOutlineItem,
  updateTimelineEvent,
} from '../../lib/storage'
import { setChromeAnchor } from '../../composables/useChromeAnchor'
import type {
  Category,
  Character,
  Chapter,
  CharacterAttribute,
  CharacterFactionMembership,
  CharacterRelation,
  Faction,
  NewCharacterInput,
  IssueStatus,
  IssueType,
  OutlineItem,
  OutlineStatus,
  StoryIssue,
  TimelineEvent,
} from '../../types'
import CharacterGraphRelationToolbar from '../../components/CharacterGraphRelationToolbar.vue'
import CharacterRelationSphere from '../../components/CharacterRelationSphere.vue'
import CharacterRelationFocusSphere from '../../components/CharacterRelationFocusSphere.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const workspaceChromeAnchorRef = ref<HTMLElement | null>(null)
watch(workspaceChromeAnchorRef, (el) => setChromeAnchor(el), { immediate: true })
onUnmounted(() => setChromeAnchor(null))

const novelId = computed(() => String(route.params.id ?? ''))
const novel = computed(() => getNovelById(novelId.value))
const activeTab = ref<'write' | 'outline' | 'timeline' | 'characters' | 'factions' | 'categories' | 'issues'>('write')
const lastTabBeforeCharacters = ref<'write' | 'outline' | 'timeline' | 'factions' | 'categories' | 'issues' | ''>('')
const chapters = ref<Chapter[]>([])
const outlineItems = ref<OutlineItem[]>([])
const expandedOutlineId = ref<string>('')

// 删除情节点：使用自定义弹窗替代原生 confirm()
const outlineDeleteOpen = ref(false)
const outlineDeleteId = ref<string>('')

const characters = ref<Character[]>([])
const characterRelations = ref<CharacterRelation[]>([])
const factions = ref<Faction[]>([])
const categories = ref<Category[]>([])
const categoryCreateName = ref('')
const categoryCreateNotes = ref('')
const categoryEditOpen = ref(false)
const categoryEditId = ref('')
const categoryEditDraft = reactive({ name: '', notes: '' })
const categoryEditInitial = ref({ name: '', notes: '' })
const categoryEditCancelConfirmOpen = ref(false)
const selectedCategoryFilterId = ref('')
const characterKeywordFilter = ref('')
const factionKeywordFilter = ref('')
const categoryBindCharacterQuery = ref('')
const categoryBindFactionQuery = ref('')
const categoryCharacterDraftById = ref<Record<string, string[]>>({})
const categoryFactionDraftById = ref<Record<string, string[]>>({})
const characterFactionMemberships = ref<CharacterFactionMembership[]>([])
const issues = ref<StoryIssue[]>([])
const timelineEvents = ref<TimelineEvent[]>([])
const timelineForm = reactive({
  storyLabel: '',
  title: '',
  summary: '',
  chapterNoStart: '',
  chapterNoEnd: '',
  outlineItemId: '',
})
const timelineDeleteOpen = ref(false)
const timelineDeleteId = ref<string>('')
const outlineForm = reactive({
  title: '',
  summary: '',
})
const characterForm = reactive({
  name: '',
  firstAppearanceChapterNo: '',
  age: '',
  gender: '',
  attributes: [] as CharacterAttribute[],
  /** 新建角色时加入的势力及描述 */
  membershipRows: [] as { factionId: string; description: string }[],
})
const characterCreateError = ref('')
const factionFormError = ref('')
const characterCreateOpen = ref(false)
const factionForm = reactive({
  name: '',
  attributes: [] as CharacterAttribute[],
})
const factionEditOpen = ref(false)
const factionEditId = ref('')
const factionEditDraft = reactive({
  name: '',
  attributes: [] as CharacterAttribute[],
  memberQuery: '',
  memberCharIds: [] as string[],
  memberDescByCharId: {} as Record<string, string>,
})
const factionEditInitial = ref({
  name: '',
  attrs: [] as Array<{ key: string; value: string }>,
  memberCharIds: [] as string[],
  memberDescByCharId: {} as Record<string, string>,
})
const factionEditCancelConfirmOpen = ref(false)
const factionSavedNotice = ref(false)
type FactionEditMembershipRow = {
  characterId: string
  description: string
}
// （势力编辑）改为弹窗草稿形态，memberQuery/memberCharIds 在 factionEditDraft 内维护
const issueForm = reactive({
  title: '',
  type: 'foreshadow' as IssueType,
  plan: '',
  notes: '',
})
const characterDeleteOpen = ref(false)
const pendingDeleteCharacterId = ref<string | null>(null)
const factionDeleteOpen = ref(false)
const pendingDeleteFactionId = ref<string | null>(null)

// 角色关系网：当前聚焦角色（用于显示/编辑属性与关系）
const graphFocusCharacterId = ref<string>('')
/** 右侧「角色信息」：须先点「修改」，再点「保存」 */
const characterEditMode = ref(false)
const characterEditError = ref('')
const characterDraft = reactive({
  name: '',
  firstAppearanceChapterNo: '',
  age: '',
  gender: '',
  attributes: [] as CharacterAttribute[],
  membershipRows: [] as { factionId: string; description: string }[],
})
const timelineChapterDropdownOpen = ref(false)
const timelineChapterEndDropdownOpen = ref(false)
const timelineOutlineDropdownOpen = ref(false)
const characterFirstAppearDropdownOpen = ref(false)
const timelineEventChapterStartDropdownOpenId = ref('')
const timelineEventChapterEndDropdownOpenId = ref('')
const timelineEventOutlineDropdownOpenId = ref('')
const graphAttributeKey = ref('')
const graphAttributeValue = ref('')

/** 与章节写作弹窗同款：编辑关系 / 已有关系列表 */
const graph3dLinkMode = ref(false)
/** 下方聚焦 3D 图中点击的节点（非中心时展示与中心的双向关系） */
const graphFocusSphereSelectedId = ref('')

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

const characterFirstAppearDropdownLabel = computed(() => {
  if (!characterDraft.firstAppearanceChapterNo) return '未设置'
  const no = Number(characterDraft.firstAppearanceChapterNo)
  const ch = chapters.value.find((x) => x.chapterNo === no)
  return ch ? `第 ${ch.chapterNo} 章 · ${ch.title}` : '未设置'
})

function selectTimelineChapter(value: string): void {
  timelineForm.chapterNoStart = value
  timelineChapterDropdownOpen.value = false
}

function toggleTimelineChapterDropdown(): void {
  timelineChapterDropdownOpen.value = !timelineChapterDropdownOpen.value
  if (timelineChapterDropdownOpen.value) {
    timelineChapterEndDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    characterFirstAppearDropdownOpen.value = false
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
    timelineChapterDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    characterFirstAppearDropdownOpen.value = false
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
    timelineChapterDropdownOpen.value = false
    timelineChapterEndDropdownOpen.value = false
    characterFirstAppearDropdownOpen.value = false
    timelineEventChapterStartDropdownOpenId.value = ''
    timelineEventChapterEndDropdownOpenId.value = ''
    timelineEventOutlineDropdownOpenId.value = ''
  }
}

function selectCharacterFirstAppearance(value: string): void {
  characterDraft.firstAppearanceChapterNo = value
  characterFirstAppearDropdownOpen.value = false
}

function toggleCharacterFirstAppearDropdown(): void {
  characterFirstAppearDropdownOpen.value = !characterFirstAppearDropdownOpen.value
  if (characterFirstAppearDropdownOpen.value) {
    timelineChapterDropdownOpen.value = false
    timelineChapterEndDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
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
    timelineEventChapterEndDropdownOpenId.value = ''
    timelineEventOutlineDropdownOpenId.value = ''
    timelineChapterDropdownOpen.value = false
    timelineChapterEndDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    characterFirstAppearDropdownOpen.value = false
  }
}

function toggleTimelineEventChapterEndDropdown(eventId: string): void {
  timelineEventChapterEndDropdownOpenId.value =
    timelineEventChapterEndDropdownOpenId.value === eventId ? '' : eventId
  if (timelineEventChapterEndDropdownOpenId.value) {
    timelineEventChapterStartDropdownOpenId.value = ''
    timelineEventOutlineDropdownOpenId.value = ''
    timelineChapterDropdownOpen.value = false
    timelineChapterEndDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    characterFirstAppearDropdownOpen.value = false
  }
}

function toggleTimelineEventOutlineDropdown(eventId: string): void {
  timelineEventOutlineDropdownOpenId.value =
    timelineEventOutlineDropdownOpenId.value === eventId ? '' : eventId
  if (timelineEventOutlineDropdownOpenId.value) {
    timelineEventChapterStartDropdownOpenId.value = ''
    timelineEventChapterEndDropdownOpenId.value = ''
    timelineChapterDropdownOpen.value = false
    timelineChapterEndDropdownOpen.value = false
    timelineOutlineDropdownOpen.value = false
    characterFirstAppearDropdownOpen.value = false
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

function closeWorkspaceDropdowns(): void {
  timelineChapterDropdownOpen.value = false
  timelineChapterEndDropdownOpen.value = false
  timelineOutlineDropdownOpen.value = false
  characterFirstAppearDropdownOpen.value = false
  timelineEventChapterStartDropdownOpenId.value = ''
  timelineEventChapterEndDropdownOpenId.value = ''
  timelineEventOutlineDropdownOpenId.value = ''
}

function onCharacterRelationsChanged(): void {
  characterRelations.value = getCharacterRelationsByNovelId(novelId.value)
}

function onFocusSphereNodeSelect(id: string): void {
  if (id === graphFocusCharacterId.value) {
    graphFocusSphereSelectedId.value = ''
    return
  }
  graphFocusSphereSelectedId.value = id
}

watch(
  novelId,
  (id) => {
    chapters.value = getChaptersByNovelId(id)
    outlineItems.value = getOutlineByNovelId(id)
    characters.value = getCharactersByNovelId(id)
    characterRelations.value = getCharacterRelationsByNovelId(id)
    graphFocusCharacterId.value = characters.value[0]?.id ?? ''
    factions.value = getFactionsByNovelId(id)
    categories.value = getCategoriesByNovelId(id)
    characterFactionMemberships.value = getCharacterFactionMembershipsByNovelId(id)
    issues.value = getIssuesByNovelId(id)
    timelineEvents.value = getTimelineByNovelId(id)
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
  characterEditMode.value = false
  characterEditError.value = ''
  graph3dLinkMode.value = false
  graphFocusSphereSelectedId.value = ''
  closeWorkspaceDropdowns()
})

/** 使用 click 冒泡阶段：避免 capture 阶段先关掉下拉导致同一次点击无法触发按钮 */
function onWorkspaceClickOutside(e: MouseEvent): void {
  const anyDdOpen =
    timelineChapterDropdownOpen.value ||
    timelineChapterEndDropdownOpen.value ||
    timelineOutlineDropdownOpen.value ||
    characterFirstAppearDropdownOpen.value ||
    !!timelineEventChapterStartDropdownOpenId.value ||
    !!timelineEventChapterEndDropdownOpenId.value ||
    !!timelineEventOutlineDropdownOpenId.value
  if (!anyDdOpen) return
  const t = e.target as HTMLElement | null
  if (!t) return
  if (t.closest('.workspace-dd')) return
  closeWorkspaceDropdowns()
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', onWorkspaceClickOutside, false)
}

watch(characterCreateOpen, (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open ? 'hidden' : ''
})

function openCharacterCreate(): void {
  closeWorkspaceDropdowns()
  characterCreateError.value = ''
  characterForm.name = ''
  characterForm.firstAppearanceChapterNo = ''
  characterForm.age = ''
  characterForm.gender = ''
  characterForm.attributes = []
  characterForm.membershipRows = []
  characterCreateOpen.value = true
}

function closeCharacterCreate(): void {
  characterCreateOpen.value = false
  characterCreateError.value = ''
}

function handleCreateOutline() {
  if (!novel.value) return
  createOutlineItem({
    novelId: novel.value.id,
    title: outlineForm.title,
    summary: outlineForm.summary,
  })
  outlineForm.title = ''
  outlineForm.summary = ''
  outlineItems.value = getOutlineByNovelId(novel.value.id)
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

function moveOutline(id: string, direction: 'up' | 'down') {
  moveOutlineItem(id, direction)
  outlineItems.value = getOutlineByNovelId(novelId.value)
}

function getLinkedChaptersCount(outlineId: string): number {
  return chapters.value.filter((c) => (c.outlineItemIds ?? []).includes(outlineId)).length
}

function toggleChapterOutline(chapterId: string, outlineId: string): void {
  const current = chapters.value.find((c) => c.id === chapterId)
  if (!current) return

  const set = new Set(current.outlineItemIds ?? [])
  if (set.has(outlineId)) set.delete(outlineId)
  else set.add(outlineId)

  updateChapter({ id: chapterId, outlineItemIds: Array.from(set) })
  chapters.value = getChaptersByNovelId(novelId.value)
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
      firstAppearanceChapterNo: characterForm.firstAppearanceChapterNo
        ? Number(characterForm.firstAppearanceChapterNo)
        : null,
      age: characterForm.age,
      gender: characterForm.gender,
      goal: '',
      secret: '',
      arc: '',
      notes: '',
      attributes: parsedAttrs.value,
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
  characterForm.firstAppearanceChapterNo = ''
  characterForm.age = ''
  characterForm.gender = ''
  characterForm.attributes = []
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
  graph3dLinkMode.value = false
  characterDeleteOpen.value = false
}

function onCharacterDeleteDialogCancel(): void {
  characterDeleteOpen.value = false
  pendingDeleteCharacterId.value = null
}

function startCharacterEdit(): void {
  const c = selectedGraphCharacter.value
  if (!c) return
  characterEditError.value = ''
  characterDraft.name = c.name
  characterDraft.firstAppearanceChapterNo =
    c.firstAppearanceChapterNo != null ? String(c.firstAppearanceChapterNo) : ''
  characterDraft.membershipRows = characterFactionMemberships.value
    .filter((m) => m.characterId === c.id)
    .map((m) => ({ factionId: m.factionId, description: m.description ?? '' }))
  characterDraft.age = c.age ?? ''
  characterDraft.gender = c.gender ?? ''
  characterDraft.attributes = (c.attributes ?? []).map((a) => ({
    id: a.id,
    key: a.key,
    value: a.value,
  }))
  characterEditMode.value = true
}

function cancelCharacterEdit(): void {
  characterEditMode.value = false
  characterEditError.value = ''
}

function saveCharacterEdit(): void {
  const c = selectedGraphCharacter.value
  if (!c || !novel.value) return
  const name = characterDraft.name.trim()
  if (!name) {
    characterEditError.value = '请填写角色名。'
    return
  }
  characterEditError.value = ''
  const parsedAttrs = parseAttributesInput(characterDraft.attributes)
  if (!parsedAttrs.ok) {
    characterEditError.value = parsedAttrs.message
    return
  }

  updateCharacter({
    id: c.id,
    name,
    firstAppearanceChapterNo: characterDraft.firstAppearanceChapterNo
      ? Number(characterDraft.firstAppearanceChapterNo)
      : null,
    age: characterDraft.age,
    gender: characterDraft.gender,
    goal: '',
    secret: '',
    arc: '',
    notes: '',
    attributes: parsedAttrs.value,
  })
  const memRows = characterDraft.membershipRows.filter((r) => r.factionId.trim())
  const seenF = new Set<string>()
  const uniq = memRows.filter((row) => {
    const id = row.factionId.trim()
    if (seenF.has(id)) return false
    seenF.add(id)
    return true
  })
  replaceMembershipsForCharacter(novelId.value, c.id, uniq)
  characters.value = getCharactersByNovelId(novelId.value)
  characterFactionMemberships.value = getCharacterFactionMembershipsByNovelId(novelId.value)
  characterEditMode.value = false
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

function addCharacterDraftRow(): void {
  characterDraft.attributes.push({ id: uid(), key: '', value: '' })
}

function removeCharacterDraftRow(id: string): void {
  const i = characterDraft.attributes.findIndex((x) => x.id === id)
  if (i >= 0) characterDraft.attributes.splice(i, 1)
}

function addCharacterFormRow(): void {
  characterForm.attributes.push({ id: uid(), key: '', value: '' })
}

function removeCharacterFormRow(id: string): void {
  const i = characterForm.attributes.findIndex((x) => x.id === id)
  if (i >= 0) characterForm.attributes.splice(i, 1)
}

function addCharacterFormMembershipRow(): void {
  characterForm.membershipRows.push({ factionId: '', description: '' })
}

function removeCharacterFormMembershipRow(index: number): void {
  characterForm.membershipRows.splice(index, 1)
}

function addCharacterDraftMembershipRow(): void {
  characterDraft.membershipRows.push({ factionId: '', description: '' })
}

function removeCharacterDraftMembershipRow(index: number): void {
  characterDraft.membershipRows.splice(index, 1)
}

function addFactionFormAttrRow(): void {
  factionForm.attributes.push({ id: uid(), key: '', value: '' })
}

function removeFactionFormAttrRow(id: string): void {
  const i = factionForm.attributes.findIndex((x) => x.id === id)
  if (i >= 0) factionForm.attributes.splice(i, 1)
}

function addFactionEditAttrRowModal(): void {
  factionEditDraft.attributes.push({ id: uid(), key: '', value: '' })
}

function removeFactionEditAttrRowModal(id: string): void {
  const i = factionEditDraft.attributes.findIndex((x) => x.id === id)
  if (i >= 0) factionEditDraft.attributes.splice(i, 1)
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
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
  return characters.value.filter((c) => {
    if (cid && !(c.categoryIds ?? []).includes(cid)) return false
    if (!q) return true
    return c.name.toLowerCase().includes(q)
  })
})

const filteredFactions = computed(() => {
  const cid = selectedCategoryFilterId.value
  const q = factionKeywordFilter.value.trim().toLowerCase()
  return factions.value.filter((f) => {
    if (cid && !(f.categoryIds ?? []).includes(cid)) return false
    if (!q) return true
    return f.name.toLowerCase().includes(q)
  })
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

function createCategoryFromCenter(): void {
  if (!novel.value) return
  const name = categoryCreateName.value.trim()
  if (!name) return
  const existed = categories.value.find((c) => c.name.toLowerCase() === name.toLowerCase())
  if (existed) {
    categoryCreateName.value = ''
    categoryCreateNotes.value = ''
    return
  }
  const created = createCategory({ novelId: novel.value.id, name })
  updateCategory({ id: created.id, notes: categoryCreateNotes.value })
  categories.value = getCategoriesByNovelId(novel.value.id)
  categoryCreateName.value = ''
  categoryCreateNotes.value = ''
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

const categoryCenterCharacters = computed(() => {
  const q = categoryBindCharacterQuery.value.trim().toLowerCase()
  if (!q) return characters.value
  return characters.value.filter((c) => c.name.toLowerCase().includes(q))
})

const categoryCenterFactions = computed(() => {
  const q = categoryBindFactionQuery.value.trim().toLowerCase()
  if (!q) return factions.value
  return factions.value.filter((f) => f.name.toLowerCase().includes(q))
})

function getCharacterIdsByCategory(categoryId: string): string[] {
  return characters.value.filter((c) => (c.categoryIds ?? []).includes(categoryId)).map((c) => c.id)
}

function getFactionIdsByCategory(categoryId: string): string[] {
  return factions.value.filter((f) => (f.categoryIds ?? []).includes(categoryId)).map((f) => f.id)
}

function ensureCategoryDraft(categoryId: string): void {
  if (!categoryCharacterDraftById.value[categoryId]) {
    categoryCharacterDraftById.value[categoryId] = getCharacterIdsByCategory(categoryId)
  }
  if (!categoryFactionDraftById.value[categoryId]) {
    categoryFactionDraftById.value[categoryId] = getFactionIdsByCategory(categoryId)
  }
}

function categoryHasCharacter(categoryId: string, characterId: string): boolean {
  ensureCategoryDraft(categoryId)
  return (categoryCharacterDraftById.value[categoryId] ?? []).includes(characterId)
}

function categoryHasFaction(categoryId: string, factionId: string): boolean {
  ensureCategoryDraft(categoryId)
  return (categoryFactionDraftById.value[categoryId] ?? []).includes(factionId)
}

function toggleCharacterCategory(categoryId: string, characterId: string): void {
  ensureCategoryDraft(categoryId)
  const ids = [...(categoryCharacterDraftById.value[categoryId] ?? [])]
  if (ids.includes(characterId)) removeCategoryFromIds(ids, characterId)
  else ids.push(characterId)
  categoryCharacterDraftById.value[categoryId] = ids
}

function toggleFactionCategory(categoryId: string, factionId: string): void {
  ensureCategoryDraft(categoryId)
  const ids = [...(categoryFactionDraftById.value[categoryId] ?? [])]
  if (ids.includes(factionId)) removeCategoryFromIds(ids, factionId)
  else ids.push(factionId)
  categoryFactionDraftById.value[categoryId] = ids
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
  categoryCharacterDraftById.value[categoryId] = getCharacterIdsByCategory(categoryId)
  categoryFactionDraftById.value[categoryId] = getFactionIdsByCategory(categoryId)
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

const selectedGraphCharacter = computed(() => {
  return characters.value.find((c) => c.id === graphFocusCharacterId.value) ?? null
})

const graphCharacterMemberships = computed(() => {
  const c = selectedGraphCharacter.value
  if (!c) return []
  return characterFactionMemberships.value.filter((m) => m.characterId === c.id)
})

const filteredCharacterIdSet = computed(() => new Set(filteredCharacters.value.map((c) => c.id)))

const filteredCharacterRelations = computed(() =>
  characterRelations.value.filter(
    (r) => filteredCharacterIdSet.value.has(r.fromCharacterId) && filteredCharacterIdSet.value.has(r.toCharacterId),
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

const visibleCharacters = computed(() => filteredCharacters.value.filter((c) => visibleGraphCharacterIds.value.has(c.id)))

function factionNameById(id?: string | null): string {
  if (!id) return ''
  return factions.value.find((f) => f.id === id)?.name ?? ''
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
  hoverRelationId.value = ''
  graphFocusSphereSelectedId.value = ''
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

function parseFactionAttributesInput(
  attrs: CharacterAttribute[]
): { ok: true; value: CharacterAttribute[] } | { ok: false; message: string } {
  const out: CharacterAttribute[] = []
  for (const a of attrs) {
    const k = a.key.trim()
    const v = a.value.trim()
    if (!k && !v) continue
    if (!k) return { ok: false, message: '自定义字段需填写「字段名」。' }
    if (!v) return { ok: false, message: '自定义字段需填写「内容」。' }
    out.push({ id: a.id || uid(), key: k, value: v })
  }
  return { ok: true, value: out }
}

function handleCreateFaction() {
  factionFormError.value = ''
  if (!novel.value || !factionForm.name.trim()) return
  const parsed = parseFactionAttributesInput(factionForm.attributes)
  if (!parsed.ok) {
    factionFormError.value = parsed.message
    return
  }
  createFaction({
    novelId: novel.value.id,
    name: factionForm.name,
    leader: '',
    notes: '',
    attributes: parsed.value.length > 0 ? parsed.value : undefined,
  })
  factionForm.name = ''
  factionForm.attributes = []
  factions.value = getFactionsByNovelId(novel.value.id)
  categories.value = getCategoriesByNovelId(novel.value.id)
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
  factionEditDraft.attributes = (f.attributes ?? []).map((a) => ({ ...a }))
  const mems = characterFactionMemberships.value.filter((m) => m.factionId === factionId)
  factionEditDraft.memberCharIds = mems.map((m) => m.characterId)
  factionEditDraft.memberDescByCharId = Object.fromEntries(
    mems.map((m) => [m.characterId, (m.description ?? '').trim()]),
  )
  factionEditDraft.memberQuery = ''
  factionEditInitial.value = {
    name: factionEditDraft.name.trim(),
    attrs: factionEditDraft.attributes.map((a) => ({ key: a.key.trim(), value: a.value.trim() })),
    memberCharIds: [...factionEditDraft.memberCharIds].sort(),
    memberDescByCharId: { ...factionEditDraft.memberDescByCharId },
  }
  factionEditOpen.value = true
  factionEditCancelConfirmOpen.value = false
}

function factionEditDirty(): boolean {
  if (factionEditDraft.name.trim() !== factionEditInitial.value.name) return true
  const curAttrs = factionEditDraft.attributes.map((a) => ({ key: a.key.trim(), value: a.value.trim() }))
  if (curAttrs.length !== factionEditInitial.value.attrs.length) return true
  for (let i = 0; i < curAttrs.length; i++) {
    if (curAttrs[i].key !== factionEditInitial.value.attrs[i].key) return true
    if (curAttrs[i].value !== factionEditInitial.value.attrs[i].value) return true
  }
  const curIds = [...factionEditDraft.memberCharIds].sort().join('|')
  const oldIds = [...factionEditInitial.value.memberCharIds].sort().join('|')
  return curIds !== oldIds
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
}

function saveFactionEdit(): void {
  const id = factionEditId.value
  if (!id) return
  const name = factionEditDraft.name.trim()
  if (!name) return
  const parsed = parseFactionAttributesInput(factionEditDraft.attributes)
  if (!parsed.ok) {
    factionFormError.value = parsed.message
    return
  }
  factionFormError.value = ''
  updateFaction({
    id,
    name,
    leader: '',
    notes: '',
    attributes: parsed.value.length > 0 ? parsed.value : undefined,
  })
  const memRows = [...new Set(factionEditDraft.memberCharIds)]
    .filter((cid) => cid.trim())
    .map((cid) => ({
      characterId: cid,
      description: (factionEditDraft.memberDescByCharId[cid] ?? '').trim(),
    }))
  replaceMembershipsForFaction(novelId.value, id, memRows)
  characterFactionMemberships.value = getCharacterFactionMembershipsByNovelId(novelId.value)
  factions.value = getFactionsByNovelId(novelId.value)
  categories.value = getCategoriesByNovelId(novelId.value)
  factionSavedNotice.value = true
  window.setTimeout(() => {
    factionSavedNotice.value = false
  }, 1200)
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

function handleCreateIssue() {
  if (!novel.value || !issueForm.title.trim()) return
  createIssue({
    novelId: novel.value.id,
    title: issueForm.title,
    type: issueForm.type,
    plan: issueForm.plan,
    notes: issueForm.notes,
  })
  issueForm.title = ''
  issueForm.type = 'foreshadow'
  issueForm.plan = ''
  issueForm.notes = ''
  issues.value = getIssuesByNovelId(novel.value.id)
}

function issueTypeText(type: IssueType): string {
  if (type === 'foreshadow') return '伏笔'
  if (type === 'logic') return '逻辑'
  if (type === 'timeline') return '时间线'
  if (type === 'motivation') return '动机'
  return '其他'
}

function issueStatusText(status: IssueStatus): string {
  if (status === 'open') return '待处理'
  if (status === 'in_progress') return '处理中'
  return '已解决'
}

function cycleIssueStatus(id: string) {
  const current = issues.value.find((i) => i.id === id)
  if (!current) return
  const next: IssueStatus =
    current.status === 'open' ? 'in_progress' : current.status === 'in_progress' ? 'resolved' : 'open'
  updateIssue({ id, status: next })
  issues.value = getIssuesByNovelId(novelId.value)
}

function onIssueNotesChange(id: string, event: Event) {
  const target = event.target as HTMLInputElement | null
  updateIssue({ id, notes: target?.value ?? '' })
  issues.value = getIssuesByNovelId(novelId.value)
}

function applyRoutePrefill(): void {
  const tab = String(route.query.tab ?? '')
  if (
    tab === 'write' ||
    tab === 'outline' ||
    tab === 'timeline' ||
    tab === 'characters' ||
    tab === 'factions' ||
    tab === 'categories' ||
    tab === 'issues'
  ) {
    activeTab.value = tab
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
}

function backFromCharacters(): void {
  if (lastTabBeforeCharacters.value) {
    activeTab.value = lastTabBeforeCharacters.value
    lastTabBeforeCharacters.value = ''
    return
  }
  backFromPage()
}

/** 始终回到首页「新建作品」列表，不使用浏览器历史返回，避免从章节写作等入口进入时误回到中间页 */
function backFromPage(): void {
  void router.push({ name: 'novels' })
}

function switchTab(tab: 'write' | 'outline' | 'timeline' | 'characters' | 'factions' | 'categories' | 'issues'): void {
  closeWorkspaceDropdowns()
  if (tab === 'characters' && activeTab.value !== 'characters') {
    lastTabBeforeCharacters.value = activeTab.value as 'write' | 'outline' | 'timeline' | 'factions' | 'categories' | 'issues'
  }
  activeTab.value = tab
}

function parseOptionalChapterNo(raw: string): number | null {
  if (raw === '') return null
  const n = parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function handleCreateTimeline(): void {
  if (!novel.value) return
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
  timelineForm.storyLabel = ''
  timelineForm.title = ''
  timelineForm.summary = ''
  timelineForm.chapterNoStart = ''
  timelineForm.chapterNoEnd = ''
  timelineForm.outlineItemId = ''
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

