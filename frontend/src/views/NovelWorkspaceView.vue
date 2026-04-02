<template>
  <section class="page-block" v-if="novel">
    <header ref="workspaceChromeAnchorRef" class="header-row">
      <div>
        <h1>{{ novel.title }}</h1>
        <p class="muted workspace-sub">{{ novel.summary || '暂无简介' }}</p>
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
      <h2>作品基础信息</h2>
      <div class="meta-grid">
        <div><span class="k">题材</span><span>{{ novel.genre || '未设置' }}</span></div>
        <div><span class="k">叙事视角</span><span>{{ novel.perspective || '未设置' }}</span></div>
        <div><span class="k">基调</span><span>{{ novel.tone || '未设置' }}</span></div>
        <div><span class="k">多线叙事</span><span>{{ novel.isMultiLineNarrative ? '是' : '否' }}</span></div>
      </div>
      <div class="action-row workspace-write-entry">
        <RouterLink class="workspace-write-entry__btn" :to="{ name: 'novel-chapter-writing', params: { novelId: novel.id } }">
          进入章节写作
        </RouterLink>
      </div>
    </section>

    <section class="card" v-if="activeTab === 'outline'">
      <div class="header-row">
        <div>
          <h2>大纲（第一期）</h2>
          <p class="muted">已支持：新增情节点、顺序号、状态切换、摘要编辑、关联章节。</p>
        </div>
      </div>

      <form class="form-grid" @submit.prevent="handleCreateOutline">
        <div class="grid-2">
          <label>
            情节点标题
            <input v-model="outlineForm.title" maxlength="80" placeholder="例如：主角首次发现真相线索" />
          </label>
          <label>
            情节点摘要
            <input v-model="outlineForm.summary" maxlength="240" placeholder="该节点发生什么，以及它推动了什么" />
          </label>
        </div>
        <div class="action-row">
          <button type="submit">新增情节点（自动排序）</button>
        </div>
      </form>

      <p v-if="outlineItems.length === 0" class="muted">还没有情节点，先新增一个大纲节点。</p>
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
                placeholder="情节点标题"
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
              placeholder="情节点摘要"
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

    <section class="card" v-if="activeTab === 'characters'">
      <section v-if="characters.length === 0" class="panel characters-empty">
        <h2>角色关系网（MVP）</h2>
        <p class="muted">还没有角色。先新增一个主要角色，才能开始图谱。</p>
        <div class="action-row">
          <button type="button" class="btn-primary" @click="openCharacterCreate">新增角色</button>
        </div>
      </section>

      <section class="panel characters-graph-block" v-else>
        <div class="header-row">
          <div>
            <h2>角色关系网（MVP）</h2>
            <p class="muted">节点：角色；边：你为其添加的关系与属性。</p>
          </div>
        </div>

        <div class="characters-graph-ui">
          <div class="characters-graph-ui__left">
            <div class="characters-graph-3d-wrap">
              <CharacterRelationSphere
                :characters="characters"
                :relations="characterRelations"
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
                  :characters="visibleCharacters"
                  :relations="relatedRelations"
                  :focus-character-id="graphFocusCharacterId"
                />

                <p v-else class="muted">暂无关系。</p>
              </div>
            </div>
          </div>

          <div class="characters-graph-ui__right">
            <article class="characters-graph-ui__section character-panel">
              <header class="character-panel__head">
                <div>
                  <h3 class="character-panel__title">角色档案</h3>
                  <p class="character-panel__lede">
                    只读预览 · 切换 3D 聚焦或点击「编辑」；未保存时切换角色将丢弃草稿。
                  </p>
                </div>
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
                      <div class="character-panel__spec-item">
                        <dt>所属势力</dt>
                        <dd>{{ factionNameById(selectedGraphCharacter.factionId) || '—' }}</dd>
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
                        <select v-model="characterDraft.firstAppearanceChapterNo" class="character-panel__input">
                          <option value="">未设置</option>
                          <option v-for="ch in chapters" :key="`fa-${ch.id}`" :value="String(ch.chapterNo)">
                            第 {{ ch.chapterNo }} 章 · {{ ch.title }}
                          </option>
                        </select>
                      </label>
                      <label class="character-panel__field">
                        <span class="character-panel__field-label">所属势力</span>
                        <select v-model="characterDraft.factionId" class="character-panel__input">
                          <option value="">未绑定</option>
                          <option v-for="f in factions" :key="`cf-${f.id}`" :value="f.id">{{ f.name }}</option>
                        </select>
                      </label>
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
                          <textarea v-model="a.value" class="character-panel__textarea" maxlength="500" rows="2" />
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
                  <option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </label>

              <div class="characters-graph-ui__link-mode">
                <div class="characters-graph-ui__link-head">
                  <button
                    type="button"
                    class="btn-primary"
                    :class="{ 'btn-primary--active': graph3dLinkMode }"
                    @click="toggle3dLinkMode"
                  >
                    {{ graph3dLinkMode ? '结束连线添加' : '3D 连线添加' }}
                  </button>
                </div>

                <p v-if="graph3dLinkMode" class="muted characters-graph-ui__link-hint">
                  以当前聚焦角色为 A，选择另一个角色 B，并分别填写 A 对 B、B 对 A 的关系描述。
                </p>

                <p v-if="graphLinkError" class="characters-graph-ui__link-error">{{ graphLinkError }}</p>
                <p v-if="graphLinkSuccess" class="characters-graph-ui__link-success">{{ graphLinkSuccess }}</p>

                <div v-if="graph3dLinkMode" class="graph3d-link-editor">
                  <label class="characters-graph-ui__field">
                    <span class="characters-graph-ui__field-label">目标角色（B）</span>
                    <select v-model="graphRelationToCharacterId" class="characters-graph-ui__select">
                      <option value="">请选择角色</option>
                      <option v-for="c in relationTargetOptions" :key="`to-${c.id}`" :value="c.id">
                        {{ c.name }}
                      </option>
                    </select>
                  </label>

                  <p v-if="graphRelationToCharacterId" class="characters-graph-ui__from-chip">
                    {{ relationPairExists ? '已关联（将更新）' : '未关联（将新增）' }}
                  </p>

                  <label class="characters-graph-ui__field">
                    <span class="characters-graph-ui__field-label">
                      {{ selectedGraphCharacter?.name || 'A' }} 是 {{ relationTargetName || 'B' }} 的
                    </span>
                    <input
                      v-model="graphRelationTypeFromA"
                      maxlength="40"
                      class="characters-graph-ui__input"
                      placeholder="例如：盟友 / 上级 / 亲属 / 宿敌"
                    />
                  </label>

                  <label class="characters-graph-ui__field">
                    <span class="characters-graph-ui__field-label">
                      {{ relationTargetName || 'B' }} 是 {{ selectedGraphCharacter?.name || 'A' }} 的
                    </span>
                    <input
                      v-model="graphRelationTypeFromB"
                      maxlength="40"
                      class="characters-graph-ui__input"
                      placeholder="例如：下属 / 师父 / 恋人 / 竞争者"
                    />
                  </label>

                  <label class="characters-graph-ui__field">
                    <span class="characters-graph-ui__field-label">备注（可选）</span>
                    <input
                      v-model="graphRelationNote"
                      maxlength="120"
                      class="characters-graph-ui__input"
                      placeholder="补充关系背景或触发条件"
                    />
                  </label>

                  <div class="action-row">
                    <button type="button" class="btn-primary" @click="addGraphRelationBidirectional">
                      {{ relationPairExists ? '更新双向关系' : '新增双向关系' }}
                    </button>
                  </div>
                </div>
              </div>
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
                      <input v-model="characterForm.name" maxlength="40" required placeholder="例如：林岚" />
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
                      所属势力
                      <select v-model="characterForm.factionId">
                        <option value="">未绑定</option>
                        <option v-for="f in factions" :key="`create-fac-${f.id}`" :value="f.id">{{ f.name }}</option>
                      </select>
                    </label>
                    <label>
                      年龄
                      <input v-model="characterForm.age" maxlength="20" placeholder="例如：19" />
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
                    <p class="character-custom-list__title">自定义字段（可选）</p>
                    <div
                      v-for="a in characterForm.attributes"
                      :key="a.id"
                      class="character-custom-fields__row"
                    >
                      <label class="character-custom-fields__pair">
                        字段名
                        <input v-model="a.key" maxlength="40" placeholder="例如：佩剑" />
                      </label>
                      <label class="character-custom-fields__pair">
                        字段说明
                        <textarea
                          v-model="a.value"
                          maxlength="500"
                          rows="2"
                          placeholder="说明"
                          class="textarea"
                        />
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
      <div class="header-row">
        <div>
          <h2>势力档案（第一期）</h2>
          <p class="muted">已支持：新增与编辑势力、成员角色列表、领袖/目标/资源、与主角关系、备注。</p>
        </div>
      </div>

      <form class="form-grid" @submit.prevent="handleCreateFaction">
        <div class="grid-3">
          <label>
            势力名 *
            <input v-model="factionForm.name" maxlength="50" required placeholder="例如：夜鸦议会" />
          </label>
          <label>
            领袖
            <input v-model="factionForm.leader" maxlength="40" placeholder="例如：苏冥" />
          </label>
          <label>
            核心目标
            <input v-model="factionForm.goal" maxlength="100" placeholder="势力最想实现什么" />
          </label>
        </div>
        <div class="grid-2">
          <label>
            核心资源
            <input v-model="factionForm.resource" maxlength="100" placeholder="情报、兵力、资金、遗物..." />
          </label>
          <label>
            与主角关系
            <input
              v-model="factionForm.relationToProtagonist"
              maxlength="80"
              placeholder="合作 / 对立 / 利用..."
            />
          </label>
        </div>
        <label>
          势力备注
          <input v-model="factionForm.notes" maxlength="200" placeholder="势力风格、禁忌、内部矛盾等" />
        </label>
        <div class="action-row">
          <button type="submit">新增势力</button>
        </div>
      </form>

      <p v-if="factions.length === 0" class="muted">还没有势力，先新增一个组织。</p>
      <ul v-else class="list">
        <li v-for="f in factions" :key="f.id" class="list-item" :id="`faction-row-${f.id}`">
          <div class="chapter-main">
            <form
              v-if="editingFactionId === f.id"
              class="form-grid"
              @submit.prevent="saveFactionEdit"
            >
              <div class="grid-3">
                <label>
                  势力名 *
                  <input v-model="factionEditForm.name" maxlength="50" required placeholder="例如：夜鸦议会" />
                </label>
                <label>
                  领袖
                  <input v-model="factionEditForm.leader" maxlength="40" placeholder="例如：苏冥" />
                </label>
                <label>
                  核心目标
                  <input v-model="factionEditForm.goal" maxlength="100" placeholder="势力最想实现什么" />
                </label>
              </div>
              <div class="grid-2">
                <label>
                  核心资源
                  <input v-model="factionEditForm.resource" maxlength="100" placeholder="情报、兵力、资金、遗物..." />
                </label>
                <label>
                  与主角关系
                  <input
                    v-model="factionEditForm.relationToProtagonist"
                    maxlength="80"
                    placeholder="合作 / 对立 / 利用..."
                  />
                </label>
              </div>
              <label>
                势力备注
                <input v-model="factionEditForm.notes" maxlength="200" placeholder="势力风格、禁忌、内部矛盾等" />
              </label>
              <div class="action-row action-row--inline">
                <button type="submit">保存修改</button>
                <button
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--ghost"
                  @click="cancelFactionEdit"
                >
                  取消
                </button>
              </div>
            </form>
            <template v-else>
              <div class="faction-row__head">
                <strong class="faction-row__title">
                  {{ f.name }}<span class="muted">（领袖：{{ f.leader || '未设置' }}）</span>
                </strong>
                <div class="faction-row__actions">
                  <button type="button" class="faction-row__edit" title="编辑势力" @click="openFactionEdit(f)">
                    编辑
                  </button>
                  <button
                    type="button"
                    class="faction-row__delete"
                    title="删除势力"
                    @click="openFactionDelete(f.id)"
                  >
                    删除
                  </button>
                </div>
              </div>
              <small class="muted">目标：{{ f.goal || '未设置' }} · 资源：{{ f.resource || '未设置' }}</small>
              <small class="muted">与主角关系：{{ f.relationToProtagonist || '未设置' }}</small>
              <div class="faction-row__members">
                <span class="muted">成员角色：</span>
                <span v-if="factionMemberNamesByFactionId[f.id]" class="faction-row__member-names">{{
                  factionMemberNamesByFactionId[f.id]
                }}</span>
                <span v-else class="muted">暂无（在「角色」或写作中选词绑定势力）</span>
              </div>
              <input
                class="inline-input"
                :value="f.notes"
                maxlength="200"
                placeholder="势力备注"
                @change="onFactionNotesChange(f.id, $event)"
              />
            </template>
          </div>
        </li>
      </ul>

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

    <section class="card" v-if="activeTab === 'issues'">
      <div class="header-row">
        <div>
          <h2>伏笔与坑点（第一期）</h2>
          <p class="muted">已支持：新增问题、类型与状态、处理计划、备注编辑。</p>
        </div>
      </div>

      <form class="form-grid" @submit.prevent="handleCreateIssue">
        <div class="grid-3">
          <label>
            问题标题 *
            <input
              v-model="issueForm.title"
              maxlength="80"
              required
              placeholder="例如：第三章的伏笔尚未回收"
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
            <input v-model="issueForm.plan" maxlength="120" placeholder="计划在哪章处理、怎么处理" />
          </label>
        </div>
        <label>
          备注
          <input v-model="issueForm.notes" maxlength="200" placeholder="补充上下文或风险说明" />
        </label>
        <div class="action-row">
          <button type="submit">新增问题</button>
        </div>
      </form>

      <p v-if="issues.length === 0" class="muted">还没有坑点/伏笔问题，先记录一个。</p>
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
              placeholder="备注"
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
  createCharacter,
  createFaction,
  createCharacterRelation,
  createIssue,
  createOutlineItem,
  deleteCharacterRelation,
  deleteCharacter,
  deleteFaction,
  deleteOutlineItem,
  getCharactersByNovelId,
  getChaptersByNovelId,
  getCharacterRelationsByNovelId,
  getFactionsByNovelId,
  getIssuesByNovelId,
  getNovelById,
  getOutlineByNovelId,
  moveOutlineItem,
  updateCharacter,
  updateCharacterRelation,
  updateFaction,
  updateChapter,
  updateIssue,
  updateOutlineItem,
} from '../lib/storage'
import { setChromeAnchor } from '../composables/useChromeAnchor'
import type {
  Character,
  Chapter,
  CharacterAttribute,
  CharacterRelation,
  Faction,
  NewCharacterInput,
  IssueStatus,
  IssueType,
  OutlineItem,
  OutlineStatus,
  StoryIssue,
} from '../types'
import CharacterRelationSphere from '../components/CharacterRelationSphere.vue'
import CharacterRelationFocusSphere from '../components/CharacterRelationFocusSphere.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const workspaceChromeAnchorRef = ref<HTMLElement | null>(null)
watch(workspaceChromeAnchorRef, (el) => setChromeAnchor(el), { immediate: true })
onUnmounted(() => setChromeAnchor(null))

