import { computed, reactive, ref, type Ref } from 'vue'
import {
  buildCharacterStateSnapshot,
  getChaptersByNovelId,
  normalizeCategoryIds,
  recordCharacterChangeFields,
  replaceItemOwnersForEntity,
  replaceMembershipsForCharacter,
  type CharacterChangeDetail,
  type CharacterStateSnapshot,
  updateChapter,
  updateCharacter,
} from '../../../lib/storage'
import { characterMatchLabels, normalizeCharacterAliases, replaceCharacterLabelsInText } from '../../../lib/characterLabels'
import type {
  Category,
  Character,
  CharacterAttribute,
  CharacterFactionMembership,
  Faction,
  Item,
} from '../../../types'

type MembershipDraftRow = { factionId: string; description: string }

type ItemPickerRow = Item & { ownerLabel: string; transferHint: string; bound: boolean }

function normalizeItemIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hans'))
}

type UseCharacterGraphCharacterEditorParams = {
  novelId: Ref<string>
  chapterId: Ref<string | undefined>
  sourceTextRange: Ref<{ start: number; end: number } | null | undefined>
  categories: Ref<Category[] | undefined>
  characters: Ref<Character[]>
  items: Ref<Item[]>
  editingCharacter: Ref<Character | null>
  membershipSource: Ref<CharacterFactionMembership[]>
  factionOptions: Ref<Faction[]>
  reloadModalSources: () => void
  onSaved: (message?: string) => void
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function normalizeMembershipRows(rows: MembershipDraftRow[]): Array<{ factionId: string; description: string }> {
  const out = rows
    .map((m) => ({ factionId: m.factionId.trim(), description: (m.description ?? '').trim() }))
    .filter((m) => m.factionId)
    .sort((a, b) => a.factionId.localeCompare(b.factionId, 'zh-Hans'))
  const uniq: Array<{ factionId: string; description: string }> = []
  const seen = new Set<string>()
  for (const row of out) {
    if (seen.has(row.factionId)) continue
    seen.add(row.factionId)
    uniq.push(row)
  }
  return uniq
}

function parseAttributesInput(
  attrs: CharacterAttribute[],
): { ok: true; value: CharacterAttribute[] } | { ok: false } {
  const out: CharacterAttribute[] = []
  for (const a of attrs) {
    const k = a.key.trim()
    const v = a.value.trim()
    if (!k && !v) continue
    if (!k || !v) return { ok: false }
    out.push({ id: a.id || uid(), key: k, value: v })
  }
  return { ok: true, value: out }
}

function buildCharacterEditSnapshot(input: {
  draft: {
    id: string
    name: string
    age: string
    gender: string
    aliasRows: Array<{ id: string; value: string }>
    categoryIds: string[]
    membershipRows: Array<{ factionId: string; description: string }>
    itemIds: string[]
    attributes: CharacterAttribute[]
    notes: string
  }
}): string {
  return JSON.stringify({
    id: String(input.draft.id ?? '').trim(),
    name: String(input.draft.name ?? '').trim(),
    age: String(input.draft.age ?? '').trim(),
    gender: String(input.draft.gender ?? '').trim(),
    aliases: normalizeCharacterAliases(input.draft.aliasRows.map((r) => r.value)),
    categoryIds: normalizeCategoryIds(input.draft.categoryIds).slice().sort(),
    membershipRows: normalizeMembershipRows(input.draft.membershipRows),
    itemIds: normalizeItemIds(input.draft.itemIds),
    attributes: input.draft.attributes
      .map((a) => ({ key: a.key.trim(), value: a.value.trim() }))
      .filter((a) => a.key || a.value),
    notes: String(input.draft.notes ?? '').trim(),
  })
}

export function useCharacterGraphCharacterEditor(params: UseCharacterGraphCharacterEditorParams) {
  const characterEditModalOpen = ref(false)
  const characterEditMembershipFactionDropdownOpenId = ref('')
  const renameConfirmOpen = ref(false)
  const characterEditInitialSnapshot = ref('')
  const itemQuery = ref('')
  let pendingRenameSave: null | (() => void) = null

  const draft = reactive({
    id: '',
    name: '',
    age: '',
    gender: '',
    aliasRows: [] as Array<{ id: string; value: string }>,
    categoryIds: [] as string[],
    membershipRows: [] as Array<{ factionId: string; description: string }>,
    itemIds: [] as string[],
    attributes: [] as CharacterAttribute[],
    notes: '',
  })

  function factionNameById(factionId: string): string {
    return params.factionOptions.value.find((f) => f.id === factionId)?.name ?? factionId
  }

  function itemNameById(itemId: string): string {
    return params.items.value.find((item) => item.id === itemId)?.name ?? itemId
  }

  function itemOwnerLabel(item: Item): string {
    if (item.ownerType === 'character' && item.ownerId) {
      const name = params.characters.value.find((c) => c.id === item.ownerId)?.name
      return name ? `角色：${name}` : '未知角色'
    }
    if (item.ownerType === 'faction' && item.ownerId) {
      const name = params.factionOptions.value.find((f) => f.id === item.ownerId)?.name
      return name ? `势力：${name}` : '未知势力'
    }
    return '未绑定'
  }

  function itemTransferHint(item: Item, selected: Character | null): string {
    if (!selected) return ''
    if (!item.ownerType || !item.ownerId) return '保存后绑定到当前角色'
    if (item.ownerType === 'character' && item.ownerId === selected.id) return '当前角色已绑定'
    return `保存后将转移自：${itemOwnerLabel(item)}`
  }

  const itemPickerRows = computed<ItemPickerRow[]>(() => {
    const selected = params.editingCharacter.value
    const q = itemQuery.value.trim().toLowerCase()
    const rows = params.items.value
      .filter((item) => item.novelId === params.novelId.value)
      .filter((item) => !q || `${item.name ?? ''} ${item.summary ?? ''}`.toLowerCase().includes(q))
      .map((item) => ({
        ...item,
        ownerLabel: itemOwnerLabel(item),
        transferHint: itemTransferHint(item, selected),
        bound: draft.itemIds.includes(item.id),
      }))
    return rows.sort((a, b) => {
      const groupA = a.bound ? 0 : !a.ownerType ? 1 : 2
      const groupB = b.bound ? 0 : !b.ownerType ? 1 : 2
      if (groupA !== groupB) return groupA - groupB
      return (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans')
    })
  })

  function computeDraftChangePayload(selected: Character): { fields: string[]; details: CharacterChangeDetail[] } {
    const changed = new Set<string>()
    const details: CharacterChangeDetail[] = []
    const pushDetail = (field: string, location: string, before: unknown, after: unknown): void => {
      details.push({
        field,
        location,
        before: String(before ?? ''),
        after: String(after ?? ''),
      })
    }
    const name = draft.name.trim()
    if (!name) return { fields: [], details: [] }
    if (draft.age !== (selected.age ?? '')) changed.add('age')
    if (draft.age !== (selected.age ?? '')) pushDetail('age', '角色档案/年龄', selected.age ?? '', draft.age)
    if (draft.gender !== (selected.gender ?? '')) changed.add('gender')
    if (draft.gender !== (selected.gender ?? '')) pushDetail('gender', '角色档案/性别', selected.gender ?? '', draft.gender)
    if (draft.notes !== (selected.notes ?? '')) changed.add('notes')
    if (draft.notes !== (selected.notes ?? '')) pushDetail('notes', '角色档案/备注', selected.notes ?? '', draft.notes)

    const attrsA = draft.attributes.map((a) => ({ key: a.key.trim(), value: a.value.trim() }))
    const attrsB = (selected.attributes ?? []).map((a) => ({ key: a.key.trim(), value: a.value.trim() }))
    const attrsChanged =
      attrsA.length !== attrsB.length ||
      attrsA.some((a, i) => a.key !== attrsB[i]?.key || a.value !== attrsB[i]?.value)
    if (attrsChanged) changed.add('attributes')
    if (attrsChanged) {
      const before = attrsB.map((a) => `${a.key}:${a.value}`).join('；')
      const after = attrsA.map((a) => `${a.key}:${a.value}`).join('；')
      pushDetail('attributes', '角色档案/扩展条目', before, after)
    }

    const memA = normalizeMembershipRows(draft.membershipRows)
    const memB = normalizeMembershipRows(
      params.membershipSource.value
        .filter((m) => m.characterId === selected.id)
        .map((m) => ({ factionId: m.factionId, description: m.description ?? '' })),
    )
    const memChanged =
      memA.length !== memB.length ||
      memA.some((m, i) => m.factionId !== memB[i]?.factionId || m.description !== memB[i]?.description)
    if (memChanged) changed.add('memberships')
    if (memChanged) {
      const before = memB.map((m) => `${factionNameById(m.factionId)}:${m.description}`).join('；')
      const after = memA.map((m) => `${factionNameById(m.factionId)}:${m.description}`).join('；')
      pushDetail('memberships', '角色档案/所属势力', before, after)
    }

    const itemA = normalizeItemIds(draft.itemIds)
    const itemB = normalizeItemIds(
      params.items.value
        .filter(
          (item) => item.novelId === params.novelId.value && item.ownerType === 'character' && item.ownerId === selected.id,
        )
        .map((item) => item.id),
    )
    const itemsChanged = itemA.length !== itemB.length || itemA.some((id, i) => id !== itemB[i])
    if (itemsChanged) {
      changed.add('items')
      const label = (ids: string[]) => ids.map((id) => itemNameById(id)).join('、')
      pushDetail('items', '角色档案/绑定物品', label(itemB), label(itemA))
    }

    const prevCats = normalizeCategoryIds(selected.categoryIds).slice().sort().join('|')
    const nextCats = normalizeCategoryIds(draft.categoryIds).slice().sort().join('|')
    if (prevCats !== nextCats) {
      changed.add('categoryIds')
      const nameById = new Map((params.categories.value ?? []).map((c) => [c.id, c.name]))
      const label = (ids: string[]) =>
        normalizeCategoryIds(ids)
          .map((id) => nameById.get(id) ?? id)
          .join('、')
      pushDetail('categoryIds', '角色档案/分类', label(selected.categoryIds ?? []), label(draft.categoryIds))
    }

    return { fields: Array.from(changed), details }
  }


  function draftMembershipSnapshots(selected: Character): CharacterStateSnapshot['memberships'] {
    return normalizeMembershipRows(draft.membershipRows).map((row) => ({
      novelId: params.novelId.value,
      characterId: selected.id,
      factionId: row.factionId,
      description: row.description,
    }))
  }

  function buildDraftStateSnapshot(selected: Character, attrs: CharacterAttribute[]): CharacterStateSnapshot {
    return {
      ...buildCharacterStateSnapshot(selected, []),
      name: draft.name.trim() || selected.name,
      age: draft.age,
      gender: draft.gender,
      notes: draft.notes,
      aliases: normalizeCharacterAliases(draft.aliasRows.map((r) => r.value)),
      categoryIds: normalizeCategoryIds(draft.categoryIds),
      attributes: attrs.map((a) => ({ ...a })),
      memberships: draftMembershipSnapshots(selected),
    }
  }

  function isRenameChanged(selected: Character): boolean {
    const nextName = draft.name.trim()
    if (!nextName) return false
    const prevName = selected.name ?? ''
    const nextAliases = normalizeCharacterAliases(draft.aliasRows.map((r) => r.value))
    const prevAliases = normalizeCharacterAliases(selected.aliases)
    if (nextName !== prevName) return true
    if (nextAliases.length !== prevAliases.length) return true
    return nextAliases.some((v, i) => v !== prevAliases[i])
  }

  function resetCharacterEditTransientState(): void {
    characterEditModalOpen.value = false
    characterEditMembershipFactionDropdownOpenId.value = ''
    renameConfirmOpen.value = false
    characterEditInitialSnapshot.value = ''
    itemQuery.value = ''
    pendingRenameSave = null
  }

  function setDraftByCharacter(c: Character): void {
    draft.id = c.id
    draft.name = c.name ?? ''
    draft.age = c.age ?? ''
    draft.gender = c.gender ?? ''
    draft.aliasRows = normalizeCharacterAliases(c.aliases).map((v) => ({ id: uid(), value: v }))
    draft.categoryIds = [...normalizeCategoryIds(c.categoryIds)]
    draft.membershipRows = params.membershipSource.value
      .filter((m) => m.characterId === c.id)
      .map((m) => ({ factionId: m.factionId, description: m.description ?? '' }))
    draft.itemIds = normalizeItemIds(
      params.items.value
        .filter((item) => item.novelId === params.novelId.value && item.ownerType === 'character' && item.ownerId === c.id)
        .map((item) => item.id),
    )
    draft.attributes = (c.attributes ?? []).map((a) => ({ id: a.id || uid(), key: a.key, value: a.value }))
    draft.notes = c.notes ?? ''
  }

  function openCharacterEditModal(): void {
    const c = params.editingCharacter.value
    if (!c) return
    setDraftByCharacter(c)
    characterEditInitialSnapshot.value = buildCharacterEditSnapshot({ draft })
    characterEditModalOpen.value = true
  }

  const hasUnsavedCharacterChanges = computed(() => {
    if (!characterEditModalOpen.value) return false
    if (!characterEditInitialSnapshot.value) return false
    return buildCharacterEditSnapshot({ draft }) !== characterEditInitialSnapshot.value
  })

  function closeCharacterEditModal(force = false): boolean {
    if (!force && hasUnsavedCharacterChanges.value) return false
    resetCharacterEditTransientState()
    return true
  }

  const canSaveDraft = computed(() => {
    const selected = params.editingCharacter.value
    if (!selected) return false
    return computeDraftChangePayload(selected).fields.length > 0 || isRenameChanged(selected)
  })

  function saveCharacterEdit(): void {
    const selected = params.editingCharacter.value
    if (!selected) return
    const changePayload = computeDraftChangePayload(selected)
    const name = draft.name.trim()
    if (!name) return
    const nextAliases = normalizeCharacterAliases(draft.aliasRows.map((r) => r.value))
    const renameChanged = isRenameChanged(selected)
    if (changePayload.fields.length === 0 && !renameChanged) return
    if (renameChanged && !changePayload.fields.includes('name')) {
      changePayload.fields.push('name')
      changePayload.details.push({
        field: 'name',
        location: '角色档案/姓名',
        before: selected.name ?? '',
        after: name,
      })
    }
    const attrsParsed = parseAttributesInput(draft.attributes)
    if (!attrsParsed.ok) return
    const beforeSnapshot = buildCharacterStateSnapshot(
      selected,
      params.membershipSource.value.filter((m) => m.characterId === selected.id),
    )
    const afterSnapshot = buildDraftStateSnapshot(selected, attrsParsed.value)
    const anchorRange = params.sourceTextRange.value
    const isAnchoredEdit = !!params.chapterId.value && !!anchorRange && anchorRange.end > anchorRange.start
    const runSave = (): void => {
      if (renameChanged && !isAnchoredEdit) {
        const oldLabels = characterMatchLabels(selected)
        const chapters = getChaptersByNovelId(params.novelId.value)
        for (const ch of chapters) {
          const content = ch.content ?? ''
          const nextContent = replaceCharacterLabelsInText(content, oldLabels, name)
          if (nextContent === content) continue
          updateChapter({ id: ch.id, content: nextContent })
        }
      } else if (renameChanged && isAnchoredEdit && anchorRange) {
        const chapterId = String(params.chapterId.value ?? '').trim()
        const ch = getChaptersByNovelId(params.novelId.value).find((x) => x.id === chapterId)
        if (ch) {
          const content = ch.content ?? ''
          const start = Math.max(0, Math.min(content.length, Math.floor(anchorRange.start)))
          const end = Math.max(start, Math.min(content.length, Math.floor(anchorRange.end)))
          const nextContent = `${content.slice(0, start)}${name}${content.slice(end)}`
          if (nextContent !== content) updateChapter({ id: ch.id, content: nextContent })
        }
      }
      updateCharacter({
        id: selected.id,
        name,
        age: draft.age,
        gender: draft.gender,
        notes: draft.notes,
        aliases: nextAliases,
        categoryIds: normalizeCategoryIds(draft.categoryIds),
        attributes: attrsParsed.value,
      })
      const rows = draft.membershipRows.filter((r) => r.factionId.trim())
      const seen = new Set<string>()
      const uniq = rows.filter((r) => {
        const id = r.factionId.trim()
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      replaceMembershipsForCharacter(params.novelId.value, selected.id, uniq)
      replaceItemOwnersForEntity(params.novelId.value, 'character', selected.id, draft.itemIds)
      if (changePayload.fields.length > 0) {
        recordCharacterChangeFields(selected.id, changePayload.fields, {
          chapterId: params.chapterId.value ?? '',
          anchorStart: params.sourceTextRange.value?.start,
          anchorEnd: params.sourceTextRange.value?.end,
          details: changePayload.details,
          beforeSnapshot: isAnchoredEdit ? beforeSnapshot : null,
          afterSnapshot: isAnchoredEdit ? afterSnapshot : null,
        })
      }
      params.reloadModalSources()
      closeCharacterEditModal(true)
      params.onSaved('角色档案已保存。')
    }
    if (renameChanged) {
      pendingRenameSave = runSave
      renameConfirmOpen.value = true
      return
    }
    runSave()
  }

  function confirmRenameAndSave(): void {
    const fn = pendingRenameSave
    pendingRenameSave = null
    if (fn) fn()
  }

  function addAliasRow(): void {
    draft.aliasRows.push({ id: uid(), value: '' })
  }

  function removeAliasRow(id: string): void {
    const i = draft.aliasRows.findIndex((x) => x.id === id)
    if (i >= 0) draft.aliasRows.splice(i, 1)
  }

  function addMembershipRow(): void {
    const firstFactionId = params.factionOptions.value[0]?.id ?? ''
    draft.membershipRows.push({ factionId: firstFactionId, description: '' })
  }

  function removeMembershipRow(index: number): void {
    draft.membershipRows.splice(index, 1)
  }

  function characterEditMembershipFactionLabel(factionId: string): string {
    return params.factionOptions.value.find((f) => f.id === factionId)?.name ?? '未找到势力'
  }

  function selectCharacterEditMembershipFaction(index: number, factionId: string): void {
    const row = draft.membershipRows[index]
    if (!row) return
    row.factionId = factionId
    characterEditMembershipFactionDropdownOpenId.value = ''
  }

  function toggleCharacterEditMembershipFactionDropdown(index: number): void {
    const id = String(index)
    characterEditMembershipFactionDropdownOpenId.value =
      characterEditMembershipFactionDropdownOpenId.value === id ? '' : id
  }

  function addAttributeRow(): void {
    draft.attributes.push({ id: uid(), key: '', value: '' })
  }

  function removeAttributeRow(id: string): void {
    const i = draft.attributes.findIndex((x) => x.id === id)
    if (i >= 0) draft.attributes.splice(i, 1)
  }

  function toggleItemBinding(itemId: string): void {
    const id = String(itemId ?? '').trim()
    if (!id) return
    const idx = draft.itemIds.indexOf(id)
    if (idx >= 0) draft.itemIds.splice(idx, 1)
    else draft.itemIds.push(id)
  }

  return {
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
    closeCharacterEditModal,
    saveCharacterEdit,
    confirmRenameAndSave,
    addAliasRow,
    removeAliasRow,
    addMembershipRow,
    removeMembershipRow,
    characterEditMembershipFactionLabel,
    selectCharacterEditMembershipFaction,
    toggleCharacterEditMembershipFactionDropdown,
    addAttributeRow,
    removeAttributeRow,
    toggleItemBinding,
  }
}
