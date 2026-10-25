# MCP 服务需求文档

## Introduction

Rin 博客在站点根路径下的 `/mcp` 暴露一个 Model Context Protocol（MCP）服务端。MCP 客户端（Claude Code、Cursor、MCP Inspector 等）通过设置页创建的 32 位 API Key 访问该端点，服务端依据该密钥持有的权限（scope）决定暴露的工具集合与可执行的数据操作范围。

本需求覆盖端点暴露、鉴权、权限到工具的映射、内容读写工具、配置工具、安全防护与接入文档。

## Glossary

- **MCP 服务端**：遵循 Model Context Protocol 2026-07-28 规范、通过 Streamable HTTP 传输对外提供工具的服务端实例。
- **端点**：站点路径 `/mcp`。
- **API Key**：设置页创建的 32 位 base64url 字符串密钥，服务端以 SHA-256 哈希存储。
- **权限（scope）**：API Key 持有的能力标识，例如 `content.read`、`feed.write`、`config.site`。
- **内容属主**：通过 API Key 创建的内容所归属的用户标识，当前固定为 `uid=1`。
- **MCP 客户端**：发起 MCP JSON-RPC 调用的外部程序。
- **站点域名**：博客对外访问的主机名，例如 `https://blog.example.com`。

## Requirements

### Requirement 1: MCP 端点

**User Story:** AS 站点管理员, I want 在 `/mcp` 暴露标准 MCP 端点, so that 任意支持 Streamable HTTP 的 MCP 客户端能直接连接博客。

#### Acceptance Criteria

1. WHEN MCP 客户端向 `https://<站点域名>/mcp` 发送 MCP JSON-RPC 请求, THE 系统 SHALL 按 MCP Streamable HTTP 规范返回响应。
2. WHEN 请求以 POST 到达 `/mcp`, THE 系统 SHALL 为该请求创建独立的 MCP 服务端实例并在请求结束后释放该实例。
3. WHEN 请求以 GET 或 DELETE 到达 `/mcp`, THE 系统 SHALL 返回 405 状态码。
4. WHEN 请求访问 `/mcp` 以外的路径, THE 系统 SHALL 保持现有 API 路由与单页应用行为不变。
5. WHEN MCP 客户端在 `initialize` 请求之后调用 `tools/list`, THE 系统 SHALL 返回当前密钥有权使用的工具清单及其 JSON Schema 输入定义。

### Requirement 2: API Key 鉴权

**User Story:** AS 站点管理员, I want 用设置页创建的 API Key 保护 MCP 端点, so that 只有持有密钥的自动化流程能访问博客数据。

#### Acceptance Criteria

1. WHEN 请求缺少 API Key, THE 系统 SHALL 返回 401 状态码与错误信息 `Missing API key`。
2. WHEN 请求携带的 API Key 与任何已存密钥的哈希都不匹配, THE 系统 SHALL 返回 401 状态码与错误信息 `Invalid API key`。
3. WHEN 请求携带有效 API Key, THE 系统 SHALL 使用该密钥的权限集合决定本次请求可用的工具。
4. THE 系统 SHALL 通过 `Authorization: Bearer <key>` 与 `X-API-Key: <key>` 两种请求头接收凭据。
5. WHEN 鉴权成功, THE 系统 SHALL 将该密钥的 `last_used_at` 更新为当前时间戳。
6. THE 系统 SHALL 在鉴权失败的响应中隐藏密钥明文与密钥哈希。

### Requirement 3: 工具集合随权限变化

**User Story:** AS 站点管理员, I want 不同密钥获得不同的工具集合, so that 我可以用最小权限把博客能力交给不同的自动化流程。

#### Acceptance Criteria

1. WHEN 密钥仅持有 `content.read`, THE 系统 SHALL 暴露文章、标签、动态、友链的读取工具以及 `whoami` 工具。
2. WHEN 密钥持有 `feed.write`, THE 系统 SHALL 暴露文章创建、修改、删除工具。
3. WHEN 密钥持有 `moment.write`, THE 系统 SHALL 暴露动态创建、修改、删除工具。
4. WHEN 密钥持有 `friend.write`, THE 系统 SHALL 暴露友链创建、修改、删除工具。
5. WHEN 密钥持有任意 `config.*` 权限, THE 系统 SHALL 暴露配置读取与配置写入工具。
6. THE 系统 SHALL 为每个通过鉴权的密钥暴露 `whoami` 工具, 返回密钥标识、权限清单与可用工具清单。
7. WHEN 客户端调用密钥未持有权限所对应的工具, THE 系统 SHALL 返回错误信息并指明缺失的权限名。

### Requirement 4: 内容读取工具

**User Story:** AS 内容运营者, I want 通过 MCP 读取博客内容, so that AI 助手能基于真实内容回答问题。

#### Acceptance Criteria

