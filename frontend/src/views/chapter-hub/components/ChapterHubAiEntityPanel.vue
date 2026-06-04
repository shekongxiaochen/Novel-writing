<template>
  <aside v-show="open" class="chapter-hub-ai-panel" role="region" aria-label="AI 阅读台" :aria-hidden="open ? 'false' : 'true'">
    <div class="chapter-hub-ai-panel__surface">
      <header class="chapter-hub-ai-panel__header">
        <div class="chapter-hub-ai-panel__topbar">
          <div class="chapter-hub-ai-panel__hero-actions">
            <button
              type="button"
              class="chapter-hub-ai-panel__iconbtn"
              :aria-label="historyOpen ? historyToggleLabel.close : historyToggleLabel.open"
              :title="historyOpen ? historyToggleLabel.close : historyToggleLabel.open"
              :aria-pressed="historyOpen ? 'true' : 'false'"
              @click="historyOpen = !historyOpen"
            >
              <span aria-hidden="true">◷</span>
            </button>
            <button
              type="button"
              class="chapter-hub-ai-panel__iconbtn"
              aria-label="新建聊天"
              title="新建聊天"
              @click="$emit('new-chat')"
            >
              <span aria-hidden="true">＋</span>
            </button>
            <button type="button" class="chapter-hub-ai-panel__toolbtn chapter-hub-ai-panel__toolbtn--primary" :disabled="busy || !targetChapter" @click="$emit('run')">
              {{ loading ? '整理中...' : '整理' }}
            </button>
            <div class="chapter-hub-ai-panel__mode" role="tablist" aria-label="AI 模式">
              <button
                type="button"
                role="tab"
                class="chapter-hub-ai-panel__mode-seg"
                :class="{ 'is-active': deskMode === 'ask' }"
                :aria-selected="deskMode === 'ask' ? 'true' : 'false'"
                @click="deskMode === 'write' && $emit('toggle-desk-mode')"
              >提问</button>
              <button
                type="button"
                role="tab"
                class="chapter-hub-ai-panel__mode-seg"
                :class="{ 'is-active': deskMode === 'write' }"
                :aria-selected="deskMode === 'write' ? 'true' : 'false'"
                @click="deskMode === 'ask' && $emit('toggle-desk-mode')"
              >写作</button>
            </div>
          </div>
          <div class="chapter-hub-ai-panel__right-cluster">
            <div class="chapter-hub-ai-panel__wallet" role="group" aria-label="钱包余额">
              <button
                type="button"
                class="chapter-hub-ai-panel__wallet-main"
                aria-label="钱包与卡密兑换"
                title="钱包 · 卡密兑换"
                @click="onWalletClick"
              >
                <span class="chapter-hub-ai-panel__wallet-icon" aria-hidden="true">◎</span>
                <span class="chapter-hub-ai-panel__wallet-balance">{{ balanceLabel }}</span>
              </button>
              <button
                type="button"
                class="chapter-hub-ai-panel__wallet-refresh"
                :class="{ 'is-spinning': balanceRefreshing }"
                aria-label="刷新余额"
                title="刷新余额"
                :disabled="balanceRefreshing"
                @click="refreshBalance"
              >
                <span aria-hidden="true">↻</span>
              </button>
            </div>
            <button
              type="button"
              class="chapter-hub-ai-panel__iconbtn chapter-hub-ai-panel__collapse"
              aria-label="收起侧栏"
              title="收起"
              @click="$emit('collapse')"
            >
              <span aria-hidden="true">⟩</span>
            </button>
          </div>
        </div>

      </header>

      <div v-if="historyOpen" class="chapter-hub-ai-panel__history scrollbar-paper">
        <div v-if="chatHistorySessions.length === 0" class="chapter-hub-ai-panel__history-empty">
          <p>{{ deskMode === 'write' ? '还没有写作记录' : '还没有提问记录' }}</p>
          <span>{{ deskMode === 'write' ? '新建写作后，这里会保留最近的续写会话。' : '新建聊天后，这里会保留最近的提问会话。' }}</span>
        </div>
        <div
          v-for="session in chatHistorySessions"
          :key="`history-${session.id}`"
          class="chapter-hub-ai-panel__history-item"
          :data-active="session.id === activeChatId ? 'true' : 'false'"
        >
          <button
            type="button"
            class="chapter-hub-ai-panel__history-switch"
            @click="historyOpen = false; $emit('switch-chat', session.id)"
          >
            <span class="chapter-hub-ai-panel__history-main">
              <span class="chapter-hub-ai-panel__history-title">{{ session.title }}</span>
            </span>
            <span class="chapter-hub-ai-panel__history-side">
              <span class="chapter-hub-ai-panel__history-time">{{ formatHistoryAge(session.lastQuestionAt) }}</span>
            </span>
          </button>
          <button
            type="button"
            class="chapter-hub-ai-panel__history-close"
            aria-label="删除聊天"
            title="删除聊天"
            @click.stop="$emit('delete-chat', session.id)"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>

      <div ref="scrollRef" class="chapter-hub-ai-panel__scroll scrollbar-paper">
        <section v-if="deskMode === 'ask' && extractRuns.length > 0" class="chapter-hub-ai-panel__results-rail">
          <div class="chapter-hub-ai-panel__rail-title">最近整理</div>
          <div class="chapter-hub-ai-panel__rail-items">
            <button
              v-for="(run, runIdx) in extractRuns.slice(0, 4)"
              :key="`rail-${run.id}`"
              type="button"
              class="chapter-hub-ai-panel__rail-item"
              :data-active="isRunExpanded(run.id) ? 'true' : 'false'"
              @click="toggleRunExpanded(run.id)"
            >
              <span>{{ formatRunKind(run.kind) }}</span>
              <span>{{ formatRunTime(run.createdAt) || `#${runIdx + 1}` }}</span>
            </button>
          </div>
        </section>

        <article
          v-if="deskMode === 'ask' && chatMessages.length === 0 && !loading && !chatLoading && !error && !hasRun"
          class="chapter-hub-ai-message chapter-hub-ai-message--assistant"
        >
          <div class="chapter-hub-ai-message__body chapter-hub-ai-message__body--hint chapter-hub-ai-message__body--empty">
            <p class="chapter-hub-ai-message__empty-title">从当前章节开始提问</p>
            <p>可询问人物关系、伏笔回收、信息冲突，或先点「整理」生成本章档案建议。</p>
            <p>也可让 AI 修改正文、章总结、大纲、角色、势力、伏笔等，侧栏会列出方案，你确认「采用」后才写入。</p>
            <p>选中正文后，引用内容会自动带到输入区上方。</p>
          </div>
        </article>

        <article
          v-if="deskMode === 'write' && chatMessages.length === 0 && !loading && !chatLoading && !error && !hasRun && !continueDraft.loading && !continueDraft.text && continueDraft.status === 'idle'"
          class="chapter-hub-ai-message chapter-hub-ai-message--assistant"
        >
          <div class="chapter-hub-ai-message__body chapter-hub-ai-message__body--hint chapter-hub-ai-message__body--empty">
            <p class="chapter-hub-ai-message__empty-title">AI 写作台</p>
            <p>直接说明需求即可，例如「按大纲写下一章」「续写本章末尾」「在光标处写 800 字」。</p>
            <p>说「写下一章」会自动新建章节、绑定大纲并起标题；生成后在「续写草稿」预览，采用后写入稿纸并更新章总结与人物档案。</p>
          </div>
        </article>

        <article
          v-if="chapterSummaryDraft.status !== 'idle' || chapterSummaryDraft.loading"
          class="chapter-hub-ai-card chapter-hub-ai-card--summary"
        >
          <header class="chapter-hub-ai-card__head">
            <div class="chapter-hub-ai-card__title-wrap">
              <h4 class="chapter-hub-ai-card__title">章总结草稿</h4>
              <p class="chapter-hub-ai-card__subtitle">采用后写入本章「总结」字段</p>
            </div>
            <span v-if="chapterSummaryDraft.status === 'applied'" class="chapter-hub-ai-card__state">已采用</span>
            <span v-else-if="chapterSummaryDraft.status === 'ignored'" class="chapter-hub-ai-card__state">已忽略</span>
          </header>
          <div v-if="chapterSummaryDraft.loading && !chapterSummaryDraft.text" class="chapter-hub-ai-message__body chapter-hub-ai-message__body--streaming">
            <p class="chapter-hub-ai-streaming__title">正在生成章总结…</p>
          </div>
          <pre v-else class="chapter-hub-ai-continue__preview">{{ chapterSummaryDraft.text }}</pre>
          <footer v-if="chapterSummaryDraft.status === 'ready' && !chapterSummaryDraft.loading" class="chapter-hub-ai-card__footer">
            <button type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('chapter-summary-adopt')">写入总结</button>
            <button type="button" class="chapter-hub-ai-action" @click="$emit('chapter-summary-ignore')">忽略</button>
          </footer>
          <footer v-else-if="chapterSummaryDraft.loading" class="chapter-hub-ai-card__footer">
            <button type="button" class="chapter-hub-ai-action" @click="$emit('chapter-summary-stop')">终止</button>
          </footer>
        </article>

        <article
          v-for="message in chatMessagesBeforeExtract"
          :key="message.id"
          class="chapter-hub-ai-message"
          :class="[
            message.role === 'user' ? 'chapter-hub-ai-message--user' : 'chapter-hub-ai-message--assistant',
            { 'chapter-hub-ai-message--live': isLiveAssistantMessage(message) },
          ]"
        >
          <div class="chapter-hub-ai-message__meta">
            <span class="chapter-hub-ai-message__author">{{ message.role === 'user' ? 'You' : 'Assistant' }}</span>
          </div>
          <div
            v-if="isLiveAssistantMessage(message) && !message.content.trim()"
            class="chapter-hub-ai-message__body chapter-hub-ai-message__body--streaming"
          >
            <div class="chapter-hub-ai-streaming">
              <div class="chapter-hub-ai-streaming__dots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p class="chapter-hub-ai-streaming__title">{{ deskMode === 'write' ? '正在生成写作草稿...' : '正在回答你的问题...' }}</p>
              <p class="chapter-hub-ai-streaming__desc">
                {{ deskMode === 'write' ? '我会结合当前章节正文、章总结与档案信息续写。' : '我会结合当前章节、上下文和已整理信息来组织回答。' }}
              </p>
              <div class="chapter-hub-ai-streaming__lines" aria-hidden="true">
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--lg"></span>
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--md"></span>
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--sm"></span>
              </div>
            </div>
          </div>
          <div
            v-else
            class="chapter-hub-ai-message__body chapter-hub-ai-message__body--markdown"
            :class="{ 'chapter-hub-ai-message__body--live-markdown': isLiveAssistantMessage(message) }"
          >
            <div v-html="renderMessageMarkdown(message.content)" />
            <span v-if="isLiveAssistantMessage(message)" class="chapter-hub-ai-message__caret" aria-hidden="true"></span>
          </div>
        </article>

        <article
          v-for="(run, runIdx) in inlineExtractRuns"
          :key="run.id"
          class="chapter-hub-ai-message chapter-hub-ai-message--assistant"
        >
          <div class="chapter-hub-ai-message__meta">
            <span class="chapter-hub-ai-message__author">Assistant</span>
            <span class="chapter-hub-ai-message__tag">整理结果</span>
          </div>
          <div class="chapter-hub-ai-message__body chapter-hub-ai-result">
            <button type="button" class="chapter-hub-ai-result__fold" @click="toggleRunExpanded(run.id)">
              <span>{{ isRunExpanded(run.id) ? '收起' : '展开' }}</span>
              <span>{{ formatRunKind(run.kind) }} · {{ formatRunMode(run.mode) }} · {{ formatRunTime(run.createdAt) || `第 ${runIdx + 1} 次整理` }}</span>
            </button>

            <div v-if="isRunExpanded(run.id)">
              <template v-if="run.kind === 'foreshadows'">
                <p
                  v-if="
                    (run.foreshadowResult?.newPlants.length ?? 0) === 0 &&
                    (run.foreshadowResult?.fulfillments.length ?? 0) === 0 &&
                    (run.foreshadowResult?.danglingThreads.length ?? 0) === 0 &&
                    (run.foreshadowResult?.warnings.length ?? 0) === 0
                  "
                  class="chapter-hub-ai-result__empty"
                >
                  当前范围里没有识别出新的伏笔建议或回收提醒。
                </p>
                <details v-if="(run.foreshadowResult?.warnings.length ?? 0) > 0" class="chapter-hub-ai-section" open>
                  <summary class="chapter-hub-ai-section__summary">
                    <span>提醒</span>
                    <span class="chapter-hub-ai-section__count">{{ run.foreshadowResult?.warnings.length ?? 0 }}</span>
                  </summary>
                  <div class="chapter-hub-ai-section__content chapter-hub-ai-section__content--warnings">
                    <p v-for="warning in run.foreshadowResult?.warnings ?? []" :key="warning" class="chapter-hub-ai-warning-card">{{ warning }}</p>
                  </div>
                </details>
                <details v-if="(run.foreshadowResult?.newPlants.length ?? 0) > 0" class="chapter-hub-ai-section" open>
                  <summary class="chapter-hub-ai-section__summary">
                    <span>新增伏笔候选</span>
                    <span class="chapter-hub-ai-section__count">{{ run.foreshadowResult?.newPlants.length ?? 0 }}</span>
                  </summary>
                  <div class="chapter-hub-ai-section__content">
                    <article v-for="(item, index) in run.foreshadowResult?.newPlants ?? []" :key="`fs-new-${run.id}-${index}`" class="chapter-hub-ai-suggestion">
                      <div class="chapter-hub-ai-suggestion__top">
                        <div class="chapter-hub-ai-suggestion__main">
                          <strong>{{ item.title }}</strong>
                          <p class="chapter-hub-ai-suggestion__summary">{{ item.summary }}</p>
                        </div>
                        <div class="chapter-hub-ai-suggestion__chips">
                          <span class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ confidenceLabel(item.confidence) }}</span>
                        </div>
                      </div>
                      <p v-if="item.payoffHint" class="chapter-hub-ai-suggestion__meta">建议回收方向：{{ item.payoffHint }}</p>
                    </article>
                  </div>
                </details>
                <details v-if="(run.foreshadowResult?.fulfillments.length ?? 0) > 0" class="chapter-hub-ai-section" open>
                  <summary class="chapter-hub-ai-section__summary">
                    <span>疑似回收</span>
                    <span class="chapter-hub-ai-section__count">{{ run.foreshadowResult?.fulfillments.length ?? 0 }}</span>
                  </summary>
                  <div class="chapter-hub-ai-section__content">
                    <article v-for="(item, index) in run.foreshadowResult?.fulfillments ?? []" :key="`fs-fulfill-${run.id}-${index}`" class="chapter-hub-ai-suggestion">
                      <div class="chapter-hub-ai-suggestion__top">
                        <div class="chapter-hub-ai-suggestion__main">
                          <strong>{{ item.title }}</strong>
                          <p class="chapter-hub-ai-suggestion__summary">{{ item.summary }}</p>
                        </div>
                        <div class="chapter-hub-ai-suggestion__chips">
                          <span class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ item.status === 'implicit' ? '隐式呼应' : '对应已有伏笔' }}</span>
                          <span class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ confidenceLabel(item.confidence) }}</span>
                        </div>
                      </div>
                      <p v-if="item.relatedPlantTitle" class="chapter-hub-ai-suggestion__meta">关联伏笔：{{ item.relatedPlantTitle }}</p>
                    </article>
                  </div>
                </details>
                <details v-if="(run.foreshadowResult?.danglingThreads.length ?? 0) > 0" class="chapter-hub-ai-section" open>
                  <summary class="chapter-hub-ai-section__summary">
                    <span>待回收线索</span>
                    <span class="chapter-hub-ai-section__count">{{ run.foreshadowResult?.danglingThreads.length ?? 0 }}</span>
                  </summary>
                  <div class="chapter-hub-ai-section__content">
                    <article v-for="(item, index) in run.foreshadowResult?.danglingThreads ?? []" :key="`fs-open-${run.id}-${index}`" class="chapter-hub-ai-suggestion">
                      <div class="chapter-hub-ai-suggestion__top">
                        <div class="chapter-hub-ai-suggestion__main">
                          <strong>{{ item.title }}</strong>
                          <p class="chapter-hub-ai-suggestion__summary">{{ item.summary }}</p>
                        </div>
                        <div class="chapter-hub-ai-suggestion__chips">
                          <span class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ confidenceLabel(item.confidence) }}</span>
                        </div>
                      </div>
                      <p v-if="item.lastMentionChapterNo" class="chapter-hub-ai-suggestion__meta">最近相关章节：第 {{ item.lastMentionChapterNo }} 章</p>
                      <p v-if="item.suggestedPayoff" class="chapter-hub-ai-suggestion__meta">建议处理：{{ item.suggestedPayoff }}</p>
                    </article>
                  </div>
                </details>
              </template>
              <template v-else-if="run.kind === 'classification'">
                <article class="chapter-hub-ai-suggestion">
                  <div class="chapter-hub-ai-suggestion__top">
                    <div class="chapter-hub-ai-suggestion__main">
                      <strong>{{ chapterTypeLabel(run.classificationResult?.chapterType) }}</strong>
                      <p class="chapter-hub-ai-suggestion__summary">{{ run.classificationResult?.summary || '这次没有生成章节摘要。' }}</p>
                    </div>
                    <div class="chapter-hub-ai-suggestion__chips">
                      <span v-if="run.classificationResult?.pacing" class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ pacingLabel(run.classificationResult?.pacing) }}</span>
                      <span v-if="run.classificationResult?.tensionLevel" class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">张力 {{ run.classificationResult?.tensionLevel }}/5</span>
                    </div>
                  </div>
                  <p v-if="run.classificationResult?.mainConflict" class="chapter-hub-ai-suggestion__meta">核心冲突：{{ run.classificationResult?.mainConflict }}</p>
                  <p v-if="(run.classificationResult?.storyFunctions.length ?? 0) > 0" class="chapter-hub-ai-suggestion__meta">章节功能：{{ run.classificationResult?.storyFunctions.join('、') }}</p>
                  <p v-if="(run.classificationResult?.informationGain.length ?? 0) > 0" class="chapter-hub-ai-suggestion__meta">新增信息：{{ run.classificationResult?.informationGain.join('、') }}</p>
                  <p v-if="(run.classificationResult?.activeForeshadows.length ?? 0) > 0" class="chapter-hub-ai-suggestion__meta">活跃伏笔：{{ run.classificationResult?.activeForeshadows.join('、') }}</p>
                  <p v-if="(run.classificationResult?.tags.length ?? 0) > 0" class="chapter-hub-ai-suggestion__meta">标签：{{ run.classificationResult?.tags.join('、') }}</p>
                  <p v-if="run.classificationResult?.rationale" class="chapter-hub-ai-suggestion__meta">判断依据：{{ run.classificationResult?.rationale }}</p>
                  <p v-for="warning in run.classificationResult?.warnings ?? []" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
                </article>
              </template>
              <template v-else>
              <p
                v-if="
                  run.result.characters.length === 0 &&
                  run.result.factions.length === 0 &&
                  run.result.items.length === 0 &&
                  run.result.memberships.length === 0 &&
                  run.result.relations.length === 0 &&
                  run.result.warnings.length === 0
                "
                class="chapter-hub-ai-result__empty"
              >
                当前章节没有提取出新的角色、势力、物品或关系建议。
              </p>

              <div v-if="run.appliedActions.length > 0" class="chapter-hub-ai-result__applied">
                <div class="chapter-hub-ai-result__applied-head">
                  <span>已采用 / 已忽略</span>
                  <span>{{ run.appliedActions.length }}</span>
                </div>
                <p
                  v-for="entry in run.appliedActions"
                  :key="entry.id"
                  class="chapter-hub-ai-result__applied-item"
                  :data-tone="entry.tone"
                >
                  {{ entry.text }}
                </p>
              </div>

            <details v-if="run.result.warnings.length > 0" class="chapter-hub-ai-section" open>
              <summary class="chapter-hub-ai-section__summary">
                <span>提醒</span>
                <span class="chapter-hub-ai-section__count">{{ run.result.warnings.length }}</span>
              </summary>
              <div class="chapter-hub-ai-section__content chapter-hub-ai-section__content--warnings">
                <p v-for="warning in run.result.warnings" :key="warning" class="chapter-hub-ai-warning-card">{{ warning }}</p>
              </div>
            </details>

            <details v-if="run.result.characters.length > 0" class="chapter-hub-ai-section" open>
              <summary class="chapter-hub-ai-section__summary">
                <span>角色</span>
                <span class="chapter-hub-ai-section__count">{{ run.result.characters.length }}</span>
              </summary>
              <div class="chapter-hub-ai-section__content">
                <article
                  v-for="(item, index) in run.result.characters"
                  :key="`character-${run.id}-${item.name}-${item.match.targetId ?? 'new'}`"
                  class="chapter-hub-ai-card"
                  :class="{ 'chapter-hub-ai-card--locked': isSuggestionLocked(item.uiState?.status) }"
                >
                  <header class="chapter-hub-ai-card__head">
                    <div class="chapter-hub-ai-card__title-wrap">
                      <h4 class="chapter-hub-ai-card__title">{{ item.name }}</h4>
                      <p class="chapter-hub-ai-card__subtitle">
                        {{ matchLabel(item.match.type, item.identityStatus) }} · {{ confidenceLabel(item.confidence) }}
                      </p>
                    </div>
                    <span v-if="isSuggestionLocked(item.uiState?.status)" class="chapter-hub-ai-card__state">{{ suggestionStateLabel(item.uiState?.status) }}</span>
                  </header>

                  <dl v-if="characterFieldRows(item).length" class="chapter-hub-ai-card__fields">
                    <template v-for="field in characterFieldRows(item)" :key="`${item.name}-${field.label}`">
                      <dt>{{ field.label }}</dt>
                      <dd>{{ field.value }}</dd>
                    </template>
                  </dl>

                  <p v-if="item.match.targetName" class="chapter-hub-ai-card__line">匹配档案：{{ item.match.targetName }}</p>
                  <p v-if="item.aliases.length" class="chapter-hub-ai-card__line">别名：{{ item.aliases.join('、') }}</p>

                  <details v-if="item.evidences.length" class="chapter-hub-ai-evidence">
                    <summary class="chapter-hub-ai-evidence__summary">原文依据（{{ item.evidences.length }}）</summary>
                    <div class="chapter-hub-ai-evidence-list">
                      <p v-for="(ev, evIdx) in item.evidences" :key="`character-${index}-${evIdx}`">第 {{ ev.chapterNo ?? '?' }} 章 · {{ ev.quote }}</p>
                    </div>
                  </details>
                  <p v-for="warning in item.warnings" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>

                  <footer v-if="runIdx === 0" class="chapter-hub-ai-card__footer">
                    <template v-if="!isSuggestionLocked(item.uiState?.status)">
                      <button
                        v-if="item.match.type === 'new' || canMerge(item.match.type, item.match.targetId)"
                        type="button"
                        class="chapter-hub-ai-action chapter-hub-ai-action--primary"
                        @click="$emit('apply', { section: 'characters', index, action: item.match.type === 'new' ? 'create' : 'merge' })"
                      >
                        {{ adoptLabel(item.match.type) }}
                      </button>
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'characters', index, action: 'ignore' })">忽略</button>
                    </template>
                    <template v-else-if="item.uiState?.status === 'applied'">
                      <button
                        v-if="item.uiState?.editorTargetId"
                        type="button"
                        class="chapter-hub-ai-action chapter-hub-ai-action--primary"
                        @click="$emit('open-editor', { section: 'characters', index })"
                      >
                        打开编辑
                      </button>
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'characters', index, action: 'reopen' })">重新审阅</button>
                    </template>
                    <template v-else-if="item.uiState?.status === 'ignored'">
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'characters', index, action: 'reopen' })">重新审阅</button>
                    </template>
                  </footer>
                </article>
              </div>
            </details>

            <details v-if="run.result.factions.length > 0" class="chapter-hub-ai-section" open>
              <summary class="chapter-hub-ai-section__summary">
                <span>势力</span>
                <span class="chapter-hub-ai-section__count">{{ run.result.factions.length }}</span>
              </summary>
              <div class="chapter-hub-ai-section__content">
                <article v-for="(item, index) in run.result.factions" :key="`faction-${run.id}-${item.name}-${item.match.targetId ?? 'new'}`" class="chapter-hub-ai-suggestion">
                  <div class="chapter-hub-ai-suggestion__eyebrow">
                    <span>势力档案</span>
                    <span>{{ actionLabel(item.match.type) }}</span>
                  </div>
                  <div class="chapter-hub-ai-suggestion__top">
                    <div class="chapter-hub-ai-suggestion__main">
                      <strong>{{ item.name }}</strong>
                      <p class="chapter-hub-ai-suggestion__summary">{{ factionSummary(item) }}</p>
                    </div>
                    <div class="chapter-hub-ai-suggestion__chips">
                      <span class="chapter-hub-ai-chip" :data-kind="item.match.type">{{ matchLabel(item.match.type) }}</span>
                      <span class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ confidenceLabel(item.confidence) }}</span>
                      <span class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ suggestionStateLabel(item.uiState?.status) }}</span>
                    </div>
                  </div>
                  <p v-if="item.match.targetName" class="chapter-hub-ai-suggestion__meta">匹配目标：{{ item.match.targetName }}</p>
                  <details v-if="item.evidences.length" class="chapter-hub-ai-evidence">
                    <summary class="chapter-hub-ai-evidence__summary">引用证据 {{ item.evidences.length }}</summary>
                    <div class="chapter-hub-ai-evidence-list">
                      <p v-for="(ev, evIdx) in item.evidences" :key="`faction-${index}-${evIdx}`">第 {{ ev.chapterNo ?? '?' }} 章 · {{ ev.quote }}</p>
                    </div>
                  </details>
                  <p v-for="warning in item.warnings" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
                  <footer v-if="runIdx === 0" class="chapter-hub-ai-card__footer">
                    <template v-if="!isSuggestionLocked(item.uiState?.status)">
                      <button
                        v-if="item.match.type === 'new' || canMerge(item.match.type, item.match.targetId)"
                        type="button"
                        class="chapter-hub-ai-action chapter-hub-ai-action--primary"
                        @click="$emit('apply', { section: 'factions', index, action: item.match.type === 'new' ? 'create' : 'merge' })"
                      >
                        {{ adoptLabel(item.match.type) }}
                      </button>
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'factions', index, action: 'ignore' })">忽略</button>
                    </template>
                    <template v-else-if="item.uiState?.status === 'applied'">
                      <button v-if="item.uiState?.editorTargetId" type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('open-editor', { section: 'factions', index })">打开编辑</button>
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'factions', index, action: 'reopen' })">重新审阅</button>
                    </template>
                    <template v-else-if="item.uiState?.status === 'ignored'">
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'factions', index, action: 'reopen' })">重新审阅</button>
                    </template>
                  </footer>
                </article>
              </div>
            </details>

            <details v-if="run.result.items.length > 0" class="chapter-hub-ai-section" open>
              <summary class="chapter-hub-ai-section__summary">
                <span>物品</span>
                <span class="chapter-hub-ai-section__count">{{ run.result.items.length }}</span>
              </summary>
              <div class="chapter-hub-ai-section__content">
                <article
                  v-for="(item, index) in run.result.items"
                  :key="`item-${run.id}-${item.name}-${item.match.targetId ?? 'new'}`"
                  class="chapter-hub-ai-card"
                  :class="{ 'chapter-hub-ai-card--locked': isSuggestionLocked(item.uiState?.status) }"
                >
                  <header class="chapter-hub-ai-card__head">
                    <div class="chapter-hub-ai-card__title-wrap">
                      <h4 class="chapter-hub-ai-card__title">{{ item.name }}</h4>
                      <p class="chapter-hub-ai-card__subtitle">
                        {{ matchLabel(item.match.type) }} · {{ confidenceLabel(item.confidence) }}
                      </p>
                    </div>
                    <span v-if="isSuggestionLocked(item.uiState?.status)" class="chapter-hub-ai-card__state">{{ suggestionStateLabel(item.uiState?.status) }}</span>
                  </header>

                  <dl v-if="itemFieldRows(item).length" class="chapter-hub-ai-card__fields">
                    <template v-for="field in itemFieldRows(item)" :key="`${item.name}-${field.label}`">
                      <dt>{{ field.label }}</dt>
                      <dd>{{ field.value }}</dd>
                    </template>
                  </dl>

                  <p v-if="item.match.targetName" class="chapter-hub-ai-card__line">匹配档案：{{ item.match.targetName }}</p>

                  <details v-if="item.evidences.length" class="chapter-hub-ai-evidence">
                    <summary class="chapter-hub-ai-evidence__summary">原文依据（{{ item.evidences.length }}）</summary>
                    <div class="chapter-hub-ai-evidence-list">
                      <p v-for="(ev, evIdx) in item.evidences" :key="`item-${index}-${evIdx}`">第 {{ ev.chapterNo ?? '?' }} 章 · {{ ev.quote }}</p>
                    </div>
                  </details>
                  <p v-for="warning in item.warnings" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
                  <footer v-if="runIdx === 0" class="chapter-hub-ai-card__footer">
                    <template v-if="!isSuggestionLocked(item.uiState?.status)">
                      <button
                        v-if="item.match.type === 'new' || canMerge(item.match.type, item.match.targetId)"
                        type="button"
                        class="chapter-hub-ai-action chapter-hub-ai-action--primary"
                        @click="$emit('apply', { section: 'items', index, action: item.match.type === 'new' ? 'create' : 'merge' })"
                      >
                        {{ adoptLabel(item.match.type) }}
                      </button>
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'items', index, action: 'ignore' })">忽略</button>
                    </template>
                    <template v-else-if="item.uiState?.status === 'applied'">
                      <button v-if="item.uiState?.editorTargetId" type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('open-editor', { section: 'items', index })">打开编辑</button>
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'items', index, action: 'reopen' })">重新审阅</button>
                    </template>
                    <template v-else-if="item.uiState?.status === 'ignored'">
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'items', index, action: 'reopen' })">重新审阅</button>
                    </template>
                  </footer>
                </article>
              </div>
            </details>

            <details v-if="run.result.memberships.length + run.result.relations.length > 0" class="chapter-hub-ai-section" open>
              <summary class="chapter-hub-ai-section__summary">
                <span>关系</span>
                <span class="chapter-hub-ai-section__count">{{ run.result.memberships.length + run.result.relations.length }}</span>
              </summary>
              <div class="chapter-hub-ai-section__content">
                <article
                  v-for="(item, index) in run.result.memberships"
                  :key="`membership-${run.id}-${index}`"
                  class="chapter-hub-ai-card chapter-hub-ai-card--relation"
                  :class="{ 'chapter-hub-ai-card--locked': isSuggestionLocked(item.uiState?.status) }"
                >
                  <header class="chapter-hub-ai-card__head">
                    <div class="chapter-hub-ai-card__title-wrap">
                      <p class="chapter-hub-ai-card__kind">势力归属</p>
                      <p class="chapter-hub-ai-card__subtitle">
                        {{ matchLabel(item.match.type) }} · {{ confidenceLabel(item.confidence) }}
                      </p>
                    </div>
                    <span v-if="isSuggestionLocked(item.uiState?.status)" class="chapter-hub-ai-card__state">{{ suggestionStateLabel(item.uiState?.status) }}</span>
                  </header>

                  <div class="chapter-hub-ai-relation__flow">
                    <span class="chapter-hub-ai-relation__person">{{ item.characterName }}</span>
                    <span class="chapter-hub-ai-relation__arrow" aria-hidden="true">→</span>
                    <span class="chapter-hub-ai-relation__person chapter-hub-ai-relation__person--faction">{{ item.factionName }}</span>
                  </div>
                  <p v-if="item.description" class="chapter-hub-ai-card__line">{{ item.description }}</p>
                  <p v-else class="chapter-hub-ai-card__line chapter-hub-ai-card__line--muted">未提供补充说明</p>

                  <p v-if="item.match.targetName" class="chapter-hub-ai-card__line">匹配档案：{{ item.match.targetName }}</p>
                  <details v-if="item.evidences.length" class="chapter-hub-ai-evidence">
                    <summary class="chapter-hub-ai-evidence__summary">原文依据（{{ item.evidences.length }}）</summary>
                    <div class="chapter-hub-ai-evidence-list">
                      <p v-for="(ev, evIdx) in item.evidences" :key="`membership-${index}-${evIdx}`">第 {{ ev.chapterNo ?? '?' }} 章 · {{ ev.quote }}</p>
                    </div>
                  </details>
                  <p v-for="warning in item.warnings" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
                  <footer v-if="runIdx === 0" class="chapter-hub-ai-card__footer">
                    <template v-if="!isSuggestionLocked(item.uiState?.status)">
                      <button
                        v-if="item.match.type === 'new' || canMerge(item.match.type, item.match.targetId)"
                        type="button"
                        class="chapter-hub-ai-action chapter-hub-ai-action--primary"
                        @click="$emit('apply', { section: 'memberships', index, action: item.match.type === 'new' ? 'create' : 'merge' })"
                      >
                        {{ adoptLabel(item.match.type) }}
                      </button>
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'memberships', index, action: 'ignore' })">忽略</button>
                    </template>
                    <template v-else-if="item.uiState?.status === 'ignored'">
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'memberships', index, action: 'reopen' })">重新审阅</button>
                    </template>
                  </footer>
                </article>

                <article
                  v-for="(item, index) in run.result.relations"
                  :key="`relation-${run.id}-${index}`"
                  class="chapter-hub-ai-card chapter-hub-ai-card--relation"
                  :class="{ 'chapter-hub-ai-card--locked': isSuggestionLocked(item.uiState?.status) }"
                >
                  <header class="chapter-hub-ai-card__head">
                    <div class="chapter-hub-ai-card__title-wrap">
                      <p class="chapter-hub-ai-card__kind">角色关系</p>
                      <p class="chapter-hub-ai-card__subtitle">
                        {{ matchLabel(item.match.type) }} · {{ confidenceLabel(item.confidence) }}
                      </p>
                    </div>
                    <span v-if="isSuggestionLocked(item.uiState?.status)" class="chapter-hub-ai-card__state">{{ suggestionStateLabel(item.uiState?.status) }}</span>
                  </header>

                  <div class="chapter-hub-ai-relation__flow">
                    <span class="chapter-hub-ai-relation__person">{{ item.fromCharacterName }}</span>
                    <span class="chapter-hub-ai-relation__arrow" aria-hidden="true">→</span>
                    <span v-if="item.relationType" class="chapter-hub-ai-relation__badge">{{ item.relationType }}</span>
                    <span v-if="item.relationType" class="chapter-hub-ai-relation__arrow" aria-hidden="true">→</span>
                    <span class="chapter-hub-ai-relation__person">{{ item.toCharacterName }}</span>
                  </div>
                  <p v-if="item.note" class="chapter-hub-ai-card__line">{{ item.note }}</p>

                  <p v-if="item.match.targetName" class="chapter-hub-ai-card__line">匹配档案：{{ item.match.targetName }}</p>
                  <details v-if="item.evidences.length" class="chapter-hub-ai-evidence">
                    <summary class="chapter-hub-ai-evidence__summary">原文依据（{{ item.evidences.length }}）</summary>
                    <div class="chapter-hub-ai-evidence-list">
                      <p v-for="(ev, evIdx) in item.evidences" :key="`relation-${index}-${evIdx}`">第 {{ ev.chapterNo ?? '?' }} 章 · {{ ev.quote }}</p>
                    </div>
                  </details>
                  <p v-for="warning in item.warnings" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
                  <footer v-if="runIdx === 0" class="chapter-hub-ai-card__footer">
                    <template v-if="!isSuggestionLocked(item.uiState?.status)">
                      <button
                        v-if="item.match.type === 'new' || canMerge(item.match.type, item.match.targetId)"
                        type="button"
                        class="chapter-hub-ai-action chapter-hub-ai-action--primary"
                        @click="$emit('apply', { section: 'relations', index, action: item.match.type === 'new' ? 'create' : 'merge' })"
                      >
                        {{ adoptLabel(item.match.type) }}
                      </button>
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'relations', index, action: 'ignore' })">忽略</button>
                    </template>
                    <template v-else-if="item.uiState?.status === 'ignored'">
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'relations', index, action: 'reopen' })">重新审阅</button>
                    </template>
                  </footer>
                </article>
              </div>
            </details>

            <details v-if="(run.result.outlineItems?.length ?? 0) > 0" class="chapter-hub-ai-section" open>
              <summary class="chapter-hub-ai-section__summary">
                <span>大纲节点</span>
                <span class="chapter-hub-ai-section__count">{{ run.result.outlineItems?.length ?? 0 }}</span>
              </summary>
              <div class="chapter-hub-ai-section__content">
                <article
                  v-for="(item, index) in (run.result.outlineItems ?? [])"
                  :key="`outline-${run.id}-${index}`"
                  class="chapter-hub-ai-card"
                  :class="{ 'chapter-hub-ai-card--locked': isSuggestionLocked(item.uiState?.status) }"
                >
                  <header class="chapter-hub-ai-card__head">
                    <div class="chapter-hub-ai-card__title-wrap">
                      <p class="chapter-hub-ai-card__kind">{{ item.title }}</p>
                      <p class="chapter-hub-ai-card__subtitle">
                        {{ matchLabel(item.match.type) }} · {{ confidenceLabel(item.confidence) }}
                      </p>
                    </div>
                    <span v-if="isSuggestionLocked(item.uiState?.status)" class="chapter-hub-ai-card__state">{{ suggestionStateLabel(item.uiState?.status) }}</span>
                  </header>

                  <p v-if="item.summary" class="chapter-hub-ai-card__line">{{ item.summary }}</p>
                  <p v-if="item.match.targetName" class="chapter-hub-ai-card__line">匹配档案：{{ item.match.targetName }}</p>
                  <details v-if="item.evidences.length" class="chapter-hub-ai-evidence">
                    <summary class="chapter-hub-ai-evidence__summary">原文依据（{{ item.evidences.length }}）</summary>
                    <div class="chapter-hub-ai-evidence-list">
                      <p v-for="(ev, evIdx) in item.evidences" :key="`outline-${index}-${evIdx}`">第 {{ ev.chapterNo ?? '?' }} 章 · {{ ev.quote }}</p>
                    </div>
                  </details>
                  <p v-for="warning in item.warnings" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
                  <footer v-if="runIdx === 0" class="chapter-hub-ai-card__footer">
                    <template v-if="!isSuggestionLocked(item.uiState?.status)">
                      <button type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'outlineItems', index, action: 'create' })">采用</button>
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'outlineItems', index, action: 'ignore' })">忽略</button>
                    </template>
                    <template v-else-if="item.uiState?.status === 'ignored'">
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'outlineItems', index, action: 'reopen' })">重新审阅</button>
                    </template>
                  </footer>
                </article>
              </div>
            </details>

            <details v-if="(run.foreshadowResult?.warnings.length ?? 0) > 0" class="chapter-hub-ai-section" open>
              <summary class="chapter-hub-ai-section__summary">
                <span>伏笔提醒</span>
                <span class="chapter-hub-ai-section__count">{{ run.foreshadowResult?.warnings.length ?? 0 }}</span>
              </summary>
              <div class="chapter-hub-ai-section__content chapter-hub-ai-section__content--warnings">
                <p v-for="warning in run.foreshadowResult?.warnings ?? []" :key="warning" class="chapter-hub-ai-warning-card">{{ warning }}</p>
              </div>
            </details>

            <details v-if="(run.foreshadowResult?.newPlants.length ?? 0) > 0" class="chapter-hub-ai-section" open>
              <summary class="chapter-hub-ai-section__summary">
                <span>新增伏笔候选</span>
                <span class="chapter-hub-ai-section__count">{{ run.foreshadowResult?.newPlants.length ?? 0 }}</span>
              </summary>
              <div class="chapter-hub-ai-section__content">
                <article v-for="(item, index) in run.foreshadowResult?.newPlants ?? []" :key="`fs-combined-${run.id}-${index}`" class="chapter-hub-ai-suggestion">
                  <div class="chapter-hub-ai-suggestion__top">
                    <div class="chapter-hub-ai-suggestion__main">
                      <strong>{{ item.title }}</strong>
                      <p class="chapter-hub-ai-suggestion__summary">{{ item.summary }}</p>
                    </div>
                    <div class="chapter-hub-ai-suggestion__chips">
                      <span class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ confidenceLabel(item.confidence) }}</span>
                      <span class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ suggestionStateLabel(item.uiState?.status) }}</span>
                    </div>
                  </div>
                  <p v-if="item.payoffHint" class="chapter-hub-ai-suggestion__meta">建议回收方向：{{ item.payoffHint }}</p>
                  <details v-if="item.evidences.length" class="chapter-hub-ai-evidence">
                    <summary class="chapter-hub-ai-evidence__summary">引用证据 {{ item.evidences.length }}</summary>
                    <div class="chapter-hub-ai-evidence-list">
                      <p v-for="(ev, evIdx) in item.evidences" :key="`fs-combined-${index}-${evIdx}`">第 {{ ev.chapterNo ?? '?' }} 章 · {{ ev.quote }}</p>
                    </div>
                  </details>
                  <p v-for="warning in item.warnings" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
                  <footer v-if="runIdx === 0" class="chapter-hub-ai-card__footer">
                    <template v-if="!isSuggestionLocked(item.uiState?.status)">
                      <button type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'foreshadows', index, action: 'create' })">采用</button>
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'foreshadows', index, action: 'ignore' })">忽略</button>
                    </template>
                    <template v-else-if="item.uiState?.status === 'ignored'">
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'foreshadows', index, action: 'reopen' })">重新审阅</button>
                    </template>
                  </footer>
                </article>
              </div>
            </details>

            <details v-if="run.classificationResult?.chapterType || run.classificationResult?.summary" class="chapter-hub-ai-section" open>
              <summary class="chapter-hub-ai-section__summary">
                <span>章节分类</span>
                <span class="chapter-hub-ai-section__count">{{ suggestionStateLabel(run.classificationResult?.uiState?.status) }}</span>
              </summary>
              <div class="chapter-hub-ai-section__content">
                <article class="chapter-hub-ai-suggestion">
                  <div class="chapter-hub-ai-suggestion__top">
                    <div class="chapter-hub-ai-suggestion__main">
                      <strong>{{ chapterTypeLabel(run.classificationResult?.chapterType) }}</strong>
                      <p class="chapter-hub-ai-suggestion__summary">{{ run.classificationResult?.summary || '这次没有生成章节摘要。' }}</p>
                    </div>
                    <div class="chapter-hub-ai-suggestion__chips">
                      <span v-if="run.classificationResult?.pacing" class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ pacingLabel(run.classificationResult?.pacing) }}</span>
                      <span v-if="run.classificationResult?.tensionLevel" class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">张力 {{ run.classificationResult?.tensionLevel }}/5</span>
                    </div>
                  </div>
                  <p v-if="run.classificationResult?.mainConflict" class="chapter-hub-ai-suggestion__meta">核心冲突：{{ run.classificationResult?.mainConflict }}</p>
                  <p v-if="(run.classificationResult?.storyFunctions.length ?? 0) > 0" class="chapter-hub-ai-suggestion__meta">章节功能：{{ run.classificationResult?.storyFunctions.join('、') }}</p>
                  <p v-if="(run.classificationResult?.informationGain.length ?? 0) > 0" class="chapter-hub-ai-suggestion__meta">新增信息：{{ run.classificationResult?.informationGain.join('、') }}</p>
                  <p v-if="(run.classificationResult?.activeForeshadows.length ?? 0) > 0" class="chapter-hub-ai-suggestion__meta">活跃伏笔：{{ run.classificationResult?.activeForeshadows.join('、') }}</p>
                  <p v-if="(run.classificationResult?.tags.length ?? 0) > 0" class="chapter-hub-ai-suggestion__meta">标签：{{ run.classificationResult?.tags.join('、') }}</p>
                  <p v-if="run.classificationResult?.rationale" class="chapter-hub-ai-suggestion__meta">判断依据：{{ run.classificationResult?.rationale }}</p>
                  <p v-for="warning in run.classificationResult?.warnings ?? []" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
                  <footer v-if="runIdx === 0" class="chapter-hub-ai-card__footer">
                    <template v-if="!isSuggestionLocked(run.classificationResult?.uiState?.status)">
                      <button type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'classification', index: 0, action: 'merge' })">采用</button>
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'classification', index: 0, action: 'ignore' })">忽略</button>
                    </template>
                    <template v-else-if="run.classificationResult?.uiState?.status === 'ignored'">
                      <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'classification', index: 0, action: 'reopen' })">重新审阅</button>
                    </template>
                  </footer>
                </article>
              </div>
            </details>
              </template>
            </div>
          </div>
        </article>

        <article
          v-for="message in chatMessagesAfterExtract"
          :key="message.id"
          class="chapter-hub-ai-message"
          :class="[
            message.role === 'user' ? 'chapter-hub-ai-message--user' : 'chapter-hub-ai-message--assistant',
            { 'chapter-hub-ai-message--live': isLiveAssistantMessage(message) },
          ]"
        >
          <div class="chapter-hub-ai-message__meta">
            <span class="chapter-hub-ai-message__author">{{ message.role === 'user' ? 'You' : 'Assistant' }}</span>
          </div>
          <div
            v-if="isLiveAssistantMessage(message) && !message.content.trim()"
            class="chapter-hub-ai-message__body chapter-hub-ai-message__body--streaming"
          >
            <div class="chapter-hub-ai-streaming">
              <div class="chapter-hub-ai-streaming__dots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p class="chapter-hub-ai-streaming__title">{{ deskMode === 'write' ? '正在生成写作草稿...' : '正在回答你的问题...' }}</p>
              <p class="chapter-hub-ai-streaming__desc">
                {{ deskMode === 'write' ? '我会结合当前章节正文、章总结与档案信息续写。' : '我会结合当前章节、上下文和已整理信息来组织回答。' }}
              </p>
              <div class="chapter-hub-ai-streaming__lines" aria-hidden="true">
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--lg"></span>
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--md"></span>
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--sm"></span>
              </div>
            </div>
          </div>
          <div
            v-else
            class="chapter-hub-ai-message__body chapter-hub-ai-message__body--markdown"
            :class="{ 'chapter-hub-ai-message__body--live-markdown': isLiveAssistantMessage(message) }"
          >
            <div v-html="renderMessageMarkdown(message.content)" />
            <span v-if="isLiveAssistantMessage(message)" class="chapter-hub-ai-message__caret" aria-hidden="true"></span>
          </div>
        </article>

        <article
          v-if="deskMode === 'write' && (continueDraft.loading || continueDraft.text || continueDraft.status !== 'idle')"
          class="chapter-hub-ai-card chapter-hub-ai-card--continue"
        >
          <header class="chapter-hub-ai-card__head">
            <div class="chapter-hub-ai-card__title-wrap">
              <h4 class="chapter-hub-ai-card__title">续写草稿</h4>
              <p class="chapter-hub-ai-card__subtitle">采用后写入稿纸，并自动更新章总结与人物档案</p>
            </div>
            <span v-if="continueDraft.status === 'applied'" class="chapter-hub-ai-card__state">已采用</span>
            <span v-else-if="continueDraft.status === 'ignored'" class="chapter-hub-ai-card__state">已忽略</span>
          </header>
          <div v-if="continueDraft.loading && !continueDraft.text" class="chapter-hub-ai-message__body chapter-hub-ai-message__body--streaming">
            <div class="chapter-hub-ai-streaming">
              <div class="chapter-hub-ai-streaming__dots" aria-hidden="true">
                <span></span><span></span><span></span>
              </div>
              <p class="chapter-hub-ai-streaming__title">
                {{ continueThinkingText ? '正在思考并准备正文…' : '正在生成续写草稿…' }}
              </p>
              <p v-if="continueThinkingText" class="chapter-hub-ai-streaming__desc chapter-hub-ai-continue__thinking">
                {{ continueThinkingExcerpt }}
              </p>
            </div>
          </div>
          <pre v-else class="chapter-hub-ai-continue__preview">{{ continueDraft.text }}</pre>
          <p
            v-if="continueDraft.usedLayers.length > 0 || continueDraft.droppedLayers.length > 0"
            class="chapter-hub-ai-continue__context-meta"
          >
            <span v-if="continueDraft.usedChars > 0">上下文约 {{ continueDraft.usedChars }} 字</span>
            <span v-if="continueDraft.usedLayers.length > 0"> · 已用：{{ formatContinueLayers(continueDraft.usedLayers) }}</span>
            <span v-if="continueDraft.droppedLayers.length > 0"> · 已省略：{{ formatContinueLayers(continueDraft.droppedLayers) }}</span>
          </p>
          <details v-if="continueDraft.ragHits.length > 0" class="chapter-hub-ai-continue__rag">
            <summary>旧章检索 {{ continueDraft.ragHits.length }} 段</summary>
            <article v-for="hit in continueDraft.ragHits" :key="`${hit.chapterId}-${hit.excerpt.slice(0, 24)}`" class="chapter-hub-ai-continue__rag-item">
              <p class="chapter-hub-ai-continue__rag-meta">
                第 {{ hit.chapterNo }} 章 · {{ ragSourceLabel(hit.source) }} · {{ hit.matchedTerms.join('、') }}
              </p>
              <p class="chapter-hub-ai-continue__rag-excerpt">{{ hit.excerpt }}</p>
            </article>
          </details>
          <p v-for="warning in continueDraft.warnings" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
          <footer v-if="continueDraft.status === 'ready' && !continueDraft.loading" class="chapter-hub-ai-card__footer">
            <button type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('continue-adopt')">采用</button>
            <button type="button" class="chapter-hub-ai-action" @click="$emit('continue-ignore')">忽略</button>
            <button type="button" class="chapter-hub-ai-action" @click="regenerateContinue">重新生成</button>
          </footer>
          <footer v-else-if="continueDraft.loading" class="chapter-hub-ai-card__footer">
            <button type="button" class="chapter-hub-ai-action" @click="$emit('continue-stop')">终止</button>
          </footer>
        </article>

        <article v-if="deskMode === 'ask' && loading" class="chapter-hub-ai-message chapter-hub-ai-message--assistant">
          <div class="chapter-hub-ai-message__meta">
            <span class="chapter-hub-ai-message__author">Assistant</span>
          </div>
          <div class="chapter-hub-ai-message__body chapter-hub-ai-message__body--streaming">
            <div class="chapter-hub-ai-streaming">
              <div class="chapter-hub-ai-streaming__dots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p class="chapter-hub-ai-streaming__title">正在整理...</p>
              <p class="chapter-hub-ai-streaming__desc">人物、势力、物品、关系、伏笔和章节分类会整理到当前会话里。</p>
              <div class="chapter-hub-ai-streaming__lines" aria-hidden="true">
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--lg"></span>
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--md"></span>
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--sm"></span>
              </div>
            </div>
          </div>
        </article>

        <article v-if="deskMode === 'ask' && chatThinking && !hasLiveAssistantMessage" class="chapter-hub-ai-message chapter-hub-ai-message--assistant">
          <div class="chapter-hub-ai-message__meta">
            <span class="chapter-hub-ai-message__author">Assistant</span>
          </div>
          <div class="chapter-hub-ai-message__body chapter-hub-ai-message__body--streaming">
            <div class="chapter-hub-ai-streaming">
              <div class="chapter-hub-ai-streaming__dots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p class="chapter-hub-ai-streaming__title">正在回答你的问题...</p>
              <p class="chapter-hub-ai-streaming__desc">我会结合当前章节、上下文和已整理信息来组织回答。</p>
              <div class="chapter-hub-ai-streaming__lines" aria-hidden="true">
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--lg"></span>
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--md"></span>
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--sm"></span>
              </div>
            </div>
          </div>
        </article>

        <article v-if="error" class="chapter-hub-ai-message chapter-hub-ai-message--assistant">
          <div class="chapter-hub-ai-message__meta">
            <span class="chapter-hub-ai-message__author">Assistant</span>
            <span class="chapter-hub-ai-message__tag chapter-hub-ai-message__tag--error">Error</span>
          </div>
          <div class="chapter-hub-ai-message__body chapter-hub-ai-message__body--error">
            <p>{{ error }}</p>
          </div>
        </article>

        <article
          v-if="deskMode === 'ask' && pendingToolActions.length > 0"
          class="chapter-hub-ai-card chapter-hub-ai-card--pending-tools"
        >
          <header class="chapter-hub-ai-card__head">
            <div class="chapter-hub-ai-card__title-wrap">
              <h4 class="chapter-hub-ai-card__title">待确认的修改</h4>
              <p class="chapter-hub-ai-card__subtitle">采用后才会新建章节、写入正文、章总结、大纲、角色、势力、伏笔或时间线</p>
            </div>
          </header>
          <ul class="chapter-hub-ai-pending-tools__list">
            <li v-for="action in pendingToolActions" :key="action.id" class="chapter-hub-ai-pending-tools__item">
              <div class="chapter-hub-ai-pending-tools__main">
                <span class="chapter-hub-ai-pending-tools__label">{{ action.label }}</span>
                <p v-if="action.previewText" class="chapter-hub-ai-pending-tools__preview muted">
                  {{ action.previewText }}
                </p>
              </div>
              <button type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('pending-tool-adopt-one', action.id)">
                采用
              </button>
            </li>
          </ul>
          <footer class="chapter-hub-ai-card__footer">
            <button type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('pending-tool-adopt-all')">全部采用</button>
            <button type="button" class="chapter-hub-ai-action" @click="$emit('pending-tool-ignore-all')">全部忽略</button>
          </footer>
        </article>

      </div>

      <footer class="chapter-hub-ai-panel__composer">
        <div class="chapter-hub-ai-panel__composer-shell">
          <div v-if="selectionQuote" class="chapter-hub-ai-panel__selection-quote">
            <span class="chapter-hub-ai-panel__selection-chip">引用正文</span>
            <p>{{ selectionQuote }}</p>
            <button type="button" class="chapter-hub-ai-panel__selection-clear" @click="$emit('clear-selection-quote')">清除</button>
          </div>

          <div class="chapter-hub-ai-panel__input-wrap">
            <textarea
              ref="composerInputRef"
              v-model="draft"
              class="chapter-hub-ai-panel__input"
              rows="1"
              maxlength="500"
              :placeholder="deskMode === 'write' ? '说明写作需求，如：按大纲写下一章 / 续写本章争吵后的场景…' : '询问当前章的人物、伏笔、冲突……'"
              @keydown="onComposerKeydown"
            />
          </div>

          <details
            v-if="deskMode === 'ask' && askContextFoldVisible"
            class="chapter-hub-ai-ask-context"
          >
            <summary class="chapter-hub-ai-ask-context__summary">{{ askContextSummary }}</summary>
            <div class="chapter-hub-ai-ask-context__body">
              <p v-if="askContextMeta.usedLayers.length > 0 || askContextMeta.droppedLayers.length > 0" class="chapter-hub-ai-ask-context__layers">
                <span v-if="askContextMeta.usedLayers.length > 0">已纳入：{{ formatAskLayers(askContextMeta.usedLayers) }}</span>
                <span v-if="askContextMeta.droppedLayers.length > 0"> · 已省略：{{ formatAskLayers(askContextMeta.droppedLayers) }}</span>
              </p>
              <ul v-if="askContextMeta.warnings.length > 0" class="chapter-hub-ai-ask-context__warnings">
                <li v-for="warning in askContextMeta.warnings" :key="`ask-w-${warning}`">{{ warning }}</li>
              </ul>
              <details v-if="askContextMeta.ragHits.length > 0" class="chapter-hub-ai-continue__rag">
                <summary>旧章检索 {{ askContextMeta.ragHits.length }} 段</summary>
                <article
                  v-for="hit in askContextMeta.ragHits"
                  :key="`ask-rag-${hit.chapterId}-${hit.excerpt.slice(0, 20)}`"
                  class="chapter-hub-ai-continue__rag-item"
                >
                  <p class="chapter-hub-ai-continue__rag-meta">
                    第 {{ hit.chapterNo }} 章 · {{ ragSourceLabel(hit.source) }} · {{ hit.matchedTerms.join('、') }}
                  </p>
                  <p class="chapter-hub-ai-continue__rag-excerpt">{{ hit.excerpt }}</p>
                </article>
              </details>
            </div>
          </details>

          <div class="chapter-hub-ai-panel__composer-bar">
            <span class="chapter-hub-ai-panel__hint">{{ composerHint }}</span>
            <button
              v-if="deskMode === 'write'"
              type="button"
              class="chapter-hub-ai-panel__ask"
              :class="{ 'chapter-hub-ai-panel__ask--stop': writeComposerBusy }"
              :data-busy="writeComposerBusy ? 'true' : 'false'"
              :disabled="loading || (!writeComposerBusy && !targetChapter && !canCreateFirstChapter)"
              :aria-label="writeComposerBusy ? '终止续写' : '生成续写'"
              @click="onWriteComposerClick()"
            >
              {{ writeComposerBusy ? '终止' : '生成' }}
            </button>
            <button
              v-else
              type="button"
              class="chapter-hub-ai-panel__ask"
              :class="{ 'chapter-hub-ai-panel__ask--stop': askComposerBusy }"
              :data-busy="askComposerBusy ? 'true' : 'false'"
              :disabled="loading || (!askComposerBusy && !canSend)"
              :aria-label="askComposerBusy ? '终止回答' : '发送提问'"
              @click="onAskComposerClick()"
            >
              {{ askComposerBusy ? '终止' : '发送' }}
            </button>
          </div>
        </div>
      </footer>
    </div>
  </aside>

  <CardKeyRedeemDialog :open="redeemOpen" @close="redeemOpen = false" @redeemed="onRedeemed" />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import CardKeyRedeemDialog from '../../../components/CardKeyRedeemDialog.vue'
