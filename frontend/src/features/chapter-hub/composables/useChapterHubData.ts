import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  getCategoriesByNovelId,
  getCharacterFactionMembershipsByNovelId,
  getCharactersByNovelId,
  getChaptersByNovelId,
  getFactionsByNovelId,
  getItemsByNovelId,
  getNovelById,
  getOutlineByNovelId,
  getOutlineStorylinesByNovelId,
} from '../../../lib/storage'
import type {
  Category,
  Chapter,
  Character,
  CharacterFactionMembership,
  Faction,
  Item,
  Novel,
  OutlineItem,
  OutlineStoryline,
} from '../../../types'

export function useChapterHubData() {
  const route = useRoute()
  const novelId = computed(() => String(route.params.novelId ?? ''))

  const novel = computed<Novel | null>(() => getNovelById(novelId.value) ?? null)
  const chapters = ref<Chapter[]>([])
  const characters = ref<Character[]>([])
  const factions = ref<Faction[]>([])
  const items = ref<Item[]>([])
  const categories = ref<Category[]>([])
  const characterFactionMemberships = ref<CharacterFactionMembership[]>([])
  const outlineItems = ref<OutlineItem[]>([])
  const outlineStorylines = ref<OutlineStoryline[]>([])
  const selectedChapterId = ref('')

  const chapterForm = reactive({
    title: '',
    notes: '',
    annotation: '',
  })

  const workspaceLink = computed(() => `/novels/${novelId.value}`)

  function reload() {
    chapters.value = getChaptersByNovelId(novelId.value)
    outlineItems.value = getOutlineByNovelId(novelId.value)
    outlineStorylines.value = getOutlineStorylinesByNovelId(novelId.value)
    characters.value = getCharactersByNovelId(novelId.value)
    factions.value = getFactionsByNovelId(novelId.value)
    items.value = getItemsByNovelId(novelId.value)
    categories.value = getCategoriesByNovelId(novelId.value)
    characterFactionMemberships.value = getCharacterFactionMembershipsByNovelId(novelId.value)
  }

  function onNovelDataChanged(): void {
    reload()
  }

  watch(novelId, () => reload(), { immediate: true })

  watch(
    chapters,
    (list) => {
      const ids = new Set(list.map((c) => c.id))
      const queryChapterId = String(route.query.chapterId ?? '').trim()
      if (list.length === 0) {
        selectedChapterId.value = ''
      } else if (queryChapterId && ids.has(queryChapterId)) {
        selectedChapterId.value = queryChapterId
      } else if (!selectedChapterId.value || !ids.has(selectedChapterId.value)) {
        selectedChapterId.value = list[0].id
      }
    },
    { immediate: true }
  )

  watch(
    () => String(route.query.chapterId ?? '').trim(),
    (id) => {
      if (!id) return
      if (chapters.value.some((c) => c.id === id)) selectedChapterId.value = id
    }
  )

  onMounted(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('novel-writing:changed', onNovelDataChanged)
  })

  onUnmounted(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('novel-writing:changed', onNovelDataChanged)
  })

  const selectedChapter = computed(() => chapters.value.find((c) => c.id === selectedChapterId.value) ?? null)

  const selectedChapterCtx = computed(() => {
    const c = selectedChapter.value
    if (!c) return null
    return { id: c.id, chapterNo: c.chapterNo }
  })

  return {
    novelId,
    novel,
    chapters,
    characters,
    factions,
    items,
    categories,
    characterFactionMemberships,
    outlineItems,
    outlineStorylines,
    selectedChapterId,
    selectedChapter,
    selectedChapterCtx,
    chapterForm,
    workspaceLink,
    reload,
  }
}
