<template>
  <Teleport to="body">
    <div
      v-if="open && (character || tooltipFaction) && !textareaFocused && !textareaHasSelection"
      class="chapter-hub__entity-tooltip"
      :style="{ top: `${tooltipY}px`, left: `${tooltipX}px` }"
    >
      <template v-if="character">
        <p class="chapter-hub__entity-tooltip-title">角色：{{ character.name }}</p>
        <template v-if="characterCategoryLines.length > 0">
          <p v-for="(line, i) in characterCategoryLines" :key="`cc-${i}`" class="chapter-hub__entity-tooltip-row">
            分类：{{ line }}
          </p>
        </template>
        <template v-if="characterFactionLines.length > 0">
          <p v-for="(line, i) in characterFactionLines" :key="`cf-${i}`" class="chapter-hub__entity-tooltip-row">
            所属势力：{{ line }}
          </p>
        </template>
        <p v-else class="chapter-hub__entity-tooltip-row">所属势力：未加入</p>
        <p class="chapter-hub__entity-tooltip-row">首次出场：第 {{ character.firstAppearanceChapterNo || '未设置' }} 章</p>
        <p class="chapter-hub__entity-tooltip-row">年龄：{{ character.age || '未设置' }}</p>
        <p class="chapter-hub__entity-tooltip-row">性别：{{ character.gender || '未设置' }}</p>
        <template v-if="(character.attributes?.length ?? 0) > 0">
          <p
            v-for="attr in character.attributes"
            :key="attr.id"
            class="chapter-hub__entity-tooltip-row"
          >
            {{ attr.key }}：{{ attr.value }}
          </p>
        </template>
      </template>
      <template v-else-if="tooltipFaction">
        <p class="chapter-hub__entity-tooltip-title">势力：{{ tooltipFaction.name }}</p>
        <template v-if="factionCategoryLines.length > 0">
          <p v-for="(line, i) in factionCategoryLines" :key="`fc-${i}`" class="chapter-hub__entity-tooltip-row">
            分类：{{ line }}
          </p>
        </template>
        <p class="chapter-hub__entity-tooltip-row">领袖：{{ tooltipFaction.leader?.trim() || '未设置' }}</p>
        <template v-if="(tooltipFaction.attributes?.length ?? 0) > 0">
          <p
            v-for="attr in tooltipFaction.attributes"
            :key="attr.id"
            class="chapter-hub__entity-tooltip-row"
          >
            {{ attr.key }}：{{ attr.value }}
          </p>
        </template>
        <p class="chapter-hub__entity-tooltip-row">势力备注：{{ tooltipFaction.notes?.trim() || '未设置' }}</p>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Character, Faction } from '../../../types'

defineProps<{
  open: boolean
  character: Character | null
  /** 悬停势力时展示（与 character 互斥） */
  tooltipFaction: Faction | null
  /** 角色悬停：多行「势力名」或「势力名：描述」 */
  characterFactionLines: string[]
  /** 角色分类（按名称展示） */
  characterCategoryLines: string[]
  /** 势力分类（按名称展示） */
  factionCategoryLines: string[]
  tooltipX: number
  tooltipY: number
  textareaFocused: boolean
  textareaHasSelection: boolean
}>()
</script>