const novelId = computed(() => String(route.params.id ?? ''))
const novel = computed(() => getNovelById(novelId.value))
const activeTab = ref<'write' | 'outline' | 'characters' | 'factions' | 'issues'>('write')
const lastTabBeforeCharacters = ref<'write' | 'outline' | 'factions' | 'issues' | ''>('')
const chapters = ref<Chapter[]>([])
const outlineItems = ref<OutlineItem[]>([])
const expandedOutlineId = ref<string>('')

// 删除情节点：使用自定义弹窗替代原生 confirm()
const outlineDeleteOpen = ref(false)
const outlineDeleteId = ref<string>('')

const characters = ref<Character[]>([])
const characterRelations = ref<CharacterRelation[]>([])
const factions = ref<Faction[]>([])
const issues = ref<StoryIssue[]>([])
const outlineForm = reactive({
  title: '',
  summary: '',
})
const characterForm = reactive({
  name: '',
  firstAppearanceChapterNo: '',
  factionId: '',
  age: '',
  gender: '',
  attributes: [] as CharacterAttribute[],
})
const characterCreateError = ref('')
const characterCreateOpen = ref(false)
const factionForm = reactive({
  name: '',
  leader: '',
  goal: '',
  resource: '',
  relationToProtagonist: '',
  notes: '',
})
const editingFactionId = ref<string | null>(null)
const factionEditForm = reactive({
  name: '',
  leader: '',
  goal: '',
  resource: '',
  relationToProtagonist: '',
  notes: '',
})
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
  factionId: '',
  age: '',
  gender: '',
  attributes: [] as CharacterAttribute[],
})
const graphAttributeKey = ref('')
const graphAttributeValue = ref('')
const graphRelationToCharacterId = ref<string>('')
const graphRelationTypeFromA = ref('')
const graphRelationTypeFromB = ref('')
const graphRelationNote = ref('')
const graphLinkError = ref('')
const graphLinkSuccess = ref('')