import { requestAiAccess } from '../../../composables/useAiAccess'
import { useAuth } from '../../../composables/useAuth'
import { formatBalanceYuan } from '../../../lib/balanceFormat'
import { fetchWalletBalance } from '../../../lib/backendAi'
import { ASK_CONTEXT_LAYER_LABELS, CONTINUE_CONTEXT_LAYER_LABELS } from '../../../lib/localAi'
import type {
  AiAnalysisKind,
  AiDeskChatMessage,
  AiAskContextMeta,
  AiChapterSummaryDraft,
  AiContinueDraft,
  ContinueRagSnippetHit,
  AiDeskMode,
  Chapter,
  EntityMatchType,
  ExtractedCharacter,
  ExtractedFaction,
  ExtractedItem,
  ExtractedRelation,
  NovelChapterClassificationResult,
  NovelEntityExtractResult,
  NovelForeshadowAnalysisResult,
} from '../../../types'

const props = defineProps<{
  open: boolean
  loading: boolean
  chatLoading: boolean
  chatThinking: boolean
  error: string
  result: NovelEntityExtractResult
  foreshadowResult: NovelForeshadowAnalysisResult
  classificationResult: NovelChapterClassificationResult
  appliedActions: Array<{ id: string; text: string; tone: 'applied' | 'ignored' }>
  extractRuns: Array<{
    id: string
    createdAt: string
    kind: AiAnalysisKind
    mode: 'current' | 'recent' | 'all' | null
    chapterId: string
    result: NovelEntityExtractResult
    entityResult?: NovelEntityExtractResult
    foreshadowResult?: NovelForeshadowAnalysisResult
    classificationResult?: NovelChapterClassificationResult
    appliedActions: Array<{ id: string; text: string; tone: 'applied' | 'ignored' }>
  }>
  chatSessions: Array<{ id: string; title: string; updatedAt: string }>
  chatHistorySessions: Array<{ id: string; title: string; updatedAt: string; lastQuestionAt: string }>
  activeChatId: string
  targetChapter?: Chapter | null
  canCreateFirstChapter?: boolean
  hasRun: boolean
  chatMessages: AiDeskChatMessage[]
  selectionQuote?: string
  deskMode: AiDeskMode
  continueDraft: AiContinueDraft
  continueThinkingText?: string
  chapterSummaryDraft: AiChapterSummaryDraft
  askContextMeta: AiAskContextMeta
  pendingToolActions: Array<{
    id: string
    label: string
    previewText?: string
    status: 'pending' | 'applied' | 'ignored'
  }>
}>()

