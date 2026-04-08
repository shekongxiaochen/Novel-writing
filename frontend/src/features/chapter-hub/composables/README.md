# `features/chapter-hub/composables/`

**章节写作用组合式函数**：作品与章节数据加载（`useChapterHubData`）、稿纸/顶栏 DOM 引用与顶栏锚点（`useChapterHubDomRefs`）、名称补全、选区右键菜单、实体悬停提示、删除章节确认、章节字段变更、正文键盘与窗口监听（`useChapterHubTextareaEditor`）、跳转工作台（`useChapterHubWorkspaceNav`）等。视图层只负责传 ref/computed 与绑定事件。