// 3D 连线添加模式：选中 A 后，手动选择 B 并填写双向关系
const graph3dLinkMode = ref(false)

watch(
  novelId,
  (id) => {
    chapters.value = getChaptersByNovelId(id)
    outlineItems.value = getOutlineByNovelId(id)
    characters.value = getCharactersByNovelId(id)
    characterRelations.value = getCharacterRelationsByNovelId(id)
    graphFocusCharacterId.value = characters.value[0]?.id ?? ''
    factions.value = getFactionsByNovelId(id)
    issues.value = getIssuesByNovelId(id)
    editingFactionId.value = null
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
  characters,
  (list) => {
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

watch(graphFocusCharacterId, () => {
  hoverRelationId.value = ''
  characterEditMode.value = false
  characterEditError.value = ''
  if (graphRelationToCharacterId.value === graphFocusCharacterId.value) {
    graphRelationToCharacterId.value = ''
  }
})

watch(graphRelationToCharacterId, (bId) => {
  graphLinkError.value = ''
  graphLinkSuccess.value = ''
  if (!bId) {
    graphRelationTypeFromA.value = ''
    graphRelationTypeFromB.value = ''
    graphRelationNote.value = ''
    return
  }
  graphRelationTypeFromA.value = relationAB.value?.relationType ?? ''
  graphRelationTypeFromB.value = relationBA.value?.relationType ?? ''
  graphRelationNote.value = relationAB.value?.note || relationBA.value?.note || ''
})

watch(characterCreateOpen, (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open ? 'hidden' : ''
})

function openCharacterCreate(): void {
  characterCreateError.value = ''
  characterForm.name = ''
  characterForm.firstAppearanceChapterNo = ''
  characterForm.age = ''
  characterForm.gender = ''
  characterForm.attributes = []
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
      factionId: characterForm.factionId ? characterForm.factionId : null,
      age: characterForm.age,
      gender: characterForm.gender,
      goal: '',
      secret: '',
      arc: '',
      notes: '',
      attributes: parsedAttrs.value,
    } satisfies NewCharacterInput)

    characters.value = getCharactersByNovelId(novel.value.id)
    characterRelations.value = getCharacterRelationsByNovelId(novel.value.id)
    graphFocusCharacterId.value = created.id
  } catch (e) {
    console.error(e)
    characterCreateError.value = '新增角色失败（已记录到控制台）。'
    return
  }

  characterForm.name = ''
  characterForm.firstAppearanceChapterNo = ''
  characterForm.factionId = ''
  characterForm.age = ''
  characterForm.gender = ''
  characterForm.attributes = []

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

  // 清空右侧表单，避免继续编辑已不存在的角色
  graphAttributeKey.value = ''
  graphAttributeValue.value = ''
  graphRelationToCharacterId.value = ''
  graphRelationTypeFromA.value = ''
  graphRelationTypeFromB.value = ''
  graphRelationNote.value = ''
  graphLinkError.value = ''
  graphLinkSuccess.value = ''
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
  characterDraft.factionId = c.factionId ? String(c.factionId) : ''
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
    factionId: characterDraft.factionId ? String(characterDraft.factionId) : null,
    age: characterDraft.age,
    gender: characterDraft.gender,
    goal: '',
    secret: '',
    arc: '',
    notes: '',
    attributes: parsedAttrs.value,
  })
  characters.value = getCharactersByNovelId(novelId.value)
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

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

