<template>
  <aside v-show="open" class="chapter-hub-ai-panel" role="region" aria-label="AI 阅读台" :aria-hidden="open ? 'false' : 'true'">
    <div class="chapter-hub-ai-panel__surface">
      <header class="chapter-hub-ai-panel__header">
        <div class="chapter-hub-ai-panel__topbar">
          <div class="chapter-hub-ai-panel__hero-actions">
            <button
              type="button"
              class="chapter-hub-ai-panel__iconbtn"
              :aria-label="historyOpen ? '收起历史聊天' : '打开历史聊天'"
              :title="historyOpen ? '收起历史聊天' : '打开历史聊天'"
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
              {{ loading ? '整理中...' : '整理当前章' }}
            </button>
            <button type="button" class="chapter-hub-ai-panel__toolbtn chapter-hub-ai-panel__toolbtn--ghost" @click="$emit('collapse')">收起</button>
          </div>
        </div>

      </header>

      <div v-if="historyOpen" class="chapter-hub-ai-panel__history scrollbar-paper">
        <div v-if="chatHistorySessions.length === 0" class="chapter-hub-ai-panel__history-empty">
          <p>还没有历史对话</p>
          <span>新建聊天后，这里会保留最近会话。</span>
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
        <section v-if="extractRuns.length > 0" class="chapter-hub-ai-panel__results-rail">
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

        <article v-if="chatMessages.length === 0 && !loading && !chatLoading && !error && !hasRun" class="chapter-hub-ai-message chapter-hub-ai-message--assistant">
          <div class="chapter-hub-ai-message__body chapter-hub-ai-message__body--hint chapter-hub-ai-message__body--empty">
            <p class="chapter-hub-ai-message__empty-title">从当前章节开始协作</p>
            <p>提问人物关系、伏笔回收、信息冲突，或者先整理一遍当前章。</p>
            <p>选中正文后，引用内容会自动带到输入区上方。</p>
          </div>
        </article>

        <article
          v-for="message in chatMessages"
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
              <p class="chapter-hub-ai-streaming__title">正在回答你的问题...</p>
              <p class="chapter-hub-ai-streaming__desc">我会结合当前章节、上下文和已整理信息来组织回答。</p>
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

        <article v-if="loading" class="chapter-hub-ai-message chapter-hub-ai-message--assistant">
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
              <p class="chapter-hub-ai-streaming__title">正在整理当前章...</p>
              <p class="chapter-hub-ai-streaming__desc">人物、势力、物品、关系、伏笔和章节分类会整理到当前会话里。</p>
              <div class="chapter-hub-ai-streaming__lines" aria-hidden="true">
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--lg"></span>
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--md"></span>
                <span class="chapter-hub-ai-streaming__line chapter-hub-ai-streaming__line--sm"></span>
              </div>
            </div>
          </div>
        </article>

        <article v-if="chatThinking && !hasLiveAssistantMessage" class="chapter-hub-ai-message chapter-hub-ai-message--assistant">
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
          v-for="(run, runIdx) in extractRuns"
          :key="run.id"
          v-show="hasRun && !loading"
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
                      <strong>{{ run.classificationResult?.chapterType || '未给出分类' }}</strong>
                      <p class="chapter-hub-ai-suggestion__summary">{{ run.classificationResult?.summary || '这次没有生成章节摘要。' }}</p>
                    </div>
                    <div class="chapter-hub-ai-suggestion__chips">
                      <span v-if="run.classificationResult?.pacing" class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ run.classificationResult?.pacing }}</span>
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
                  <span>已处理</span>
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
                <article v-for="(item, index) in run.result.characters" :key="`character-${run.id}-${item.name}-${item.match.targetId ?? 'new'}`" class="chapter-hub-ai-suggestion">
                  <div class="chapter-hub-ai-suggestion__eyebrow">
                    <span>角色档案</span>
                    <span>{{ actionLabel(item.match.type) }}</span>
                  </div>
                  <div class="chapter-hub-ai-suggestion__top">
                    <div class="chapter-hub-ai-suggestion__main">
                      <strong>{{ item.name }}</strong>
                      <p class="chapter-hub-ai-suggestion__summary">{{ characterSummary(item) }}</p>
                    </div>
                    <div class="chapter-hub-ai-suggestion__chips">
                      <span class="chapter-hub-ai-chip" :data-kind="item.match.type">{{ matchLabel(item.match.type) }}</span>
                      <span class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ confidenceLabel(item.confidence) }}</span>
                      <span class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ suggestionStateLabel(item.uiState?.status) }}</span>
                    </div>
                  </div>
                  <p v-if="item.match.targetName" class="chapter-hub-ai-suggestion__meta">匹配目标：{{ item.match.targetName }}</p>
                  <p v-if="item.aliases.length" class="chapter-hub-ai-suggestion__meta">别名：{{ item.aliases.join('、') }}</p>
                  <details v-if="item.evidences.length" class="chapter-hub-ai-evidence">
                    <summary class="chapter-hub-ai-evidence__summary">引用证据 {{ item.evidences.length }}</summary>
                    <div class="chapter-hub-ai-evidence-list">
                      <p v-for="(ev, evIdx) in item.evidences" :key="`character-${index}-${evIdx}`">第 {{ ev.chapterNo ?? '?' }} 章 · {{ ev.quote }}</p>
                    </div>
                  </details>
                  <p v-for="warning in item.warnings" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
                  <div v-if="runIdx === 0 && !isSuggestionLocked(item.uiState?.status)" class="chapter-hub-ai-suggestion__actions">
                    <button v-if="item.match.type === 'new'" type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'characters', index, action: 'create' })">新建</button>
                    <button v-else-if="canMerge(item.match.type, item.match.targetId)" type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'characters', index, action: 'merge' })">合并</button>
                    <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'characters', index, action: 'ignore' })">忽略</button>
                  </div>
                  <div v-else-if="runIdx === 0 && item.uiState?.status === 'applied' && item.uiState?.editorTargetId" class="chapter-hub-ai-suggestion__actions">
                    <button type="button" class="chapter-hub-ai-action" @click="$emit('open-editor', { section: 'characters', index })">打开编辑</button>
                  </div>
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
                  <div v-if="runIdx === 0 && !isSuggestionLocked(item.uiState?.status)" class="chapter-hub-ai-suggestion__actions">
                    <button v-if="item.match.type === 'new'" type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'factions', index, action: 'create' })">新建</button>
                    <button v-else-if="canMerge(item.match.type, item.match.targetId)" type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'factions', index, action: 'merge' })">合并</button>
                    <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'factions', index, action: 'ignore' })">忽略</button>
                  </div>
                  <div v-else-if="runIdx === 0 && item.uiState?.status === 'applied' && item.uiState?.editorTargetId" class="chapter-hub-ai-suggestion__actions">
                    <button type="button" class="chapter-hub-ai-action" @click="$emit('open-editor', { section: 'factions', index })">打开编辑</button>
                  </div>
                </article>
              </div>
            </details>

            <details v-if="run.result.items.length > 0" class="chapter-hub-ai-section" open>
              <summary class="chapter-hub-ai-section__summary">
                <span>物品</span>
                <span class="chapter-hub-ai-section__count">{{ run.result.items.length }}</span>
              </summary>
              <div class="chapter-hub-ai-section__content">
                <article v-for="(item, index) in run.result.items" :key="`item-${run.id}-${item.name}-${item.match.targetId ?? 'new'}`" class="chapter-hub-ai-suggestion">
                  <div class="chapter-hub-ai-suggestion__eyebrow">
                    <span>物品档案</span>
                    <span>{{ actionLabel(item.match.type) }}</span>
                  </div>
                  <div class="chapter-hub-ai-suggestion__top">
                    <div class="chapter-hub-ai-suggestion__main">
                      <strong>{{ item.name }}</strong>
                      <p class="chapter-hub-ai-suggestion__summary">{{ itemSummary(item) }}</p>
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
                      <p v-for="(ev, evIdx) in item.evidences" :key="`item-${index}-${evIdx}`">第 {{ ev.chapterNo ?? '?' }} 章 · {{ ev.quote }}</p>
                    </div>
                  </details>
                  <p v-for="warning in item.warnings" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
                  <div v-if="runIdx === 0 && !isSuggestionLocked(item.uiState?.status)" class="chapter-hub-ai-suggestion__actions">
                    <button v-if="item.match.type === 'new'" type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'items', index, action: 'create' })">新建</button>
                    <button v-else-if="canMerge(item.match.type, item.match.targetId)" type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'items', index, action: 'merge' })">合并</button>
                    <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'items', index, action: 'ignore' })">忽略</button>
                  </div>
                  <div v-else-if="runIdx === 0 && item.uiState?.status === 'applied' && item.uiState?.editorTargetId" class="chapter-hub-ai-suggestion__actions">
                    <button type="button" class="chapter-hub-ai-action" @click="$emit('open-editor', { section: 'items', index })">打开编辑</button>
                  </div>
                </article>
              </div>
            </details>

            <details v-if="run.result.memberships.length + run.result.relations.length > 0" class="chapter-hub-ai-section" open>
              <summary class="chapter-hub-ai-section__summary">
                <span>关系</span>
                <span class="chapter-hub-ai-section__count">{{ run.result.memberships.length + run.result.relations.length }}</span>
              </summary>
              <div class="chapter-hub-ai-section__content">
                <article v-for="(item, index) in run.result.memberships" :key="`membership-${run.id}-${index}`" class="chapter-hub-ai-suggestion chapter-hub-ai-suggestion--relation">
                  <div class="chapter-hub-ai-suggestion__eyebrow">
                    <span>势力归属</span>
                    <span>{{ actionLabel(item.match.type) }}</span>
                  </div>
                  <div class="chapter-hub-ai-suggestion__top">
                    <div class="chapter-hub-ai-suggestion__main">
                      <span class="chapter-hub-ai-suggestion__type">所属势力</span>
                      <strong>{{ item.characterName }} -> {{ item.factionName }}</strong>
                      <p class="chapter-hub-ai-suggestion__summary">{{ item.description || '未提供补充说明' }}</p>
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
                      <p v-for="(ev, evIdx) in item.evidences" :key="`membership-${index}-${evIdx}`">第 {{ ev.chapterNo ?? '?' }} 章 · {{ ev.quote }}</p>
                    </div>
                  </details>
                  <p v-for="warning in item.warnings" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
                  <div v-if="runIdx === 0 && !isSuggestionLocked(item.uiState?.status)" class="chapter-hub-ai-suggestion__actions">
                    <button v-if="item.match.type === 'new'" type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'memberships', index, action: 'create' })">新建</button>
                    <button v-else-if="canMerge(item.match.type, item.match.targetId)" type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'memberships', index, action: 'merge' })">合并</button>
                    <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'memberships', index, action: 'ignore' })">忽略</button>
                  </div>
                  <div v-else-if="runIdx === 0 && item.uiState?.status === 'applied' && item.uiState?.editorTargetId" class="chapter-hub-ai-suggestion__actions">
                    <button type="button" class="chapter-hub-ai-action" @click="$emit('open-editor', { section: 'memberships', index })">打开编辑</button>
                  </div>
                </article>

                <article v-for="(item, index) in run.result.relations" :key="`relation-${run.id}-${index}`" class="chapter-hub-ai-suggestion chapter-hub-ai-suggestion--relation">
                  <div class="chapter-hub-ai-suggestion__eyebrow">
                    <span>角色关系</span>
                    <span>{{ actionLabel(item.match.type) }}</span>
                  </div>
                  <div class="chapter-hub-ai-suggestion__top">
                    <div class="chapter-hub-ai-suggestion__main">
                      <span class="chapter-hub-ai-suggestion__type">角色关系</span>
                      <strong>{{ item.fromCharacterName }} -> {{ item.toCharacterName }}</strong>
                      <p class="chapter-hub-ai-suggestion__summary">{{ relationSummary(item) }}</p>
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
                      <p v-for="(ev, evIdx) in item.evidences" :key="`relation-${index}-${evIdx}`">第 {{ ev.chapterNo ?? '?' }} 章 · {{ ev.quote }}</p>
                    </div>
                  </details>
                  <p v-for="warning in item.warnings" :key="warning" class="chapter-hub-ai-warning">{{ warning }}</p>
                  <div v-if="runIdx === 0 && !isSuggestionLocked(item.uiState?.status)" class="chapter-hub-ai-suggestion__actions">
                    <button v-if="item.match.type === 'new'" type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'relations', index, action: 'create' })">新建</button>
                    <button v-else-if="canMerge(item.match.type, item.match.targetId)" type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'relations', index, action: 'merge' })">合并</button>
                    <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'relations', index, action: 'ignore' })">忽略</button>
                  </div>
                  <div v-else-if="runIdx === 0 && item.uiState?.status === 'applied' && item.uiState?.editorTargetId" class="chapter-hub-ai-suggestion__actions">
                    <button type="button" class="chapter-hub-ai-action" @click="$emit('open-editor', { section: 'relations', index })">打开编辑</button>
                  </div>
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
                  <div v-if="runIdx === 0 && !isSuggestionLocked(item.uiState?.status)" class="chapter-hub-ai-suggestion__actions">
                    <button type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'foreshadows', index, action: 'create' })">采纳</button>
                    <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'foreshadows', index, action: 'ignore' })">忽略</button>
                  </div>
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
                      <strong>{{ run.classificationResult?.chapterType || '未给出分类' }}</strong>
                      <p class="chapter-hub-ai-suggestion__summary">{{ run.classificationResult?.summary || '这次没有生成章节摘要。' }}</p>
                    </div>
                    <div class="chapter-hub-ai-suggestion__chips">
                      <span v-if="run.classificationResult?.pacing" class="chapter-hub-ai-chip chapter-hub-ai-chip--soft">{{ run.classificationResult?.pacing }}</span>
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
                  <div v-if="runIdx === 0 && !isSuggestionLocked(run.classificationResult?.uiState?.status)" class="chapter-hub-ai-suggestion__actions">
                    <button type="button" class="chapter-hub-ai-action chapter-hub-ai-action--primary" @click="$emit('apply', { section: 'classification', index: 0, action: 'merge' })">写入本章总结</button>
                    <button type="button" class="chapter-hub-ai-action" @click="$emit('apply', { section: 'classification', index: 0, action: 'ignore' })">忽略</button>
                  </div>
                </article>
              </div>
            </details>
              </template>
            </div>
          </div>
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
              placeholder="询问当前章的人物、伏笔、冲突……"
              @keydown="onComposerKeydown"
              @input="syncComposerHeight"
            />
          </div>

          <div class="chapter-hub-ai-panel__composer-bar">
            <span class="chapter-hub-ai-panel__hint">Enter 发送，Shift+Enter 换行</span>
            <button
              type="button"
              class="chapter-hub-ai-panel__ask"
              :data-busy="chatLoading ? 'true' : 'false'"
              :disabled="loading || (!chatLoading && (!canSend || !targetChapter))"
              @click="chatLoading ? $emit('stop-ask') : submitAsk()"
            >
              {{ chatLoading ? '暂停' : '发送' }}
            </button>
          </div>
        </div>
      </footer>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type {
  AiAnalysisKind,
  AiDeskChatMessage,
  Chapter,
  EntityMatchType,
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
  hasRun: boolean
  chatMessages: AiDeskChatMessage[]
  selectionQuote?: string
}>()

