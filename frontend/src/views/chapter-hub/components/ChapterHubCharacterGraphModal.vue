<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="open && selectedGraphCharacter"
        class="confirm-overlay chapter-hub__char-graph-overlay"
        role="presentation"
        @click.self="emitClose"
      >
        <div
          class="confirm-dialog chapter-hub__char-graph-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chapter-hub-char-graph-title"
        >
          <div class="confirm-dialog__body chapter-hub__char-graph-body">
            <div class="chapter-hub__char-graph-head">
              <div class="chapter-hub__char-graph-head-text">
                <h2 id="chapter-hub-char-graph-title" class="chapter-hub__char-graph-title">
                  {{ selectedGraphCharacter.name }} · 关系
                </h2>
                <p class="chapter-hub__char-graph-sub muted">
                  左侧为工作台「角色」页下方的同款聚焦 3D 关系图；可拖拽旋转查看。
                </p>
                <p
                  v-if="chapterId && modifiedInChapterCharacterIds.length > 0"
                  class="chapter-hub__char-graph-legend muted"
                >
                  琥珀色球体：本章节内修改过档案的角色
                </p>
              </div>
              <div class="chapter-hub__char-graph-head-actions">
                <button
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--ghost"
                  @click="hangCurrentGraph"
                >
                  悬挂3D图
                </button>
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="emitClose">
                  关闭
                </button>
              </div>
            </div>

            <div class="characters-graph-ui chapter-hub__char-graph-ui">
              <div class="characters-graph-ui__left chapter-hub__char-graph-col-3d">
                <div class="characters-graph-ui__viz chapter-hub__char-graph-viz-outer">
                  <div class="characters-graph-ui__viz-main chapter-hub__char-graph-viz-main">
                    <div class="chapter-hub__char-graph-viz-actions">
                      <button
                        type="button"
                        class="confirm-dialog__btn confirm-dialog__btn--ghost chapter-hub__char-graph-viz-action-btn"
                        :disabled="!selectedGraphCharacter"
                        @click="openRelationEditModal"
                      >
                        编辑角色关系
                      </button>
                      <button
                        type="button"
                        class="confirm-dialog__btn confirm-dialog__btn--ghost chapter-hub__char-graph-viz-action-btn"
                        :disabled="!selectedGraphCharacter"
                        @click="openRelationAddModal"
                      >
                        新增角色关系
                      </button>
                    </div>
                    <CharacterRelationFocusSphere
                      v-if="visibleCharacters.length > 0"
                      selectable
                      :render-scale="1"
                      :panel-height="520"
                      :characters="visibleCharacters"
                      :relations="relatedRelations"
                      :focus-character-id="focusCharacterId"
                      :modified-in-chapter-ids="modifiedInChapterCharacterIds"
                      @select="onFocusSphereNodeSelect"
                    />
                    <p v-else class="muted">暂无关系数据。</p>
                  </div>
                </div>
              </div>

              <div class="characters-graph-ui__right chapter-hub__char-graph-right">
                <article class="characters-graph-ui__section character-panel">
                  <header class="character-panel__head">
                    <h3 class="character-panel__title">档案</h3>
                  </header>
                  <div v-if="editingCharacter" class="character-panel__main">
                    <div class="character-panel__body character-panel__body--scroll scrollbar-paper">
                      <div class="character-panel__hero">
                        <p class="character-panel__name">{{ editingCharacter.name }}</p>
                        <div class="character-panel__hero-chips">
                          <span class="character-panel__chip">
                            {{ editingCharacter.firstAppearanceChapterNo != null ? `首见 · 第 ${editingCharacter.firstAppearanceChapterNo} 章` : '首见 · 暂未出场' }}
                          </span>
                          <span
                            v-if="chapterId && isEditingCharacterModifiedInChapter"
                            class="character-panel__chip character-panel__chip--chapter-edited"
                            title="该角色在本章节保存过档案修改"
                          >
                            本章节已改
                          </span>
                        </div>
                      </div>
                      <dl class="character-panel__spec">
                        <div class="character-panel__spec-item">
                          <dt>年龄</dt>
                          <dd>{{ editingCharacter.age || '—' }}</dd>
                        </div>
                        <div class="character-panel__spec-item">
                          <dt>性别</dt>
                          <dd>{{ editingCharacter.gender || '—' }}</dd>
                        </div>
                        <div class="character-panel__spec-item character-panel__spec-item--block">
                          <dt>所属势力</dt>
                          <dd>
                            <ul v-if="graphCharacterMemberships.length > 0" class="character-panel__faction-list">
                              <li v-for="m in graphCharacterMemberships" :key="m.factionId">
                                <strong>{{ factionNameById(m.factionId) }}</strong>
                                <span v-if="(m.description ?? '').trim()" class="muted">— {{ m.description }}</span>
                              </li>
                            </ul>
                            <template v-else>—</template>
                          </dd>
                        </div>
                        <div class="character-panel__spec-item character-panel__spec-item--block">
                          <dt>分类</dt>
                          <dd>
                            <ul v-if="characterCategoryViewLines.length > 0" class="character-panel__faction-list">
                              <li v-for="name in characterCategoryViewLines" :key="`cv-${name}`">
                                <strong>{{ name }}</strong>
                              </li>
                            </ul>
                            <template v-else>—</template>
                          </dd>
                        </div>
                        <div class="character-panel__spec-item character-panel__spec-item--block">
                          <dt>持有物品</dt>
                          <dd>
                            <ul v-if="graphCharacterHeldItems.length > 0" class="character-panel__faction-list">
                              <li v-for="item in graphCharacterHeldItems" :key="`chi-${item.id}`">
                                <strong>{{ item.name }}</strong>
                              </li>
                            </ul>
                            <template v-else>—</template>
                          </dd>
                        </div>
                      </dl>
                      <section class="character-panel__block">
                        <h4 class="character-panel__block-title">扩展条目</h4>
                        <ul v-if="(editingCharacter.attributes?.length ?? 0) > 0" class="character-panel__extra-list">
                          <li v-for="a in editingCharacter.attributes" :key="a.id" class="character-panel__extra">
                            <span class="character-panel__extra-key">{{ a.key }}</span>
                            <p class="character-panel__extra-val">{{ a.value }}</p>
                          </li>
                        </ul>
                        <p v-else class="character-panel__empty">无扩展条目</p>
                      </section>
                    </div>
                    <footer class="character-panel__foot">
                      <button type="button" class="character-panel__btn character-panel__btn--ghost" @click="openCharacterAllChangesModal">
                        显示角色所有更改
                      </button>
                      <button type="button" class="character-panel__btn character-panel__btn--primary" @click="openCharacterEditModal">
                        编辑
                      </button>
                    </footer>
                  </div>
                  <p v-else class="character-panel__placeholder">在上方图谱中选择角色以查看档案</p>
                </article>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Transition>
    <Transition name="confirm">
      <div
        v-if="open && characterAllChangesModalOpen && editingCharacter"
        class="confirm-overlay"
        role="presentation"
        @click.self="closeCharacterAllChangesModal"
      >
        <div class="confirm-dialog chapter-hub__relation-edit-dialog" role="dialog" aria-modal="true">
          <div class="confirm-dialog__accent" aria-hidden="true" />
          <div class="confirm-dialog__body chapter-hub__relation-edit-dialog-body">
            <h2 class="confirm-dialog__title">角色全部更改 · {{ editingCharacter.name }}</h2>
            <div class="chapter-hub__relation-edit-top">
              <label class="chapter-hub__relation-edit-field">
                <span>查看字段</span>
                <div class="workspace-dd">
                  <button
                    type="button"
                    class="workspace-dd__btn workspace-dd__btn--compact"
                    :class="{ 'workspace-dd__btn--open': characterAllChangesFieldDropdownOpen }"
                    data-dd-key="hub-character-all-changes-field"
                    @click="toggleCharacterAllChangesFieldDropdown"
                  >
                    <span class="workspace-dd__btn-text">{{ characterAllChangesFieldDropdownLabel }}</span>
                    <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                  </button>
                  <div
                    v-if="characterAllChangesFieldDropdownOpen"
                    class="workspace-dd__panel scrollbar-paper"
                    :class="dropdownPanelDirectionClass('hub-character-all-changes-field')"
                    data-dd-panel-key="hub-character-all-changes-field"
                    role="listbox"
                  >
                    <button
                      type="button"
                      class="workspace-dd__item"
                      :class="{ 'workspace-dd__item--active': characterAllChangesFieldFilter === '__all__' }"
                      @click="selectCharacterAllChangesField('__all__')"
                    >
                      全部字段
                    </button>
                    <button
                      v-for="opt in characterAllChangeFieldOptions"
                      :key="`chg-field-${opt.value}`"
                      type="button"
                      class="workspace-dd__item"
                      :class="{ 'workspace-dd__item--active': characterAllChangesFieldFilter === opt.value }"
                      @click="selectCharacterAllChangesField(opt.value)"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                </div>
              </label>
            </div>
            <div class="chapter-hub__relation-edit-scroll scrollbar-paper">
              <template v-if="filteredCharacterAllChangeRows.length > 0">
                <div
                  v-for="(row, idx) in filteredCharacterAllChangeRows"
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
                      @click="jumpToCharacterChange(row)"
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
            <div class="confirm-dialog__actions chapter-hub__relation-edit-actions">
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeCharacterAllChangesModal">
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <Transition name="confirm">
      <div
        v-if="open && characterEditModalOpen && editingCharacter"
        class="confirm-overlay"
        role="presentation"
        @click.self="closeCharacterEditModal"
      >
        <div class="confirm-dialog workspace-character-edit-dialog" role="dialog" aria-modal="true">
          <div class="confirm-dialog__accent" aria-hidden="true" />
          <div class="confirm-dialog__body workspace-character-edit-dialog__body">
            <h2 class="confirm-dialog__title">修改角色</h2>
            <p class="muted workspace-character-edit-dialog__sub">基础信息、分类、势力关联与扩展条目</p>
            <div class="character-panel__body character-panel__body--edit workspace-character-edit-dialog__scroll scrollbar-paper" style="padding: 0; margin-top: 12px">
              <div class="character-panel__form-grid">
                <label class="character-panel__field workspace-character-edit-dialog__left-col">
                  <span class="character-panel__field-label">姓名</span>
                  <input v-model="draft.name" class="character-panel__input" maxlength="40" />
                </label>
                <label class="character-panel__field workspace-character-edit-dialog__left-col">
                  <span class="character-panel__field-label">年龄</span>
                  <input v-model="draft.age" class="character-panel__input" maxlength="20" />
                </label>
                <div class="character-panel__field">
                  <span class="character-panel__field-label">性别</span>
                  <div class="character-gender-toggle" role="radiogroup" aria-label="性别">
                    <button
                      v-for="option in genderOptions"
                      :key="`hub-gender-${option.value || 'unset'}`"
                      type="button"
                      class="character-gender-toggle__option"
                      :class="{ 'character-gender-toggle__option--active': draft.gender === option.value }"
                      role="radio"
                      :aria-checked="draft.gender === option.value"
                      @click="draft.gender = option.value"
                    >
                      <span class="character-gender-toggle__dot" aria-hidden="true">{{ option.mark }}</span>
                      <span>{{ option.label }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <section class="character-panel__block character-panel__block--edit workspace-character-edit-dialog__full-row">
                <div class="character-panel__block-head">
                  <h4 class="character-panel__block-title">别名</h4>
                </div>
                <div v-for="row in draft.aliasRows" :key="row.id" class="character-panel__custom-card">
                  <label class="character-panel__field character-panel__field--tight">
                    <span class="character-panel__field-label">别称</span>
                    <input v-model="row.value" class="character-panel__input" maxlength="40" />
                  </label>
                  <button type="button" class="character-panel__icon-btn" @click="removeAliasRow(row.id)">移除</button>
                </div>
                <button type="button" class="character-panel__btn character-panel__btn--dashed" @click="addAliasRow">＋ 添加别名</button>
              </section>

              <section class="character-panel__block character-panel__block--edit workspace-character-edit-dialog__full-row">
                <div class="character-panel__block-head">
                  <h4 class="character-panel__block-title">分类</h4>
                  <span class="character-panel__block-hint">可多选；需在「分类」页先创建分类</span>
                </div>
                <p v-if="sortedCategories.length === 0" class="muted" style="margin: 0 0 8px">暂无分类，请在工作台「分类」中新建。</p>
                <div v-else class="character-panel__category-checks" role="group" aria-label="角色分类">
                  <label
                    v-for="cat in sortedCategories"
                    :key="`dcc-${cat.id}`"
                    class="category-bind-chip character-panel__category-chip"
                    :class="draft.categoryIds.includes(cat.id) ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'"
                    :for="`hub-cat-${cat.id}`"
                  >
                    <input
                      :id="`hub-cat-${cat.id}`"
                      type="checkbox"
                      class="visually-hidden"
                      :checked="draft.categoryIds.includes(cat.id)"
                      @change="toggleDraftCategory(cat.id)"
                    />
                    <span class="category-bind-chip__state" aria-hidden="true">{{
                      draft.categoryIds.includes(cat.id) ? '✓' : '+'
                    }}</span>
                    <span class="character-panel__category-chip-text">{{ cat.name }}</span>
                  </label>
                </div>
              </section>

              <section class="character-panel__block character-panel__block--edit workspace-character-edit-dialog__full-row">
                <div class="character-panel__block-head">
                  <h4 class="character-panel__block-title">所属势力</h4>
                </div>
                <div v-for="(row, idx) in draft.membershipRows" :key="`mm-${idx}-${row.factionId}`" class="character-panel__custom-card">
                  <label class="character-panel__field character-panel__field--tight">
                    <span class="character-panel__field-label">势力</span>
                    <div class="workspace-dd">
                      <button
                        type="button"
                        class="workspace-dd__btn workspace-dd__btn--compact"
                        :class="{ 'workspace-dd__btn--open': characterEditMembershipFactionDropdownOpenId === String(idx) }"
                        :data-dd-key="`hub-character-membership-${idx}`"
                        @click="toggleCharacterEditMembershipFactionDropdown(idx)"
                      >
                        <span class="workspace-dd__btn-text">{{ characterEditMembershipFactionLabel(row.factionId) }}</span>
                        <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                      </button>
                      <div
                        v-if="characterEditMembershipFactionDropdownOpenId === String(idx)"
                        class="workspace-dd__panel scrollbar-paper"
                        :class="[
                          dropdownPanelDirectionClass(`hub-character-membership-${idx}`),
                          { 'workspace-dd__panel--max4': factionOptions.length > 4 },
                        ]"
                        :data-dd-panel-key="`hub-character-membership-${idx}`"
                        role="listbox"
                      >
                        <button
                          v-for="f in factionOptions"
                          :key="`hub-cfd-${f.id}`"
                          type="button"
                          class="workspace-dd__item"
                          :class="{ 'workspace-dd__item--active': row.factionId === f.id }"
                          @click="selectCharacterEditMembershipFaction(idx, f.id)"
                        >
                          {{ f.name }}
                        </button>
                      </div>
                    </div>
                  </label>
                  <label class="character-panel__field">
                    <span class="character-panel__field-label">在该势力中的描述（最多 120 字）</span>
                    <input v-model="row.description" class="character-panel__input" maxlength="120" />
                  </label>
                  <button type="button" class="character-panel__icon-btn" @click="removeMembershipRow(idx)">移除</button>
                </div>
                <button type="button" class="character-panel__btn character-panel__btn--dashed" @click="addMembershipRow">＋ 添加势力关联</button>
              </section>

              <section class="character-panel__block character-panel__block--edit workspace-character-edit-dialog__full-row">
                <div class="character-panel__block-head">
                  <h4 class="character-panel__block-title">绑定物品</h4>
                  <span class="character-panel__block-hint">可绑定多个物品；选择已被占用的物品会在保存后转移持有者</span>
                </div>
                <p v-if="items.length === 0" class="muted" style="margin: 0 0 8px">暂无物品，请先到工作台「物品」页创建物品。</p>
                <label v-else class="character-panel__field character-panel__field--tight">
                  <span class="character-panel__field-label">搜索物品</span>
                  <input v-model="itemQuery" class="character-panel__input" maxlength="40" />
                </label>
                <div v-if="items.length > 0" class="character-panel__category-checks" role="group" aria-label="绑定物品">
                  <button
                    v-for="item in itemPickerRows"
                    :key="`hub-character-item-${item.id}`"
                    type="button"
                    class="category-bind-chip character-panel__category-chip"
                    :class="item.bound ? 'category-bind-chip--bound' : 'category-bind-chip--unbound'"
                    @click="toggleItemBinding(item.id)"
                  >
                    <span class="category-bind-chip__state" aria-hidden="true">{{ item.bound ? '已绑定' : '未绑定' }}</span>
                    <span class="character-panel__category-chip-text">{{ item.name }}</span>
                    <span class="muted">· {{ item.transferHint }}</span>
                  </button>
                </div>
                <p v-if="items.length > 0 && itemPickerRows.length === 0" class="muted" style="margin: 8px 0 0">没有匹配的物品。</p>
              </section>

              <section class="character-panel__block character-panel__block--edit workspace-character-edit-dialog__full-row">
                <div class="character-panel__block-head">
                  <h4 class="character-panel__block-title">扩展条目</h4>
                </div>
                <div v-for="a in draft.attributes" :key="a.id" class="character-panel__custom-card">
                  <label class="character-panel__field character-panel__field--tight">
                    <span class="character-panel__field-label">名称</span>
                    <input v-model="a.key" class="character-panel__input" maxlength="40" />
                  </label>
                  <label class="character-panel__field">
                    <span class="character-panel__field-label">说明</span>
                    <input v-model="a.value" class="character-panel__input" maxlength="80" />
                  </label>
                  <button type="button" class="character-panel__icon-btn" @click="removeAttributeRow(a.id)">移除</button>
                </div>
                <button type="button" class="character-panel__btn character-panel__btn--dashed" @click="addAttributeRow">＋ 新建条目</button>
              </section>
            </div>

            <div class="confirm-dialog__actions workspace-character-edit-dialog__actions">
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeCharacterEditModal">取消</button>
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" :disabled="!canSaveDraft" @click="saveCharacterEdit">
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <Transition name="confirm">
      <div
        v-if="open && relationEditModalOpen && selectedGraphCharacter"
        class="confirm-overlay"
        role="presentation"
        @click.self="closeRelationEditModal"
      >
        <div class="confirm-dialog chapter-hub__relation-edit-dialog" role="dialog" aria-modal="true">
          <div class="confirm-dialog__accent" aria-hidden="true" />
          <div class="confirm-dialog__body chapter-hub__relation-edit-dialog-body">
            <h2 class="confirm-dialog__title">编辑角色关系</h2>
            <div v-if="relationDraftRows.length > 0" class="chapter-hub__relation-edit-top">
              <label class="chapter-hub__relation-edit-field">
                <span>搜索角色</span>
                <input
                  v-model="relationEditSearchQuery"
                  type="search"
                  class="character-panel__input chapter-hub__relation-edit-search-input"
                  placeholder="留空显示全部关系；输入对方名称或 id 片段可筛选列表"
                  autocomplete="off"
                  aria-label="筛选要显示的对方角色"
                />
              </label>
            </div>
            <div class="chapter-hub__relation-edit-scroll scrollbar-paper">
              <template v-if="relationEditVisibleRows.length > 0">
                <div
                  v-for="row in relationEditVisibleRows"
                  :key="`rel-edit-${row.targetCharacterId}`"
                  class="chapter-hub__relation-edit-row"
                >
                  <div class="chapter-hub__relation-edit-row-head">
                    <p class="chapter-hub__relation-edit-target">
                      {{ selectedGraphCharacter.name }} · {{ row.targetName }}
                    </p>
                    <button
                      type="button"
                      class="character-panel__icon-btn chapter-hub__relation-edit-remove"
                      @click="removeRelationDraftRow(row.targetCharacterId)"
                    >
                      移除此行
                    </button>
                  </div>
                  <label class="chapter-hub__relation-edit-field">
                    <span class="chapter-hub__relation-edit-sentence">
                      「<strong>{{ selectedGraphCharacter.name }}</strong>」是「<strong>{{ row.targetName }}</strong>」的
                    </span>
                    <input
                      v-model="row.centerToOtherType"
                      class="character-panel__input"
                      maxlength="20"
                      placeholder="如：父亲、徒弟、盟友"
                    />
                  </label>
                  <label class="chapter-hub__relation-edit-field">
                    <span class="chapter-hub__relation-edit-sentence">
                      「<strong>{{ row.targetName }}</strong>」是「<strong>{{ selectedGraphCharacter.name }}</strong>」的
                    </span>
                    <input
                      v-model="row.otherToCenterType"
                      class="character-panel__input"
                      maxlength="20"
                      placeholder="如：儿子、师父、宿敌"
                    />
                  </label>
                </div>
              </template>
              <p v-else-if="relationDraftRows.length > 0" class="muted">无匹配角色，请调整搜索词。</p>
              <p v-else class="muted">暂无与球心相连的角色关系可编辑。</p>
            </div>
            <div class="confirm-dialog__actions chapter-hub__relation-edit-actions">
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeRelationEditModal">
                取消
              </button>
              <button
                type="button"
                class="confirm-dialog__btn confirm-dialog__btn--danger"
                :disabled="!canSaveRelationDraft"
                @click="saveRelationDraftRows"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <Transition name="confirm">
      <div
        v-if="open && relationAddModalOpen && selectedGraphCharacter"
        class="confirm-overlay"
        role="presentation"
        @click.self="closeRelationAddModal"
      >
        <div class="confirm-dialog chapter-hub__relation-add-dialog" role="dialog" aria-modal="true">
          <div class="confirm-dialog__accent" aria-hidden="true" />
          <div class="confirm-dialog__body chapter-hub__relation-add-dialog-body">
            <h2 class="confirm-dialog__title">新增角色关系</h2>
            <p class="muted chapter-hub__relation-edit-sub">
              为球心「{{ selectedGraphCharacter.name }}」与另一名本作角色建立双向称谓（与「编辑角色关系」中的两行含义相同）。
            </p>
            <div class="chapter-hub__relation-add-form scrollbar-paper">
              <label class="chapter-hub__relation-edit-field">
                <span>对方角色</span>
                <div class="relation-target-dd">
                  <button
                    type="button"
                    class="workspace-dd__btn workspace-dd__btn--compact character-panel__input relation-target-dd__btn"
                    :class="{ 'workspace-dd__btn--open': relationAddTargetDropdownOpen }"
                    @click="toggleRelationAddTargetDropdown"
                  >
                    <span class="workspace-dd__btn-text">{{ relationAddTargetDropdownLabel }}</span>
                    <span class="workspace-dd__btn-caret" aria-hidden="true">▾</span>
                  </button>
                  <div v-if="relationAddTargetDropdownOpen" class="relation-target-dd__panel" role="listbox">
                    <div class="relation-target-dd__search">
                      <input
                        v-model="relationAddTargetQuery"
                        type="search"
                        class="workspace-dd__search-input relation-target-dd__search-input"
                        placeholder="搜索角色名…"
                        autocomplete="off"
                      />
                    </div>
                    <div class="relation-target-dd__list scrollbar-paper">
                      <button
                        type="button"
                        class="workspace-dd__item"
                        :class="{ 'workspace-dd__item--active': !newRelationTargetId }"
                        @click="selectRelationAddTarget('')"
                      >
                        请选择尚未与球心建立关系的角色…
                      </button>
                      <button
                        v-for="c in relationAddFilteredTargets"
                        :key="`rel-new-${c.id}`"
                        type="button"
                        class="workspace-dd__item"
                        :class="{ 'workspace-dd__item--active': newRelationTargetId === c.id }"
                        @click="selectRelationAddTarget(c.id)"
                      >
                        {{ c.name || '未命名角色' }}
                      </button>
                      <p v-if="relationAddNewCandidates.length === 0" class="muted relation-target-dd__empty">
                        本作中已没有可与球心新建关系的角色。
                      </p>
                      <p v-else-if="relationAddFilteredTargets.length === 0" class="muted relation-target-dd__empty">
                        没有匹配的角色。
                      </p>
                    </div>
                  </div>
                </div>
              </label>
              <label v-if="newRelationTargetName" class="chapter-hub__relation-edit-field">
                <span class="chapter-hub__relation-edit-sentence">
                  「<strong>{{ selectedGraphCharacter.name }}</strong>」是「<strong>{{ newRelationTargetName }}</strong>」的
                </span>
                <input
                  v-model="newRelationCenterToOther"
                  class="character-panel__input"
                  maxlength="20"
                  placeholder="如：父亲、徒弟、盟友"
                />
              </label>
              <label v-if="newRelationTargetName" class="chapter-hub__relation-edit-field">
                <span class="chapter-hub__relation-edit-sentence">
                  「<strong>{{ newRelationTargetName }}</strong>」是「<strong>{{ selectedGraphCharacter.name }}</strong>」的
                </span>
                <input
                  v-model="newRelationOtherToCenter"
                  class="character-panel__input"
                  maxlength="20"
                  placeholder="如：儿子、师父、宿敌"
                />
              </label>
              <p v-if="relationAddNewCandidates.length === 0" class="muted">
                本作中已没有可与球心新建关系的角色（或均已存在关系边）。
              </p>
            </div>
            <div class="confirm-dialog__actions chapter-hub__relation-edit-actions">
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="closeRelationAddModal">
                取消
              </button>
              <button
                type="button"
                class="confirm-dialog__btn confirm-dialog__btn--danger"
                :disabled="!canSaveNewRelation"
                @click="saveNewRelationPair"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <div
      v-for="win in hungGraphWindows"
      :key="win.id"
      class="chapter-hub__char-graph-float"
      :style="hungGraphFloatStyle(win)"
      role="dialog"
      aria-label="悬挂3D关系图"
    >
      <div class="chapter-hub__char-graph-float-bar" @pointerdown="onFloatBarPointerDown(win.id, $event)">
        <span>{{ characterNameById(win.focusCharacterId) }} · 悬挂 3D 图</span>
        <button
          type="button"
          class="chapter-hub__char-graph-float-close"
          aria-label="关闭悬挂3D图"
          @click="removeHungGraph(win.id)"
        >
          收回
        </button>
      </div>
      <div class="chapter-hub__char-graph-float-body">
        <CharacterRelationFocusSphere
          v-if="visibleCharactersByFocus(win.focusCharacterId).length > 0"
          selectable
          :render-scale="win.renderScale"
          :panel-height="Math.max(120, win.height - 40)"
          :characters="visibleCharactersByFocus(win.focusCharacterId)"
          :relations="relatedRelationsByFocus(win.focusCharacterId)"
          :focus-character-id="win.focusCharacterId"
          :modified-in-chapter-ids="modifiedInChapterCharacterIds"
        />
        <p v-else class="muted">暂无关系数据。</p>
      </div>
      <div class="chapter-hub__char-graph-float-resizer" @pointerdown="onFloatResizerPointerDown(win.id, $event)" />
    </div>
  </Teleport>
  <ConfirmDialog
    v-model="renameConfirmOpen"
    title="应用新角色名到全文"
    message="你更改了角色名或别名。保存后将把正文中该角色的旧名字/旧别名统一替换为新角色名。是否继续？"
    confirm-label="继续保存"
    cancel-label="取消"
    :danger="false"
    :show-danger-subhint="false"
    @confirm="confirmRenameAndSave"
  />
  <ConfirmDialog
    v-model="unsavedConfirmOpen"
    title="放弃未保存的修改？"
    message="当前弹窗有未保存内容。确认取消后，当前修改将不会保留。"
    confirm-label="放弃修改"
    cancel-label="继续编辑"
    :danger="false"
    :show-danger-subhint="false"
    @confirm="confirmDiscardChanges"
    @cancel="cancelDiscardChanges"
  />
  <SaveToast :open="saveToastOpen" :message="saveToastMessage" />
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, toRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import CharacterRelationFocusSphere from '../../../components/CharacterRelationFocusSphere.vue'
import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import SaveToast from '../../../components/SaveToast.vue'
import { useCharacterGraphCharacterEditor } from '../../../features/chapter-hub/composables/useCharacterGraphCharacterEditor'
import { useCharacterGraphRelations } from '../../../features/chapter-hub/composables/useCharacterGraphRelations'
import {
  getCharacterChangeHistory,
  getCharacterFactionMembershipsByNovelId,
  getChaptersByNovelId,
  getFactionsByNovelId,
  hasCharacterChangeInChapter,
  normalizeCategoryIds,
  type CharacterChangeEvent,
} from '../../../lib/storage'
import type { Category, Character, CharacterFactionMembership, CharacterRelation, Faction, Item } from '../../../types'