const selectedGraphCharacter = computed(() => {
  return characters.value.find((c) => c.id === graphFocusCharacterId.value) ?? null
})
const relationTargetOptions = computed(() =>
  characters.value.filter((c) => c.id !== graphFocusCharacterId.value)
)
const relationTargetName = computed(
  () => characters.value.find((c) => c.id === graphRelationToCharacterId.value)?.name ?? ''
)
const relationAB = computed(() => {
  const aId = selectedGraphCharacter.value?.id
  const bId = graphRelationToCharacterId.value
  if (!aId || !bId) return null
  return characterRelations.value.find((r) => r.fromCharacterId === aId && r.toCharacterId === bId) ?? null
})
const relationBA = computed(() => {
  const aId = selectedGraphCharacter.value?.id
  const bId = graphRelationToCharacterId.value
  if (!aId || !bId) return null
  return characterRelations.value.find((r) => r.fromCharacterId === bId && r.toCharacterId === aId) ?? null
})
const relationPairExists = computed(() => Boolean(relationAB.value || relationBA.value))

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
  return characterRelations.value.filter((r) => r.fromCharacterId === id || r.toCharacterId === id)
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

const visibleCharacters = computed(() => characters.value.filter((c) => visibleGraphCharacterIds.value.has(c.id)))