const emit = defineEmits<{
  run: []
  'toggle-desk-mode': []
  ask: [payload: { question: string; mode: AiDeskMode }]
  'continue-run': [payload: { direction: string }]
  'continue-stop': []
  'continue-adopt': []
  'continue-ignore': []
  'chapter-summary-adopt': []
  'chapter-summary-ignore': []
  'chapter-summary-stop': []
  newChat: []
  switchChat: [sessionId: string]
  closeChat: [sessionId: string]
  deleteChat: [sessionId: string]
  collapse: []
  clearSelectionQuote: []
  stopAsk: []
  apply: [payload: { section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations' | 'foreshadows' | 'classification' | 'outlineItems'; index: number; action: 'create' | 'merge' | 'ignore' | 'reopen' }]
  openEditor: [payload: { section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations'; index: number }]
  'pending-tool-adopt-all': []
  'pending-tool-adopt-one': [actionId: string]
  'pending-tool-ignore-all': []
}>()

const { balance, refresh: refreshAuth } = useAuth()
const redeemOpen = ref(false)
const balanceRefreshing = ref(false)

const balanceLabel = computed(() => formatBalanceYuan(balance.value))

async function refreshBalance(): Promise<void> {
  if (!requestAiAccess()) return
  if (balanceRefreshing.value) return
  balanceRefreshing.value = true
  try {
    await fetchWalletBalance()
    refreshAuth()
  } catch {
    /* 静默失败，用户可重试 */
  } finally {
    balanceRefreshing.value = false
  }
}

function onWalletClick(): void {
  if (!requestAiAccess()) return
  redeemOpen.value = true
  void refreshBalance()
}

function onRedeemed(): void {
  refreshAuth()
}

function onAccountChanged(): void {
  refreshAuth()
}

const draft = ref('')
const scrollRef = ref<HTMLElement | null>(null)
const composerInputRef = ref<HTMLTextAreaElement | null>(null)
const historyOpen = ref(false)
const expandedRunIds = ref<string[]>([])
function resizeComposer(): void {
  const el = composerInputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}
watch(draft, () => {
  void nextTick(resizeComposer)
})
function formatContinueLayers(keys: string[]): string {
  return keys.map((key) => CONTINUE_CONTEXT_LAYER_LABELS[key] ?? key).join('、')
}

function formatAskLayers(keys: string[]): string {
  return keys.map((key) => ASK_CONTEXT_LAYER_LABELS[key] ?? CONTINUE_CONTEXT_LAYER_LABELS[key] ?? key).join('、')
}

function ragSourceLabel(source: ContinueRagSnippetHit['source']): string {
  if (source === 'foreshadow') return '伏笔'
  if (source === 'location') return '地点'
  return '人物'
}
const lastContinueDirection = ref('')

const busy = computed(() => props.loading || props.chatLoading || props.continueDraft.loading)
const askComposerBusy = computed(() => props.chatLoading || props.chatThinking)
const writeComposerBusy = computed(() => props.continueDraft.loading)
const composerHint = computed(() => {
  if (props.deskMode === 'write') {
    return writeComposerBusy.value ? 'Enter 终止，Shift+Enter 换行' : 'Enter 生成，Shift+Enter 换行'
  }
  if (props.pendingToolActions.length > 0) {
    return '请先确认上方「待确认的修改」，或全部忽略后再继续提问'
  }
  return askComposerBusy.value ? 'Enter 终止，Shift+Enter 换行' : 'Enter 发送，Shift+Enter 换行'
})
const hasLiveAssistantMessage = computed(() =>
  askComposerBusy.value &&
  props.chatMessages.length > 0 &&
  props.chatMessages[props.chatMessages.length - 1]?.role === 'assistant',
)

const continueThinkingExcerpt = computed(() => {
  const text = String(props.continueThinkingText ?? '').trim()
  if (!text) return ''
  return text.length > 240 ? `${text.slice(-240)}…` : text
})

const askContextFoldVisible = computed(
  () => props.askContextMeta.usedChars > 0 || props.askContextMeta.warnings.length > 0 || props.askContextMeta.ragHits.length > 0,
)

const askContextSummary = computed(() => {
  const parts: string[] = []
  if (props.askContextMeta.usedChars > 0) parts.push(`上下文约 ${props.askContextMeta.usedChars} 字`)
  if (props.askContextMeta.warnings.length > 0) parts.push(`${props.askContextMeta.warnings.length} 条打包说明`)
  if (props.askContextMeta.ragHits.length > 0) parts.push(`旧章检索 ${props.askContextMeta.ragHits.length} 段`)
  return parts.length > 0 ? parts.join(' · ') : '查看上下文打包'
})

const latestExtractAnchorAt = computed(() => {
  if (props.deskMode !== 'ask' || !props.hasRun || props.extractRuns.length === 0) return null
  return props.extractRuns[0].createdAt
})

const chatMessagesBeforeExtract = computed(() => {
  const anchor = latestExtractAnchorAt.value
  if (!anchor) return props.chatMessages
  const anchorTs = new Date(anchor).getTime()
  return props.chatMessages.filter((message) => new Date(message.createdAt).getTime() <= anchorTs)
})

const chatMessagesAfterExtract = computed(() => {
  const anchor = latestExtractAnchorAt.value
  if (!anchor) return []
  const anchorTs = new Date(anchor).getTime()
  return props.chatMessages.filter((message) => new Date(message.createdAt).getTime() > anchorTs)
})

const inlineExtractRuns = computed(() => {
  if (props.deskMode !== 'ask' || !props.hasRun || props.loading) return []
  const run = props.extractRuns[0]
  return run ? [run] : []
})

function isLiveAssistantMessage(message: AiDeskChatMessage): boolean {
  return Boolean(
    askComposerBusy.value &&
    props.chatMessages[props.chatMessages.length - 1]?.id === message.id &&
    message.role === 'assistant',
  )
}
const canSend = computed(() => !!draft.value.trim())

const historyToggleLabel = computed(() =>
  props.deskMode === 'write'
    ? { open: '打开写作记录', close: '收起写作记录' }
    : { open: '打开提问记录', close: '收起提问记录' },
)

function formatLastQuestionAt(value: string): string {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return '尚未提问'
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

function formatHistoryAge(value: string): string {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return '--'
  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  if (diffDays >= 1) return `${diffDays}d`
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)))
  if (diffHours >= 1) return `${diffHours}h`
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)))
  return `${diffMinutes}m`
}

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