const emit = defineEmits<{
  run: []
  ask: [payload: { question: string }]
  newChat: []
  switchChat: [sessionId: string]
  closeChat: [sessionId: string]
  deleteChat: [sessionId: string]
  openSettings: []
  collapse: []
  clearSelectionQuote: []
  stopAsk: []
  apply: [payload: { section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations' | 'foreshadows' | 'classification'; index: number; action: 'create' | 'merge' | 'ignore' }]
  openEditor: [payload: { section: 'characters' | 'factions' | 'items' | 'memberships' | 'relations'; index: number }]
}>()

const draft = ref('')
const scrollRef = ref<HTMLElement | null>(null)
const composerInputRef = ref<HTMLTextAreaElement | null>(null)
const historyOpen = ref(false)
const expandedRunIds = ref<string[]>([])
const busy = computed(() => props.loading || props.chatLoading)
const hasLiveAssistantMessage = computed(() =>
  props.chatLoading &&
  props.chatMessages.length > 0 &&
  props.chatMessages[props.chatMessages.length - 1]?.role === 'assistant',
)

function isLiveAssistantMessage(message: AiDeskChatMessage): boolean {
  return Boolean(
    props.chatLoading &&
    props.chatMessages[props.chatMessages.length - 1]?.id === message.id &&
    message.role === 'assistant',
  )
}
const canSend = computed(() => !!draft.value.trim())

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

function syncComposerHeight(): void {
  const el = composerInputRef.value
  if (!el) return
  el.style.height = 'auto'
  const computed = window.getComputedStyle(el)
  const lineHeight = Number.parseFloat(computed.lineHeight || '0') || 18
  const paddingTop = Number.parseFloat(computed.paddingTop || '0') || 0
  const paddingBottom = Number.parseFloat(computed.paddingBottom || '0') || 0
  const borderTop = Number.parseFloat(computed.borderTopWidth || '0') || 0
  const borderBottom = Number.parseFloat(computed.borderBottomWidth || '0') || 0
  const cssMinHeight = Number.parseFloat(computed.minHeight || '0') || 0
  const contentMinHeight = lineHeight * 2 + paddingTop + paddingBottom + borderTop + borderBottom
  const minHeight = Math.max(cssMinHeight, contentMinHeight)
  const maxHeight = lineHeight * 5 + paddingTop + paddingBottom + borderTop + borderBottom
  const nextHeight = Math.min(el.scrollHeight, maxHeight)
  el.style.height = `${Math.max(nextHeight, minHeight)}px`
  el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

function scrollToBottom(smooth = false): void {
  const el = scrollRef.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' as ScrollBehavior })
}

watch(
  () => props.chatMessages.length,
  () => { void nextTick(() => scrollToBottom()) },
)

watch(
  () => {
    const msgs = props.chatMessages
    return msgs.length > 0 ? msgs[msgs.length - 1].content : ''
  },
  () => {
    const el = scrollRef.value
    if (!el) return
    void nextTick(() => {
      if (isNearBottom(el)) scrollToBottom()
    })
  },
)

watch(
  () => props.open,
  (open) => {
    if (open) {
      void nextTick(() => {
        scrollToBottom()
        syncComposerHeight()
      })
    }
  },
)

watch(draft, () => {
  void nextTick(() => syncComposerHeight())
})

watch(
  () => props.extractRuns.map((item) => item.id).join('|'),
  () => {
    syncExpandedRuns()
  },
  { immediate: true },
)

onMounted(() => {
  void nextTick(() => {
    scrollToBottom()
    syncComposerHeight()
  })
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
  if (status === 'applied') return '已处理'
  if (status === 'ignored') return '已忽略'
  return '待确认'
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

function submitAsk(): void {
  const question = draft.value.trim()
  if (!question) return
  emit('ask', { question })
  draft.value = ''
  void nextTick(() => syncComposerHeight())
}

function onComposerKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submitAsk()
  }
}

function matchLabel(type: EntityMatchType): string {
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
    attrPreview,
    item.notes,
  ]
  return parts.filter(Boolean).join(' · ') || '未提取到更多字段'
}

function factionSummary(item: ExtractedFaction): string {
  const parts = [item.leader && `首领 ${item.leader}`, item.notes]
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
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.chapter-hub-ai-panel__hero-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
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
  height: 56px;
  min-height: 56px;
  resize: none;
  border: 0;
  background: transparent;
  padding: 11px 12px;
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

.chapter-hub-ai-message__body--markdown :deep(p),
.chapter-hub-ai-message__body--markdown :deep(ul),
.chapter-hub-ai-message__body--markdown :deep(ol),
.chapter-hub-ai-message__body--markdown :deep(pre),
.chapter-hub-ai-message__body--markdown :deep(blockquote),
.chapter-hub-ai-message__body--markdown :deep(h1),
.chapter-hub-ai-message__body--markdown :deep(h2),
.chapter-hub-ai-message__body--markdown :deep(h3),
.chapter-hub-ai-message__body--markdown :deep(h4) {
  margin: 0 0 10px;
}

.chapter-hub-ai-message__body--markdown :deep(*:last-child) {
  margin-bottom: 0;
}

.chapter-hub-ai-message__body--markdown :deep(ul),
.chapter-hub-ai-message__body--markdown :deep(ol) {
  padding-left: 18px;
}

.chapter-hub-ai-message__body--markdown :deep(li) {
  margin: 4px 0;
}

.chapter-hub-ai-message__body--markdown :deep(code) {
  padding: 2px 6px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--color-surface) 74%, transparent);
  font-size: 0.6rem;
}

.chapter-hub-ai-message__body--markdown :deep(pre) {
  padding: 10px 11px;
  overflow: auto;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-bg) 8%, var(--color-surface));
}

.chapter-hub-ai-message__body--markdown :deep(blockquote) {
  padding-left: 12px;
  border-left: 3px solid color-mix(in srgb, var(--color-primary) 28%, transparent);
  color: var(--color-text-muted);
}

.chapter-hub-ai-message__body--markdown :deep(a) {
  color: var(--color-primary);
}

@media (max-width: 1100px) {
  .chapter-hub-ai-suggestion__top,
  .chapter-hub-ai-panel__composer-bar,
  .chapter-hub-ai-panel__topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .chapter-hub-ai-panel__hero-actions,
  .chapter-hub-ai-suggestion__chips {
    justify-content: flex-start;
  }
}
</style>
