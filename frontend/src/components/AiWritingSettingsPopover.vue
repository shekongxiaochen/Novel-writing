<template>
  <Teleport to="body">
    <Transition name="ai-settings-pop">
      <div v-if="open" class="ai-settings-overlay" @pointerdown.self="close">
        <section
          ref="panelRef"
          class="ai-settings-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-settings-title"
          tabindex="-1"
          @keydown="onKeydown"
          @pointerdown.stop
        >
          <!-- Header -->
          <header class="ai-settings-dialog__header">
            <div class="ai-settings-dialog__header-left">
              <div class="ai-settings-dialog__icon">S</div>
              <div>
                <h2 id="ai-settings-title" class="ai-settings-dialog__title">AI 写作风格</h2>
                <p class="ai-settings-dialog__subtitle">
                  自定义 AI 续写和大纲生成时的风格偏好
                </p>
              </div>
            </div>
            <button
              type="button"
              class="ai-settings-dialog__close"
              aria-label="关闭"
              @click="close"
            >
              &times;
            </button>
          </header>

          <!-- Body -->
          <div class="ai-settings-dialog__body">

            <!-- Presets -->
            <div class="ai-settings-section">
              <div class="ai-settings-section__head">
                <span class="ai-settings-section__label">快速模板</span>
                <span class="ai-settings-section__hint">点击应用，可在下方继续修改</span>
              </div>
              <div class="ai-settings-presets">
                <button
                  v-for="preset in presets"
                  :key="preset.id"
                  type="button"
                  class="ai-settings-preset"
                  :class="{ 'ai-settings-preset--active': activePresetId === preset.id }"
                  @click="applyPreset(preset)"
                >
                  <span class="ai-settings-preset__icon">{{ preset.icon }}</span>
                  <span class="ai-settings-preset__info">
                    <span class="ai-settings-preset__name">{{ preset.name }}</span>
                    <span class="ai-settings-preset__desc">{{ preset.desc }}</span>
                  </span>
                </button>
              </div>
            </div>

            <!-- Editor -->
            <div class="ai-settings-section">
              <div class="ai-settings-section__head">
                <span class="ai-settings-section__label">自定义提示词</span>
                <button
                  v-if="draft.trim()"
                  type="button"
                  class="ai-settings-clear"
                  @click="draft = ''; activePresetId = ''"
                >
                  清空
                </button>
              </div>
              <div class="ai-settings-editor">
                <textarea
                  ref="textareaRef"
                  v-model="draft"
                  class="ai-settings-textarea"
                  rows="7"
                  maxlength="1000"
                  placeholder="描述你期望的写作风格，例如：&#10;&#10;· 用短句为主，多用感官描写&#10;· 对话口语化，避免文绉绉&#10;· 打斗场面注重动作节奏&#10;· 少用心理独白，多用行为暗示&#10;· 环境描写点到即止"
                ></textarea>
                <div class="ai-settings-textarea__footer">
                  <span class="ai-settings-textarea__count" :class="{ 'ai-settings-textarea__count--warn': draft.length > 900 }">
                    {{ draft.length }}/1000
                  </span>
                </div>
              </div>
            </div>

            <!-- Style sample (few-shot anchor) -->
            <div class="ai-settings-section">
              <div class="ai-settings-section__head">
                <span class="ai-settings-section__label">风格范文（可选，强烈推荐）</span>
                <button
                  v-if="sample.trim()"
                  type="button"
                  class="ai-settings-clear"
                  @click="sample = ''"
                >
                  清空
                </button>
              </div>
              <div class="ai-settings-editor">
                <textarea
                  ref="sampleRef"
                  v-model="sample"
                  class="ai-settings-textarea"
                  rows="6"
                  maxlength="10000"
                  placeholder="粘贴一段你认可的文字（你自己写的、或喜欢的作品片段）。&#10;AI 会模仿它的语感、句式、节奏和用词习惯来续写——比纯文字描述更精准。&#10;&#10;注意：AI 只学“怎么写”，不会照抄这段的情节或句子。"
                ></textarea>
                <div class="ai-settings-textarea__footer">
                  <span class="ai-settings-textarea__count" :class="{ 'ai-settings-textarea__count--warn': sample.length > 9000 }">
                    {{ sample.length }}/10000
                  </span>
                </div>
              </div>
            </div>

            <!-- 风格蒸馏 -->
            <div v-if="canAnalyze" class="ai-settings-section">
              <button
                type="button"
                class="ai-settings-btn ai-settings-btn--distill"
                :disabled="analyzing"
                @click="analyzeStyle"
              >
                {{ analyzing ? '分析中…' : '分析风格' }}
              </button>

              <div v-if="analysisResult" class="ai-settings-distill">
                <div class="ai-settings-distill__title">风格分析结果</div>
                <dl class="ai-settings-distill__list">
                  <div v-for="dim in analysisResult.dimensions" :key="dim.label" class="ai-settings-distill__item">
                    <dt class="ai-settings-distill__label">{{ dim.label }}</dt>
                    <dd class="ai-settings-distill__value">{{ dim.summary }}</dd>
                  </div>
                </dl>
                <div class="ai-settings-distill__prompt-preview">
                  <div class="ai-settings-distill__prompt-title">生成的风格指令</div>
                  <p class="ai-settings-distill__prompt-text">{{ analysisResult.stylePrompt }}</p>
                </div>
                <div class="ai-settings-distill__actions">
                  <button type="button" class="ai-settings-btn ai-settings-btn--primary" @click="adoptAnalysis">采用此分析</button>
                  <button type="button" class="ai-settings-btn" @click="analyzeStyle">重新分析</button>
                </div>
              </div>
            </div>

            <!-- Info -->
            <div class="ai-settings-info">
              <span class="ai-settings-info__icon">i</span>
              <p class="ai-settings-info__text">
                提示词与范文都会在每次 AI 续写、大纲生成时作为风格参考注入。范文给“语感锚点”，比文字描述更能让 AI 抓住你的风格。留空则使用默认风格。
              </p>
            </div>
          </div>

          <!-- Footer -->
          <footer class="ai-settings-dialog__footer">
            <Transition name="ai-settings-save" mode="out-in">
              <button
                v-if="saved"
                key="saved"
                type="button"
                class="ai-settings-btn ai-settings-btn--success"
                disabled
              >
                <span class="ai-settings-btn__check">✓</span>
                已保存
              </button>
              <button
                v-else
                key="save"
                type="button"
                class="ai-settings-btn ai-settings-btn--primary"
                :disabled="saving"
                @click="handleSave"
              >
                {{ saving ? '保存中…' : '保存设定' }}
              </button>
            </Transition>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { getCurrentSession } from '../lib/auth'
