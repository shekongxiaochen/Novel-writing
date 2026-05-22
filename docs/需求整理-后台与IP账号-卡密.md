# 需求整理：管理后台、设备账号、聚发货卡密

> 基于当前对话整理，供后续分阶段实现。与现有 `docs/认证后端设计方案.md`（邮箱注册）**方向不同**，以本文件为准做「认证方案切换」。  
> **已确认决策**见 §7；**设备绑定**（非 IP）见 §2。

---

## 7. 已确认决策（2026-05-22）

| # | 问题 | 你的决定 |
|---|------|----------|
| 1 | 额度单位 | **按 token 计费**；接入模型为 **DeepSeek V4 Flash**（实现时以实际 API 模型 ID 为准） |
| 2 | 卡密面额 | **1 / 3 / 5 / 10 / 50 / 100 元** 六档；兑换后按档位折算为 token 入账 |
| 3 | 注册限制 | **一设备一账号**（客户端上报稳定 **设备_id**，类似机器码）；**登录不限制设备/IP**，账号+密码正确即可 |
| 4 | 改密码 | **不允许**用户改密码；丢失只能走运营/未来找回流程（一期不做） |
| 5 | 聚发货对接 | **暂缓**（你尚未研究聚发货）；方向仍为方式 B，实现排在卡密流程之后 |
| 6 | 旧数据 | **清空**测试库，从设备账号 + token 钱包重做（不迁移邮箱用户） |
| 7 | **消耗倍率** | 后台**全局**控制**扣余额的速度**，不是充值多给 token；**×1 = 按真实用量扣**；**×2 = 真实成本 n 元，从余额扣等价 2n 元** |
| 8 | AI 配置 | **仅管理后台**可改模型/单价/倍率等；**密钥与真实 API 信息不得对用户端或公开 API 泄露** |
| 9 | 消耗倍率对用户 | **完全不显示**：客户端、用户 API、流水详情均不出现倍率、费率、真实单价；用户仅看到余额变化与「额度不足」等业务提示 |

### 钱包与充值入账（无消耗倍率）

钱包余额存 **剩余 token 数**（建议整数）。卡密六档面额：**1 / 3 / 5 / 10 / 50 / 100 元**（聚发货暂缓，入账规则先定死）。

**充值入账（兑卡 / 人工补额，与倍率无关）**：

```text
tokens_granted = floor(face_value_yuan × tokens_per_yuan_base)
```

- `tokens_per_yuan_base`：每 1 元人民币对应多少 wallet token（按 DeepSeek V4 Flash 成本与毛利反算，**后台可改**）。
- 充值**不**乘消耗倍率；用户买 10 元卡就按上式固定入账。

### 消耗倍率（扣费速度，核心）

倍率作用在 **每次 AI 调用扣减余额**，控制用户余额被吃掉的速度。

**×1（原价扣费）**：按本次调用的**真实 token 用量**（及后台定价规则）扣 wallet。

**×2 示例**：若本次调用按成本折算的「真实价格」为 **n 元**（或等价 token 数 `T`），则从用户余额扣除 **2n 元等价 token**（即 `2 × T`）。

```text
usage_tokens = prompt_tokens + completion_tokens   -- DeepSeek 返回的 usage

-- ×1 时从钱包扣的 token 数（示意，具体可按输入/输出单价加权）
base_deduct = bill_tokens(usage_tokens, ai_pricing_config)

tokens_deducted = floor(base_deduct × consumption_multiplier)
```

| 倍率 | 含义 |
|------|------|
| `1.0` | **×1**：扣费 = 真实用量对应额度 |
| `2.0` | **×2**：真实成本 n，**实际扣 2n**（余额掉得更快） |
| `0.5` | 促销：真实 n，只扣 0.5n（余额更耐用） |

- 配置项 `consumption_multiplier` 在 **`system_settings`**，管理后台「AI / 计费配置」**一次性全局修改**，对**之后**的 AI 扣费立即生效。
- 每条 `ai_wallet_ledger`（`reason=ai_call`）建议保存 `consumption_multiplier_applied` 快照，便于对账。
- **与充值无关**：改倍率不改变已入账余额，只改变后续每次调用的扣减量。

### AI 配置与安全（仅后台）

