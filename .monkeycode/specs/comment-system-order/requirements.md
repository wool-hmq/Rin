# Requirements Document

## Introduction

当前后台设置中已提供「评论系统显示顺序」排序 UI，但功能未生效。本需求记录评论系统显示顺序排序的完整目标与现状，供后续研究修复。

用户期望：在后台设置中可以对文章页启用的评论系统进行排序（上移/下移），排序结果应反映在文章页的评论系统切换按钮顺序上。

## Glossary

- **评论系统**：native（本站评论）/ twikoo / giscus / waline / cwd / gitalk / utterances 共 7 种。
- **切换按钮**：文章页评论区顶部一排可切换评论系统的胶囊按钮。
- **`comment.systemOrder`**：配置键，期望以数组存储启用的评论系统顺序，如 `["twikoo", "native", "giscus"]`。

## Requirements

### Requirement 1: 后台排序管理

**User Story:** AS 站点管理员，I want 在设置页对启用的评论系统进行排序，SO THAT 控制文章页评论系统的显示顺序。

#### Acceptance Criteria

1. WHEN 后台启用了多个评论系统，系统 SHALL 在「评论管理」区域展示排序 UI（当前实现：每个系统一行，带向上/向下按钮）。
2. WHEN 管理员点击向上/向下按钮，系统 SHALL 更新 `comment.systemOrder` 配置（当前实现：通过 `setConfigValue("client", "comment.systemOrder", newOrder)` 更新 draft）。
3. WHEN 排序 UI 保存成功，系统 SHALL 在文章页按该顺序渲染评论系统切换按钮。

### Requirement 2: 文章页按顺序渲染

**User Story:** AS 访客，I want 按管理员设定的顺序看到评论系统切换按钮，SO THAT 体验与站点配置一致。

#### Acceptance Criteria

1. WHEN 文章页存在多个启用的评论系统，系统 SHALL 按 `comment.systemOrder` 的顺序渲染切换按钮。
2. WHEN `comment.systemOrder` 未配置或长度与启用系统数不一致，系统 SHALL 回退到默认顺序（native → twikoo → giscus → waline → cwd → gitalk → utterances）。

## Current Status（现状记录）

**2026-08-22 已修复并合入 main。** 排序功能现已生效，同时新增第 8 种评论系统 Discuss。

已完成：
- `feed.tsx`：`enabledSystems` 按 `comment.systemOrder` 排序（`/workspace/client/src/page/feed.tsx:550-575`），切换按钮改为 `enabledSystems.map()` 动态渲染（`SYSTEM_ICONS` 映射 + `t(`comment.system.${system}`)`），评论区改为 `activeSystem === "xxx"` 精确判断渲染，删除全部 `showXxxComments` 布尔量与硬编码按钮块。
- `settings.tsx`：排序 UI 保留（上移/下移按钮），`comment.systemOrder` 读取处增加 `Array.isArray` 兜底（`/workspace/client/src/page/settings.tsx:537`），`COMMENT_SYSTEM_OPTIONS` 新增 `discuss`。
- `settings-helpers.ts`：`normalizeSettingsState` 对字符串化的 `comment.systemOrder` 做 JSON 解析归一化。
- 新增 `client/src/components/discuss_comment.tsx`：Discuss 评论系统组件（`window.Discuss` 全局构造器 + `initializedRef` 防重复 + 动态 script 加载）。
- 四种语言翻译已补充 `settings.comment.order.*` 与 `comment.system.discuss`。

验证：
- client + server tsc 通过；vitest 37/37 全绿；4 个翻译 JSON 合法性通过。
- 待线上环境实测：`comment.systemOrder` D1 存取往返（GET /config 返回数组）。

## Out of Scope

- 拖拽排序（当前为上移/下移按钮，暂不引入拖拽库）。
- 评论系统之间的数据迁移。