import { postAiPrompt } from '../lib/backendAi'
import { upsertNovelRecord } from '../lib/storage'
import type { Novel } from '../types'

const presets = [
  {
    id: 'xianxia',
    icon: '壹',
    name: '玄幻修仙',
    desc: '古风长句，意境描写，打斗注重招式与气韵',
    content: '以古风长句为主，善用四字短语和意象描写。打斗场面注重招式意境和气机流转，不拘泥于具体动作分解。对话偏古风但不过度文言，保持可读性。环境描写讲究意境渲染，常用天地、灵气等元素烘托氛围。修炼突破时注重心境感悟的描写。',
  },
  {
    id: 'urban',
    icon: '贰',
    name: '都市现代',
    desc: '口语化对话，快节奏推进，心理描写细腻',
    content: '对话口语化、贴近当代年轻人说话方式。节奏偏快，场景切换利落。心理描写细腻但不拖沓，善用行为和细节暗示情绪。环境描写简洁有画面感，注重都市氛围。避免过度书面化的表达，叙事视角贴近角色内心。',
  },
  {
    id: 'mystery',
    icon: '叁',
    name: '悬疑推理',
    desc: '冷峻笔调，细节伏笔，节奏张弛有度',
    content: '笔调冷峻克制，叙述简洁有力。善于通过细节描写埋设伏笔，不直接点明线索的重要性。节奏张弛有度，紧张处短句急促，铺垫处从容展开。对话简洁，潜台词丰富。避免过多心理描写，用行为和环境暗示角色状态。',
  },
  {
    id: 'romance',
    icon: '肆',
    name: '言情甜宠',
    desc: '细腻情感，氛围营造，对话温柔有张力',
    content: '情感描写细腻入微，善于捕捉微妙的心动瞬间。氛围营造注重光影、温度、气味等感官细节。对话温柔但有张力，潜台词丰富。配角互动轻松有趣。亲密场景含蓄有美感，点到即止。避免过度狗血和无脑误会推动剧情。',
  },
  {
    id: 'scifi',
    icon: '伍',
    name: '科幻未来',
    desc: '硬核设定，理性叙事，科技感与人文并重',
    content: '叙事理性克制，技术描写准确但不堆砌术语。注重科技对人性的影响和思考。世界观设定要有内在逻辑自洽性。对话简洁高效，角色思维缜密。环境描写突出未来感和科技氛围。在硬核设定之上保持人文关怀。',
  },
]

