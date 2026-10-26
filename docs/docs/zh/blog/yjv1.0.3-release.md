---
pageType: doc
sidebar: false
---

# 羊角快车二创版 yjv1.0.3 发布：API 接口与 MCP 密钥分离

**发布日期**: 2026年10月26日

本次版本把 REST API 与 MCP 的密钥管理拆成两类独立密钥。此前两类调用共用同一套密钥与权限范围，一把用于脚本自动化的密钥也能直接调用 MCP 端点，权限边界较模糊。现在每个密钥只对一种端点生效，设置页也分开展示与创建。

## 密钥类型

| 类型 | `key_type` | 可用端点 | 典型用途 |
| --- | --- | --- | --- |
| API 接口密钥 | `1` | `/api/key/*` | 外部脚本、定时任务、自动化同步 |
| MCP 密钥 | `2` | `/mcp` | Claude Code、Cursor、MCP Inspector 等 MCP 客户端 |

- 密钥类型在创建时确定，之后不可更改；需要另一种类型时请新建密钥
- 两个标签页的密钥列表互相独立，看不到对方的密钥
- 每个账号的密钥总数上限仍为 20 把，两类密钥合计计算

## 权限范围的变化

`content.read` 是为 MCP 读取工具新增的权限，因此只对 MCP 密钥开放：

- **API 接口密钥**：可选 `feed.write`、`moment.write`、`friend.write` 与各类 `config.*`
- **MCP 密钥**：在上述权限之外，还可以勾选 `content.read`

设置页创建密钥时，会按当前标签页只列出该类型可用的权限，服务端同样会拒绝越界勾选（返回 `400`）。

## 端点隔离

密钥类型与端点不匹配时，请求在鉴权阶段就会被拒绝，不会进入业务逻辑：

```bash
# API 接口密钥调用 /mcp
curl -i -X POST https://your-site/mcp -H "X-API-Key: <API 接口密钥>"
# HTTP/1.1 403
# {"success":false,"error":"This key is for the REST API; create an MCP key to call /mcp"}

# MCP 密钥调用 /api/key/help
curl -i https://your-site/api/key/help -H "X-API-Key: <MCP 密钥>"
# HTTP/1.1 403
# {"success":false,"error":"This key is for MCP; create an API key to call /api/key"}
```

| 状态码 | 含义 |
| --- | --- |
| `401` | 缺少密钥，或密钥无效、已轮换、已删除 |
| `403` | 密钥有效，但缺少所需权限，或密钥类型与端点不匹配 |

## 数据库变更

`api_keys` 表新增一列：

```sql
ALTER TABLE `api_keys` ADD `key_type` integer DEFAULT 1 NOT NULL;
```

迁移 `0021.sql` 会同时为历史密钥归类：

- 权限中含 `content.read` 的密钥 → `key_type = 2`（MCP 密钥）
- 其余密钥 → `key_type = 1`（API 接口密钥）

这个规则覆盖了 yjv1.0.2 以来创建的 MCP 密钥，升级后原有 MCP 客户端可以继续使用，无需重新创建密钥。如果某个密钥同时承担脚本与 MCP 两种用途，升级后它只会保留其中一种能力，建议按用途拆分。

## 版本号规则

从这个版本开始，二创版的 `yjvX.Y.Z` 按改动规模递增：

1. **超大更新**：大量新功能或整体重构，`X` 加 1，`Y` 与 `Z` 归零
2. **普通更新**：新增 1-2 个功能，或多个简单功能，`Y` 加 1，`Z` 归零
3. **补丁**：缺陷修复与小改动，`Z` 加 1

本次改动属于补丁级别，因此版本号从 `yjv1.0.2` 递增到 `yjv1.0.3`。

## 升级提示

- 拉取代码后重新部署即可，迁移随部署流程自动执行
- 已有 MCP 客户端不需要修改配置，除非它使用的密钥还带有写入权限且同时被脚本使用
- 如果客户端提示 `403`，先在设置页确认密钥标签页与端点是否匹配

接口细节见 [API 使用指南](../guide/api-guide)，完整改动见 [更新日志](../guide/changelog)。

## 反馈

- 二创版 Issues：<https://github.com/wool-hmq/Rin/issues>
- 二创版 Discussions：<https://github.com/wool-hmq/Rin/discussions>
- 官方原版 Issues（上游）：<https://github.com/openRin/Rin/issues>
