<template>
  <section class="page-block">
    <header ref="listChromeAnchorRef" class="page-hero">
      <h1>我的作品</h1>
    </header>

    <form
      ref="createCardRef"
      class="card form-grid"
      @submit.prevent="handleCreate"
    >
      <h2>新建作品</h2>
      <label>
        作品标题 *
        <input v-model="form.title" required maxlength="60" />
      </label>

      <label>
        简介
        <textarea
          v-model="form.summary"
          rows="3"
          maxlength="500"
          class="scrollbar-paper novel-list__summary-input"
        />
      </label>

      <div class="grid-2">
        <label>
          题材
          <input v-model="form.genre" maxlength="30" placeholder="如：玄幻、悬疑、科幻" />
        </label>
        <label>
          叙事视角
          <select v-model="form.perspective">
            <option value="">未设置</option>
            <option value="第一人称">第一人称</option>
            <option value="第三人称-有限">第三人称-有限</option>
            <option value="第三人称-全知">第三人称-全知</option>
            <option value="第二人称">第二人称</option>
            <option value="多视角">多视角</option>
          </select>
        </label>
      </div>

      <div class="grid-2">
        <label>
          基调
          <input v-model="form.tone" maxlength="30" placeholder="如：热血、治愈、黑暗" />
        </label>
        <label class="checkbox-line" style="margin-top: 26px">
          <input v-model="form.isMultiLineNarrative" type="checkbox" />
          多线叙事
        </label>
      </div>

      <div class="action-row">
        <button type="submit" class="btn-primary">创建并进入作品</button>
      </div>
    </form>

    <section class="card">
      <h2>作品列表</h2>
      <p v-if="sortedNovels.length === 0" class="muted">
        暂无作品，先在上方创建第一本。
      </p>
      <ul v-else class="list novel-list__list scrollbar-paper">
        <li
          v-for="novel in sortedNovels"
          :key="novel.id"
          class="list-item novel-card"
        >
          <div class="novel-card__body">
            <strong class="novel-card__title">{{ novel.title }}</strong>
            <p class="muted one-line novel-card__summary">
              {{ novel.summary || "暂无简介" }}
            </p>
            <div class="novel-card__meta">
              <span class="novel-meta-chip"
                >创建：{{ formatDateTime(novel.createdAt) }}</span
              >
              <span class="novel-meta-chip"
                >上次码字：{{ formatDateTime(novelLastWritingAt(novel)) }}</span
              >
            </div>
          </div>
          <button type="button" class="btn-primary" @click="goNovel(novel.id)">
            进入
          </button>
        </li>
      </ul>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { setChromeAnchor } from "../../composables/useChromeAnchor";
import { createNovel, getChaptersByNovelId, getNovels } from "../../lib/storage";
import type { NewNovelInput, Novel } from "../../types";

const router = useRouter();
const route = useRoute();
const listChromeAnchorRef = ref<HTMLElement | null>(null);
const createCardRef = ref<HTMLElement | null>(null);
watch(listChromeAnchorRef, (el) => setChromeAnchor(el), { immediate: true });
onUnmounted(() => setChromeAnchor(null));

const novels = ref<Novel[]>(getNovels());
const sortedNovels = computed(() =>
  [...novels.value].sort((a, b) => {
    const ta = novelLastWritingAt(a);
    const tb = novelLastWritingAt(b);
    if (ta === tb) return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
    return tb.localeCompare(ta);
  })
);
const form = reactive<Pick<NewNovelInput, "title" | "summary" | "genre" | "perspective" | "tone" | "isMultiLineNarrative">>({
  title: "",
  summary: "",
  genre: "",
  perspective: "",
  tone: "",
  isMultiLineNarrative: false,
});

function resetForm() {
  form.title = "";
  form.summary = "";
  form.genre = "";
  form.perspective = "";
  form.tone = "";
  form.isMultiLineNarrative = false;
}

function handleCreate() {
  if (!form.title.trim()) return;
  const novel = createNovel({
    title: form.title,
    summary: form.summary,
    genre: form.genre,
    perspective: form.perspective,
    tone: form.tone,
    isMultiLineNarrative: form.isMultiLineNarrative,
  });
  novels.value = getNovels();
  resetForm();
  void router.push(`/novels/${novel.id}`);
}

function formatDateTime(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN", { hour12: false });
}

function goNovel(id: string) {
  void router.push(`/novels/${id}`);
}

function novelLastWritingAt(novel: Novel): string {
  const chapters = getChaptersByNovelId(novel.id);
  let latest = "";
  for (const chapter of chapters) {
    if (!String(chapter.content ?? "").trim()) continue;
    const ts = String(chapter.updatedAt ?? "");
    if (!ts) continue;
    if (!latest || ts > latest) latest = ts;
  }
  return latest || novel.createdAt;
}

function scrollToCreate(): void {
  createCardRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

watch(
  () => route.query.focus,
  (focus) => {
    if (String(focus ?? "") !== "create") return;
    void Promise.resolve().then(() => {
      scrollToCreate();
      const nextQuery = { ...route.query };
      delete nextQuery.focus;
      void router.replace({ query: nextQuery });
    });
  },
  { immediate: true },
);
</script>
