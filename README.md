# Lumen 流明

面向中长篇小说创作的桌面写作工具。本地优先存储，内置可深度参与创作流程的 AI 助手，帮助你管理大纲、角色、势力、伏笔与正文之间错综复杂的关系。

- **桌面应用**：基于 Tauri 2，支持 Windows / Linux / macOS
- **前端**：Vue 3 + Vite
- **后端**（可选）：Rust + Axum，仅用于账号与云同步；不登录也能完整本地使用
- **AI**：自带钥匙模式，由你自行配置 `API Key / Base URL / Model`，数据不经过第三方中转

> 仓库：<https://github.com/shekongxiaochen/Novel-writing>

---

## 功能概览

### 写作与组织
- 多作品管理，作品元数据（题材、叙事视角、基调、多线叙事等）
- 卷 / 幕 / 章 / 场景的层级结构，多标签页同时编辑章节
- 正文编辑器，章节字数与写作进度统计
- 正文中自动高亮角色、势力、物品与伏笔，点击可跳转对应档案

### 设定库
- **角色**：档案、关系网、随章节推进的状态变化记录
- **势力 / 组织**：档案与势力关系网
- **物品**、**分类**、**世界观**设定条目
- **伏笔**：埋设点与回收点追踪
- 设定与章节、大纲的引用关联，减少"吃书"

### 大纲看板
- 卷 → 幕 → 章 → 场景的层级看板，支持拖拽排序
- 另有纵向列表视图与思维导图视图

### AI 助手
> 以下能力均结合你的本地设定库与正文上下文工作，改动需经你确认后才写回。

- **续写 / 重写**：流式生成，自动注入相关角色、势力、伏笔等上下文
- **AI 整理（实体抽取）**：从正文中识别角色、势力、物品、关系、所属、大纲条目，给出新增 / 更新建议
- **一致性检查**：检测人设、时间线、伏笔、设定冲突，并可生成修复方案
- **大纲设计与回写**：访谈式生成多套大纲方案、骨架展开、根据已写正文动态修订未写节点
- **世界观生成**：访谈式生成世界观草稿
- **风格分析**：粘贴一段范文，AI 提炼其叙事节奏、句式、修辞等特征，生成可复用的风格指令
- **章节总结 / 分类 / 弧线摘要 / 全书连续性摘要**
- **AI 问答 + 工具调用**：对话中 AI 可直接提议修改数据，由你在侧边栏确认

### 数据与同步
- 本地优先：数据存于本机，离线可用
- 可选云同步：登录账号后，将作品快照、角色状态等推送 / 拉取至自建 Rust 后端

---

## 下载安装

从 [Releases](https://github.com/shekongxiaochen/Novel-writing/releases) 页面下载对应平台的安装包：

| 平台 | 安装包 |
|------|--------|
| Windows | `.exe`（NSIS 安装程序） |
| Linux | `.AppImage` / `.deb` |
| macOS | `.dmg`（Apple Silicon 与 Intel 分别提供） |

安装后首次使用，在应用内 **AI 设置** 中填写你的 `API Key`（按需补充 `Base URL` 和 `Model`）即可启用 AI 功能。无需后端服务也能本地写作。

---

## 从源码构建

### 环境要求
- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/tools/install) 稳定版工具链
- Tauri 各平台的[系统依赖](https://tauri.app/start/prerequisites/)

### 本地开发

```bash
cd frontend
npm install

# 仅 Web 前端调试（浏览器，端口 5174）
npm run dev

# 桌面应用开发模式（Tauri 窗口）
npm run tauri:dev
```

### 打包桌面应用

```bash
cd frontend
npm run tauri:build
```

产物位于 `frontend/src-tauri/target/release/bundle/`。

多平台安装包通过 GitHub Actions 自动构建：推送 `v*` 标签（如 `v1.0.0`）或手动触发 `Build All Platforms` 工作流，即可产出 Windows / Linux / macOS 安装包。详见 [.github/workflows/build-all.yml](.github/workflows/build-all.yml)。

---

## 后端（可选）

后端仅在需要**账号与云同步**时使用，本地写作无需启动。

- 技术栈：Rust + Axum + SeaORM，依赖 MySQL 与 Redis
- 默认端口：`8080`
- 前端通过 `frontend/.env.local` 的 `VITE_API_BASE_URL` 指向后端地址

启动与部署详见 [backend/README.md](backend/README.md) 与 [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md)。

---

## 文档

- [功能总表](功能总表.md) — 产品范围与模块一览
- [docs/AI实体抽取设计方案.md](docs/AI实体抽取设计方案.md)
- [docs/AI续写功能设计方案.md](docs/AI续写功能设计方案.md)
- [docs/认证后端设计方案.md](docs/认证后端设计方案.md)
