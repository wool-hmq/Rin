# Requirements Document

## Introduction

Rin 博客当前仅支持基于 SQL `LIKE` 的关键字搜索（匹配文章标题、正文、摘要与别名）。本需求新增「AI 增强搜索」能力：用户在搜索页可自由选择「关键字搜索」或「AI 增强搜索」两种模式。AI 增强搜索使用大语言模型（LLM）理解用户查询意图，对候选文章按相关性进行筛选与排序，行为类似于通用搜索引擎（不要求查询词与文章内容关键字一一对应）。其 LLM 配置与文章 AI 总结完全同步（复用主用 API 与备用 API 链），并通过独立开关控制可用性。

## Glossary

- **系统（System）**：Rin 博客应用（前端 + Cloudflare Worker 后端）。
- **关键字搜索**：基于 D1 SQL `LIKE` 匹配标题/正文/摘要/别名的现有搜索模式。
- **AI 增强搜索**：调用 LLM 理解查询意图并对候选文章做相关性筛选与排序的搜索模式。
- **AI 总结配置**：现存于 D1 的 `ai_summary.*` 配置组（enabled/provider/model/api_key/api_url/failover）。
- **AI 搜索开关**：新增配置键 `ai_search.enabled`，独立控制 AI 增强搜索是否可用。
- **主用 API**：`ai_summary.provider`、`ai_summary.model` 等主配置。
- **备用 API（failover）**：`ai_summary.failover` 中的逐条备用模型列表，按序尝试。
- **候选文章**：由关键字粗筛得到的待 LLM 评分的文章集合。

## Requirements

### Requirement 1: 搜索模式选择

**User Story:** AS 访客，I want 在搜索页选择搜索模式，SO THAT 可按需使用关键字搜索或 AI 增强搜索。

#### Acceptance Criteria

1. WHEN 用户访问搜索页，系统 SHALL 展示「关键字」与「AI 增强」两种模式的选择控件，并默认选中「关键字」模式。
2. WHEN 用户切换至「AI 增强」模式，系统 SHALL 使用当前输入的关键词发起 AI 增强搜索。
3. WHEN 用户位于「关键字」模式，系统 SHALL 保持现有关键字搜索结果与分页行为不变。
4. WHEN AI 搜索开关关闭，系统 SHALL 在搜索页禁用「AI 增强」模式并提示原因。

### Requirement 2: AI 增强搜索接口

**User Story:** AS 后端，I want 提供 AI 增强搜索端点，SO THAT 前端可发起 AI 搜索请求并获取文章列表。

#### Acceptance Criteria

1. WHEN 前端以 AI 模式携带关键词请求搜索，系统 SHALL 返回与关键字搜索同构的文章列表响应（含分页字段）。
2. WHEN 关键词为空，系统 SHALL 返回空结果而不调用 LLM。
3. WHEN AI 搜索开关关闭、LLM 未配置或调用失败，系统 SHALL 回退返回关键字搜索结果，并在响应中附注回退原因。

### Requirement 3: AI 搜索开关

**User Story:** AS 管理员，I want 独立控制 AI 增强搜索的可用性，SO THAT 可在不关闭文章 AI 总结的情况下停用 AI 搜索。

#### Acceptance Criteria

1. WHEN 管理员在设置页切换 AI 搜索开关，系统 SHALL 持久化 `ai_search.enabled` 配置。
2. WHEN AI 搜索开关为关闭状态，服务端 SHALL 拒绝执行 AI 检索并回退至关键字搜索。
3. WHEN AI 搜索开关为开启状态，服务端 SHALL 允许执行 AI 检索。

### Requirement 4: LLM 配置同步

**User Story:** AS 管理员，I want AI 增强搜索复用 AI 总结的 LLM 配置，SO THAT 无需为搜索单独配置模型。

#### Acceptance Criteria

1. WHEN AI 增强搜索执行，系统 SHALL 复用 `ai_summary` 配置组（provider/model/api_key/api_url）作为主用 LLM。
2. WHEN 主用 LLM 调用失败，系统 SHALL 依次尝试 `ai_summary.failover` 中的备用模型，直至成功或全部失败。
3. WHEN AI 增强搜索需要更新任何 LLM 配置，系统 SHALL 通过现有 AI 总结设置界面完成，不提供独立配置项。

### Requirement 5: AI 检索机制

**User Story:** AS 后端，I want 借助 LLM 对候选文章做语义相关性筛选与排序，SO THAT 搜索结果不要求查询词与文章内容关键字一一对应。

#### Acceptance Criteria

1. WHEN AI 增强搜索执行，系统 SHALL 先以关键词对文章标题/正文/摘要/别名做 `LIKE` 粗筛，得到候选文章集合并限制候选数量上限。
2. WHEN 候选文章集合为空，系统 SHALL 返回空结果而不调用 LLM。
3. WHEN 候选文章集合非空，系统 SHALL 将每篇候选文章的标题、简介（summary）与 AI 总结（ai_summary）截断后交给 LLM，并要求 LLM 返回按相关性降序排列的文章标识列表。
4. WHEN LLM 返回的文章标识列表为空或无效，系统 SHALL 回退至关键字搜索结果。
5. WHEN LLM 返回有效的文章标识列表，系统 SHALL 按 LLM 给定的顺序返回对应文章的详情。

### Requirement 6: AI 搜索结果展示

**User Story:** AS 访客，I want AI 增强搜索返回相关文章，SO THAT 我能更快找到目标内容。

#### Acceptance Criteria

1. WHEN AI 增强搜索成功返回结果，系统 SHALL 以与关键字搜索一致的 FeedCard 列表展示文章。
2. WHEN AI 增强搜索回退至关键字结果，系统 SHALL 提示用户当前展示的是关键字搜索结果及回退原因。

## Out of Scope

- 独立的 AI 搜索 LLM 配置界面（配置与 AI 总结共享，仅新增 `ai_search.enabled` 开关）。
- 向量数据库 / 全文索引（FTS）检索。
- AI 搜索结果的分页深度排序（AI 模式结果数量由 LLM 相关性排序决定，不执行大偏移量分页）。