function scrollToBottom(smooth = false): void {
  const el = scrollRef.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' as ScrollBehavior })
}

function shouldAutoScrollToBottom(): boolean {
  if (props.loading || props.chatLoading || props.chatThinking || props.continueDraft.loading) return true
  const el = scrollRef.value
  return el ? isNearBottom(el) : true
}

function restoreAiPanelScrollTop(scrollTop: number): void {
  const el = scrollRef.value
  if (!el) return
  const top = Math.max(0, scrollTop)
  void nextTick(() => {
    requestAnimationFrame(() => {
      el.scrollTop = top
    })
  })
}

const extractUiFingerprint = computed(() => {
  const run = props.extractRuns[0]
  if (!run) return ''
  const r = run.result
  const suggestionStates = [
    ...r.characters.map((item) => item.uiState?.status ?? ''),
    ...r.factions.map((item) => item.uiState?.status ?? ''),
    ...r.items.map((item) => item.uiState?.status ?? ''),
    ...r.memberships.map((item) => item.uiState?.status ?? ''),
    ...r.relations.map((item) => item.uiState?.status ?? ''),
    ...(run.foreshadowResult?.newPlants ?? []).map((item) => item.uiState?.status ?? ''),
    run.classificationResult?.uiState?.status ?? '',
  ].join('|')
  return `${run.appliedActions.length}|${suggestionStates}`
})

