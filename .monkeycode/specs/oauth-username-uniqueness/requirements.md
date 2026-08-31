# Requirements Document

## Introduction

本功能解决多第三方登录（GitHub、Gitee）接入后，不同用户可能拥有相同用户名的问题。当前 `users` 表按 `openid` 区分用户，但 `username` 列无唯一约束，OAuth 新用户会以 `user.name || user.login` 直接入库，导致两个不同人显示成同一用户名。

目标：
- 已存在于 `user` 表的第三方账号，按现有流程正常登录。
- 不存在的第三方账号，进入专门的「创建新用户」页面，由用户设置一个**全局唯一**的用户名后完成注册。

## Glossary

- **第三方账号 / OAuth 账号**：通过 GitHub 或 Gitee 授权登录的账号，由 `openid`（平台用户 ID）唯一标识。
- **`openid`**：用户在某一 OAuth 平台上的唯一标识，格式为 `<平台>:<平台用户ID>`（如 `github:12345`）。
- **注册令牌（registration token）**：OAuth 回调为新用户签发的一次性、短时效、签名 JWT，编码待注册资料，经 URL 参数回传前端。
- **「创建新用户」页面**：路径 `/register`，展示 OAuth 头像与建议用户名，收集用户填写的唯一用户名。

## Requirements

### Requirement 1: 新第三方用户分流到注册页

**User Story:** AS 通过 GitHub/Gitee 首次访问本站的用户，I want 在确认账号不存在时被引导到一个设置用户名的页面，SO THAT 我能以自己选定的唯一用户名完成注册。

#### Acceptance Criteria

1. WHEN OAuth 回调成功且 `openid` 在 `users` 表中不存在，系统 SHALL 签发注册令牌并 302 重定向到 `/register?token=<注册令牌>`。
2. WHEN OAuth 回调成功且 `openid` 已存在于 `users` 表，系统 SHALL 按现有流程签发登录 JWT 并 302 重定向到 `/callback?token=<登录JWT>`。
3. WHEN 注册令牌过期或签名无效，系统 SHALL 拒绝注册并在 `/register` 页面提示「链接已失效，请重新登录」。

### Requirement 2: 用户名全局唯一（数据库约束）

**User Story:** AS 站点管理员，I want 数据库层面保证 `username` 唯一，SO THAT 两个不同用户不可能拥有相同用户名。

#### Acceptance Criteria

1. WHEN 执行迁移 `0011.sql`，系统 SHALL 为 `users.username` 添加 UNIQUE 约束。
2. WHEN 迁移执行前库中存在重复 `username`，系统 SHALL 自动为重复的后续记录追加后缀（如 `#2`、`#3`）使其唯一，保留首条记录原名。
3. WHEN 迁移完成，`users` 表 SHALL 将 `migration_version` 更新为 `11`。

### Requirement 3: 用户名可用性实时校验

**User Story:** AS 注册用户，I want 在输入用户名时即时获知是否可用，SO THAT 我能在提交前更换被占用的用户名。

#### Acceptance Criteria

1. WHEN 前端请求 `GET /api/user/check-username?username=<候选>`，系统 SHALL 返回 `{ available: boolean }`。
2. WHEN `username` 已被任一现有用户占用，系统 SHALL 返回 `available: false`。
3. WHEN `username` 为空或仅含空白，系统 SHALL 返回 `available: false`。

### Requirement 4: 「创建新用户」页面

**User Story:** AS 首次 OAuth 登录的用户，I want 在一个简洁的页面看到我的第三方头像并填写唯一用户名，SO THAT 我能确认并创建账号。

#### Acceptance Criteria

1. WHEN 用户访问 `/register?token=<注册令牌>`，系统 SHALL 解析令牌并展示 OAuth 头像与建议用户名。
2. WHEN 用户输入用户名，系统 SHALL 调用用户名可用性校验并实时显示可用/占用状态。
3. WHEN 用户提交且用户名可用，系统 SHALL 调用注册接口创建用户并跳转至首页（或 `redirect_to` 所指页面）。
4. WHEN 用户提交且用户名已被占用，系统 SHALL 阻止提交并提示更换用户名。

### Requirement 5: 注册接口创建唯一用户名用户

**User Story:** AS 注册用户，I want 提交后系统以我填写的用户名创建账号并登录，SO THAT 我能立即以该身份使用站点。

#### Acceptance Criteria

1. WHEN 前端 `POST /api/user/register` 携带有效注册令牌与唯一用户名，系统 SHALL 创建 `users` 记录（`openid`、头像取自令牌，`username` 取用户填写值）。
2. WHEN 创建时库中无任何用户，系统 SHALL 将该用户 `permission` 置为 `1`（首个管理员）。
3. WHEN 创建成功，系统 SHALL 签发登录 JWT 并通过响应或重定向交给前端。
4. WHEN 提交的 `username` 已存在，系统 SHALL 返回错误并要求更换用户名（与 Requirement 2 的约束一致）。

### Requirement 6: 既有 OAuth 登录行为保持不变

**User Story:** AS 已注册用户，I want 我的 GitHub/Gitee 登录体验不受本次改动影响，SO THAT 我能照常一键登录。

#### Acceptance Criteria

1. WHEN 已存在用户通过 OAuth 登录，系统 SHALL 沿用既有登录、资料更新与 JWT 下发逻辑。
2. WHEN 既有用户的 `username` 因迁移被追加后缀，系统 SHALL 在后续登录中保持该用户名不变。

### Requirement 7: 首个用户管理员引导保留

**User Story:** AS 首次部署站点的管理员，I want 第一个通过 OAuth 注册的用户自动成为管理员，SO THAT 我能直接接管后台。

#### Acceptance Criteria

1. WHEN 注册接口创建用户且 `users` 表为空，系统 SHALL 将其 `permission` 设为 `1`。
2. WHEN 注册接口创建用户且 `users` 表已存在其他用户，系统 SHALL 将其 `permission` 设为 `0`。