function factionNameById(id?: string | null): string {
  if (!id) return ''
  return factions.value.find((f) => f.id === id)?.name ?? ''
}

/** 各势力下已绑定角色名（按名排序，顿号连接），供势力列表展示 */
const factionMemberNamesByFactionId = computed(() => {
  const out: Record<string, string> = {}
  for (const f of factions.value) {
    const names = characters.value
      .filter((c) => (c.factionId ?? '').trim() === f.id)
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b, 'zh-Hans'))
    out[f.id] = names.join('、')
  }
  return out
})

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

function toggle3dLinkMode(): void {
  graph3dLinkMode.value = !graph3dLinkMode.value
  hoverRelationId.value = ''
  graphLinkError.value = ''
  graphLinkSuccess.value = ''
  if (!graph3dLinkMode.value) {
    graphRelationToCharacterId.value = ''
    graphRelationTypeFromA.value = ''
    graphRelationTypeFromB.value = ''
    graphRelationNote.value = ''
  }
}

function onSphereSelect(id: string): void {
  graphFocusCharacterId.value = id
  graphLinkError.value = ''
  graphLinkSuccess.value = ''
}

function upsertRelation(fromId: string, toId: string, type: string, note: string): void {
  const matches = characterRelations.value.filter((r) => r.fromCharacterId === fromId && r.toCharacterId === toId)
  if (matches.length > 0) {
    // 归并历史重复边：保留一条并更新，其余重复边删除，避免“点了更新但视觉无变化”
    const keep = matches[0]
    updateCharacterRelation({
      id: keep.id,
      relationType: type,
      note,
    })
    for (let i = 1; i < matches.length; i += 1) {
      deleteCharacterRelation(matches[i].id)
    }
    return
  }
  createCharacterRelation({
    novelId: novelId.value,
    fromCharacterId: fromId,
    toCharacterId: toId,
    relationType: type,
    note: note || undefined,
  })
}