watch(
  () => props.chatMessages.length,
  () => {
    if (!shouldAutoScrollToBottom()) return
    void nextTick(() => scrollToBottom())
  },
)

watch(
  () => props.loading,
  (loading, wasLoading) => {
    if (wasLoading && !loading) {
      void nextTick(() => scrollToBottom(true))
    }
  },
)

watch(
  () => {
    const msgs = props.chatMessages
    return msgs.length > 0 ? msgs[msgs.length - 1].content : ''
  },
  () => {
    if (!shouldAutoScrollToBottom()) return
    const el = scrollRef.value
    if (!el) return
    void nextTick(() => {
      if (isNearBottom(el)) scrollToBottom()
    })
  },
)

let extractUiScrollSnapshot: number | null = null

watch(
  extractUiFingerprint,
  (_next, prev) => {
    if (!prev || props.loading) return
    const el = scrollRef.value
    extractUiScrollSnapshot = el ? el.scrollTop : null
  },
  { flush: 'pre' },
)

watch(
  extractUiFingerprint,
  (_next, prev) => {
    if (!prev || props.loading || extractUiScrollSnapshot == null) return
    restoreAiPanelScrollTop(extractUiScrollSnapshot)
    extractUiScrollSnapshot = null
  },
)

watch(
  () => props.open,
  (open) => {
    if (open) {
      void nextTick(() => {
        scrollToBottom()
      })
    }
  },
)