1. WHEN 调用 `list_posts`, THE 系统 SHALL 返回分页文章列表并支持 `page`、`limit`、`type`（`normal`、`draft`、`unlisted`）参数, 且 `limit` 上限为 50。
2. WHEN 调用 `get_post`, THE 系统 SHALL 按 `id` 或 `alias` 返回单篇文章的标题、正文、摘要、标签与作者信息。
3. WHEN 调用 `get_post` 且文章不存在, THE 系统 SHALL 返回未找到错误。
4. WHEN 调用 `search_posts`, THE 系统 SHALL 按标题关键词返回匹配文章并返回匹配总数。
5. WHEN 调用 `list_tags`, THE 系统 SHALL 返回全部标签及其关联文章数量。
6. WHEN 调用 `list_moments` 或 `list_friends`, THE 系统 SHALL 返回分页的动态或友链列表。
7. WHEN 读取工具返回结果, THE 系统 SHALL 以 JSON 文本形式返回结构化数据。

### Requirement 5: 内容写入工具

**User Story:** AS 内容运营者, I want 通过 MCP 发布与维护内容, so that AI 助手能完成日常内容维护工作。

#### Acceptance Criteria

1. WHEN 调用 `create_post`, THE 系统 SHALL 要求 `title` 与 `content` 非空, 支持 `alias`、`summary`、`tags`、`listed`、`draft`、`createdAt` 参数, 且 `draft` 默认值为 `true`。
2. WHEN 调用 `update_post`, THE 系统 SHALL 仅更新调用方传入的字段, 并在文章不存在时返回未找到错误。
3. WHEN 调用 `delete_post` 且文章不存在, THE 系统 SHALL 返回未找到错误。
4. WHEN 调用 `create_moment` 或 `update_moment`, THE 系统 SHALL 要求 `content` 非空。
5. WHEN 调用 `create_friend`, THE 系统 SHALL 要求 `name`、`desc`、`avatar`、`url` 非空, 且每个字段长度不超过 100 字符。
6. WHEN 写入操作成功, THE 系统 SHALL 清理文章列表、搜索结果、动态列表等相关缓存。
7. WHEN 写入操作创建内容, THE 系统 SHALL 将内容归属到内容属主 `uid=1`。
8. WHEN 写入操作完成, THE 系统 SHALL 返回受影响内容的标识。

### Requirement 6: 配置工具

**User Story:** AS 站点管理员, I want 通过 MCP 读取与更新站点配置, so that 我能用自然语言完成站点设置调整。

#### Acceptance Criteria

1. WHEN 调用 `get_config`, THE 系统 SHALL 要求 `section` 参数属于已知配置分区。
2. WHEN 调用 `get_config` 且密钥缺少该分区对应的权限, THE 系统 SHALL 返回指明缺失权限名的错误。
3. WHEN 调用 `update_config`, THE 系统 SHALL 仅写入该分区在对应权限下允许的配置键, 并拒绝其它键。
4. WHEN 调用 `update_config` 且未提供任何可写配置键, THE 系统 SHALL 返回参数错误。
5. WHEN 读取 AI 分区配置, THE 系统 SHALL 返回 `ai_summary.api_key_set` 布尔值, 且响应中不包含 AI 密钥明文。

### Requirement 7: 安全防护

**User Story:** AS 站点管理员, I want MCP 端点具备浏览器侧攻击防护, so that 恶意页面无法借浏览器身份调用受保护的工具。

#### Acceptance Criteria

1. THE 系统 SHALL 在处理 MCP 请求前校验请求的 Host 与 Origin 头, 允许列表包含 `FRONTEND_URL` 配置的主机名与 localhost 主机名。
2. WHEN Host 头不在允许列表内, THE 系统 SHALL 返回 403 状态码。
3. WHEN Origin 头存在且其主机名不在允许列表内, THE 系统 SHALL 返回 403 状态码。
4. WHEN 请求不携带 Origin 头, THE 系统 SHALL 继续处理该请求, 以兼容非浏览器 MCP 客户端。
5. THE 系统 SHALL 在日志与错误响应中隐藏 API Key 明文与密钥哈希。

### Requirement 8: 接入文档

**User Story:** AS 站点管理员, I want 文档说明如何连接 MCP 端点, so that 我能快速把博客接入 AI 工具。

#### Acceptance Criteria

1. THE 系统 SHALL 在中文与英文 API 使用指南中说明 `/mcp` 端点地址与鉴权请求头。
2. THE 系统 SHALL 在中文与英文 API 使用指南中给出 Claude Code、Cursor 与 MCP Inspector 的连接配置示例。
3. THE 系统 SHALL 在中文与英文 API 使用指南中列出权限与工具的对应关系。

## Out of Scope

- OAuth 授权流程与第三方 OAuth 提供方集成。
- 有状态 MCP 会话、订阅推送、Durable Object 持久化会话。
- MCP 客户端侧界面与站点设置页中的 MCP 配置向导。
- 通过 MCP 修改站点管理员账号、密码与 TOTP 安全设置。
