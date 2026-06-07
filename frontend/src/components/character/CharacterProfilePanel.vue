<template>
  <article class="characters-graph-ui__section character-panel">
    <header class="character-panel__head">
      <h3 class="character-panel__title">档案</h3>
    </header>
    <div v-if="character" class="character-panel__main">
      <div class="character-panel__body character-panel__body--scroll scrollbar-paper">
        <div class="character-panel__hero">
          <p class="character-panel__name">{{ displayName || character.name }}</p>
          <div class="character-panel__hero-chips">
            <span class="character-panel__chip">
              {{ character.firstAppearanceChapterNo != null ? `首见 · 第 ${character.firstAppearanceChapterNo} 章` : '首见 · 暂未出场' }}
            </span>
            <span
              v-if="modifiedInChapter"
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
            <dd>{{ character.age || '—' }}</dd>
          </div>
          <div class="character-panel__spec-item">
            <dt>性别</dt>
            <dd>{{ character.gender || '—' }}</dd>
          </div>
          <div class="character-panel__spec-item character-panel__spec-item--block">
            <dt>所属势力</dt>
            <dd>
              <ul v-if="memberships.length > 0" class="character-panel__faction-list">
                <li v-for="m in memberships" :key="m.factionId">
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
              <ul v-if="categoryNames.length > 0" class="character-panel__faction-list">
                <li v-for="name in categoryNames" :key="`cv-${name}`">
                  <strong>{{ name }}</strong>
                </li>
              </ul>
              <template v-else>—</template>
            </dd>
          </div>
          <div class="character-panel__spec-item character-panel__spec-item--block">
            <dt>持有物品</dt>
            <dd>
              <ul v-if="heldItems.length > 0" class="character-panel__faction-list">
                <li v-for="item in heldItems" :key="`chi-${item.id}`">
                  <strong>{{ item.name }}</strong>
                </li>
              </ul>
              <template v-else>—</template>
            </dd>
          </div>
        </dl>
        <section class="character-panel__block">
          <h4 class="character-panel__block-title">扩展条目</h4>
          <ul v-if="(character.attributes?.length ?? 0) > 0" class="character-panel__extra-list">
            <li v-for="a in character.attributes" :key="a.id" class="character-panel__extra">
              <span class="character-panel__extra-key">{{ a.key }}</span>
              <p class="character-panel__extra-val">{{ a.value }}</p>
            </li>
          </ul>
          <p v-else class="character-panel__empty">无扩展条目</p>
        </section>
        <slot name="body-extra" />
      </div>
      <footer class="character-panel__foot">
        <button
          v-if="showAllChanges"
          type="button"
          class="character-panel__btn character-panel__btn--ghost"
          @click="emit('open-all-changes')"
        >
          显示角色所有更改
        </button>
        <button
          v-if="showEdit"
          type="button"
          class="character-panel__btn character-panel__btn--primary"
          @click="emit('edit')"
        >
          编辑
        </button>
        <button
          v-if="showDelete"
          type="button"
          class="character-panel__btn character-panel__btn--danger"
          @click="emit('delete')"
        >
          删除角色
        </button>
      </footer>
    </div>
    <p v-else class="character-panel__placeholder">{{ placeholder }}</p>
  </article>
</template>

<script setup lang="ts">
import type { Character, Item } from '../../types'

withDefaults(
  defineProps<{
    character: Character | null
    memberships: Array<{ factionId: string; description?: string }>
    heldItems: Item[]
    categoryNames: string[]
    factionNameById: (id: string) => string
    displayName?: string
    modifiedInChapter?: boolean
    showDelete?: boolean
    showEdit?: boolean
    showAllChanges?: boolean
    placeholder?: string
  }>(),
  {
    displayName: '',
    modifiedInChapter: false,
    showDelete: false,
    showEdit: true,
    showAllChanges: true,
    placeholder: '在上方图谱中选择角色以查看档案',
  },
)

const emit = defineEmits<{
  edit: []
  delete: []
  'open-all-changes': []
}>()
</script>

