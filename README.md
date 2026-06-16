# Lumen 流明

面向中长篇小说创作的桌面写作工具。本地优先存储，内置可深度参与创作流程的 AI 助手，帮助你管理大纲、角色、势力、伏笔与正文之间错综复杂的关系。

**Lumen** is an open-source desktop novel writing tool designed for creative writers. Local-first storage with built-in AI writing assistant. Manage your plots, characters, factions, foreshadowing, and narrative structure with ease.

- **Desktop App**: Built with Tauri 2, supports Windows / Linux / macOS
- **Frontend**: Vue 3 + Vite + TypeScript
- **Backend** (optional): Rust + Axum, for accounts & cloud sync only
- **AI**: Bring your own API Key (OpenAI-compatible), data never leaves your configured endpoint

> Repository: <https://github.com/shekongxiaochen/Novel-writing>

---

## Features

### Writing & Organization
- Multi-novel management with metadata (genre, narrative perspective, tone, multi-line narrative)
- Volume / Act / Chapter / Scene hierarchical structure
- Rich text editor with word count & writing progress tracking
- Automatic highlighting of characters, factions, items, and foreshadowing in text

### World-building Database
- **Characters**: Profiles, relationship graphs, state changes across chapters
- **Factions / Organizations**: Profiles and inter-faction relationship maps
- **Items**, **Categories**, **World-building** entries
- **Foreshadowing**: Setup and payoff tracking
- Cross-references between world-building and chapters/outlines

### Outline Board
- Kanban-style hierarchy: Volume → Act → Chapter → Scene, with drag-and-drop
- Vertical list view and mind map view

### AI Writing Assistant
- **Continue Writing / Rewrite**: Streaming generation with context-aware character, faction, and foreshadowing injection
- **AI Entity Extraction**: Identify characters, factions, items, relationships from text
- **Consistency Check**: Detect conflicts in character traits, timeline, foreshadowing, and settings
- **Outline Design**: Interview-style multi-scheme outline generation
- **World-building Generation**: Interview-style world-building draft creation
- **Style Analysis**: Extract narrative patterns from sample text
- **Chapter Summary / Classification / Arc Summary**
- **AI Chat with Tool Calling**: AI can propose data changes, you approve in sidebar

### Data & Sync
- Local-first: all data stored locally, works offline
- Optional cloud sync via self-hosted Rust backend

---

## Download

Download the latest installer from the [Releases](https://github.com/shekongxiaochen/Novel-writing/releases) page.

| Platform | Package |
|----------|---------|
| Windows | `.exe` (NSIS installer) |
| Linux | `.AppImage` / `.deb` |
| macOS | `.dmg` (Apple Silicon & Intel) |

After installation, configure your AI provider with API Key / Base URL / Model in the app settings to enable AI features. No backend server is required for local writing.

---

## Build from Source

### Prerequisites
- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/tools/install) stable toolchain
- Tauri [system dependencies](https://tauri.app/start/prerequisites/) for your platform

### Development

```bash
cd frontend
npm install

# Web frontend only (browser, port 5174)
npm run dev

# Desktop app dev mode (Tauri window)
npm run tauri:dev
```

### Package

```bash
cd frontend
npm run tauri:build
```

Artifacts will be at `frontend/src-tauri/target/release/bundle/`.

Multi-platform builds are automated via GitHub Actions: push a `v*` tag (e.g. `v1.0.0`) or manually trigger the `Build All Platforms` workflow.

---

## Backend (Optional)

The backend is only needed for **account & cloud sync**. Local writing works without it.

- Stack: Rust + Axum + SeaORM, requires MySQL & Redis
- Default port: `8080`
- Configure `VITE_API_BASE_URL` in `frontend/.env.local` to point to your backend

See [backend/README.md](backend/README.md) and [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) for setup and deployment.

---

## License

This project is open source. See the repository for details.
