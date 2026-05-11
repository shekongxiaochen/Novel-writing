<template>
  <Teleport to="body">
    <div v-if="open" class="chapter-hub__ctx-overlay" @click="emit('close')">
      <div class="chapter-hub__ctx-menu" :style="{ top: `${y}px`, left: `${x}px` }" @click.stop>
        <p v-if="notice" class="chapter-hub__ctx-notice">{{ notice }}</p>
        <p v-if="selectedCharacter" class="chapter-hub__ctx-entity-title">角色：{{ selectedCharacter.name }}</p>
        <p v-else-if="selectedFaction && !selectedCharacter" class="chapter-hub__ctx-entity-title">势力：{{ selectedFaction.name }}</p>
        <p v-else-if="selectedItem && !selectedCharacter && !selectedFaction" class="chapter-hub__ctx-entity-title">物品：{{ selectedItem.name }}</p>
        <div v-if="showAddAs" class="chapter-hub__ctx-parent">
          添加为
          <div class="chapter-hub__ctx-sub">
            <button type="button" @click="emit('addCharacter')">角色</button>
            <button
              type="button"
              :disabled="!canAddAsFaction"
              :title="!canAddAsFaction ? '该名称已是角色，不能创建为势力' : undefined"
              @click="emit('addFaction')"
            >
              势力
            </button>
            <button type="button" @click="emit('addItem')">物品</button>
          </div>
        </div>
        <div v-if="selectedCharacter" class="chapter-hub__ctx-parent">
          加入 / 退出势力
          <div class="chapter-hub__ctx-sub">
            <p class="chapter-hub__ctx-sub-heading">
              <template v-if="boundFactionSummary">已加入：{{ boundFactionSummary }}</template>
              <template v-else>当前未加入任何势力</template>
            </p>
            <button
              v-for="f in factions"
              :key="`bindf-${f.id}`"
              type="button"
              @click="emit('toggleFaction', f.id)"
            >
              <span class="chapter-hub__ctx-bind-faction-row">
                {{ f.name }}
                <span v-if="isFactionCurrent(f.id)" class="chapter-hub__ctx-bind-pill">已加入</span>
                <span v-else class="chapter-hub__ctx-bind-pill chapter-hub__ctx-bind-pill--off">未加入</span>
              </span>
            </button>
          </div>
        </div>
        <div class="chapter-hub__ctx-parent">
          伏笔 / 照应
          <div class="chapter-hub__ctx-sub">
            <button type="button" @click="emit('setForeshadow')">设为伏笔</button>
            <button
              type="button"
              :disabled="!hasForeshadowIssues"
              :title="!hasForeshadowIssues ? '当前还没有可对应的伏笔' : undefined"
              @click="emit('resolveForeshadow')"
            >
              设为照应
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Character, Faction, Item } from '../../../types'

withDefaults(
  defineProps<{
  open: boolean
  x: number
  y: number
  notice: string
  selectedCharacter: Character | null
  /** 选区落在已有势力名内（且未识别为角色） */
  selectedFaction: Faction | null
  /** 选区落在已有物品名内 */
  selectedItem: Item | null
  /** 为 false 时不展示「添加为」整块 */
  showAddAs: boolean
  /** 已加入势力名称列表（顿号分隔） */
  boundFactionSummary: string
  /** 兼容旧版本：是否未绑定任何势力（多对多后不再需要，但保留以避免类型不一致） */
  characterFactionUnbound?: boolean
  /** 选区与已有角色同名时为 false，禁止添加为势力 */
  canAddAsFaction: boolean
  /** 是否已有伏笔，可用于“对应伏笔（标记完成）” */
  hasForeshadowIssues: boolean
  factions: Faction[]
  isFactionCurrent: (id: string) => boolean
  }>(),
  { characterFactionUnbound: false }
)

const emit = defineEmits<{
  close: []
  addCharacter: []
  addFaction: []
  addItem: []
  toggleFaction: [factionId: string]
  setForeshadow: []
  resolveForeshadow: []
}>()
</script>