| 原则 | 说明 |
|------|------|
| **客户端只调本后端** | 写作端 **禁止**直连 DeepSeek；所有推理经服务端代理 |
| **密钥不进客户端** | `DEEPSEEK_API_KEY` 等只放服务端 `.env` 或加密存储；**永不**出现在用户 API 响应、前端 bundle、错误堆栈 |
| **后台可配、用户不可见** | 模型 ID、输入/输出单价、`tokens_per_yuan_base`、`consumption_multiplier` 在 **axum-admin** 维护 |
| **密钥展示** | 后台若需改 Key：仅「已设置 / 未设置」或掩码 `sk-…xxxx`；保存时写入，**列表/详情不回显完整 Key** |
| **公开 API 白名单** | 用户侧只返回：`balance_tokens`、扣费后余额、业务错误码；**不返回** API Key、上游 URL、成本明细、**消耗倍率**、单价、单次 `base_deduct` |
| **对用户 UI** | **完全不显示**倍率/费率；流水只展示「消费」「充值」等中性文案与 `delta`，不解释扣费公式 |
| **日志与 Webhook** | 禁止打印完整 Key、完整上游请求体；运维日志脱敏 |

后台建议字段（存 `system_settings` 或 `ai_provider_config` 表，实现时再定）：

- `deepseek_model`（如 V4 Flash 的 model id）
- `price_per_1m_input_tokens` / `price_per_1m_output_tokens`（或统一折算进 `bill_tokens`）
- `tokens_per_yuan_base`
- `consumption_multiplier`
- API Key：**仅环境变量**或后台「写入一次」加密字段，**不可通过用户 JWT 访问的管理接口以外导出**

---

## 1. 产品边界（你的结论 + 建议固化）

### 1.1 不需要放进管理后台的

| 数据 | 存放位置 | 谁操作 |
|------|----------|--------|
| 小说元数据 `novels` | 服务器 MySQL | **仅用户**（写作客户端 API） |
| 作品正文/快照 `novel_snapshots` 等 | 服务器 MySQL | **仅用户** |
| 章节、角色、设定等创作数据 | 服务器 MySQL | **仅用户** |

管理后台**不提供**增删改小说、编辑章节。运维只需保证：用户登录后能通过自己的 `user_id` 加载数据。

**现状**：axum-admin 已注册「小说」「应用用户」菜单 → 后续应从后台**移除小说 CRUD**（保留只读审计可选，见下）。

### 1.2 需要服务器保证的（非后台日常操作）

- 用户身份（**设备 ID** 绑定注册，一设备一账号）
- 登录会话（`user_sessions` + Redis）
- AI 额度账户（余额、流水）
- 卡密兑换记录（与聚发货对齐）

### 1.3 管理后台真正要管的

| 能力 | 目的 |
|------|------|
| **运营观测** | 用户数、活跃、兑换量、异常设备 |
| **AI 额度与卡密** | 核对聚发货发卡、处理兑换失败、人工补额（慎用） |
| **账号风控** | 封禁设备/账号、查看登录与兑换日志 |
| **系统配置** | AI 模型/单价、消耗倍率、`tokens_per_yuan_base`（密钥仅服务端，见 §7） |
| **聚发货（暂缓）** | Webhook、卡库等 **待你研究后再做** |
| **后台自身账号** | `auth_users`（已有 axum-admin） |

---

## 2. 用户账号：按设备 ID 分配（一设备一账号）

> 你说的「IP」实际含义是 **机器码 / 设备指纹**：同一台设备只能注册一次；**登录不绑设备**，任意网络下账号+密码即可。

### 2.1 行为定义

```text
客户端首次启动 → 生成并本地持久化 device_id（UUID 或硬件指纹哈希）

用户点击「注册」
  ├─ 该 device_id 从未分配过账号 → 系统生成 username + password，一次性展示，提示保存
  └─ 该 device_id 已有账号           → 409，前端只显示「登录」

用户点击「登录」
  └─ username + password（不校验 device_id、不校验 IP）

改密码：不提供（一期）
```

### 2.2 客户端 device_id（写作软件）

| 要求 | 说明 |
|------|------|
| 稳定性 | 重装软件前尽量不变；存 `localStorage` / 应用数据目录 |
| 格式 | 建议 `dev_` + UUID v4，或平台 API 指纹后 SHA256 |
| 上报 | 注册、可选 `device-status` 时放在 header `X-Device-Id` 或 body |
| 防伪造 | 无法 100% 防虚拟机多开；一期接受；后续可加签名/证书 |

**不要用公网 IP 做唯一键**（NAT、换网会误伤）；IP 仅作审计字段可选记录。

