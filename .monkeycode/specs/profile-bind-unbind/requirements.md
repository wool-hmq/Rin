# Requirements Document

## Introduction

用户登录后，可在个人资料页面查看当前已绑定的登录方式，并绑定/解绑其他登录方式（GitHub、Gitee、QQ、邮箱）。绑定后，用户可通过任一已绑定的方式登录同一账号；解绑后，该方式与当前账号脱钩。

## Glossary

- **绑定（Bind）**：将第三方登录方式（如 GitHub、Gitee、QQ、邮箱）关联到当前登录账号，使该方式可用来登录当前账号。
- **解绑（Unbind）**：从当前登录账号移除已绑定的第三方登录方式。
- **第三方账号标识（Provider ID）**：用户在第三方平台上的唯一标识（如 GitHub user.id、QQ open_id）。
- **绑定关系表**：记录用户与第三方账号关联关系的数据库表。
- **主登录方式**：用户当前登录所使用的登录方式（如密码、GitHub 等）。

## Requirements

### Requirement 1: 个人资料页展示已绑定登录方式

**User Story:** AS 已登录用户，I want 在个人资料页面查看当前账号已绑定的所有登录方式，SO THAT 我能了解账号有哪些登录入口。

#### Acceptance Criteria

1. WHEN 用户访问 `/profile` 页面，系统 SHALL 显示当前账号已绑定的登录方式列表（GitHub、Gitee、QQ、邮箱、密码）。
2. WHEN 用户通过 GitHub 登录且该账号已绑定 GitHub，系统 SHALL 在列表中显示「GitHub（已绑定）」。
3. WHEN 用户未绑定某登录方式（如 QQ），系统 SHALL 在列表中显示「QQ（未绑定）」并提供绑定按钮。
4. WHEN 用户仅有一种登录方式（如仅密码），系统 SHALL 禁止解绑该方式并显示提示「此为唯一登录方式，无法解绑」。

### Requirement 2: 绑定第三方登录方式

**User Story:** AS 已登录用户，I want 绑定其他登录方式到当前账号，SO THAT 我可以通过多种方式登录同一账号。

#### Acceptance Criteria

1. WHEN 用户点击「绑定 GitHub」按钮，系统 SHALL 重定向到 GitHub OAuth 授权页面，回调时将该 GitHub 账号关联到当前登录用户。
2. WHEN OAuth 回调成功且该第三方账号未绑定其他账号，系统 SHALL 建立绑定关系并返回成功提示。
3. WHEN OAuth 回调成功但该第三方账号已绑定其他用户，系统 SHALL 拒绝绑定并提示「该账号已绑定至其他用户」。
4. WHEN OAuth 回调失败或用户取消授权，系统 SHALL 返回个人资料页并显示失败提示。
5. WHEN 用户绑定邮箱，系统 SHALL 通过验证码验证邮箱所有权后建立绑定关系。

### Requirement 3: 解绑第三方登录方式

**User Story:** AS 已登录用户，I want 解绑已绑定的第三方登录方式，SO THAT 我可以管理账号的登录入口。

#### Acceptance Criteria

1. WHEN 用户点击「解绑」按钮并确认，系统 SHALL 移除该登录方式与当前账号的绑定关系。
2. WHEN 解绑后用户仍存在其他登录方式（密码或其他第三方），系统 SHALL 允许解绑并返回成功提示。
3. IF 该登录方式是当前账号的唯一登录方式，系统 SHALL 拒绝解绑并提示「此为唯一登录方式，无法解绑」。
4. WHEN 用户解绑 GitHub 账号，系统 SHALL 清除该 GitHub 账号与当前用户的关联，但保留用户名、头像等用户数据。

### Requirement 4: 数据模型与迁移

**User Story:** AS 系统管理员，I want 数据库支持多登录方式绑定关系，SO THAT 用户可以通过多种方式登录同一账号。

#### Acceptance Criteria

1. WHEN 执行数据库迁移，系统 SHALL 创建 `linked_accounts` 表存储用户与第三方账号的绑定关系。
2. WHEN `linked_accounts` 表创建完成，系统 SHALL 包含字段：`id`、`user_id`、`provider`、`provider_id`、`created_at`，其中 `(user_id, provider, provider_id)` 联合唯一。
3. WHEN 迁移完成，系统 SHALL 将 `migration_version` 更新为对应版本号。
4. WHEN 用户通过第三方登录时，系统 SHALL 优先在 `linked_accounts` 表中查找绑定关系，若存在则登录对应 `user_id` 对应的账号。

### Requirement 5: 登录流程适配

**User Story:** AS 通过第三方登录的用户，I want 系统能识别我绑定的账号并正确登录，SO THAT 绑定后的登录方式能正常使用。

#### Acceptance Criteria

1. WHEN 用户通过 GitHub OAuth 登录且该 GitHub 账号已绑定到用户 U，系统 SHALL 登录用户 U（而非创建新用户或登录 GitHub 账号原有的用户）。
2. WHEN 用户通过未绑定的第三方账号登录，系统 SHALL 按现有流程处理（创建新用户或提示用户名冲突）。
3. WHEN 用户通过已绑定的第三方账号登录，系统 SHALL 更新头像等信息（若第三方资料有更新）。

### Requirement 6: 安全与异常处理

**User Story:** AS 系统管理员，I want 绑定/解绑操作安全可靠，SO THAT 用户账号不会被未授权操作影响。

#### Acceptance Criteria

1. WHEN 用户尝试绑定他人已绑定的第三方账号，系统 SHALL 拒绝绑定并返回 409 冲突。
2. WHEN 用户尝试解绑他人账号的第三方登录方式，系统 SHALL 返回 403 禁止。
3. WHEN 数据库操作失败，系统 SHALL 返回 500 错误并记录日志。
4. WHEN 绑定/解绑操作成功，系统 SHALL 返回 200 成功并更新前端状态。
