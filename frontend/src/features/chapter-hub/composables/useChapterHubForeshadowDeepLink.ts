import { nextTick, onUnmounted, watch, type Ref } from 'vue'
import type { LocationQueryRaw, RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { scrollCaretIntoView } from '../caretGeometry'
import { getForeshadowsByNovelId } from '../../../lib/storage'
import type { Chapter, ForeshadowFulfillment, ForeshadowPlant } from '../../../types'

function inferRangeFromSnippet(content: string, snippet: string): { start: number; end: number } | null {
  const t = snippet.trim()
  if (!t) return null
  const idx = content.indexOf(t)
  if (idx < 0) return null
  return { start: idx, end: idx + t.length }
}

function inferNearestRangeFromSnippet(
  content: string,
  snippet: string,
  near: number,
): { start: number; end: number } | null {
  const t = snippet.trim()
  if (!t) return null
  const hits: number[] = []
  const n = t.length
  for (let i = 0; i <= content.length - n; i++) {
    if (content.slice(i, i + n) === t) hits.push(i)
  }
  if (hits.length === 0) return null
  // 明确避免“向前偏移”：优先选择 near 及其之后最近命中。
  let bestForward: number | null = null
  for (const h of hits) {
    if (h < near) continue
    if (bestForward == null || h < bestForward) bestForward = h
  }
  if (bestForward != null) return { start: bestForward, end: bestForward + t.length }
  // 仅当 near 之后没有命中时，才回退到 near 之前最近命中。
  let bestBack = hits[0]
  let bestDist = Math.abs(bestBack - near)
  for (let i = 1; i < hits.length; i++) {
    const d = Math.abs(hits[i] - near)
    if (d < bestDist) {
      bestBack = hits[i]
      bestDist = d
    }
  }
  return { start: bestBack, end: bestBack + t.length }
}

function inferNearbyShiftedRangeFromSnippet(
  content: string,
  snippet: string,
  aroundStart: number,
  windowSize = 8,
): { start: number; end: number } | null {
  const t = snippet.trim()
  if (!t) return null
  const n = t.length
  const minStart = Math.max(0, aroundStart - windowSize)
  const maxStart = Math.min(Math.max(0, content.length - n), aroundStart + windowSize)
  let bestForward: number | null = null
  let bestBack: number | null = null
  let bestBackDist = Infinity
  for (let i = minStart; i <= maxStart; i++) {
    if (content.slice(i, i + n) !== t) continue
    if (i >= aroundStart) {
      if (bestForward == null || i < bestForward) bestForward = i
      continue
    }
    const d = aroundStart - i
    if (d < bestBackDist) {
      bestBack = i
      bestBackDist = d
    }
  }
  const picked = bestForward ?? bestBack
  if (picked == null) return null
  return { start: picked, end: picked + n }
}

function inferBestRangeFromQuery(
  content: string,
  snippet?: string,
  start?: number,
  end?: number,
): { start: number; end: number } | null {
  if (typeof start === 'number' && typeof end === 'number' && end > start && end <= content.length) {
    const raw = { start, end }
    const t = (snippet ?? '').trim()
    if (t) {
      const slice = content.slice(raw.start, raw.end)
      if (slice === t) return raw
      // 坐标与文本不一致：先做局部微调（修复前后偏 1-2 字），再回退全局最近匹配
      return (
        inferNearbyShiftedRangeFromSnippet(content, t, raw.start) ??
        inferNearestRangeFromSnippet(content, t, raw.start) ??
        raw
      )
    }
    return raw
  }
  return inferRangeFromSnippet(content, snippet ?? '')
}

function resolvePlantRange(plant: ForeshadowPlant, content: string): { start: number; end: number } | null {
  const s = plant.plantStart
  const e = plant.plantEnd
  if (typeof s === 'number' && typeof e === 'number' && e > s && e <= content.length) {
    return { start: s, end: e }
  }
  return inferRangeFromSnippet(content, plant.plantText)
}

function resolveFulfillRange(ff: ForeshadowFulfillment, content: string): { start: number; end: number } | null {
  const s = ff.fulfillStart
  const e = ff.fulfillEnd
  if (typeof s === 'number' && typeof e === 'number' && e > s && e <= content.length) {
    return { start: s, end: e }
  }
  return inferRangeFromSnippet(content, ff.fulfillText)
}

/**
 * 工作台「跳转」query：focusChapter、focusForeshadow、focusForeshadowKind（plant|fulfill）、focusFulfillmentId（可选）
 * 可选 focusForeshadowToken 用于强制重复跳转时也执行闪烁。
 * 也支持通用区间跳转：focusRangeStart、focusRangeEnd、focusRangeToken（无需 focusForeshadow）。
 */
export function useChapterHubForeshadowDeepLink(deps: {
  novelId: Ref<string>
  chapters: Ref<Chapter[]>
  selectedChapterId: Ref<string>
  chapterTextareaRef: Ref<HTMLTextAreaElement | null>
  route: RouteLocationNormalizedLoaded
  router: Router
  onForeshadowFocused?: (meta: {
    chapterId: string
    fsKey: string
    range: { start: number; end: number }
  }) => void
}): void {
  const { novelId, chapters, selectedChapterId, chapterTextareaRef, route, router, onForeshadowFocused } = deps
  let applyRetryTimer: number | null = null

  function forceSyncTextareaScroll(ta: HTMLTextAreaElement): void {
    ta.dispatchEvent(new Event('scroll'))
  }

  function clearApplyRetryTimer(): void {
    if (applyRetryTimer != null) {
      window.clearTimeout(applyRetryTimer)
      applyRetryTimer = null
    }
  }

  async function waitForTextareaForChapter(chapterId: string, timeoutMs = 1400): Promise<HTMLTextAreaElement | null> {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      const ta = chapterTextareaRef.value
      if (ta && selectedChapterId.value === chapterId) return ta
      await nextTick()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    return null
  }

  function stripForeshadowFocusQuery(): void {
    const q: LocationQueryRaw = { ...route.query }
    if (
      !('focusChapter' in q) &&
      !('focusForeshadow' in q) &&
      !('focusForeshadowKind' in q) &&
      !('focusFulfillmentId' in q) &&
      !('focusForeshadowToken' in q) &&
      !('focusRangeStart' in q) &&
      !('focusRangeEnd' in q) &&
      !('focusRangeToken' in q) &&
      !('focusForeshadowStart' in q) &&
      !('focusForeshadowEnd' in q) &&
      !('focusForeshadowText' in q)
    ) {
      return
    }
    delete q.focusChapter
    delete q.focusForeshadow
    delete q.focusForeshadowKind
    delete q.focusFulfillmentId
    delete q.focusForeshadowToken
    delete q.focusRangeStart
    delete q.focusRangeEnd
    delete q.focusRangeToken
    delete q.focusForeshadowStart
    delete q.focusForeshadowEnd
    delete q.focusForeshadowText
    void router.replace({ path: route.path, query: q })
  }

  async function applyFromRoute(): Promise<void> {
    const chapterId = String(route.query.focusChapter ?? '').trim()
    const plantId = String(route.query.focusForeshadow ?? '').trim()
    const kindRaw = String(route.query.focusForeshadowKind ?? 'plant').trim()
    const fulfillmentId = String(route.query.focusFulfillmentId ?? '').trim()
    const focusStart = Number(route.query.focusForeshadowStart)
    const focusEnd = Number(route.query.focusForeshadowEnd)
    const focusText = String(route.query.focusForeshadowText ?? '').trim()
    const rangeStart = Number(route.query.focusRangeStart)
    const rangeEnd = Number(route.query.focusRangeEnd)
    const hasGenericRangeFocus =
      !!chapterId &&
      !plantId &&
      Number.isFinite(rangeStart) &&
      Number.isFinite(rangeEnd) &&
      rangeEnd > rangeStart

    if (!chapterId || (!plantId && !hasGenericRangeFocus)) return

    const ch = chapters.value.find((c) => c.id === chapterId)
    if (!ch) {
      stripForeshadowFocusQuery()
      return
    }

    selectedChapterId.value = chapterId
    await nextTick()
    await nextTick()
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve())
      })
    })

    const ta = await waitForTextareaForChapter(chapterId)
    if (!ta) {
      // 编辑器尚未挂载时延迟重试，不立即吞掉 query
      clearApplyRetryTimer()
      applyRetryTimer = window.setTimeout(() => {
        applyRetryTimer = null
        void applyFromRoute()
      }, 120)
      return
    }

    const content = ta.value ?? ''
    if (hasGenericRangeFocus) {
      const s = Math.max(0, Math.min(Math.floor(rangeStart), content.length))
      scrollCaretIntoView(ta, s)
      ta.setSelectionRange(s, s)
      forceSyncTextareaScroll(ta)
      stripForeshadowFocusQuery()
      requestAnimationFrame(() => {
        const cur = chapterTextareaRef.value
        cur?.blur()
      })
      return
    }

    const plants = getForeshadowsByNovelId(novelId.value)
    const plant = plants.find((p) => p.id === plantId)
    if (!plant) {
      stripForeshadowFocusQuery()
      return
    }

    let range: { start: number; end: number } | null = null
    let fallbackCaret = 0

    if (kindRaw === 'fulfill') {
      const ff =
        (fulfillmentId ? plant.fulfillments.find((f) => f.id === fulfillmentId) : null) ??
        plant.fulfillments[0]
      if (!ff) {
        stripForeshadowFocusQuery()
        return
      }
      range =
        inferBestRangeFromQuery(content, focusText, focusStart, focusEnd) ??
        resolveFulfillRange(ff, content) ??
        inferRangeFromSnippet(content, ff.fulfillText)
      if (range) fallbackCaret = range.start
      if (!range) {
        const plantRange =
          inferBestRangeFromQuery(content, focusText, focusStart, focusEnd) ??
          resolvePlantRange(plant, content) ??
          inferRangeFromSnippet(content, plant.plantText)
        if (plantRange) {
          range = plantRange
          fallbackCaret = plantRange.start
        }
      }
    } else {
      range =
        inferBestRangeFromQuery(content, focusText, focusStart, focusEnd) ??
        resolvePlantRange(plant, content) ??
        inferRangeFromSnippet(content, plant.plantText)
      if (range) fallbackCaret = range.start
    }

    if (!range) {
      const safeCaret = Math.max(0, Math.min(fallbackCaret, Math.max(0, content.length)))
      range = { start: safeCaret, end: safeCaret }
    }

    if (range.end <= content.length && range.start >= 0) {
      scrollCaretIntoView(ta, range.start)
      ta.setSelectionRange(range.start, range.start)
      forceSyncTextareaScroll(ta)
      if (plantId) {
        const fsKey =
          kindRaw === 'fulfill'
            ? `fulfill:${plant.id}:${fulfillmentId || plant.fulfillments[0]?.id || ''}`
            : `plant:${plant.id}:`
        onForeshadowFocused?.({
          chapterId,
          fsKey,
          range: { start: range.start, end: range.end },
        })
      }
    }

    stripForeshadowFocusQuery()
    // 按需求：跳转完成后保持失焦
    requestAnimationFrame(() => {
      const cur = chapterTextareaRef.value
      cur?.blur()
    })
  }

  watch(
    [
      () => String(route.query.focusForeshadow ?? ''),
      () => String(route.query.focusChapter ?? ''),
      () => String(route.query.focusForeshadowKind ?? ''),
      () => String(route.query.focusFulfillmentId ?? ''),
      () => String(route.query.focusForeshadowToken ?? ''),
      () => String(route.query.focusRangeStart ?? ''),
      () => String(route.query.focusRangeEnd ?? ''),
      () => String(route.query.focusRangeToken ?? ''),
      selectedChapterId,
      () => chapters.value.find((c) => c.id === selectedChapterId.value)?.content ?? '',
    ],
    () => {
      const hasForeshadowFocus = !!String(route.query.focusForeshadow ?? '').trim()
      const hasRangeFocus =
        !!String(route.query.focusChapter ?? '').trim() &&
        Number.isFinite(Number(route.query.focusRangeStart)) &&
        Number.isFinite(Number(route.query.focusRangeEnd)) &&
        Number(route.query.focusRangeEnd) > Number(route.query.focusRangeStart)
      if (!hasForeshadowFocus && !hasRangeFocus) return
      void applyFromRoute()
    },
    { flush: 'post', immediate: true },
  )

  watch(
    () => String(route.query.focusForeshadow ?? ''),
    (v) => {
      if (!v.trim()) clearApplyRetryTimer()
    },
    { flush: 'post' },
  )

  onUnmounted(() => {
    clearApplyRetryTimer()
  })
}
