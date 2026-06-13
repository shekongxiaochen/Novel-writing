<template>
  <div class="conflict-panel">
    <div class="conflict-panel__header">
      <span class="conflict-panel__title">一致性检查</span>
      <span v-if="unresolvedCount > 0" class="conflict-panel__badge">{{ unresolvedCount }}</span>
    </div>

    <div v-if="(conflicts ?? []).length === 0 && !hasConsistencyIssues" class="conflict-panel__empty">
      暂无冲突或一致性问题
    </div>

    <div v-if="(conflicts ?? []).length > 0" class="conflict-panel__section">
      <div class="conflict-panel__section-title">档案冲突（{{ unresolvedCount }} 项待裁决）</div>
      <div
        v-for="item in unresolvedConflicts"
        :key="item.id"
        class="conflict-panel__item"
        :class="{ 'conflict-panel__item--error': item.severity === 'error' }"
      >
        <div class="conflict-panel__item-header">
          <span class="conflict-panel__entity-label">{{ item.entityLabel }}</span>
          <span class="conflict-panel__field-label">{{ fieldLabel(item.field) }}</span>
        </div>
        <div class="conflict-panel__values">
          <div class="conflict-panel__value">
            <span class="conflict-panel__value-label">现有：</span>
            <span class="conflict-panel__value-text">{{ item.existingValue }}</span>
            <span class="conflict-panel__source">（{{ item.existingSource }}）</span>
          </div>
          <div class="conflict-panel__value conflict-panel__value--incoming">
            <span class="conflict-panel__value-label">新值：</span>
            <span class="conflict-panel__value-text">{{ item.incomingValue }}</span>
            <span class="conflict-panel__source">（{{ item.incomingSource }}）</span>
          </div>
        </div>
        <div class="conflict-panel__actions">
          <button class="conflict-panel__btn" @click="onKeepExisting(item.id)">保留现有</button>
          <button class="conflict-panel__btn conflict-panel__btn--primary" @click="onAcceptIncoming(item.id)">采用新值</button>
          <button class="conflict-panel__btn" @click="onIgnore(item.id)">忽略</button>
        </div>
      </div>
    </div>

    <div v-if="hasConsistencyIssues" class="conflict-panel__section">
      <div class="conflict-panel__section-title">AI 一致性检查结果</div>
      <div v-for="(issue, idx) in allConsistencyIssues" :key="idx" class="conflict-panel__issue">
        <span class="conflict-panel__issue-severity" :class="`conflict-panel__issue-severity--${issue.severity}`">
          {{ severityLabel(issue.severity) }}
        </span>
        <span class="conflict-panel__issue-text">{{ issue.issue }}</span>
        <span v-if="issue.characterName" class="conflict-panel__issue-entity">（{{ issue.characterName }}）</span>
        <span v-if="issue.foreshadowTitle" class="conflict-panel__issue-entity">（{{ issue.foreshadowTitle }}）</span>
        <div v-if="issue.suggestion" class="conflict-panel__issue-suggestion">建议：{{ issue.suggestion }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ConflictItem } from '../../../lib/autoApply/conflictDetect'
import type { ConsistencyCheckResult, ConsistencyIssue } from '../../../lib/localAi'

const props = defineProps<{
  conflicts: ConflictItem[]
  consistencyResult: ConsistencyCheckResult | null
}>()

const emit = defineEmits<{
  resolve: [id: string, resolution: 'keep_existing' | 'accept_incoming' | 'ignored']
}>()

const unresolvedConflicts = computed(() => (props.conflicts ?? []).filter((c) => !c.resolved))
const unresolvedCount = computed(() => unresolvedConflicts.value.length)

const allConsistencyIssues = computed(() => {
  if (!props.consistencyResult) return []
  const r = props.consistencyResult
  return [
    ...(r.characterIssues ?? []),
    ...(r.timelineIssues ?? []),
    ...(r.foreshadowIssues ?? []),
    ...(r.settingIssues ?? []),
  ]
})

