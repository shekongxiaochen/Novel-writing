<template>
  <div v-if="focusCharacterId && anchorCharacter" class="character-graph-relation-toolbar">
    <section
      v-if="pairOtherCharacter"
      class="characters-graph-ui__section character-graph-pair-detail"
    >
      <h3 class="characters-graph-ui__h3 character-graph-pair-detail__title">
        「{{ pairOtherCharacter.name }}」与中心「{{ anchorCharacter.name }}」
      </h3>
      <p class="muted character-graph-pair-detail__hint">点击 3D 图中中心球可恢复查看全部关系边。</p>
      <ul class="character-graph-pair-detail__list">
        <li v-for="r in pairDirectedEdges" :key="r.id" class="character-graph-pair-detail__item">
          <p class="character-graph-pair-detail__sentence">{{ relationEdgeFullSentence(r) }}</p>
          <button type="button" class="btn-danger chapter-hub__char-graph-relation-remove" @click="removeRelation(r.id)">
            删除
          </button>
        </li>
      </ul>
      <p v-if="pairDirectedEdges.length === 0" class="muted character-graph-pair-detail__empty">
        双方尚未记录任何有向关系描述。
      </p>
    </section>

    <div class="characters-graph-ui__link-mode">
      <div class="characters-graph-ui__link-head">
        <button
          type="button"
          class="btn-primary"
          :class="{ 'btn-primary--active': linkMode }"
          @click="toggleLinkMode"
        >
          {{ linkMode ? '结束编辑关系' : '编辑与其他角色的关系' }}
        </button>
      </div>

      <p v-if="linkMode" class="muted characters-graph-ui__link-hint">
        以「{{ anchorCharacter.name }}」为 A，选择<strong>尚未关联</strong>的角色 B，并分别填写 A 对 B、B 对 A 的关系描述。
      </p>

      <p v-if="linkError" class="characters-graph-ui__link-error">{{ linkError }}</p>
      <p v-if="linkSuccess" class="characters-graph-ui__link-success">{{ linkSuccess }}</p>

      <div v-if="linkMode" class="graph3d-link-editor">
        <label class="characters-graph-ui__field">
          <span class="characters-graph-ui__field-label">目标角色（B，仅尚无关系）</span>
          <select
            v-model="targetBId"
            class="characters-graph-ui__select chapter-hub__target-role-select"
            :class="{ 'chapter-hub__target-role-select--list': targetSelectSize > 1 }"
            :size="targetSelectSize"
          >
            <option value="">请选择角色</option>
            <option v-for="c in relationTargetUnlinked" :key="`new-${c.id}`" :value="c.id">
              {{ c.name }}
            </option>
          </select>
        </label>
        <p v-if="linkMode && relationTargetUnlinked.length === 0" class="muted characters-graph-ui__link-hint">
          暂无可新增关系的角色（其他角色均已与当前角色存在关系边）。
        </p>

        <p v-if="targetBId" class="characters-graph-ui__from-chip">将新增双向关系</p>

        <label class="characters-graph-ui__field">
          <span class="characters-graph-ui__field-label">
            {{ anchorCharacter.name }} 是 {{ targetBName || 'B' }} 的
          </span>
          <input
            v-model="typeFromA"
            maxlength="40"
            class="characters-graph-ui__input"
          />
        </label>

        <label class="characters-graph-ui__field">
          <span class="characters-graph-ui__field-label">
            {{ targetBName || 'B' }} 是 {{ anchorCharacter.name }} 的
          </span>
          <input
            v-model="typeFromB"
            maxlength="40"
            class="characters-graph-ui__input"
          />
        </label>

        <label class="characters-graph-ui__field">
          <span class="characters-graph-ui__field-label">备注（可选）</span>
          <input
            v-model="note"
            maxlength="120"
            class="characters-graph-ui__input"
          />
        </label>

        <div class="action-row">
          <button type="button" class="btn-primary" :disabled="relationTargetUnlinked.length === 0" @click="submitBidirectional">
            新增双向关系
          </button>
        </div>
      </div>
    </div>

    <Transition name="chapter-hub-fold">
      <section
        v-if="relatedRelations.length > 0 && !linkMode && !pairOtherCharacter"
        class="characters-graph-ui__section chapter-hub__char-graph-existing"
      >
        <h3 class="characters-graph-ui__h3">已有关系（可删单边）</h3>
        <div class="chapter-hub__char-graph-relation-scroll">
          <ul class="chapter-hub__char-graph-relation-list">
            <li v-for="r in relatedRelations" :key="r.id" class="chapter-hub__char-graph-relation-item">
              <div class="chapter-hub__char-graph-relation-text">
                <span class="chapter-hub__char-graph-relation-sentence">{{ relationEdgeFullSentence(r) }}</span>
              </div>
              <button type="button" class="btn-danger chapter-hub__char-graph-relation-remove" @click="removeRelation(r.id)">
                删除
              </button>
            </li>
          </ul>
        </div>
      </section>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createCharacterRelation, deleteCharacterRelation, getCharacterRelationsByNovelId } from '../lib/storage'
import type { Character, CharacterRelation } from '../types'

const props = withDefaults(
  defineProps<{
    novelId: string
    focusCharacterId: string
    characters: Character[]
    relations: CharacterRelation[]
    /** 3D 聚焦图中点击的对方角色 id（非中心）；空字符串表示未点选 */
    pairCharacterId?: string
  }>(),
  { pairCharacterId: '' }
)