### 2.3 数据模型（建议）

| 表/字段 | 说明 |
|---------|------|
| `users.device_id_hash` | 注册设备 ID 的 SHA256，**UNIQUE** |
| `users.username` | 系统分配，唯一 |
| `users.password_hash` | 随机密码，不可改 |
| `users.registration_ip` | 可选，审计用，**不 UNIQUE** |
| `users.email` | 废弃或留空 |

清空库后：`email`、`email_verified` 等邮箱字段可删或忽略。

### 2.4 API（草案）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/auth/device-status` | Header `X-Device-Id` → `{ has_account, username? }` |
| POST | `/auth/register-by-device` | 需 `X-Device-Id`；返回 `{ username, password }` **仅此一次** |
| POST | `/auth/login` | `{ username, password }` |
| GET | `/auth/me` | 用户 + `wallet_balance_tokens` |
| POST | `/auth/logout` | 作废会话 |

### 2.5 风险（已知）

| 问题 | 说明 |
|------|------|
| 用户删本地数据 | 会生成新 device_id → 可能再注册一个新号；一期接受，或提示「重装即视为新设备」 |
| 多开虚拟机 | 可能多账号；后期可加设备证书 |
| 密码丢失 | 无改密；需客服后台重置或发新号（一期可不做重置） |

---

## 3. AI 功能：钱包、扣费、卡密（聚发货暂缓）

### 3.1 商业模式（目标态）

- 用户在 **聚发货** 购买卡密 → 软件内兑换 → **入账 token**（六档 1–100 元）。
- 使用 AI 时：后端代调 DeepSeek → 按 usage **扣余额**；扣减量 × **`consumption_multiplier`**（§7）。

**当前**：聚发货相关 **不实现**，你先研究平台；一期可 **后台人工调账** 测钱包与扣费。

### 3.2 数据模型（建议新增，先不含聚发货表）

```text
system_settings
  key (PK)           -- tokens_per_yuan_base | consumption_multiplier | deepseek_model | ...
  value
  updated_at

ai_wallets
  user_id (PK/FK)
  balance_tokens
  updated_at

ai_wallet_ledger
  id, user_id, delta, reason   -- redeem | ai_call | admin_adjust
  ref_id
  consumption_multiplier_applied   -- 仅 ai_call 时填
  created_at

card_redemptions / jufahuo_cards / webhook_events
  → 聚发货阶段再建（方式 B 设计保留在 §3.4 附录）
```

现有表 `ai_subscriptions` / `payment_orders` **逐步废弃**；计费以 `ai_wallets` 为准。

### 3.3 用户侧 API（一期可做）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/billing/wallet` | 仅 `balance_tokens`（不暴露倍率/单价/Key） |
| GET | `/billing/ledger` | 用户流水：**不得**含 `consumption_multiplier_applied`、单价、上游 model 等字段 |
| POST | `/ai/...` | 写作 AI 代理（服务端持 Key，扣费后返回生成结果） |
| POST | `/billing/redeem` | **聚发货就绪后再开** |

**AI 调用扣费流程**：

1. 读 `consumption_multiplier`、定价配置。
2. 调 DeepSeek（服务端 Key）。
3. `base_deduct = bill_tokens(usage)` → `tokens_deducted = floor(base_deduct × multiplier)`。
4. 余额不足则拒绝；成功则扣 wallet + 写 ledger（带倍率快照）。

### 3.4 附录：聚发货方式 B（暂缓，设计保留）

> **状态：未开始**。聚发货不提供验卡 API，将来采用 Webhook 同步卡库 + 本地 `POST /billing/redeem`。  
> 入账公式仍为 `tokens_granted = face_value × tokens_per_yuan_base`（**不用**消耗倍率）。  
> 待你提供 Webhook 文档后再写 `POST /webhooks/jufahuo` 与 `jufahuo_cards` 表。

---

## 4. 管理后台应保留/新增什么

### 4.1 建议移除（与你的产品观一致）

- ~~小说 `novels` 增删改~~
- ~~支付订单 `payment_orders` 手工改状态~~（除非短期兼容旧 mock）

可选保留 **只读**：

- 用户列表：看 `registration_ip`、注册时间、是否封禁
- 小说列表：**只读**，仅供客服查「用户是否有数据」（无编辑按钮）

### 4.2 建议新增菜单