const props = defineProps<{
  open: boolean
  novelId: string
  characters: Character[]
  items: Item[]
  /** 作品下全部分类（用于多选） */
  categories?: Category[]
  focusCharacterId: string
  chapterId?: string
  sourceTextRange?: { start: number; end: number } | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()
const router = useRouter()

const characterRelations = ref<CharacterRelation[]>([])
const factionOptions = ref<Faction[]>([])
const membershipSource = ref<CharacterFactionMembership[]>([])
const editingCharacterId = ref('')
const dropdownDirectionByKey = reactive<Record<string, 'up' | 'down'>>({})
const saveToastOpen = ref(false)
const saveToastMessage = ref('修改已保存。')
const characterAllChangesModalOpen = ref(false)
const characterAllChangesFieldFilter = ref('__all__')
const characterAllChangesFieldDropdownOpen = ref(false)
const unsavedConfirmOpen = ref(false)
let pendingDiscardAction: null | (() => void) = null
let saveToastTimer: ReturnType<typeof setTimeout> | null = null

const genderOptions = [
  { value: '', label: '未设', mark: '—' },
  { value: '男', label: '男', mark: '♂' },
  { value: '女', label: '女', mark: '♀' },
  { value: '其他', label: '其他', mark: '◇' },
]

type HungGraphWindow = {
  id: string
  focusCharacterId: string
  x: number
  y: number
  width: number
  height: number
  renderScale: number
}
const hungGraphWindows = ref<HungGraphWindow[]>([])
const draggingWindowId = ref('')
const resizingWindowId = ref('')
const floatDragOffsetX = ref(0)
const floatDragOffsetY = ref(0)
const resizeStartX = ref(0)
const resizeStartY = ref(0)
const resizeStartWidth = ref(0)
const resizeStartHeight = ref(0)

function onFocusSphereNodeSelect(id: string): void {
  const next = props.characters.find((c) => c.id === id)
  if (!next) return
  setDraftByCharacter(next)
}

const selectedGraphCharacter = computed(
  () => props.characters.find((c) => c.id === props.focusCharacterId) ?? null
)
const editingCharacter = computed(
  () => props.characters.find((c) => c.id === editingCharacterId.value) ?? selectedGraphCharacter.value ?? null
)
const graphCharacterMemberships = computed(() => {
  const c = editingCharacter.value
  if (!c) return []
  return membershipSource.value.filter((m) => m.characterId === c.id)
})

const graphCharacterHeldItems = computed(() => {
  const c = editingCharacter.value
  if (!c) return [] as Item[]
  return props.items
    .filter((item) => item.novelId === props.novelId && item.ownerType === 'character' && item.ownerId === c.id)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans'))
})

const sortedCategories = computed(() =>
  [...(props.categories ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans')),
)

const characterCategoryViewLines = computed(() => {
  const c = editingCharacter.value
  if (!c) return [] as string[]
  const idSet = new Set(normalizeCategoryIds(c.categoryIds))
  return sortedCategories.value.filter((cat) => idSet.has(cat.id)).map((cat) => cat.name)
})

function toggleDraftCategory(categoryId: string): void {
  const id = String(categoryId ?? '').trim()
  if (!id) return
  const i = draft.categoryIds.indexOf(id)
  if (i >= 0) draft.categoryIds.splice(i, 1)
  else draft.categoryIds.push(id)
}

const relatedRelations = computed(() => {
  const id = props.focusCharacterId
  return characterRelations.value.filter((r) => r.fromCharacterId === id || r.toCharacterId === id)
})

const visibleGraphCharacterIds = computed(() => {
  const ids = new Set<string>()
  if (props.focusCharacterId) ids.add(props.focusCharacterId)
  relatedRelations.value.forEach((r) => {
    ids.add(r.fromCharacterId)
    ids.add(r.toCharacterId)
  })
  return ids
})

const visibleCharacters = computed(() => props.characters.filter((c) => visibleGraphCharacterIds.value.has(c.id)))

const {
  relationEditModalOpen,
  relationAddModalOpen,
  newRelationTargetId,
  newRelationCenterToOther,
  newRelationOtherToCenter,
  relationDraftRows,
  relationEditSearchQuery,
  relationEditVisibleRows,
  canSaveRelationDraft,
  hasUnsavedRelationEditChanges,
  hasUnsavedRelationAddChanges,
  relationAddNewCandidates,
  newRelationTargetName,
  canSaveNewRelation,
  reloadRelations,
  refreshRelationEditState,
  refreshRelationAddState,
  openRelationEditModal,
  closeRelationEditModal: closeRelationEditModalCore,
  openRelationAddModal,
  closeRelationAddModal: closeRelationAddModalCore,
  removeRelationDraftRow,
  saveNewRelationPair,
  saveRelationDraftRows,
} = useCharacterGraphRelations({
  novelId: toRef(props, 'novelId'),
  characters: toRef(props, 'characters'),
  focusCharacterId: toRef(props, 'focusCharacterId'),
  characterRelations,
  onSaved: handleSaved,
})


const relationAddTargetDropdownOpen = ref(false)
const relationAddTargetQuery = ref('')
const relationAddTargetDropdownLabel = computed(() => newRelationTargetName.value || '请选择尚未与球心建立关系的角色…')
const relationAddFilteredTargets = computed(() => {
  const q = relationAddTargetQuery.value.trim().toLowerCase()
  if (!q) return relationAddNewCandidates.value
  return relationAddNewCandidates.value.filter((c) => String(c.name ?? '').toLowerCase().includes(q))
})

function selectRelationAddTarget(id: string): void {
  newRelationTargetId.value = id
  relationAddTargetDropdownOpen.value = false
  relationAddTargetQuery.value = ''
  if (!id) {
    newRelationCenterToOther.value = ''
    newRelationOtherToCenter.value = ''
  }
}

function toggleRelationAddTargetDropdown(): void {
  relationAddTargetDropdownOpen.value = !relationAddTargetDropdownOpen.value
  if (!relationAddTargetDropdownOpen.value) relationAddTargetQuery.value = ''
}

/** 变更历史里在本章节（chapterId）记过一笔的角色，用于 3D 球体琥珀色高亮 */
const modifiedInChapterCharacterIds = computed(() => {
  const chId = String(props.chapterId ?? '').trim()
  if (!chId) return [] as string[]
  return props.characters.filter((c) => hasCharacterChangeInChapter(c.id, chId)).map((c) => c.id)
})

const isEditingCharacterModifiedInChapter = computed(() => {
  const chId = String(props.chapterId ?? '').trim()
  const id = editingCharacter.value?.id
  if (!chId || !id) return false
  return hasCharacterChangeInChapter(id, chId)
})

const chapterLabelById = computed(() => {
  const map = new Map<string, string>()
  for (const ch of getChaptersByNovelId(props.novelId)) {
    map.set(ch.id, `第 ${ch.chapterNo} 章${(ch.title ?? '').trim() ? ` · ${ch.title}` : ''}`)
  }
  return map
})

type CharacterAllChangesRow = {
  updatedAt: string
  when: string
  chapterId: string
  chapterLabel: string
  anchorStart: number | null
  anchorEnd: number | null
  fields: string[]
  details: Array<{ field: string; location: string; before: string; after: string }>
}

function normalizeAnchorSpan(ev: CharacterChangeEvent): { start: number; end: number } | null {
  const s = typeof ev.anchorStart === 'number' ? Math.max(0, Math.floor(ev.anchorStart)) : NaN
  const e = typeof ev.anchorEnd === 'number' ? Math.max(0, Math.floor(ev.anchorEnd)) : NaN
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null
  return { start: s, end: e }
}

function groupAllChangesByAnchor(history: CharacterChangeEvent[]): CharacterAllChangesRow[] {
  const groups = new Map<string, CharacterChangeEvent[]>()
  const order: string[] = []

  history.forEach((ev, idx) => {
    const chapterId = String(ev.chapterId ?? '').trim()
    const span = normalizeAnchorSpan(ev)
    const key = chapterId && span ? `ch:${chapterId}|a:${span.start}-${span.end}` : `free:${idx}:${ev.updatedAt ?? ''}`
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(ev)
  })

  const out: CharacterAllChangesRow[] = []
  for (const key of order) {
    const list = (groups.get(key) ?? []).slice()
    list.sort((a, b) => String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? '')))
    const first = list[0]
    const last = list[list.length - 1]
    if (!first || !last) continue

    const chapterId = String(last.chapterId ?? first.chapterId ?? '').trim()
    const span = normalizeAnchorSpan(last) ?? normalizeAnchorSpan(first)
    const fieldSet = new Set<string>()
    const detailMap = new Map<string, { field: string; location: string; before: string; after: string }>()

    for (const ev of list) {
      for (const f of ev.fields ?? []) {
        const x = String(f ?? '').trim()
        if (x) fieldSet.add(x)
      }
      for (const d of ev.details ?? []) {
        const field = String(d.field ?? '').trim()
        const location = String(d.location ?? '').trim()
        if (!field && !location) continue
        const k = `${field}@@${location}`
        const hit = detailMap.get(k)
        if (!hit) {
          detailMap.set(k, { field, location, before: String(d.before ?? ''), after: String(d.after ?? '') })
        } else {
          hit.after = String(d.after ?? '')
        }
      }
    }

    const updatedAt = String(last.updatedAt ?? '')
    const when = updatedAt ? new Date(updatedAt).toLocaleString() : '未知时间'
    out.push({
      updatedAt,
      when,
      chapterId,
      chapterLabel: chapterLabelById.value.get(chapterId) ?? '',
      anchorStart: span?.start ?? null,
      anchorEnd: span?.end ?? null,
      fields: Array.from(fieldSet),
      details: Array.from(detailMap.values()),
    })
  }
  return out
}

const characterAllChangeRows = computed(() => {
  const c = editingCharacter.value
  if (!c) return [] as CharacterAllChangesRow[]
  const grouped = groupAllChangesByAnchor(getCharacterChangeHistory(c.id))
  return grouped
    .filter((row) => (row.fields?.length ?? 0) > 0 || (row.details?.length ?? 0) > 0)
    .slice()
    .reverse()
})

function characterFieldLabel(field: string): string {
  const key = String(field ?? '').trim()
  if (key === 'age') return '年龄'
  if (key === 'gender') return '性别'
  if (key === 'name') return '姓名'
  if (key === 'notes') return '备注'
  if (key === 'aliases') return '别名'
  if (key === 'memberships') return '所属势力'
  if (key === 'items') return '绑定物品'
  if (key === 'categoryIds') return '分类'
  if (key === 'attributes') return '扩展条目'
  return key || '未知字段'
}

function extractAttributeKeys(raw: string): string[] {
  const text = String(raw ?? '').trim()
  if (!text) return []
  return text
    .split(/[；;]/)
    .map((part) => {
      const i = part.indexOf(':')
      if (i < 0) return ''
      return part.slice(0, i).trim()
    })
    .filter(Boolean)
}

const characterAllChangeFieldOptions = computed(() => {
  const fieldSet = new Set<string>()
  const attrKeySet = new Set<string>()
  for (const row of characterAllChangeRows.value) {
    for (const f of row.fields) fieldSet.add(f)
    for (const d of row.details) {
      if (d.field !== 'attributes') continue
      for (const k of extractAttributeKeys(d.before)) attrKeySet.add(k)
      for (const k of extractAttributeKeys(d.after)) attrKeySet.add(k)
    }
  }
  for (const a of editingCharacter.value?.attributes ?? []) {
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

const characterAllChangesFieldDropdownLabel = computed(() => {
  const sel = String(characterAllChangesFieldFilter.value ?? '__all__').trim()
  if (!sel || sel === '__all__') return '全部字段'
  const hit = characterAllChangeFieldOptions.value.find((x) => x.value === sel)
  return hit?.label ?? '全部字段'
})

function selectCharacterAllChangesField(v: string): void {
  characterAllChangesFieldFilter.value = v
  characterAllChangesFieldDropdownOpen.value = false
}

function toggleCharacterAllChangesFieldDropdown(): void {
  characterAllChangesFieldDropdownOpen.value = !characterAllChangesFieldDropdownOpen.value
  if (characterAllChangesFieldDropdownOpen.value) {
    resolveDropdownDirection('hub-character-all-changes-field')
  }
}

function onDocPointerDownForAllChangesField(e: MouseEvent): void {
  if (!characterAllChangesFieldDropdownOpen.value) return
  const t = e.target
  if (!(t instanceof Node)) return
  const btn = document.querySelector<HTMLElement>('[data-dd-key="hub-character-all-changes-field"]')
  const panel = document.querySelector<HTMLElement>('[data-dd-panel-key="hub-character-all-changes-field"]')
  if (btn?.contains(t)) return
  if (panel?.contains(t)) return
  characterAllChangesFieldDropdownOpen.value = false
}

watch(characterAllChangesFieldDropdownOpen, (open) => {
  if (typeof document === 'undefined') return
  document.removeEventListener('pointerdown', onDocPointerDownForAllChangesField, true)
  if (open) document.addEventListener('pointerdown', onDocPointerDownForAllChangesField, true)
})

const filteredCharacterAllChangeRows = computed(() => {
  const sel = String(characterAllChangesFieldFilter.value ?? '__all__').trim()
  if (!sel || sel === '__all__') return characterAllChangeRows.value
  if (sel.startsWith('field:')) {
    const field = sel.slice('field:'.length)
    return characterAllChangeRows.value
      .map((row) => ({
        ...row,
        details: row.details.filter((d) => d.field === field),
      }))
      .filter((row) => row.fields.includes(field) || row.details.length > 0)
  }
  if (sel.startsWith('attr:')) {
    const key = sel.slice('attr:'.length).trim()
    if (!key) return characterAllChangeRows.value
    return characterAllChangeRows.value
      .map((row) => ({
        ...row,
        details: row.details.filter((d) => {
          if (d.field !== 'attributes') return false
          const hay = `${d.before} ${d.after}`
          return hay.includes(`${key}:`)
        }),
      }))
      .filter((row) => row.details.length > 0)
  }
  return characterAllChangeRows.value
})

const {
  characterEditModalOpen,
  characterEditMembershipFactionDropdownOpenId,
  renameConfirmOpen,
  draft,
  itemQuery,
  itemPickerRows,
  canSaveDraft,
  hasUnsavedCharacterChanges,
  resetCharacterEditTransientState,
  setDraftByCharacter,
  openCharacterEditModal,
  closeCharacterEditModal: closeCharacterEditModalCore,
  saveCharacterEdit,
  confirmRenameAndSave,
  addAliasRow,
  removeAliasRow,
  addMembershipRow,
  removeMembershipRow,
  characterEditMembershipFactionLabel,
  selectCharacterEditMembershipFaction,
  toggleCharacterEditMembershipFactionDropdown: toggleCharacterEditMembershipFactionDropdownCore,
  addAttributeRow,
  removeAttributeRow,
  toggleItemBinding,
} = useCharacterGraphCharacterEditor({
  novelId: toRef(props, 'novelId'),
  chapterId: toRef(props, 'chapterId'),
  sourceTextRange: toRef(props, 'sourceTextRange'),
  categories: toRef(props, 'categories'),
  characters: toRef(props, 'characters'),
  items: toRef(props, 'items'),
  editingCharacter,
  membershipSource,
  factionOptions,
  reloadModalSources,
  onSaved: handleSaved,
})

function clearSaveToastTimer(): void {
  if (saveToastTimer) {
    clearTimeout(saveToastTimer)
    saveToastTimer = null
  }
}

function showSaveToast(message = '修改已保存。'): void {
  clearSaveToastTimer()
  saveToastMessage.value = message
  saveToastOpen.value = true
  saveToastTimer = setTimeout(() => {
    saveToastOpen.value = false
    saveToastTimer = null
  }, 2200)
}

function handleSaved(message?: string): void {
  showSaveToast(message)
  emit('saved')
}

function requestDiscard(action: () => void): void {
  pendingDiscardAction = action
  unsavedConfirmOpen.value = true
}

function confirmDiscardChanges(): void {
  const action = pendingDiscardAction
  pendingDiscardAction = null
  unsavedConfirmOpen.value = false
  if (action) action()
}

function cancelDiscardChanges(): void {
  pendingDiscardAction = null
  unsavedConfirmOpen.value = false
}

function closeCharacterEditModal(): void {
  if (closeCharacterEditModalCore()) return
  requestDiscard(() => {
    closeCharacterEditModalCore(true)
  })
}

function closeRelationEditModal(): void {
  if (closeRelationEditModalCore()) return
  requestDiscard(() => {
    closeRelationEditModalCore(true)
  })
}

function closeRelationAddModal(): void {
  relationAddTargetDropdownOpen.value = false
  relationAddTargetQuery.value = ''
  if (closeRelationAddModalCore()) return
  requestDiscard(() => {
    closeRelationAddModalCore(true)
  })
}

function hasUnsavedModalChanges(): boolean {
  return hasUnsavedCharacterChanges.value || hasUnsavedRelationEditChanges.value || hasUnsavedRelationAddChanges.value
}

function resetModalTransientState(force = false): boolean {
  if (!force && hasUnsavedModalChanges()) return false
  resetCharacterEditTransientState()
  closeRelationEditModalCore(true)
  closeRelationAddModalCore(true)
  return true
}

function emitClose(): void {
  if (resetModalTransientState()) {
    emit('close')
    return
  }
  requestDiscard(() => {
    resetModalTransientState(true)
    emit('close')
  })
}

function openCharacterAllChangesModal(): void {
  if (!editingCharacter.value) return
  characterAllChangesFieldFilter.value = '__all__'
  characterAllChangesFieldDropdownOpen.value = false
  characterAllChangesModalOpen.value = true
}

function closeCharacterAllChangesModal(): void {
  characterAllChangesModalOpen.value = false
  characterAllChangesFieldDropdownOpen.value = false
}

function jumpToCharacterChange(row: {
  chapterId: string
  anchorStart: number | null
  anchorEnd: number | null
}): void {
  const chapterId = String(row.chapterId ?? '').trim()
  if (!chapterId || !props.novelId) return
  const nextQuery: Record<string, string> = {
    chapterId,
    focusChapter: chapterId,
    focusRangeToken: String(Date.now()),
  }
  if (typeof row.anchorStart === 'number' && typeof row.anchorEnd === 'number' && row.anchorEnd > row.anchorStart) {
    nextQuery.focusRangeStart = String(row.anchorStart)
    nextQuery.focusRangeEnd = String(row.anchorEnd)
  }
  characterAllChangesModalOpen.value = false
  emitClose()
  void router.push({ path: `/novels/${props.novelId}/chapter-writing`, query: nextQuery })
}

function factionNameById(id: string): string {
  return factionOptions.value.find((f) => f.id === id)?.name ?? '未命名势力'
}

function relatedRelationsByFocus(focusCharacterId: string): CharacterRelation[] {
  return characterRelations.value.filter((r) => r.fromCharacterId === focusCharacterId || r.toCharacterId === focusCharacterId)
}

function visibleCharactersByFocus(focusCharacterId: string): Character[] {
  const ids = new Set<string>()
  if (focusCharacterId) ids.add(focusCharacterId)
  relatedRelationsByFocus(focusCharacterId).forEach((r) => {
    ids.add(r.fromCharacterId)
    ids.add(r.toCharacterId)
  })
  return props.characters.filter((c) => ids.has(c.id))
}

function characterNameById(id: string): string {
  return props.characters.find((c) => c.id === id)?.name ?? '角色'
}

function hangCurrentGraph(): void {
  if (!props.focusCharacterId) return
  reloadModalSources()
  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const idx = hungGraphWindows.value.length
  const baseX = 20 + (idx % 4) * 26
  const baseY = 80 + (idx % 4) * 22
  const width = 380
  const height = 300
  const next: HungGraphWindow = {
    id,
    focusCharacterId: props.focusCharacterId,
    x: baseX,
    y: baseY,
    width: width * 2,
    height: height * 2,
    renderScale: 1,
  }
  if (typeof window !== 'undefined') {
    next.x = Math.min(Math.max(8, next.x), Math.max(8, window.innerWidth - next.width - 8))
    next.y = Math.min(Math.max(8, next.y), Math.max(8, window.innerHeight - next.height - 8))
  }
  hungGraphWindows.value.push(next)
  emitClose()
}

function removeHungGraph(id: string): void {
  const i = hungGraphWindows.value.findIndex((x) => x.id === id)
  if (i >= 0) hungGraphWindows.value.splice(i, 1)
  if (draggingWindowId.value === id) stopFloatDragging()
  if (resizingWindowId.value === id) stopFloatResizing()
}

function hungGraphFloatStyle(win: HungGraphWindow): Record<string, string> {
  return {
    left: `${Math.round(win.x)}px`,
    top: `${Math.round(win.y)}px`,
    width: `${Math.round(win.width)}px`,
    height: `${Math.round(win.height)}px`,
  }
}

function onFloatBarPointerDown(id: string, event: PointerEvent): void {
  const target = event.target as HTMLElement | null
  if (target?.closest('button')) return
  const win = hungGraphWindows.value.find((x) => x.id === id)
  if (!win) return
  event.preventDefault()
  draggingWindowId.value = id
  floatDragOffsetX.value = event.clientX - win.x
  floatDragOffsetY.value = event.clientY - win.y
  window.addEventListener('pointermove', onFloatPointerMove)
  window.addEventListener('pointerup', onFloatPointerUp, { once: true })
  window.addEventListener('pointercancel', onFloatPointerUp, { once: true })
}

function onFloatResizerPointerDown(id: string, event: PointerEvent): void {
  const win = hungGraphWindows.value.find((x) => x.id === id)
  if (!win) return
  event.preventDefault()
  event.stopPropagation()
  resizingWindowId.value = id
  resizeStartX.value = event.clientX
  resizeStartY.value = event.clientY
  resizeStartWidth.value = win.width
  resizeStartHeight.value = win.height
  window.addEventListener('pointermove', onFloatResizePointerMove)
  window.addEventListener('pointerup', onFloatResizePointerUp, { once: true })
  window.addEventListener('pointercancel', onFloatResizePointerUp, { once: true })
}

function onFloatPointerMove(event: PointerEvent): void {
  if (!draggingWindowId.value || typeof window === 'undefined') return
  if ((event.buttons & 1) !== 1) {
    stopFloatDragging()
    return
  }
  const win = hungGraphWindows.value.find((x) => x.id === draggingWindowId.value)
  if (!win) return
  const nextX = event.clientX - floatDragOffsetX.value
  const nextY = event.clientY - floatDragOffsetY.value
  const maxX = Math.max(8, window.innerWidth - win.width - 8)
  const maxY = Math.max(8, window.innerHeight - win.height - 8)
  win.x = Math.min(Math.max(8, nextX), maxX)
  win.y = Math.min(Math.max(8, nextY), maxY)
}

function onFloatResizePointerMove(event: PointerEvent): void {
  if (!resizingWindowId.value || typeof window === 'undefined') return
  if ((event.buttons & 1) !== 1) {
    stopFloatResizing()
    return
  }
  const win = hungGraphWindows.value.find((x) => x.id === resizingWindowId.value)
  if (!win) return
  const dx = event.clientX - resizeStartX.value
  const dy = event.clientY - resizeStartY.value
  const nextWidth = Math.min(980, Math.max(280, Math.round(resizeStartWidth.value + dx)))
  const nextHeight = Math.min(820, Math.max(220, Math.round(resizeStartHeight.value + dy)))
  win.width = nextWidth
  win.height = nextHeight
  const wRatio = nextWidth / 760
  const hRatio = nextHeight / 600
  win.renderScale = Math.min(1.8, Math.max(0.7, Number(Math.min(wRatio, hRatio).toFixed(2))))
}

function onFloatPointerUp(): void {
  stopFloatDragging()
}

function onFloatResizePointerUp(): void {
  stopFloatResizing()
}

function stopFloatDragging(): void {
  draggingWindowId.value = ''
  window.removeEventListener('pointermove', onFloatPointerMove)
  window.removeEventListener('pointercancel', onFloatPointerUp)
}

function stopFloatResizing(): void {
  resizingWindowId.value = ''
  window.removeEventListener('pointermove', onFloatResizePointerMove)
  window.removeEventListener('pointercancel', onFloatResizePointerUp)
}

function reloadModalSources(): void {
  reloadRelations()
  factionOptions.value = getFactionsByNovelId(props.novelId)
  membershipSource.value = getCharacterFactionMembershipsByNovelId(props.novelId)
}

function syncDraftWithSelectedGraphCharacter(): void {
  if (selectedGraphCharacter.value) setDraftByCharacter(selectedGraphCharacter.value)
}

function syncRelationModalStateByFocus(): void {
  if (relationEditModalOpen.value) refreshRelationEditState()
  if (relationAddModalOpen.value) refreshRelationAddState()
}

watch(
  () => props.open,
  (v) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = v ? 'hidden' : ''
    }
    if (v) {
      reloadModalSources()
      syncDraftWithSelectedGraphCharacter()
    } else {
      characterAllChangesModalOpen.value = false
      characterAllChangesFieldDropdownOpen.value = false
      resetModalTransientState()
    }
  },
  { flush: 'post' }
)

watch(
  () => props.focusCharacterId,
  () => {
    editingCharacterId.value = props.focusCharacterId || editingCharacterId.value
    syncDraftWithSelectedGraphCharacter()
    syncRelationModalStateByFocus()
  }
)

watch(
  () => props.characters,
  () => {
    const current = editingCharacter.value
    if (current) setDraftByCharacter(current)
  },
  { deep: true },
)

function toggleCharacterEditMembershipFactionDropdown(index: number): void {
  toggleCharacterEditMembershipFactionDropdownCore(index)
  const id = String(index)
  if (characterEditMembershipFactionDropdownOpenId.value) {
    resolveDropdownDirection(`hub-character-membership-${id}`)
  }
}

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

onUnmounted(() => {
  stopFloatDragging()
  stopFloatResizing()
  clearSaveToastTimer()
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>