function addGraphRelationBidirectional(): void {
  const a = selectedGraphCharacter.value
  const bId = graphRelationToCharacterId.value
  const typeAB = graphRelationTypeFromA.value.trim()
  const typeBA = graphRelationTypeFromB.value.trim()
  const note = graphRelationNote.value.trim()
  const wasUpdate = relationPairExists.value

  if (!a) {
    graphLinkError.value = '请先选中角色 A。'
    graphLinkSuccess.value = ''
    return
  }
  if (!bId || bId === a.id) {
    graphLinkError.value = '请先选择另一个角色 B。'
    graphLinkSuccess.value = ''
    return
  }
  if (!typeAB || !typeBA) {
    graphLinkError.value = '请分别填写 A 对 B、B 对 A 的关系描述。'
    graphLinkSuccess.value = ''
    return
  }

  upsertRelation(a.id, bId, typeAB, note)
  upsertRelation(bId, a.id, typeBA, note)

  characterRelations.value = getCharacterRelationsByNovelId(novelId.value)
  graphLinkError.value = ''
  // 强制把表单同步为“已落库”的最新值，避免用户感知为未更新
  graphRelationTypeFromA.value = relationAB.value?.relationType ?? typeAB
  graphRelationTypeFromB.value = relationBA.value?.relationType ?? typeBA
  graphRelationNote.value = relationAB.value?.note || relationBA.value?.note || note
  graphLinkSuccess.value = wasUpdate ? '双向关系已更新。' : '双向关系已新增。'
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

function addGraphRelation(): void {
  if (!selectedGraphCharacter.value) return
  const toId = graphRelationToCharacterId.value
  const type = graphRelationTypeFromA.value.trim()
  const note = graphRelationNote.value.trim()
  if (!toId || toId === selectedGraphCharacter.value.id) return
  if (!type) return

  createCharacterRelation({
    novelId: novelId.value,
    fromCharacterId: selectedGraphCharacter.value.id,
    toCharacterId: toId,
    relationType: type,
    note: note || undefined,
  })

  characterRelations.value = getCharacterRelationsByNovelId(novelId.value)
  graphRelationToCharacterId.value = ''
  graphRelationTypeFromA.value = ''
  graphRelationNote.value = ''
}

function onGraphRelationNoteChange(relationId: string, event: Event): void {
  const target = event.target as HTMLInputElement | null
  const note = target?.value ?? ''
  updateCharacterRelation({ id: relationId, note })
  characterRelations.value = getCharacterRelationsByNovelId(novelId.value)
}

function removeGraphRelation(relationId: string): void {
  deleteCharacterRelation(relationId)
  characterRelations.value = getCharacterRelationsByNovelId(novelId.value)
}

function handleCreateFaction() {
  if (!novel.value || !factionForm.name.trim()) return
  createFaction({
    novelId: novel.value.id,
    name: factionForm.name,
    leader: factionForm.leader,
    goal: factionForm.goal,
    resource: factionForm.resource,
    relationToProtagonist: factionForm.relationToProtagonist,
    notes: factionForm.notes,
  })
  factionForm.name = ''
  factionForm.leader = ''
  factionForm.goal = ''
  factionForm.resource = ''
  factionForm.relationToProtagonist = ''
  factionForm.notes = ''
  factions.value = getFactionsByNovelId(novel.value.id)
}

function onFactionNotesChange(id: string, event: Event) {
  const target = event.target as HTMLInputElement | null
  updateFaction({ id, notes: target?.value ?? '' })
  factions.value = getFactionsByNovelId(novelId.value)
}

function openFactionEdit(f: Faction): void {
  editingFactionId.value = f.id
  factionEditForm.name = f.name
  factionEditForm.leader = f.leader ?? ''
  factionEditForm.goal = f.goal ?? ''
  factionEditForm.resource = f.resource ?? ''
  factionEditForm.relationToProtagonist = f.relationToProtagonist ?? ''
  factionEditForm.notes = f.notes ?? ''
}

function cancelFactionEdit(): void {
  editingFactionId.value = null
}

function saveFactionEdit(): void {
  const id = editingFactionId.value
  if (!id || !factionEditForm.name.trim()) return
  updateFaction({
    id,
    name: factionEditForm.name.trim() || '未命名势力',
    leader: factionEditForm.leader.trim(),
    goal: factionEditForm.goal.trim(),
    resource: factionEditForm.resource.trim(),
    relationToProtagonist: factionEditForm.relationToProtagonist.trim(),
    notes: factionEditForm.notes.trim(),
  })
  factions.value = getFactionsByNovelId(novelId.value)
  editingFactionId.value = null
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

  if (editingFactionId.value === id) editingFactionId.value = null
  deleteFaction(id)
  factions.value = getFactionsByNovelId(novelId.value)

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
  if (tab === 'write' || tab === 'outline' || tab === 'characters' || tab === 'factions' || tab === 'issues') {
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

function backFromPage(): void {
  const state = window.history.state as { back?: string | null } | null
  if (state?.back) {
    router.back()
    return
  }
  void router.push('/')
}

function switchTab(tab: 'write' | 'outline' | 'characters' | 'factions' | 'issues'): void {
  if (tab === 'characters' && activeTab.value !== 'characters') {
    lastTabBeforeCharacters.value = activeTab.value as 'write' | 'outline' | 'factions' | 'issues'
  }
  activeTab.value = tab
}

</script>