| 模块 | 功能 |
|------|------|
| **用户与设备** | 列表、device_id 哈希、封禁、查看 AI token 余额 |
| **AI 额度** | 按用户查 wallet、ledger；人工调账（需二次确认+审计日志） |
| **AI / 计费配置（核心）** | `consumption_multiplier`（×1=按真实用量扣）、`tokens_per_yuan_base`、模型与单价；**API Key 掩码/仅写入** |
| **卡密兑换记录** | 聚发货上线后再开 |
| **仪表盘** | 用户数、今日 AI 扣费 token、当前消耗倍率（运营可见，用户不可见） |

### 4.3 不需要在后台做的

- 编辑小说内容、快照 JSON
- 代替用户登录写作端
- 在后台批量生成卡密（交给聚发货）

---

## 5. 与现状差距（实现清单）

### 5.1 已有

- Rust 后端：认证（邮箱版）、小说 CRUD、Redis、MySQL
- axum-admin：用户/小说/支付订单（需收缩）
- 库表：`users`、`novels`、`ai_subscriptions`、`payment_orders`
- 前端：本地 `localStorage` 假登录，**未接后端**

### 5.2 未做 / 需重做

| 项 | 优先级建议 |
|----|------------|
| 认证改为设备 ID 分配账号 | **P0** |
| 前端接真实登录/注册 API | **P0** |
| `ai_wallets` + ledger | **P1** |
| `system_settings` + **消耗倍率** + 后台 AI 配置页（密钥不泄露） | **P1** |
| AI 代理调用 + **按倍率扣费** | **P1** |
| 聚发货 Webhook + redeem | **暂缓** |
| 管理后台裁剪 + 运营模块 | **P2** |
| 废弃邮箱验证码注册流程 | P2（可保留代码开关） |

---

## 6. 推荐实施阶段

### 阶段 A：账号与数据归属（2–3 周量级，视人力）

1. **清空** `users` 等测试数据；表结构加 `device_id_hash`、username 唯一
2. API：`device-status`、`register-by-device`、login；客户端持久化 `device_id`
3. 前端：注册/登录对接；首次注册展示「请保存账号密码」
4. 管理后台：去掉小说写操作；用户表显示 device_id 哈希前缀

### 阶段 B：钱包 + AI 扣费 + 后台配置（无聚发货）

1. `system_settings`：`tokens_per_yuan_base`、`consumption_multiplier`、模型/单价
2. `ai_wallets`、ledger；后台 **AI 配置页**（Key 掩码，用户 API 不暴露）
3. DeepSeek **服务端代理** + 扣费（`base_deduct × consumption_multiplier`）
4. 前端：仅余额与中性流水；**禁止**任何倍率/费率文案；激活码页 **占位或隐藏**

### 阶段 B′：聚发货（你研究完后）

1. `jufahuo_cards` + Webhook + `POST /billing/redeem`
2. 后台：兑换记录、Webhook 日志、卡库只读

### 阶段 C：运维与风控

1. 仪表盘、限流、备份

### 阶段 D：上线与风控

1. ECS + 反代取真实 IP
2. 兑换限流（同 IP/同用户）
3. 备份与监控

---

## 8. 仍待补充（实现前）

1. **DeepSeek V4 Flash** 官方 `model` 名、输入/输出 token 单价 → 定 `tokens_per_yuan_base` 与 `bill_tokens` 算法。
2. ~~消耗倍率是否对用户可见~~ → **已确认：完全不显示**（见 §7 #9）。
3. **聚发货**（暂缓）：Webhook 文档、六档 SKU 映射——你研究后再补。

---

## 9. 与当前管理后台的对应动作（小结）

| 你的意图 | 建议 |
|----------|------|
| 书籍数据只在服务器，用户登录加载 | 保留 API，**从 admin 移除小说编辑** |
| 一设备一账号，登录不绑设备 | `device_id` 注册；login 只验账号密码 |
| 卡密六档 → token | 入账 = 面额 × `tokens_per_yuan_base`（与消耗倍率无关） |
| 消耗倍率 ×2 | 真实成本 n，扣余额 **2n** 等价 token |
| AI 配置仅后台 | 用户只走服务端代理，不见 Key/真实上游配置 |
| 聚发货 | **暂缓** |
| 清空旧库 | 迁移脚本或手工 TRUNCATE 后按新表重建 |

---

*文档版本：2026-05-22 v4.1（消耗倍率对用户完全不显示）。*
