# Novel Writing Assistant

当前版本是纯本地工作流：
- 前端：Vue + Vite
- 数据：浏览器本地存储
- AI：用户手动填写 `API Key / Base URL / Model`，前端直接调用模型

## 启动

```powershell
cd "D:\Novel writing\frontend"
npm run dev
```

默认地址：
- `http://localhost:5174`

## AI 使用方式

1. 打开应用右上角 `AI 设置`
2. 填写 `API Key`
3. 按需要补充 `Base URL` 和 `Model`
4. 在章节页点击 `AI 整理档案`

AI 会结合当前本地的角色、势力、物品、分类、伏笔和章节正文，给出新增、更新、关系和所属势力等建议，再由用户确认写回档案。

## 设计文档

- [docs/AI实体抽取设计方案.md](docs/AI实体抽取设计方案.md)
- [docs/认证后端设计方案.md](docs/认证后端设计方案.md)