const props = defineProps<{
  open: boolean
  returnFocusEl?: HTMLElement | null
  novel: Novel | null
}>()

const emit = defineEmits<{
  close: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const sampleRef = ref<HTMLTextAreaElement | null>(null)
const draft = ref('')
const sample = ref('')
const saving = ref(false)
const saved = ref(false)
const activePresetId = ref('')
const analyzing = ref(false)
const analysisResult = ref<{ dimensions: { label: string; summary: string }[]; stylePrompt: string } | null>(null)
const canAnalyze = computed(() => sample.value.trim().length >= 200)

// 用一个用户几乎不可能输入的分隔标记，把「风格指令」与「风格范文」拼进同一个 aiStylePrompt 字段，
// 这样无需改数据库 schema 和后端，复用现有注入链路。
const SAMPLE_MARKER = '\n\n【风格范文 — 仅模仿其语感/句式/节奏/用词，禁止照抄其情节与原句】\n'

function splitStored(stored: string): { instruction: string; sample: string } {
  const idx = stored.indexOf(SAMPLE_MARKER)
  if (idx === -1) return { instruction: stored, sample: '' }
  return {
    instruction: stored.slice(0, idx),
    sample: stored.slice(idx + SAMPLE_MARKER.length),
  }
}

function combineStored(instruction: string, sampleText: string): string {
  const a = instruction.trim()
  const b = sampleText.trim()
  if (!b) return a
  return a ? `${a}${SAMPLE_MARKER}${b}` : `${SAMPLE_MARKER.trimStart()}${b}`
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    const stored = props.novel?.aiStylePrompt ?? ''
    const parts = splitStored(stored)
    draft.value = parts.instruction
    sample.value = parts.sample
    saved.value = false
    activePresetId.value = ''
    await nextTick()
    textareaRef.value?.focus()
  },
)

onUnmounted(() => {
  props.returnFocusEl?.focus()
})

function close(): void {
  emit('close')
  nextTick(() => props.returnFocusEl?.focus())
}

function applyPreset(preset: typeof presets[number]): void {
  draft.value = preset.content
  activePresetId.value = preset.id
  nextTick(() => textareaRef.value?.focus())
}