watch(
  () => props.deskMode,
  () => {
    historyOpen.value = false
  },
)

watch(
  () => props.extractRuns.map((item) => item.id).join('|'),
  () => {
    syncExpandedRuns()
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('novel-writing:changed', onAccountChanged)
  void nextTick(() => {
    scrollToBottom()
  })
})

onUnmounted(() => {
  window.removeEventListener('novel-writing:changed', onAccountChanged)
})

function formatRunMode(mode: 'current' | 'recent' | 'all' | null): string {
  if (mode === 'recent') return '最近 3 章'
  if (mode === 'all') return '全书'
  return '当前章'
}

function formatRunKind(kind: AiAnalysisKind): string {
  if (kind === 'foreshadows') return '伏笔'
  if (kind === 'classification') return '分类'
  return '综合整理'
}

function formatRunTime(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function isRunExpanded(id: string): boolean {
  return expandedRunIds.value.includes(id)
}

function toggleRunExpanded(id: string): void {
  expandedRunIds.value = isRunExpanded(id) ? expandedRunIds.value.filter((item) => item !== id) : [...expandedRunIds.value, id]
}

function syncExpandedRuns(): void {
  const ids = props.extractRuns.map((item) => item.id)
  expandedRunIds.value = expandedRunIds.value.filter((id) => ids.includes(id))
  if (props.extractRuns[0] && expandedRunIds.value.length === 0) {
    expandedRunIds.value = [props.extractRuns[0].id]
  }
}

function suggestionStateLabel(status?: 'pending' | 'applied' | 'ignored'): string {
  if (status === 'applied') return '已采用'
  if (status === 'ignored') return '已忽略'
  return '待确认'
}

const CHAPTER_TYPE_LABELS: Record<string, string> = {
  action: '动作',
  dialogue: '对话',
  description: '描写',
  interior: '心理',
  transition: '过渡',
  montage: '蒙太奇',
  other: '其他',
}

const PACING_LABELS: Record<string, string> = {
  fast: '快节奏',
  medium: '中等节奏',
  slow: '慢节奏',
}

function chapterTypeLabel(value?: string): string {
  const key = String(value ?? '').trim().toLowerCase()
  if (!key) return '未给出分类'
  return CHAPTER_TYPE_LABELS[key] ?? value!
}

function pacingLabel(value?: string): string {
  const key = String(value ?? '').trim().toLowerCase()
  if (!key) return ''
  return PACING_LABELS[key] ?? value!
}

function adoptLabel(type: EntityMatchType): string {
  return type === 'new' ? '采用' : '采用更新'
}

function characterFieldRows(item: ExtractedCharacter): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = []
  if (item.gender) rows.push({ label: '性别', value: item.gender })
  if (item.age) rows.push({ label: '年龄', value: item.age })
  if (item.goal) rows.push({ label: '目标', value: item.goal })
  if (item.secret) rows.push({ label: '秘密', value: item.secret })
  if (item.arc) rows.push({ label: '弧光', value: item.arc })
  for (const attr of item.attributes.slice(0, 4)) {
    if (attr.key && attr.value) rows.push({ label: attr.key, value: attr.value })
  }
  if (item.notes) rows.push({ label: '备注', value: item.notes })
  return rows
}

function itemFieldRows(item: ExtractedItem): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = []
  if (item.summary) rows.push({ label: '摘要', value: item.summary })
  if (item.ownerName) rows.push({ label: '归属', value: item.ownerName })
  if (item.firstAppearanceChapterNo) rows.push({ label: '初登场', value: `第 ${item.firstAppearanceChapterNo} 章` })
  return rows
}

function isSuggestionLocked(status?: 'pending' | 'applied' | 'ignored'): boolean {
  return status === 'applied' || status === 'ignored'
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderInlineMarkdown(content: string): string {
  let html = escapeHtml(content)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/(^|[^\*])\*([^*\n]+)\*(?=[^\*]|$)/g, '$1<em>$2</em>')
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  return html
}

