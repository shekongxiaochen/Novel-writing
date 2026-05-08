import { computed, ref, type Ref } from 'vue'
import {
  createCharacterRelation,
  deleteCharacterRelation,
  getCharacterRelationsByNovelId,
  updateCharacterRelation,
} from '../../../lib/storage'
import type { Character, CharacterRelation } from '../../../types'

type RelationDraftRow = {
  targetCharacterId: string
  targetName: string
  centerToOtherType: string
  otherToCenterType: string
}

type UseCharacterGraphRelationsParams = {
  novelId: Ref<string>
  characters: Ref<Character[]>
  focusCharacterId: Ref<string>
  characterRelations: Ref<CharacterRelation[]>
  onSaved: (message?: string) => void
}

export function useCharacterGraphRelations(params: UseCharacterGraphRelationsParams) {
  const relationEditModalOpen = ref(false)
  const relationAddModalOpen = ref(false)
  const newRelationTargetId = ref('')
  const newRelationCenterToOther = ref('')
  const newRelationOtherToCenter = ref('')
  const relationDraftRows = ref<RelationDraftRow[]>([])
  const relationEditInitialSnapshot = ref('')
  const relationAddInitialSnapshot = ref('')
  const relationEditSearchQuery = ref('')

  function reloadRelations(): void {
    params.characterRelations.value = getCharacterRelationsByNovelId(params.novelId.value)
  }

  function findBidirectionalEdges(centerId: string, targetId: string): {
    centerToOther: CharacterRelation | null
    otherToCenter: CharacterRelation | null
  } {
    return {
      centerToOther:
        params.characterRelations.value.find(
          (r) => r.fromCharacterId === centerId && r.toCharacterId === targetId,
        ) ?? null,
      otherToCenter:
        params.characterRelations.value.find(
          (r) => r.fromCharacterId === targetId && r.toCharacterId === centerId,
        ) ?? null,
    }
  }

  function relationRowFromTarget(centerId: string, target: { id: string; name: string }): RelationDraftRow {
    const { centerToOther, otherToCenter } = findBidirectionalEdges(centerId, target.id)
    return {
      targetCharacterId: target.id,
      targetName: target.name || '未命名角色',
      centerToOtherType: (centerToOther?.relationType ?? '').trim(),
      otherToCenterType: (otherToCenter?.relationType ?? '').trim(),
    }
  }

  function buildRelationDraftRows(): void {
    const centerId = String(params.focusCharacterId.value ?? '').trim()
    if (!centerId) {
      relationDraftRows.value = []
      return
    }
    const byId = new Map<string, { id: string; name: string }>()
    for (const r of params.characterRelations.value) {
      if (r.fromCharacterId !== centerId && r.toCharacterId !== centerId) continue
      const otherId = r.fromCharacterId === centerId ? r.toCharacterId : r.fromCharacterId
      if (!otherId || otherId === centerId) continue
      if (byId.has(otherId)) continue
      const ch = params.characters.value.find((x) => x.id === otherId)
      byId.set(otherId, {
        id: otherId,
        name: (ch?.name ?? '').trim() || '未在档案中的角色',
      })
    }
    const list = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans'))
    relationDraftRows.value = list.map((t) => relationRowFromTarget(centerId, t))
  }

  function buildRelationAddSnapshot(): string {
    return JSON.stringify({
      targetId: String(newRelationTargetId.value ?? '').trim(),
      centerToOther: String(newRelationCenterToOther.value ?? '').trim(),
      otherToCenter: String(newRelationOtherToCenter.value ?? '').trim(),
    })
  }

  function resetRelationAddForm(): void {
    newRelationTargetId.value = ''
    newRelationCenterToOther.value = ''
    newRelationOtherToCenter.value = ''
    relationAddInitialSnapshot.value = ''
  }

  function resetRelationEditState(): void {
    relationDraftRows.value = []
    relationEditInitialSnapshot.value = ''
    relationEditSearchQuery.value = ''
  }

  function refreshRelationEditState(): void {
    reloadRelations()
    buildRelationDraftRows()
    relationEditInitialSnapshot.value = JSON.stringify(relationDraftRows.value)
    relationEditSearchQuery.value = ''
  }

  function refreshRelationAddState(): void {
    reloadRelations()
    resetRelationAddForm()
    relationAddInitialSnapshot.value = buildRelationAddSnapshot()
  }

  function openRelationEditModal(): void {
    closeRelationAddModal(true)
    refreshRelationEditState()
    relationEditModalOpen.value = true
  }

  const hasUnsavedRelationEditChanges = computed(() => {
    if (!relationEditModalOpen.value) return false
    if (!relationEditInitialSnapshot.value) return false
    try {
      return JSON.stringify(relationDraftRows.value) !== relationEditInitialSnapshot.value
    } catch {
      return true
    }
  })

  function closeRelationEditModal(force = false): boolean {
    if (!force && hasUnsavedRelationEditChanges.value) return false
    relationEditModalOpen.value = false
    resetRelationEditState()
    return true
  }

  function openRelationAddModal(): void {
    closeRelationEditModal(true)
    refreshRelationAddState()
    relationAddModalOpen.value = true
  }

  const hasUnsavedRelationAddChanges = computed(() => {
    if (!relationAddModalOpen.value) return false
    return buildRelationAddSnapshot() !== relationAddInitialSnapshot.value
  })

  function closeRelationAddModal(force = false): boolean {
    if (!force && hasUnsavedRelationAddChanges.value) return false
    relationAddModalOpen.value = false
    resetRelationAddForm()
    return true
  }

  function removeRelationDraftRow(targetCharacterId: string): void {
    const tid = String(targetCharacterId ?? '').trim()
    if (!tid) return
    relationDraftRows.value = relationDraftRows.value.filter((r) => r.targetCharacterId !== tid)
  }

  function saveNewRelationPair(): void {
    const centerId = String(params.focusCharacterId.value ?? '').trim()
    const targetId = String(newRelationTargetId.value ?? '').trim()
    const t1 = String(newRelationCenterToOther.value ?? '').trim()
    const t2 = String(newRelationOtherToCenter.value ?? '').trim()
    if (!centerId || !targetId || !t1 || !t2) return
    reloadRelations()
    const { centerToOther, otherToCenter } = findBidirectionalEdges(centerId, targetId)
    if (centerToOther || otherToCenter) return
    createCharacterRelation({
      novelId: params.novelId.value,
      fromCharacterId: centerId,
      toCharacterId: targetId,
      relationType: t1,
    })
    createCharacterRelation({
      novelId: params.novelId.value,
      fromCharacterId: targetId,
      toCharacterId: centerId,
      relationType: t2,
    })
    reloadRelations()
    closeRelationAddModal(true)
    params.onSaved('角色关系已保存。')
  }

  function saveRelationDraftRows(): void {
    const centerId = String(params.focusCharacterId.value ?? '').trim()
    if (!centerId) return

    reloadRelations()
    let initialRows: RelationDraftRow[] = []
    try {
      const parsed = JSON.parse(relationEditInitialSnapshot.value || '[]')
      if (Array.isArray(parsed)) {
        initialRows = parsed
          .map((row) => ({
            targetCharacterId: String(row?.targetCharacterId ?? '').trim(),
            targetName: String(row?.targetName ?? '').trim(),
            centerToOtherType: String(row?.centerToOtherType ?? '').trim(),
            otherToCenterType: String(row?.otherToCenterType ?? '').trim(),
          }))
          .filter((row) => row.targetCharacterId)
      }
    } catch {
      initialRows = []
    }

    const currentRowsByTarget = new Map<string, RelationDraftRow>()
    for (const row of relationDraftRows.value) {
      const targetId = String(row.targetCharacterId ?? '').trim()
      if (!targetId) continue
      currentRowsByTarget.set(targetId, row)
    }

    const allTargetIds = new Set<string>()
    for (const row of initialRows) allTargetIds.add(row.targetCharacterId)
    for (const targetId of currentRowsByTarget.keys()) allTargetIds.add(targetId)

    for (const targetId of allTargetIds) {
      if (!targetId) continue
      const row = currentRowsByTarget.get(targetId)
      const tCenterToOther = String(row?.centerToOtherType ?? '').trim()
      const tOtherToCenter = String(row?.otherToCenterType ?? '').trim()
      const { centerToOther, otherToCenter } = findBidirectionalEdges(centerId, targetId)

      if (!tCenterToOther && !tOtherToCenter) {
        if (centerToOther) deleteCharacterRelation(centerToOther.id)
        if (otherToCenter) deleteCharacterRelation(otherToCenter.id)
        continue
      }

      if (tCenterToOther) {
        if (centerToOther) {
          updateCharacterRelation({ id: centerToOther.id, relationType: tCenterToOther })
        } else {
          createCharacterRelation({
            novelId: params.novelId.value,
            fromCharacterId: centerId,
            toCharacterId: targetId,
            relationType: tCenterToOther,
          })
        }
      } else if (centerToOther) {
        deleteCharacterRelation(centerToOther.id)
      }

      if (tOtherToCenter) {
        if (otherToCenter) {
          updateCharacterRelation({ id: otherToCenter.id, relationType: tOtherToCenter })
        } else {
          createCharacterRelation({
            novelId: params.novelId.value,
            fromCharacterId: targetId,
            toCharacterId: centerId,
            relationType: tOtherToCenter,
          })
        }
      } else if (otherToCenter) {
        deleteCharacterRelation(otherToCenter.id)
      }
    }
    reloadRelations()
    closeRelationEditModal(true)
    params.onSaved('角色关系已保存。')
  }

  const relationEditVisibleRows = computed(() => {
    const rows = relationDraftRows.value
    const needle = String(relationEditSearchQuery.value ?? '').trim()
    if (!needle) return rows
    return rows.filter(
      (r) =>
        (r.targetName ?? '').includes(needle) ||
        String(r.targetCharacterId ?? '').includes(needle),
    )
  })

  const canSaveRelationDraft = computed(() => {
    if (!relationEditModalOpen.value) return false
    if (relationDraftRows.value.length === 0) return false
    return hasUnsavedRelationEditChanges.value
  })

  const relationAddNewCandidates = computed(() => {
    const centerId = String(params.focusCharacterId.value ?? '').trim()
    if (!centerId) return [] as Character[]
    return params.characters.value
      .filter((c) => {
        if (!c.id || c.id === centerId) return false
        const { centerToOther, otherToCenter } = findBidirectionalEdges(centerId, c.id)
        return !centerToOther && !otherToCenter
      })
      .slice()
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans'))
  })

  const newRelationTargetName = computed(() => {
    const id = String(newRelationTargetId.value ?? '').trim()
    if (!id) return ''
    return params.characters.value.find((c) => c.id === id)?.name?.trim() || '未命名角色'
  })

  const canSaveNewRelation = computed(() => {
    const tid = String(newRelationTargetId.value ?? '').trim()
    if (!tid) return false
    const a = String(newRelationCenterToOther.value ?? '').trim()
    const b = String(newRelationOtherToCenter.value ?? '').trim()
    return Boolean(a && b)
  })

  return {
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
    closeRelationEditModal,
    openRelationAddModal,
    closeRelationAddModal,
    removeRelationDraftRow,
    saveNewRelationPair,
    saveRelationDraftRows,
  }
}