async function handleSave(): Promise<void> {
  const novel = props.novel
  if (!novel) return
  saving.value = true
  saved.value = false
  const trimmed = combineStored(draft.value, sample.value)
  try {
    const session = getCurrentSession()
    if (session?.token) {
      const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '')
      await fetch(`${API_BASE}/novels/${novel.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ ai_style_prompt: trimmed }),
      })
    }
    upsertNovelRecord({
      ...novel,
      aiStylePrompt: trimmed,
      updatedAt: new Date().toISOString(),
    })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2200)
  } catch {
    // local save succeeded, cloud sync will catch up
  } finally {
    saving.value = false
  }
}

async function analyzeStyle(): Promise<void> {
  if (!sample.value.trim() || analyzing.value) return
  analyzing.value = true
  analysisResult.value = null
  try {
    const prompt = '你是写作风格分析专家。分析以下文本的写作风格特征，输出结构化总结。\n\n文本：\n' + sample.value.trim() + '\n\n请从以下维度分析，每项用1-2句话概括：\n1. 叙事视角与节奏\n2. 句式偏好（长短句比例、句式变化）\n3. 修辞与用词（常用修辞手法、用词倾向）\n4. 对话风格（口语化程度、潜台词密度）\n5. 描写侧重（环境/心理/动作/感官的比重）\n6. 整体语感（用3-5个关键词概括）\n\n最后输出一段完整的"风格指令"（100-200字），可以直接作为AI续写的风格参考。\n\n输出JSON格式：\n{"dimensions": [{"label":"叙事视角与节奏","summary":"..."},{"label":"句式偏好","summary":"..."},{"label":"修辞与用词","summary":"..."},{"label":"对话风格","summary":"..."},{"label":"描写侧重","summary":"..."},{"label":"整体语感","summary":"..."}],"stylePrompt":"完整风格指令文本"}'
    const result = await postAiPrompt({
      prompt_type: 'qa',
      user_prompt: prompt,
      temperature: 0.3,
      max_tokens: 2048,
      response_format: 'json',
    })
    const content = result.content
    if (!content) throw new Error('AI 未返回内容')
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed.dimensions) && parsed.stylePrompt) {
      analysisResult.value = parsed
    }
  } catch (e) {
    console.warn('风格分析失败:', e)
  } finally {
    analyzing.value = false
  }
}

function adoptAnalysis(): void {
  if (!analysisResult.value) return
  draft.value = analysisResult.value.stylePrompt
  activePresetId.value = ''
  analysisResult.value = null
  nextTick(() => textareaRef.value?.focus())
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}
</script>

<style scoped>
/* ── Transitions ─────────────────────────────────── */

.ai-settings-pop-enter-active,
.ai-settings-pop-leave-active {
  transition: opacity 0.2s ease;
}

.ai-settings-pop-enter-active .ai-settings-dialog,
.ai-settings-pop-leave-active .ai-settings-dialog {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.ai-settings-pop-enter-from,
.ai-settings-pop-leave-to {
  opacity: 0;
}

.ai-settings-pop-enter-from .ai-settings-dialog,
.ai-settings-pop-leave-to .ai-settings-dialog {
  transform: translateY(12px) scale(0.97);
  opacity: 0;
}

.ai-settings-save-enter-active,
.ai-settings-save-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.ai-settings-save-enter-from {
  opacity: 0;
  transform: scale(0.92);
}

.ai-settings-save-leave-to {
  opacity: 0;
  transform: scale(1.04);
}

/* ── Overlay ─────────────────────────────────── */

.ai-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 8vh;
  background: color-mix(in srgb, var(--color-surface) 40%, transparent);
  backdrop-filter: blur(8px);
}

/* ── Dialog ─────────────────────────────────── */

.ai-settings-dialog {
  position: relative;
  width: min(580px, calc(100vw - 32px));
  max-height: min(85vh, 720px);
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 40%, transparent);
  background: var(--color-surface);
  box-shadow:
    0 32px 80px color-mix(in srgb, #000 24%, transparent),
    0 4px 12px color-mix(in srgb, #000 8%, transparent);
  outline: none;
  overflow: hidden;
}

/* ── Header ─────────────────────────────────── */

.ai-settings-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary-soft) 14%, var(--color-surface)), var(--color-surface));
  flex-shrink: 0;
}

.ai-settings-dialog__header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ai-settings-dialog__icon {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1.5px solid color-mix(in srgb, var(--color-border-strong) 40%, transparent);
  background: transparent;
  color: var(--color-text-muted);
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}

.ai-settings-dialog__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1.2;
}

.ai-settings-dialog__subtitle {
  margin: 3px 0 0;
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.ai-settings-dialog__close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-border) 28%, transparent);
  color: var(--color-text-muted);
  font-size: 18px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.ai-settings-dialog__close:hover {
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  color: var(--color-text);
}

/* ── Body ─────────────────────────────────── */

.ai-settings-dialog__body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 20px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-text-muted) 24%, transparent) transparent;
}

.ai-settings-dialog__body::-webkit-scrollbar {
  width: 5px;
}

.ai-settings-dialog__body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-muted) 24%, transparent);
}

/* ── Section ─────────────────────────────────── */

.ai-settings-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-settings-section__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.ai-settings-section__label {
  font-size: 13px;
  font-weight: 700;
  color: color-mix(in srgb, var(--color-text) 80%, var(--color-primary) 20%);
}

.ai-settings-section__hint {
  font-size: 11.5px;
  color: var(--color-text-muted);
}

.ai-settings-clear {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
}

.ai-settings-clear:hover {
  color: var(--color-danger, #ef4444);
  background: color-mix(in srgb, var(--color-danger, #ef4444) 8%, transparent);
}

/* ── Presets ─────────────────────────────────── */

.ai-settings-presets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}

.ai-settings-preset {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 28%, transparent);
  border-radius: 12px;
  background: var(--color-surface);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.ai-settings-preset:hover {
  border-color: color-mix(in srgb, var(--color-primary) 32%, transparent);
  background: color-mix(in srgb, var(--color-primary-soft) 8%, var(--color-surface));
}

.ai-settings-preset--active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 16%, var(--color-surface));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.ai-settings-preset__icon {
  font-size: 15px;
  font-weight: 700;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-border) 16%, transparent);
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
}

.ai-settings-preset__info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.ai-settings-preset__name {
  font-size: 13px;
  font-weight: 650;
  color: var(--color-text);
  line-height: 1.2;
}

.ai-settings-preset__desc {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Textarea ─────────────────────────────────── */

.ai-settings-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-settings-textarea {
  width: 100%;
  resize: vertical;
  min-height: 150px;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-text-muted) 22%, transparent) transparent;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 40%, transparent);
  background:
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 23px,
      color-mix(in srgb, var(--color-border) 18%, transparent) 24px
    ),
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 98%, rgba(255,255,255,0.5)), var(--color-surface));
  background-attachment: local;
  color: var(--color-text);
  padding: 12px 14px;
  line-height: 24px;
  outline: none;
  font-size: 13.5px;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ai-settings-textarea::-webkit-scrollbar {
  width: 5px;
}

.ai-settings-textarea::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-muted) 22%, transparent);
}

.ai-settings-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.ai-settings-textarea__footer {
  display: flex;
  justify-content: flex-end;
  padding: 0 4px;
}

.ai-settings-textarea__count {
  font-size: 11px;
  color: var(--color-text-muted);
  transition: color 0.15s;
}

.ai-settings-textarea__count--warn {
  color: var(--color-warning, #d97706);
  font-weight: 600;
}

/* ── Info ─────────────────────────────────── */

.ai-settings-info {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-border) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border) 24%, transparent);
}

.ai-settings-info__icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--color-text-muted) 40%, transparent);
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 700;
  font-style: normal;
  flex-shrink: 0;
  margin-top: 1px;
}

.ai-settings-info__text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--color-text-muted);
}

/* ── Footer ─────────────────────────────────── */

.ai-settings-dialog__footer {
  display: flex;
  justify-content: flex-end;
  padding: 14px 24px 18px;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
  background: color-mix(in srgb, var(--color-surface) 96%, transparent);
  flex-shrink: 0;
}

/* ── Buttons ─────────────────────────────────── */

.ai-settings-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 22px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.ai-settings-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-settings-btn--primary {
  background: var(--color-primary);
  color: var(--color-primary-contrast, #fff);
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.ai-settings-btn--primary:hover:not(:disabled) {
  box-shadow: 0 4px 16px color-mix(in srgb, var(--color-primary) 30%, transparent);
  transform: translateY(-1px);
}

.ai-settings-btn--success {
  background: color-mix(in srgb, var(--color-success, #22c55e) 14%, var(--color-surface));
  color: var(--color-success, #22c55e);
  border-color: color-mix(in srgb, var(--color-success, #22c55e) 30%, transparent);
}

.ai-settings-btn__check {
  font-size: 14px;
  font-weight: 800;
}

/* ── Responsive ─────────────────────────────────── */

@media (max-width: 520px) {
  .ai-settings-dialog__header {
    padding: 16px 18px 14px;
  }

  .ai-settings-dialog__body {
    padding: 16px 18px;
  }

  .ai-settings-dialog__footer {
    padding: 12px 18px 16px;
  }

  .ai-settings-presets {
    grid-template-columns: 1fr;
  }

  .ai-settings-preset__desc {
    white-space: normal;
  }
}
.ai-settings-btn--distill {
  margin-top: 8px;
  font-size: 13px;
  padding: 5px 14px;
  border: 1px solid var(--color-primary, #1976d2);
  color: var(--color-primary, #1976d2);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.ai-settings-btn--distill:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary, #1976d2) 8%, transparent);
}
.ai-settings-btn--distill:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.ai-settings-distill {
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border, #e0e0e0);
  background: var(--color-bg-surface, #fafafa);
}
.ai-settings-distill__title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
}
.ai-settings-distill__list {
  margin: 0;
  padding: 0;
}
.ai-settings-distill__item {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 1.5;
}
.ai-settings-distill__label {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--color-text-secondary, #555);
  min-width: 100px;
}
.ai-settings-distill__value {
  margin: 0;
  color: var(--color-text, #333);
}
.ai-settings-distill__prompt-preview {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-light, #eee);
}
.ai-settings-distill__prompt-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted, #888);
  margin-bottom: 4px;
}
.ai-settings-distill__prompt-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text, #333);
}
.ai-settings-distill__actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
</style>