const hasConsistencyIssues = computed(() => allConsistencyIssues.value.length > 0)

const FIELD_LABELS: Record<string, string> = {
  age: '年龄',
  gender: '性别',
  goal: '目标',
  secret: '秘密',
  leader: '领袖',
  notes: '备注',
  summary: '描述',
  expectedFulfillChapterNo: '预期回收章节',
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

function severityLabel(severity: string): string {
  if (severity === 'error') return '错误'
  if (severity === 'warning') return '警告'
  return '提示'
}

function onKeepExisting(id: string): void {
  emit('resolve', id, 'keep_existing')
}

function onAcceptIncoming(id: string): void {
  emit('resolve', id, 'accept_incoming')
}

function onIgnore(id: string): void {
  emit('resolve', id, 'ignored')
}
</script>

<style scoped>
.conflict-panel {
  padding: 12px;
  font-size: 13px;
}
.conflict-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.conflict-panel__title {
  font-weight: 600;
  font-size: 14px;
}
.conflict-panel__badge {
  background: var(--color-danger, #e53935);
  color: #fff;
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 600;
}
.conflict-panel__empty {
  color: var(--color-text-muted, #888);
  text-align: center;
  padding: 24px 0;
}
.conflict-panel__section {
  margin-bottom: 16px;
}
.conflict-panel__section-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--color-text-secondary, #666);
}
.conflict-panel__item {
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
  background: var(--color-bg-surface, #fafafa);
}
.conflict-panel__item--error {
  border-color: var(--color-danger, #e53935);
  background: var(--color-danger-bg, #fff5f5);
}
.conflict-panel__item-header {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 6px;
}
.conflict-panel__entity-label {
  font-weight: 600;
}
.conflict-panel__field-label {
  color: var(--color-text-muted, #888);
  font-size: 12px;
}
.conflict-panel__values {
  margin-bottom: 8px;
}
.conflict-panel__value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 3px;
  line-height: 1.4;
}
.conflict-panel__value--incoming {
  color: var(--color-primary, #1976d2);
}
.conflict-panel__value-label {
  font-size: 12px;
  color: var(--color-text-muted, #888);
  flex-shrink: 0;
}
.conflict-panel__value-text {
  word-break: break-all;
}
.conflict-panel__source {
  font-size: 11px;
  color: var(--color-text-muted, #aaa);
}
.conflict-panel__actions {
  display: flex;
  gap: 6px;
}
.conflict-panel__btn {
  font-size: 12px;
  padding: 3px 8px;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 4px;
  background: var(--color-bg, #fff);
  cursor: pointer;
}
.conflict-panel__btn:hover {
  background: var(--color-bg-hover, #f0f0f0);
}
.conflict-panel__btn--primary {
  background: var(--color-primary, #1976d2);
  color: #fff;
  border-color: var(--color-primary, #1976d2);
}
.conflict-panel__btn--primary:hover {
  opacity: 0.9;
}
.conflict-panel__issue {
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border-light, #eee);
  line-height: 1.5;
}
.conflict-panel__issue:last-child {
  border-bottom: none;
}
.conflict-panel__issue-severity {
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 3px;
  margin-right: 6px;
}
.conflict-panel__issue-severity--error {
  background: var(--color-danger-bg, #ffebee);
  color: var(--color-danger, #c62828);
}
.conflict-panel__issue-severity--warning {
  background: var(--color-warning-bg, #fff8e1);
  color: var(--color-warning, #f57c00);
}
.conflict-panel__issue-severity--info {
  background: var(--color-info-bg, #e3f2fd);
  color: var(--color-info, #1565c0);
}
.conflict-panel__issue-text {
  font-size: 13px;
}
.conflict-panel__issue-entity {
  color: var(--color-text-muted, #888);
  font-size: 12px;
}
.conflict-panel__issue-suggestion {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary, #666);
}
</style>