function renderMessageMarkdown(content: string): string {
  const source = String(content ?? '').replace(/\r\n/g, '\n').trim()
  if (!source) return '<p></p>'

  const lines = source.split('\n')
  const blocks: string[] = []
  let paragraph: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let listItems: string[] = []
  let inCodeBlock = false
  let codeLines: string[] = []

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return
    blocks.push(`<p>${paragraph.map((line) => renderInlineMarkdown(line)).join('<br />')}</p>`)
    paragraph = []
  }

  const flushList = (): void => {
    if (!listType || listItems.length === 0) return
    blocks.push(`<${listType}>${listItems.join('')}</${listType}>`)
    listType = null
    listItems = []
  }

  const flushCodeBlock = (): void => {
    blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
    codeLines = []
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '  ')
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      flushParagraph()
      flushList()
      if (inCodeBlock) {
        flushCodeBlock()
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(rawLine)
      continue
    }

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      flushParagraph()
      flushList()
      blocks.push('<hr />')
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      const level = headingMatch[1].length
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`)
      continue
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      flushParagraph()
      flushList()
      blocks.push(`<blockquote><p>${renderInlineMarkdown(quoteMatch[1])}</p></blockquote>`)
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      flushParagraph()
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`)
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/)
    if (unorderedMatch) {
      flushParagraph()
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`)
      continue
    }

    flushList()
    paragraph.push(trimmed)
  }

  if (inCodeBlock) flushCodeBlock()
  flushParagraph()
  flushList()

  return blocks.join('')
}

function onAskComposerClick(): void {
  if (askComposerBusy.value) {
    emit('stop-ask')
    return
  }
  submitAsk()
}

function onWriteComposerClick(): void {
  if (writeComposerBusy.value) {
    emit('continue-stop')
    return
  }
  submitWrite()
}

function submitAsk(): void {
  if (askComposerBusy.value) {
    emit('stop-ask')
    return
  }
  const question = draft.value.trim()
  if (!question) return
  emit('ask', { question, mode: props.deskMode })
  draft.value = ''
}

function submitWrite(): void {
  if (writeComposerBusy.value) {
    emit('continue-stop')
    return
  }
  const direction = draft.value.trim()
  lastContinueDirection.value = direction
  emit('continue-run', { direction })
  draft.value = ''
}

function regenerateContinue(): void {
  emit('continue-run', { direction: lastContinueDirection.value })
}

function onComposerKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return
  if (event.key !== 'Enter' || event.shiftKey) return
  event.preventDefault()
  if (props.deskMode === 'write') {
    onWriteComposerClick()
    return
  }
  onAskComposerClick()
}

function matchLabel(type: EntityMatchType, identityStatus?: string): string {
  if (identityStatus === 'uncertain') return '身份待确认'
  if (identityStatus === 'possible_same_person') return '疑似同一人'
  if (type === 'new') return '新建建议'
  if (type === 'update') return '更新建议'
  if (type === 'possible_duplicate') return '疑似重复'
  return '冲突待确认'
}

function confidenceLabel(value: number): string {
  return `置信 ${Math.round((value || 0) * 100)}%`
}

function actionLabel(type: EntityMatchType): string {
  if (type === 'new') return '待新建'
  if (type === 'update') return '待合并'
  if (type === 'possible_duplicate') return '待确认'
  return '有冲突'
}

function canMerge(type: EntityMatchType, targetId?: string | null): boolean {
  return type !== 'new' && !!String(targetId ?? '').trim()
}

function characterSummary(item: ExtractedCharacter): string {
  const attrPreview = item.attributes.slice(0, 3).map((attr) => `${attr.key} ${attr.value}`).join(' · ')
  const parts = [
    item.gender,
    item.age && `年龄 ${item.age}`,
    item.goal && `目标 ${item.goal}`,
    item.secret && `秘密 ${item.secret}`,
    item.arc && `弧光 ${item.arc}`,
    attrPreview,
    item.notes,
  ]
  return parts.filter(Boolean).join(' · ') || '未提取到更多字段'
}

function factionSummary(item: ExtractedFaction): string {
  const attrPreview = (item.attributes ?? []).slice(0, 2).map((attr) => `${attr.key} ${attr.value}`).join(' · ')
  const parts = [item.leader && `首领 ${item.leader}`, attrPreview, item.notes]
  return parts.filter(Boolean).join(' · ') || '未提取到更多字段'
}

function itemSummary(item: ExtractedItem): string {
  const parts = [item.summary, item.ownerName && `归属 ${item.ownerName}`, item.firstAppearanceChapterNo && `初登场第 ${item.firstAppearanceChapterNo} 章`]
  return parts.filter(Boolean).join(' · ') || '未提取到更多字段'
}

function relationSummary(item: ExtractedRelation): string {
  const parts = [item.relationType, item.note]
  return parts.filter(Boolean).join(' · ') || '未提取到更多字段'
}
</script>

<style scoped>
.chapter-hub-ai-panel,
.chapter-hub-ai-panel__surface {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.chapter-hub-ai-panel__surface {
  position: relative;
  background: color-mix(in srgb, var(--color-surface) 97%, var(--color-bg) 3%);
}

.chapter-hub-ai-panel__header {
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--color-surface) 98%, transparent);
}

.chapter-hub-ai-panel__topbar {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: nowrap;
}

.chapter-hub-ai-panel__hero-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  justify-content: flex-end;
  flex: 1 1 auto;
  min-width: 0;
}

.chapter-hub-ai-panel__right-cluster {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  flex-wrap: nowrap;
}

.chapter-hub-ai-panel__collapse {
  flex: 0 0 auto;
}

.chapter-hub-ai-panel__history,
.chapter-hub-ai-panel__results-rail,
.chapter-hub-ai-panel__message__body,
.chapter-hub-ai-message__body,
.chapter-hub-ai-result__applied,
.chapter-hub-ai-section,
.chapter-hub-ai-suggestion,
.chapter-hub-ai-panel__selection-quote,
.chapter-hub-ai-panel__input-wrap {
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--color-surface-muted) 58%, var(--color-surface) 42%);
}

.chapter-hub-ai-panel__toolbtn,
.chapter-hub-ai-panel__iconbtn,
.chapter-hub-ai-panel__history-switch,
.chapter-hub-ai-panel__history-close,
.chapter-hub-ai-panel__selection-clear,
.chapter-hub-ai-panel__ask,
.chapter-hub-ai-action,
.chapter-hub-ai-panel__rail-item,
.chapter-hub-ai-result__fold {
  appearance: none;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 74%, transparent);
  background: color-mix(in srgb, var(--color-surface) 86%, var(--color-surface-muted) 14%);
  color: color-mix(in srgb, var(--color-text) 84%, var(--color-primary) 16%);
  transition: background 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.chapter-hub-ai-panel__toolbtn:hover,
.chapter-hub-ai-panel__iconbtn:hover,
.chapter-hub-ai-panel__history-switch:hover,
.chapter-hub-ai-panel__history-close:hover,
.chapter-hub-ai-panel__selection-clear:hover,
.chapter-hub-ai-panel__ask:hover,
.chapter-hub-ai-action:hover,
.chapter-hub-ai-panel__rail-item:hover,
.chapter-hub-ai-result__fold:hover {
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border-strong));
  background: color-mix(in srgb, var(--color-primary-soft) 24%, var(--color-surface));
  color: var(--color-text);
}

.chapter-hub-ai-panel__toolbtn,
.chapter-hub-ai-panel__selection-clear,
.chapter-hub-ai-panel__ask,
.chapter-hub-ai-action {
  min-height: 30px;
  padding: 0 11px;
  border-radius: 8px;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

.chapter-hub-ai-panel__iconbtn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 0.82rem;
  flex: 0 0 auto;
}

.chapter-hub-ai-panel__mode {
  display: inline-flex;
  min-height: 30px;
  padding: 2px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-surface-muted) 50%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 60%, transparent);
}
.chapter-hub-ai-panel__mode-seg {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0 12px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.14s ease, color 0.14s ease;
}
.chapter-hub-ai-panel__mode-seg.is-active {
  background: var(--color-primary);
  color: #fff;
}

.chapter-hub-ai-panel__wallet {
  display: inline-flex;
  align-items: stretch;
  min-height: 30px;
  max-width: 132px;
  flex: 0 1 auto;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 74%, transparent);
  background: color-mix(in srgb, var(--color-surface) 86%, var(--color-surface-muted) 14%);
  overflow: hidden;
  transition: border-color 0.14s ease, background 0.14s ease;
}

.chapter-hub-ai-panel__wallet:hover {
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border-strong));
  background: color-mix(in srgb, var(--color-primary-soft) 24%, var(--color-surface));
}

.chapter-hub-ai-panel__wallet-main {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  flex: 1 1 auto;
  padding: 0 6px 0 9px;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--color-text) 84%, var(--color-primary) 16%);
  cursor: pointer;
  font: inherit;
}

.chapter-hub-ai-panel__wallet-main:hover {
  color: var(--color-text);
}

.chapter-hub-ai-panel__wallet-refresh {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-left: 1px solid color-mix(in srgb, var(--color-border-strong) 68%, transparent);
  background: transparent;
  color: color-mix(in srgb, var(--color-text-muted) 88%, var(--color-text) 12%);
  cursor: pointer;
  font-size: 0.78rem;
  line-height: 1;
}

.chapter-hub-ai-panel__wallet-refresh:hover {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-primary-soft) 18%, transparent);
}

.chapter-hub-ai-panel__wallet-icon {
  font-size: 0.72rem;
  line-height: 1;
  opacity: 0.88;
}

.chapter-hub-ai-panel__wallet-balance {
  font-size: 0.64rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chapter-hub-ai-panel__wallet-refresh.is-spinning span {
  display: inline-block;
  animation: chapter-hub-ai-wallet-spin 0.7s linear infinite;
}

.chapter-hub-ai-panel__wallet-refresh:disabled {
  opacity: 0.5;
  cursor: wait;
}

@keyframes chapter-hub-ai-wallet-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.chapter-hub-ai-panel__toolbtn--primary,
.chapter-hub-ai-panel__ask,
.chapter-hub-ai-action--primary {
  border-color: color-mix(in srgb, var(--color-primary) 36%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 42%, var(--color-surface));
  color: var(--color-text);
}

.chapter-hub-ai-panel__toolbtn--ghost {
  color: var(--color-text-muted);
}

.chapter-hub-ai-panel__toolbtn:disabled,
.chapter-hub-ai-panel__ask:disabled,
.chapter-hub-ai-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}


.chapter-hub-ai-panel__history {
  position: absolute;
  top: 56px;
  left: 12px;
  right: 12px;
  display: grid;
  gap: 0;
  max-height: min(360px, 48vh);
  overflow: auto;
  margin: 0;
  padding: 6px 0;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 84%, transparent);
  background: color-mix(in srgb, var(--color-surface) 98%, var(--color-surface-muted) 2%);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.26);
  z-index: 8;
}

.chapter-hub-ai-panel__history-empty {
  display: grid;
  gap: 4px;
  padding: 16px 12px 18px;
  background: transparent;
}

.chapter-hub-ai-panel__history-empty p {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--color-text);
}

.chapter-hub-ai-panel__history-empty span {
  font-size: 0.6rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.chapter-hub-ai-panel__history-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0;
  align-items: center;
  min-height: 42px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 48%, transparent);
  background: transparent;
  transition: background 0.14s ease;
}

.chapter-hub-ai-panel__history-item:last-child {
  border-bottom: 0;
}

.chapter-hub-ai-panel__history-item[data-active='true'] {
  background: color-mix(in srgb, var(--color-primary-soft) 28%, var(--color-surface-muted));
}

.chapter-hub-ai-panel__history-item:hover {
  background: color-mix(in srgb, var(--color-surface-muted) 88%, var(--color-surface));
}

.chapter-hub-ai-panel__history-switch {
  min-height: 0;
  width: 100%;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  text-align: left;
  background: transparent;
  border: 0;
}

.chapter-hub-ai-panel__history-close {
  width: 28px;
  height: 28px;
  margin-right: 8px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: color-mix(in srgb, var(--color-text-muted) 84%, transparent);
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  opacity: 0.7;
}

.chapter-hub-ai-panel__history-item:hover .chapter-hub-ai-panel__history-close,
.chapter-hub-ai-panel__history-item[data-active='true'] .chapter-hub-ai-panel__history-close {
  opacity: 1;
  color: var(--color-text-muted);
}

.chapter-hub-ai-panel__history-main,
.chapter-hub-ai-panel__history-side {
  min-width: 0;
}

.chapter-hub-ai-panel__history-main {
  display: flex;
  align-items: center;
  min-width: 0;
}

.chapter-hub-ai-panel__history-title {
  font-size: 0.72rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--color-text) 92%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chapter-hub-ai-panel__history-side {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
}

.chapter-hub-ai-panel__history-time {
  font-size: 0.64rem;
  color: var(--color-text-muted);
}

.chapter-hub-ai-panel__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chapter-hub-ai-panel__results-rail {
  display: grid;
  gap: 8px;
  padding: 8px;
  border-radius: 12px;
}

.chapter-hub-ai-panel__rail-title {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.chapter-hub-ai-panel__rail-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chapter-hub-ai-panel__rail-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 0 9px;
  border-radius: 8px;
  font-size: 0.64rem;
  font-weight: 700;
}

.chapter-hub-ai-panel__rail-item[data-active='true'] {
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 30%, var(--color-surface));
}

.chapter-hub-ai-message {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.chapter-hub-ai-message--user {
  align-items: flex-end;
}

.chapter-hub-ai-message__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.chapter-hub-ai-message__body {
  max-width: 100%;
  padding: 10px;
  border-radius: 10px;
  box-shadow: none;
  font-size: 0.68rem;
  line-height: 1.55;
}

.chapter-hub-ai-message--assistant .chapter-hub-ai-message__body {
  border-left: 2px solid color-mix(in srgb, var(--color-primary) 26%, transparent);
}

.chapter-hub-ai-message--live .chapter-hub-ai-message__body {
  border-left-color: color-mix(in srgb, var(--color-primary) 54%, transparent);
}

.chapter-hub-ai-message--user .chapter-hub-ai-message__body {
  max-width: min(88%, 520px);
  background: color-mix(in srgb, var(--color-primary-soft) 26%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-primary) 24%, transparent);
}

.chapter-hub-ai-message__body--hint,
.chapter-hub-ai-message__body--streaming {
  color: var(--color-text-muted);
}

.chapter-hub-ai-message__body--live-markdown {
  position: relative;
}

.chapter-hub-ai-message__body--live-markdown > :deep(*) {
  margin-bottom: 0;
}

.chapter-hub-ai-message__caret {
  display: inline-block;
  width: 9px;
  height: 16px;
  margin-left: 4px;
  border-radius: 2px;
  vertical-align: -2px;
  background: color-mix(in srgb, var(--color-primary) 74%, var(--color-text) 26%);
  animation: chapter-hub-ai-message-caret 0.9s steps(1) infinite;
}

.chapter-hub-ai-message__body--streaming {
  padding: 12px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface-muted) 92%, transparent), color-mix(in srgb, var(--color-surface) 96%, transparent));
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 32%, transparent);
}

.chapter-hub-ai-streaming {
  display: grid;
  gap: 10px;
}

.chapter-hub-ai-streaming__dots {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.chapter-hub-ai-streaming__dots span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 72%, #fff 28%);
  animation: chapter-hub-ai-streaming-dot 1.15s ease-in-out infinite;
}

.chapter-hub-ai-streaming__dots span:nth-child(2) {
  animation-delay: 0.16s;
}

.chapter-hub-ai-streaming__dots span:nth-child(3) {
  animation-delay: 0.32s;
}

.chapter-hub-ai-streaming__title,
.chapter-hub-ai-streaming__desc {
  margin: 0;
}

.chapter-hub-ai-streaming__title {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-text);
}

.chapter-hub-ai-streaming__desc {
  font-size: 0.64rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.chapter-hub-ai-streaming__lines {
  display: grid;
  gap: 7px;
}

.chapter-hub-ai-streaming__line {
  display: block;
  height: 8px;
  border-radius: 999px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--color-primary-soft) 22%, var(--color-surface-muted)) 0%, color-mix(in srgb, #fff 72%, var(--color-surface)) 50%, color-mix(in srgb, var(--color-primary-soft) 22%, var(--color-surface-muted)) 100%);
  background-size: 220% 100%;
  animation: chapter-hub-ai-streaming-line 1.8s linear infinite;
}

.chapter-hub-ai-streaming__line--lg {
  width: 100%;
}

.chapter-hub-ai-streaming__line--md {
  width: 76%;
}

.chapter-hub-ai-streaming__line--sm {
  width: 54%;
}

@keyframes chapter-hub-ai-streaming-dot {
  0%, 80%, 100% {
    transform: translateY(0);
    opacity: 0.42;
  }

  40% {
    transform: translateY(-2px);
    opacity: 1;
  }
}

@keyframes chapter-hub-ai-streaming-line {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

@keyframes chapter-hub-ai-message-caret {
  0%, 49% {
    opacity: 1;
  }

  50%, 100% {
    opacity: 0;
  }
}

.chapter-hub-ai-message__body--empty {
  display: grid;
  gap: 8px;
}

.chapter-hub-ai-message__empty-title {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-text);
}

.chapter-hub-ai-message__body--error {
  border-color: color-mix(in srgb, #b91c1c 34%, var(--color-border-strong));
  background: color-mix(in srgb, #b91c1c 7%, var(--color-surface));
}

.chapter-hub-ai-message__tag {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary-soft) 30%, transparent);
}

.chapter-hub-ai-message__tag--error {
  background: color-mix(in srgb, #b91c1c 16%, transparent);
  color: #991b1b;
}

.chapter-hub-ai-result {
  display: grid;
  gap: 8px;
}

.chapter-hub-ai-result__fold {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 700;
  text-align: left;
}

.chapter-hub-ai-result__fold span:last-child {
  color: var(--color-text-muted);
}

.chapter-hub-ai-result__empty {
  margin: 0;
  font-size: 0.66rem;
  color: var(--color-text-muted);
}

.chapter-hub-ai-result__applied {
  display: grid;
  gap: 6px;
  padding: 10px;
  border-radius: 10px;
}

.chapter-hub-ai-result__applied-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.64rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.chapter-hub-ai-result__applied-item {
  margin: 0;
  font-size: 0.66rem;
  line-height: 1.5;
}

.chapter-hub-ai-section {
  margin-top: 8px;
  border-radius: 10px;
  overflow: hidden;
}

.chapter-hub-ai-section__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  font-size: 0.66rem;
  font-weight: 700;
  cursor: pointer;
  list-style: none;
  background: color-mix(in srgb, var(--color-surface) 90%, transparent);
}

.chapter-hub-ai-section__summary::-webkit-details-marker {
  display: none;
}

.chapter-hub-ai-section__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary-soft) 42%, transparent);
  color: color-mix(in srgb, var(--color-primary) 82%, var(--color-text) 18%);
}

.chapter-hub-ai-section__content {
  display: grid;
  gap: 8px;
  padding: 0 10px 10px;
}

.chapter-hub-ai-section__content--warnings {
  gap: 8px;
}

.chapter-hub-ai-warning-card,
.chapter-hub-ai-warning {
  margin: 0;
  padding: 8px 9px;
  border-radius: 8px;
  font-size: 0.64rem;
  line-height: 1.5;
  color: color-mix(in srgb, #8a4b10 84%, var(--color-text) 16%);
  background: color-mix(in srgb, #f59e0b 10%, var(--color-surface));
  border: 1px solid color-mix(in srgb, #f59e0b 24%, transparent);
}

.chapter-hub-ai-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--color-border) 88%, transparent);
  background: color-mix(in srgb, var(--color-surface) 94%, var(--color-surface-muted) 6%);
  box-shadow: 0 1px 0 color-mix(in srgb, #fff 6%, transparent);
}

.chapter-hub-ai-card--locked {
  opacity: 0.88;
}

.chapter-hub-ai-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.chapter-hub-ai-card__title-wrap {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.chapter-hub-ai-card__title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--color-text);
  word-break: break-word;
}

.chapter-hub-ai-card__subtitle {
  margin: 0;
  font-size: 0.62rem;
  line-height: 1.45;
  color: var(--color-text-muted);
}

.chapter-hub-ai-card__state {
  flex: 0 0 auto;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.58rem;
  font-weight: 700;
  color: color-mix(in srgb, var(--color-primary) 78%, var(--color-text) 22%);
  background: color-mix(in srgb, var(--color-primary-soft) 34%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.chapter-hub-ai-card__fields {
  display: grid;
  grid-template-columns: minmax(52px, 72px) minmax(0, 1fr);
  gap: 6px 10px;
  margin: 0;
  padding: 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-surface-muted) 42%, transparent);
}

.chapter-hub-ai-card__fields dt {
  margin: 0;
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.chapter-hub-ai-card__fields dd {
  margin: 0;
  font-size: 0.65rem;
  line-height: 1.55;
  color: var(--color-text);
  word-break: break-word;
}

.chapter-hub-ai-card__line {
  margin: 0;
  font-size: 0.64rem;
  line-height: 1.55;
  color: color-mix(in srgb, var(--color-text) 86%, var(--color-text-muted) 14%);
}

.chapter-hub-ai-card__line--muted {
  color: var(--color-text-muted);
  font-style: italic;
}

.chapter-hub-ai-card__kind {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--color-text);
}

.chapter-hub-ai-card--relation {
  border-color: color-mix(in srgb, var(--color-primary) 14%, var(--color-border) 86%);
}

.chapter-hub-ai-card--continue {
  border-color: color-mix(in srgb, var(--color-primary) 22%, var(--color-border) 78%);
}

.chapter-hub-ai-card--pending-tools {
  border-color: color-mix(in srgb, var(--color-warning, #c9a227) 35%, var(--color-border) 65%);
}

.chapter-hub-ai-pending-tools__list {
  margin: 0;
  padding: 0 10px 8px;
  list-style: none;
  display: grid;
  gap: 6px;
}

.chapter-hub-ai-pending-tools__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-surface-muted) 40%, transparent);
}

.chapter-hub-ai-pending-tools__main {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 4px;
}

.chapter-hub-ai-pending-tools__label {
  font-size: 0.68rem;
  line-height: 1.5;
  color: var(--color-text);
}

.chapter-hub-ai-pending-tools__preview {
  margin: 0;
  font-size: 0.62rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 5.5rem;
  overflow: hidden;
}

.chapter-hub-ai-continue__thinking {
  max-height: 4.5rem;
  overflow: hidden;
  opacity: 0.85;
}

.chapter-hub-ai-card--summary {
  border-color: color-mix(in srgb, var(--color-primary) 16%, var(--color-border) 84%);
}

.chapter-hub-ai-continue__preview {
  margin: 0;
  padding: 10px;
  max-height: 280px;
  overflow: auto;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-surface-muted) 42%, transparent);
  font-family: inherit;
  font-size: 0.68rem;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text);
}

.chapter-hub-ai-continue__options {
  display: grid;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-surface-muted) 36%, transparent);
}

.chapter-hub-ai-continue__option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chapter-hub-ai-continue__label {
  flex: 0 0 auto;
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.chapter-hub-ai-continue__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chapter-hub-ai-continue__chip {
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--color-text-muted);
  cursor: pointer;
}

.chapter-hub-ai-continue__chip.is-active {
  border-color: color-mix(in srgb, var(--color-primary) 28%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 42%, transparent);
  color: color-mix(in srgb, var(--color-primary) 76%, var(--color-text) 24%);
}

.chapter-hub-ai-continue__option-row--checks {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.chapter-hub-ai-continue__check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.62rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

.chapter-hub-ai-continue__option-row--brief {
  justify-content: space-between;
}

.chapter-hub-ai-continue__brief-btn {
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--color-text-muted);
  cursor: pointer;
}

.chapter-hub-ai-continue__brief-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.chapter-hub-ai-continue__brief-hint {
  font-size: 0.58rem;
  color: var(--color-text-muted);
}

.chapter-hub-ai-continue__context-meta {
  margin: 0;
  padding: 0 2px;
  font-size: 0.58rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.chapter-hub-ai-ask-context {
  margin: 0 10px 4px;
  padding: 0;
  font-size: 0.58rem;
  color: var(--color-text-muted);
}

.chapter-hub-ai-ask-context__summary {
  cursor: pointer;
  list-style: none;
  padding: 4px 0;
  line-height: 1.4;
  user-select: none;
}

.chapter-hub-ai-ask-context__summary::-webkit-details-marker {
  display: none;
}

.chapter-hub-ai-ask-context__summary::before {
  content: '▸ ';
  display: inline-block;
  transition: transform 0.15s ease;
}

.chapter-hub-ai-ask-context[open] .chapter-hub-ai-ask-context__summary::before {
  transform: rotate(90deg);
}

.chapter-hub-ai-ask-context__body {
  display: grid;
  gap: 4px;
  padding: 0 0 6px 0.85em;
  max-height: 120px;
  overflow: auto;
}

.chapter-hub-ai-ask-context__layers {
  margin: 0;
  line-height: 1.45;
}

.chapter-hub-ai-ask-context__warnings {
  margin: 0;
  padding-left: 1.1em;
  line-height: 1.45;
}

.chapter-hub-ai-ask-context__warnings li {
  margin: 2px 0;
}

.chapter-hub-ai-continue__rag {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-surface-muted) 34%, transparent);
  font-size: 0.62rem;
}

.chapter-hub-ai-continue__rag summary {
  cursor: pointer;
  font-weight: 700;
  color: var(--color-text-muted);
}

.chapter-hub-ai-continue__rag-item + .chapter-hub-ai-continue__rag-item {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
}

.chapter-hub-ai-continue__rag-meta {
  margin: 0 0 4px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.chapter-hub-ai-continue__rag-excerpt {
  margin: 0;
  line-height: 1.65;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.chapter-hub-ai-relation__flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  padding: 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-surface-muted) 42%, transparent);
}

.chapter-hub-ai-relation__person {
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--color-text);
  word-break: break-word;
}

.chapter-hub-ai-relation__person--faction {
  color: color-mix(in srgb, var(--color-primary) 72%, var(--color-text) 28%);
}

.chapter-hub-ai-relation__arrow {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--color-text-muted);
  user-select: none;
}

.chapter-hub-ai-relation__badge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  color: color-mix(in srgb, var(--color-primary) 80%, var(--color-text) 20%);
  background: color-mix(in srgb, var(--color-primary-soft) 40%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent);
}

.chapter-hub-ai-card__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
}

.chapter-hub-ai-suggestion {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
}

.chapter-hub-ai-suggestion__eyebrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.chapter-hub-ai-suggestion__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.chapter-hub-ai-suggestion__main {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.chapter-hub-ai-suggestion__main strong {
  font-size: 0.72rem;
  line-height: 1.3;
  color: var(--color-text);
}

.chapter-hub-ai-suggestion__type {
  font-size: 0.63rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.chapter-hub-ai-suggestion__summary,
.chapter-hub-ai-suggestion__meta {
  margin: 0;
  font-size: 0.65rem;
  line-height: 1.56;
  color: color-mix(in srgb, var(--color-text) 84%, var(--color-text-muted) 16%);
}

.chapter-hub-ai-suggestion__chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  flex: 0 0 auto;
}

.chapter-hub-ai-chip {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 700;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary-soft) 36%, var(--color-surface));
  color: color-mix(in srgb, var(--color-primary) 76%, var(--color-text) 24%);
}

.chapter-hub-ai-chip--soft {
  border-color: color-mix(in srgb, var(--color-border) 82%, transparent);
  background: color-mix(in srgb, var(--color-surface) 76%, transparent);
  color: var(--color-text-muted);
}

.chapter-hub-ai-evidence {
  border-top: 1px dashed color-mix(in srgb, var(--color-border) 74%, transparent);
  padding-top: 8px;
}

.chapter-hub-ai-evidence__summary {
  cursor: pointer;
  font-size: 0.64rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.chapter-hub-ai-evidence-list {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.chapter-hub-ai-evidence-list p {
  margin: 0;
  padding: 8px 9px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-surface) 72%, transparent);
  font-size: 0.63rem;
  line-height: 1.5;
}

.chapter-hub-ai-suggestion__actions,
.chapter-hub-ai-card__footer .chapter-hub-ai-action {
  min-height: 30px;
}

.chapter-hub-ai-card__footer .chapter-hub-ai-action--primary {
  flex: 1 1 96px;
}

.chapter-hub-ai-suggestion__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 2px;
}

.chapter-hub-ai-panel__composer {
  padding: 10px 12px 12px;
  border-top: 1px solid color-mix(in srgb, var(--color-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--color-surface) 98%, transparent);
}

.chapter-hub-ai-panel__composer-shell {
  display: grid;
  gap: 8px;
}

.chapter-hub-ai-panel__selection-quote {
  display: grid;
  gap: 7px;
  padding: 9px 10px;
  border-radius: 10px;
}

.chapter-hub-ai-panel__selection-quote p {
  margin: 0;
  font-size: 0.64rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.chapter-hub-ai-panel__selection-chip {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.58rem;
  font-weight: 700;
  background: color-mix(in srgb, var(--color-surface) 90%, transparent);
  color: color-mix(in srgb, var(--color-primary) 76%, var(--color-text) 24%);
}

.chapter-hub-ai-panel__input-wrap {
  border-radius: 10px;
  overflow: hidden;
}

.chapter-hub-ai-panel__input {
  box-sizing: border-box;
  width: 100%;
  height: auto;
  min-height: 38px;
  max-height: 160px;
  resize: none;
  overflow-y: auto;
  border: 0;
  background: transparent;
  padding: 9px 12px;
  font-size: 0.67rem;
  line-height: 1.55;
  color: var(--color-text);
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-border-strong) 66%, transparent) transparent;
}

.chapter-hub-ai-panel__input:focus {
  outline: none;
}

.chapter-hub-ai-panel__input::-webkit-scrollbar {
  width: 6px;
}

.chapter-hub-ai-panel__input::-webkit-scrollbar-track {
  background: transparent;
}

.chapter-hub-ai-panel__input::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-border-strong) 66%, transparent);
}

.chapter-hub-ai-panel__input::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--color-primary) 24%, var(--color-border-strong));
}

.chapter-hub-ai-panel__composer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chapter-hub-ai-panel__hint {
  font-size: 0.62rem;
  color: var(--color-text-muted);
}

.chapter-hub-ai-panel__ask[data-busy='true'] {
  background: color-mix(in srgb, var(--color-primary-soft) 58%, var(--color-surface));
}

.chapter-hub-ai-panel__ask--stop {
  color: color-mix(in srgb, var(--danger-text) 88%, var(--color-text) 12%);
  border-color: color-mix(in srgb, var(--danger-text) 28%, var(--color-border-strong));
  background: color-mix(in srgb, var(--danger-bg) 42%, var(--color-surface) 58%);
}

.chapter-hub-ai-panel__ask--stop:hover {
  color: var(--danger-text);
  border-color: color-mix(in srgb, var(--danger-text) 40%, var(--color-border-strong));
  background: color-mix(in srgb, var(--danger-bg) 58%, var(--color-surface) 42%);
}

.chapter-hub-ai-message__body--markdown :deep(p),
.chapter-hub-ai-message__body--markdown :deep(ul),
.chapter-hub-ai-message__body--markdown :deep(ol),
.chapter-hub-ai-message__body--markdown :deep(pre),
.chapter-hub-ai-message__body--markdown :deep(blockquote),
.chapter-hub-ai-message__body--markdown :deep(table) {
  margin: 0 0 10px;
}

.chapter-hub-ai-message__body--markdown :deep(h1),
.chapter-hub-ai-message__body--markdown :deep(h2),
.chapter-hub-ai-message__body--markdown :deep(h3),
.chapter-hub-ai-message__body--markdown :deep(h4),
.chapter-hub-ai-message__body--markdown :deep(h5),
.chapter-hub-ai-message__body--markdown :deep(h6) {
  margin: 14px 0 7px;
  line-height: 1.35;
  font-weight: 750;
  color: var(--color-text);
}

.chapter-hub-ai-message__body--markdown :deep(h1) { font-size: 0.92rem; }
.chapter-hub-ai-message__body--markdown :deep(h2) {
  font-size: 0.84rem;
  padding-bottom: 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border-strong) 36%, transparent);
}
.chapter-hub-ai-message__body--markdown :deep(h3) { font-size: 0.78rem; }
.chapter-hub-ai-message__body--markdown :deep(h4),
.chapter-hub-ai-message__body--markdown :deep(h5),
.chapter-hub-ai-message__body--markdown :deep(h6) {
  font-size: 0.72rem;
  color: color-mix(in srgb, var(--color-primary) 64%, var(--color-text) 36%);
}

.chapter-hub-ai-message__body--markdown :deep(*:first-child) {
  margin-top: 0;
}

.chapter-hub-ai-message__body--markdown :deep(*:last-child) {
  margin-bottom: 0;
}

.chapter-hub-ai-message__body--markdown :deep(strong) {
  font-weight: 750;
  color: var(--color-text);
}

.chapter-hub-ai-message__body--markdown :deep(em) {
  font-style: italic;
  color: var(--color-text-soft, var(--color-text));
}

.chapter-hub-ai-message__body--markdown :deep(ul),
.chapter-hub-ai-message__body--markdown :deep(ol) {
  padding-left: 18px;
}

.chapter-hub-ai-message__body--markdown :deep(li) {
  margin: 3px 0;
}

.chapter-hub-ai-message__body--markdown :deep(li::marker) {
  color: color-mix(in srgb, var(--color-primary) 60%, var(--color-text-muted));
}

.chapter-hub-ai-message__body--markdown :deep(li > ul),
.chapter-hub-ai-message__body--markdown :deep(li > ol) {
  margin: 3px 0 4px;
}

.chapter-hub-ai-message__body--markdown :deep(code) {
  padding: 1px 5px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 24%, transparent);
  background: color-mix(in srgb, var(--color-surface-muted) 70%, transparent);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.62rem;
  color: color-mix(in srgb, var(--color-primary) 50%, var(--color-text) 50%);
}

.chapter-hub-ai-message__body--markdown :deep(pre) {
  padding: 11px 12px;
  overflow: auto;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 28%, transparent);
  background: color-mix(in srgb, var(--color-bg) 10%, var(--color-surface));
}

.chapter-hub-ai-message__body--markdown :deep(pre code) {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font-size: 0.64rem;
  line-height: 1.55;
}

.chapter-hub-ai-message__body--markdown :deep(blockquote) {
  padding: 4px 0 4px 12px;
  border-left: 3px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 22%, transparent);
  border-radius: 0 8px 8px 0;
  color: var(--color-text-muted);
}

.chapter-hub-ai-message__body--markdown :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
}

.chapter-hub-ai-message__body--markdown :deep(a:hover) {
  text-decoration-color: var(--color-primary);
}

.chapter-hub-ai-message__body--markdown :deep(hr) {
  margin: 12px 0;
  border: 0;
  border-top: 1px solid color-mix(in srgb, var(--color-border-strong) 32%, transparent);
}

.chapter-hub-ai-message__body--markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.64rem;
}

.chapter-hub-ai-message__body--markdown :deep(th),
.chapter-hub-ai-message__body--markdown :deep(td) {
  padding: 5px 8px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 28%, transparent);
  text-align: left;
}

.chapter-hub-ai-message__body--markdown :deep(th) {
  background: color-mix(in srgb, var(--color-surface-muted) 60%, transparent);
  font-weight: 700;
}

@media (max-width: 1100px) {
  .chapter-hub-ai-suggestion__top,
  .chapter-hub-ai-panel__composer-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .chapter-hub-ai-panel__hero-actions,
  .chapter-hub-ai-suggestion__chips {
    justify-content: flex-start;
  }
}
</style>
