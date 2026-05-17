# AI实体抽取设计方案

## 1. 当前目标

当前版本不再依赖登录、注册、作品云端同步或后端快照。

AI 的工作方式改为：

1. 用户在前端手动填写 `API Key / Base URL / Model`
2. 前端直接读取本地作品数据
3. 前端把章节正文、角色、势力、物品、分类、伏笔等上下文整理后发送给模型
4. 模型返回“新增 / 更新 / 疑似重复 / 冲突待确认”建议
5. 用户逐条确认
6. 前端把确认结果直接写回本地档案

## 2. 数据来源

AI 仅使用当前本地工作区中的数据：

- 章节
- 角色
- 势力
- 物品
- 分类
- 伏笔
- 人物关系
- 角色所属势力

这些数据由前端通过 `buildNovelWorkspacePayload` 组装成上下文快照，但这个快照只在前端内存里使用，不会再保存到后端。

## 3. AI 入口

目前有两个入口：

1. `AI 整理档案`
用途：基于当前章节 / 最近章节 / 全书章节，整理实体建议

2. 大纲 AI 补全
用途：补全大纲项里的冲突、转折、悬念

两者都共用同一套本地 AI 设置。

## 4. AI 设置

前端提供统一的 `AI 设置` 弹窗，保存以下字段到本地存储：

- `apiKey`
- `baseUrl`
- `model`

默认值可以指向 OpenAI 兼容接口，也可以由用户自行替换为任意兼容服务。

## 5. 实体建议结构

当前建议结果分为这些部分：

- `characters`
- `factions`
- `items`
- `memberships`
- `relations`
- `warnings`

其中每条建议都带：

- `confidence`
- `match.type`
- `match.targetId`
- `match.targetName`
- `evidences`
- `warnings`

`match.type` 目前分为：

- `new`
- `update`
- `possible_duplicate`
- `conflict`

## 6. 匹配原则

前端在拿到模型结果后，会继续做一层本地匹配：

### 角色

- 同名优先视为 `update`
- 命中别名时视为 `possible_duplicate`
- 性别等关键字段明显冲突时标为 `conflict`

### 势力

- 同名优先视为 `update`
- 高相似度名称视为 `possible_duplicate`
- 首领信息明显冲突时标为 `conflict`

### 物品

- 同名优先视为 `update`
- 高相似度名称视为 `possible_duplicate`

### 关系 / 所属势力

- 若本地已存在相同关联，则视为 `update`
- 若核心关系冲突，则标为 `conflict`

## 7. 用户确认后的写回规则

### 新建

直接创建本地档案：

- 新角色
- 新势力
- 新物品
- 新人物关系
- 新所属势力

### 合并

采用保守策略，只补充信息，不强行覆盖已有档案：

- 角色：补空字段，合并别名，首登章取更早值
- 势力：补 `leader`、`notes`
- 物品：补 `summary`，仅在归属为空时补归属
- 所属势力 / 关系：补说明字段，不强改核心关系

### 忽略

仅从当前建议面板移除，不修改档案。

## 8. 伏笔与分类的定位

这一版里，分类与伏笔已经作为 AI 上下文输入的一部分，用于帮助模型理解小说现状。

当前落地状态：

- 分类：参与上下文理解
- 伏笔：参与上下文理解，并可在 `warnings` 中提示“本章可能呼应某条伏笔”

下一步可继续增强为：

- 直接产出“建议新增分类”
- 直接产出“某段正文对应某条伏笔”的结构化建议
- 用户确认后自动创建或补充伏笔照应记录

## 9. 当前实现文件

主要实现位于：

- [frontend/src/lib/aiSettings.ts](</abs/path/D:/Novel writing/frontend/src/lib/aiSettings.ts>)
- [frontend/src/lib/localAi.ts](</abs/path/D:/Novel writing/frontend/src/lib/localAi.ts>)
- [frontend/src/components/AiSettingsDialog.vue](</abs/path/D:/Novel writing/frontend/src/components/AiSettingsDialog.vue>)
- [frontend/src/views/chapter-hub/NovelChapterHubView.vue](</abs/path/D:/Novel writing/frontend/src/views/chapter-hub/NovelChapterHubView.vue>)
- [frontend/src/views/chapter-hub/components/ChapterHubAiEntityPanel.vue](</abs/path/D:/Novel writing/frontend/src/views/chapter-hub/components/ChapterHubAiEntityPanel.vue>)

## 10. 后续建议

优先级最高的下一步有两项：

1. 批量确认建议
2. 伏笔照应的结构化建议与一键写回
