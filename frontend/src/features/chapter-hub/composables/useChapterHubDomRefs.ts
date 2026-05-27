import { onUnmounted, ref, unref, watchEffect, type Ref } from 'vue'
import { setChromeAnchor } from '../../../composables/useChromeAnchor'

export type ChapterHubPaperExpose = {
  textareaRef: Ref<HTMLTextAreaElement | null>
  goToSearchMatch: (index: number, options?: { focus?: boolean }) => boolean
  getSearchMatchCount: () => number
}
export type ChapterHubHeaderExpose = { rootRef: Ref<HTMLElement | null> }

export function useChapterHubDomRefs() {
  const paperBlockRef = ref<ChapterHubPaperExpose | null>(null)
  const chapterTextareaRef = ref<HTMLTextAreaElement | null>(null)

  watchEffect(() => {
    chapterTextareaRef.value = unref(paperBlockRef.value?.textareaRef) ?? null
  })

  const pageHeaderRef = ref<ChapterHubHeaderExpose | null>(null)
  watchEffect(() => {
    setChromeAnchor(unref(pageHeaderRef.value?.rootRef) ?? null)
  })
  onUnmounted(() => setChromeAnchor(null))

  return {
    paperBlockRef,
    pageHeaderRef,
    chapterTextareaRef,
  }
}
