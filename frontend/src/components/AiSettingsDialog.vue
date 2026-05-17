<template>
  <div
    v-if="inline || open"
    class="ai-settings-dialog"
    :class="{ 'ai-settings-dialog--inline': inline }"
    role="dialog"
    aria-modal="false"
  >
    <div class="ai-settings-dialog__body">
      <div class="ai-settings-dialog__head">
        <div>
          <p class="ai-settings-dialog__eyebrow">Model Control Room</p>
          <h3 class="confirm-dialog__title">模型控制室</h3>
          <p class="muted ai-settings-dialog__sub">把 API Key、接口地址和模型名保存成当前设备浏览器里的统一写作配置。</p>
        </div>
        <button
          v-if="!inline"
          type="button"
          class="ai-settings-dialog__close"
          aria-label="关闭 AI 设置"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>

      <section class="ai-settings-dialog__preset-card">
        <div>
          <strong>服务商预设</strong>
          <p class="muted">先选择兼容接口，再确认模型名；保存后大纲补全、章节分析、档案整理都会复用。</p>
        </div>
        <div class="ai-settings-dialog__preset-grid">
          <button
            v-for="preset in presets"
            :key="preset.key"
            type="button"
            class="ai-settings-dialog__provider-card"
            @click="applyPreset(preset.key)"
          >
            <span class="ai-settings-dialog__provider-kicker">{{ preset.kicker }}</span>
            <strong>{{ preset.label }}</strong>
            <small>{{ preset.baseUrl }}</small>
            <span class="ai-settings-dialog__provider-model">默认模型：{{ preset.model }}</span>
            <span class="ai-settings-dialog__provider-action">套用预设</span>
          </button>
        </div>
      </section>

      <div class="ai-settings-dialog__field-grid">
        <label class="ai-settings-dialog__field ai-settings-dialog__field--wide">
          <span class="ai-settings-dialog__label">API Key</span>
          <input v-model="draft.apiKey" type="password" placeholder="输入你的 API Key" />
          <small>只保存在本地浏览器，用于当前设备的 AI 功能调用。</small>
        </label>

        <label class="ai-settings-dialog__field ai-settings-dialog__field--wide">
          <span class="ai-settings-dialog__label">Base URL</span>
          <input v-model="draft.baseUrl" type="text" placeholder="例如：https://api.deepseek.com/chat/completions" />
          <small>当前项目这里填写的是完整请求地址，不是服务根域名。</small>
        </label>

        <label class="ai-settings-dialog__field">
          <span class="ai-settings-dialog__label">Model</span>
          <input v-model="draft.model" type="text" placeholder="例如：deepseek-chat" />
          <small>建议填你实际开通的模型名，测试连接会直接拿它验证。</small>
        </label>

        <div class="ai-settings-dialog__hint">
          <span class="ai-settings-dialog__hint-kicker">复用范围</span>
          <p>这里是前端本地配置：写作助手、AI 阅读台、档案整理会读取它；后端环境变量配置不在此处同步。</p>
        </div>
      </div>

      <div class="ai-settings-dialog__footer-shell">
        <p
          v-if="statusNote"
          class="ai-settings-dialog__status"
          :class="{
            'ai-settings-dialog__status--error': statusKind === 'error',
            'ai-settings-dialog__status--success': statusKind === 'success',
          }"
        >
          {{ statusNote }}
        </p>

        <div class="confirm-dialog__actions ai-settings-dialog__footer">
          <button
            v-if="!inline"
            type="button"
            class="confirm-dialog__btn confirm-dialog__btn--secondary"
            @click="$emit('close')"
          >
            关闭
          </button>
          <button
            type="button"
            class="confirm-dialog__btn confirm-dialog__btn--secondary"
            :disabled="isTesting"
            @click="handleTestConnection"
          >
            {{ isTesting ? '测试中...' : '测试连接' }}
          </button>
          <button type="button" class="btn-primary" @click="save">保存设置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { getAiSettings, saveAiSettings, testAiConnection } from '../lib/aiSettings'

type PresetKey = 'deepseek' | 'dashscope' | 'openai-compatible'

type Preset = {
  key: PresetKey
  label: string
  kicker: string
  baseUrl: string
  model: string
}

const presets: Preset[] = [
  {
    key: 'deepseek',
    label: 'DeepSeek',
    kicker: 'CN Compatible',
    baseUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
  },
  {
    key: 'dashscope',
    label: 'DashScope',
    kicker: 'Qwen Compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-plus',
  },
  {
    key: 'openai-compatible',
    label: 'OpenAI Compatible',
    kicker: 'Generic Endpoint',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4.1-mini',
  },
]

const props = withDefaults(
  defineProps<{
    open?: boolean
    inline?: boolean
  }>(),
  {
    open: false,
    inline: false,
  },
)

const emit = defineEmits<{ close: [] }>()

const draft = reactive(getAiSettings())
const statusNote = ref('')
const statusKind = ref<'idle' | 'success' | 'error'>('idle')
const isTesting = ref(false)

function loadDraft(): void {
  Object.assign(draft, getAiSettings())
  statusNote.value = ''
  statusKind.value = 'idle'
}

function applyPreset(type: PresetKey): void {
  const preset = presets.find((row) => row.key === type)
  if (!preset) return
  draft.baseUrl = preset.baseUrl
  if (!draft.model.trim()) draft.model = preset.model
  statusNote.value = `已套用 ${preset.label} 预设。`
  statusKind.value = 'success'
}

watch(
  () => props.open,
  (open) => {
    if (!open && !props.inline) return
    loadDraft()
  },
)

watch(
  () => props.inline,
  (inline) => {
    if (!inline) return
    loadDraft()
  },
  { immediate: true },
)

function save(): void {
  saveAiSettings(draft)
  statusNote.value = '已保存。之后前端 AI 功能会直接使用这组设置。'
  statusKind.value = 'success'
  if (props.inline) return
  window.setTimeout(() => {
    emit('close')
  }, 250)
}

async function handleTestConnection(): Promise<void> {
  isTesting.value = true
  statusNote.value = ''
  statusKind.value = 'idle'
  const result = await testAiConnection(draft)
  statusNote.value = result.message
  statusKind.value = result.ok ? 'success' : 'error'
  isTesting.value = false
}
</script>