const emit = defineEmits<{
  relationsChanged: []
}>()

const linkMode = defineModel<boolean>('linkMode', { default: false })

const targetBId = ref('')
const typeFromA = ref('')
const typeFromB = ref('')
const note = ref('')
const linkError = ref('')
const linkSuccess = ref('')

const anchorCharacter = computed(() => props.characters.find((c) => c.id === props.focusCharacterId) ?? null)

const relatedRelations = computed(() => {
  const id = props.focusCharacterId
  return props.relations.filter((r) => r.fromCharacterId === id || r.toCharacterId === id)
})

const relationTargetOptions = computed(() => props.characters.filter((c) => c.id !== props.focusCharacterId))

const linkedCharacterIds = computed(() => {
  const focus = props.focusCharacterId
  const set = new Set<string>()
  for (const r of relatedRelations.value) {
    if (r.fromCharacterId === focus) set.add(r.toCharacterId)
    else if (r.toCharacterId === focus) set.add(r.fromCharacterId)
  }
  return set
})

function sortCharactersByName(list: Character[]): Character[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans'))
}

const relationTargetUnlinked = computed(() =>
  sortCharactersByName(relationTargetOptions.value.filter((c) => !linkedCharacterIds.value.has(c.id)))
)

const targetSelectSize = computed(() => {
  const n = relationTargetUnlinked.value.length
  if (n <= 5) return 1
  return Math.min(6, n)
})

const targetBName = computed(() => props.characters.find((c) => c.id === targetBId.value)?.name ?? '')

const pairOtherCharacter = computed(() => {
  const pid = (props.pairCharacterId ?? '').trim()
  if (!pid || pid === props.focusCharacterId) return null
  return props.characters.find((c) => c.id === pid) ?? null
})

const pairDirectedEdges = computed(() => {
  const other = pairOtherCharacter.value
  const focus = props.focusCharacterId
  if (!other) return []
  return props.relations.filter(
    (r) =>
      (r.fromCharacterId === focus && r.toCharacterId === other.id) ||
      (r.fromCharacterId === other.id && r.toCharacterId === focus)
  )
})

function characterNameById(id: string): string {
  return props.characters.find((c) => c.id === id)?.name ?? '未知'
}

/** 完整有向关系句，不使用箭头符号 */
function relationEdgeFullSentence(r: CharacterRelation): string {
  const a = characterNameById(r.fromCharacterId)
  const b = characterNameById(r.toCharacterId)
  const t = (r.relationType ?? '').trim() || '未标注类型'
  const n = (r.note ?? '').trim()
  let s = `「${a}」是「${b}」的「${t}」看`
  if (n) s += `；备注：${n}`
  return `${s}。`
}

function clearFormFields(): void {
  targetBId.value = ''
  typeFromA.value = ''
  typeFromB.value = ''
  note.value = ''
}

function toggleLinkMode(): void {
  linkError.value = ''
  linkSuccess.value = ''
  linkMode.value = !linkMode.value
}

function submitBidirectional(): void {
  const a = anchorCharacter.value
  const bId = targetBId.value
  const typeAB = typeFromA.value.trim()
  const typeBA = typeFromB.value.trim()
  const noteVal = note.value.trim()

  if (!a) {
    linkError.value = '当前角色无效。'
    linkSuccess.value = ''
    return
  }
  if (!bId || bId === a.id) {
    linkError.value = '请选择尚未关联的角色 B。'
    linkSuccess.value = ''
    return
  }
  if (linkedCharacterIds.value.has(bId)) {
    linkError.value = '该角色已与当前角色存在关系，无法在此重复新增。请先在下方列表删除对应边。'
    linkSuccess.value = ''
    return
  }
  if (!typeAB || !typeBA) {
    linkError.value = '请分别填写 A 对 B、B 对 A 的关系描述。'
    linkSuccess.value = ''
    return
  }

  const fresh = getCharacterRelationsByNovelId(props.novelId)
  const touching = fresh.some(
    (r) =>
      (r.fromCharacterId === a.id && r.toCharacterId === bId) ||
      (r.fromCharacterId === bId && r.toCharacterId === a.id)
  )
  if (touching) {
    linkError.value = '数据已存在关联，请刷新或先在下方列表删除后再试。'
    linkSuccess.value = ''
    return
  }

  createCharacterRelation({
    novelId: props.novelId,
    fromCharacterId: a.id,
    toCharacterId: bId,
    relationType: typeAB,
    note: noteVal || undefined,
  })
  createCharacterRelation({
    novelId: props.novelId,
    fromCharacterId: bId,
    toCharacterId: a.id,
    relationType: typeBA,
    note: noteVal || undefined,
  })

  emit('relationsChanged')
  clearFormFields()
  linkError.value = ''
  linkSuccess.value = '双向关系已新增。'
}

function removeRelation(relationId: string): void {
  deleteCharacterRelation(relationId)
  emit('relationsChanged')
  linkSuccess.value = ''
  linkError.value = ''
}

watch(linkMode, (v) => {
  if (!v) {
    clearFormFields()
    linkError.value = ''
    linkSuccess.value = ''
  }
})

watch(
  () => props.focusCharacterId,
  () => {
    clearFormFields()
    linkError.value = ''
    linkSuccess.value = ''
    linkMode.value = false
  }
)

watch(targetBId, () => {
  linkError.value = ''
  linkSuccess.value = ''
})
</script>
