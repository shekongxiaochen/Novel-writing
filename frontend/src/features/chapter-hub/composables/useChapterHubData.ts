import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  getCategoriesByNovelId,
  getCharacterFactionMembershipsByNovelId,
  getCharactersByNovelId,
  getChaptersByNovelId,
  getFactionsByNovelId,
  getNovelById,
  getOutlineByNovelId,
} from '../../../lib/storage'
import type {
  Category,
  Chapter,
  Character,
  CharacterFactionMembership,
  Faction,
  Novel,
  OutlineItem,
} from '../../../types'

export function useChapterHubData() {
  const route = useRoute()
  const novelId = computed(() => String(route.params.novelId ?? ''))

  const novel = computed<Novel | null>(() => getNovelById(novelId.value) ?? null)
  const chapters = ref<Chapter[]>([])
  const characters = ref<Character[]>([])
  const factions = ref<Faction[]>([])
  const categories = ref<Category[]>([])
  const characterFactionMemberships = ref<CharacterFactionMembership[]>([])
  const outlineItems = ref<OutlineItem[]>([])
  const selectedChapterId = ref('')

  const chapterForm = reactive({
    title: '',
    notes: '',
  })

  const workspaceLink = computed(() => `/novels/${novelId.value}`)

  function reload() {
    chapters.value = getChaptersByNovelId(novelId.value)
    outlineItems.value = getOutlineByNovelId(novelId.value)
    characters.value = getCharactersByNovelId(novelId.value)
    factions.value = getFactionsByNovelId(novelId.value)
    categories.value = getCategoriesByNovelId(novelId.value)
    characterFactionMemberships.value = getCharacterFactionMembershipsByNovelId(novelId.value)
  }

  watch(novelId, () => reload(), { immediate: true })

  watch(
    chapters,
    (list) => {
      const ids = new Set(list.map((c) => c.id))
      if (list.length === 0) {
        selectedChapterId.value = ''
      } else if (!selectedChapterId.value || !ids.has(selectedChapterId.value)) {
        selectedChapterId.value = list[0].id
      }
    },
    { immediate: true }
  )

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
    categories,
    characterFactionMemberships,
    outlineItems,
    selectedChapterId,
    selectedChapter,
    selectedChapterCtx,
    chapterForm,
    workspaceLink,
    reload,
  }
}
