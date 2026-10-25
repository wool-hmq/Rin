import * as z from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import type { CacheImpl, DB } from "../../core/hono-types";
import { friends, moments } from "../../db/schema";
import {
    deleteFeedById,
    findFeedById,
    insertFeed,
    searchFeedPage,
    updateFeedById,
} from "../feed/repository";
import {
    findFeedDetail,
    findFeedDetailByAlias,
    listFeedRows,
    listFriendRows,
    listHashtagRows,
    listMomentRows,
    type FeedListType,
} from "./repository";
import { bindTagToPost } from "../../services/tag";
import { clearFeedCache, clearFeedCollectionCaches } from "../../services/clear-feed-cache";
import { syncFeedAISummaryQueueState } from "../../services/feed-ai-summary";
import { API_KEY_CONTENT_OWNER_UID } from "../../services/api-key-owner";
import { persistRegularConfig, splitConfigPayload } from "../../services/config-helpers";
import { getAIConfig, setAIConfig } from "../../utils/db-config";
import {
    isAllowedConfigKey,
    resolveApiKeyConfigSection,
} from "../../utils/api-key-config-sections";
import { API_KEY_SCOPES } from "../../utils/api-key-scopes";

export const MCP_CONTENT_READ_SCOPE = "content.read";

export const MCP_CONFIG_SCOPES = API_KEY_SCOPES
    .map((item) => item.scope)
    .filter((scope) => scope.startsWith("config."));

export interface McpToolContext {
    db: DB;
    cache: CacheImpl;
    serverConfig: CacheImpl;
    clientConfig: CacheImpl;
    env: Env;
    scopes: string[];
    keyId: number;
    uid: number;
}

export interface McpToolDefinition {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<z.ZodRawShape>;
    scope?: string;
    scopes?: string[];
    handler: (args: any, context: McpToolContext) => Promise<CallToolResult>;
}

function textResult(payload: unknown): CallToolResult {
    return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    };
}

function errorResult(message: string): CallToolResult {
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}

function normalizePage(value: unknown, fallback: number): number {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }
    return Math.floor(parsed);
}

function normalizeLimit(value: unknown, fallback: number, max: number): number {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }
    return Math.min(Math.floor(parsed), max);
}

function hasScope(context: McpToolContext, scope: string): boolean {
    return context.scopes.includes(scope);
}

function summarizeFeed(row: any) {
    return {
        id: row.id,
        alias: row.alias,
        title: row.title,
        summary: row.summary,
        listed: row.listed,
        draft: row.draft,
        top: row.top,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        hashtags: (row.hashtags ?? []).map((item: any) => item.hashtag?.name).filter(Boolean),
        user: row.user ? { id: row.user.id, username: row.user.username } : null,
    };
}

const whoamiTool: McpToolDefinition = {
    name: "whoami",
    title: "查看当前密钥信息",
    description: "返回当前 API Key 的标识、权限范围以及可用的 MCP 工具列表。",
    inputSchema: z.object({}),
    handler: async (_args, context) => textResult({
        key_id: context.keyId,
        uid: context.uid,
        scopes: context.scopes,
        tools: selectMcpToolDefinitions(context.scopes).map((tool) => tool.name),
    }),
};

const listPostsTool: McpToolDefinition = {
    name: "list_posts",
    title: "列出文章",
    description: "按分页列出文章，支持按 normal（已发布）、draft（草稿）、unlisted（不公开）或 all 过滤。",
    inputSchema: z.object({
        page: z.number().int().min(1).optional().describe("页码，从 1 开始，默认 1"),
        limit: z.number().int().min(1).max(100).optional().describe("每页数量，默认 20，最大 100"),
        type: z.enum(["normal", "draft", "unlisted", "all"]).optional().describe("文章类型过滤，默认 normal"),
    }),
    scope: MCP_CONTENT_READ_SCOPE,
    handler: async (args, context) => {
        const page = normalizePage(args.page, 1) - 1;
        const limit = normalizeLimit(args.limit, 20, 100);
        const type = (args.type ?? "normal") as FeedListType;
        const result = await listFeedRows(context.db, { page, limit, type });
        return textResult({
            size: result.size,
            has_next: result.hasNext,
            data: result.rows.map(summarizeFeed),
        });
    },
};

const getPostTool: McpToolDefinition = {
    name: "get_post",
    title: "获取文章详情",
    description: "根据文章 ID 或别名获取文章全文、标签与元信息。",
    inputSchema: z.object({
        id: z.number().int().min(1).optional().describe("文章 ID"),
        alias: z.string().min(1).optional().describe("文章别名"),
    }),
    scope: MCP_CONTENT_READ_SCOPE,
    handler: async (args, context) => {
        if (args.id === undefined && !args.alias) {
            return errorResult("需要提供 id 或 alias 之一");
        }

        const feed = args.id !== undefined
            ? await findFeedDetail(context.db, args.id)
            : await findFeedDetailByAlias(context.db, args.alias);

        if (!feed) {
            return errorResult("文章不存在");
        }

        return textResult({
            ...summarizeFeed(feed),
            content: feed.content,
            ai_summary: feed.ai_summary,
        });
    },
};

const searchPostsTool: McpToolDefinition = {
    name: "search_posts",
    title: "搜索文章",
    description: "按标题关键字搜索文章，结果包含草稿与不公开文章。",
    inputSchema: z.object({
        keyword: z.string().min(1).describe("标题关键字"),
        page: z.number().int().min(1).optional().describe("页码，从 1 开始，默认 1"),
        limit: z.number().int().min(1).max(100).optional().describe("每页数量，默认 20，最大 100"),
    }),
    scope: MCP_CONTENT_READ_SCOPE,
    handler: async (args, context) => {
        const page = normalizePage(args.page, 1) - 1;
        const limit = normalizeLimit(args.limit, 20, 100);
        const result = await searchFeedPage(context.db, {
            keyword: args.keyword,
            admin: true,
            pageIndex: page,
            limit,
        });

        return textResult({
            size: result.size,
            has_next: result.hasNext,
            data: result.rows.map(summarizeFeed),
        });
    },
};

const listTagsTool: McpToolDefinition = {
    name: "list_tags",
    title: "列出标签",
    description: "列出站点已创建的全部标签。",
    inputSchema: z.object({
        page: z.number().int().min(1).optional().describe("页码，从 1 开始，默认 1"),
        limit: z.number().int().min(1).max(100).optional().describe("每页数量，默认 50，最大 100"),
    }),
    scope: MCP_CONTENT_READ_SCOPE,
    handler: async (args, context) => {
        const page = normalizePage(args.page, 1) - 1;
        const limit = normalizeLimit(args.limit, 50, 100);
        const result = await listHashtagRows(context.db, { page, limit });
        return textResult({
            size: result.size,
            data: result.rows.map((row) => ({ id: row.id, name: row.name })),
        });
    },
};

const listMomentsTool: McpToolDefinition = {
    name: "list_moments",
    title: "列出动态",
    description: "按分页列出站点动态。",
    inputSchema: z.object({
        page: z.number().int().min(1).optional().describe("页码，从 1 开始，默认 1"),
        limit: z.number().int().min(1).max(100).optional().describe("每页数量，默认 20，最大 100"),
    }),
    scope: MCP_CONTENT_READ_SCOPE,
    handler: async (args, context) => {
        const page = normalizePage(args.page, 1) - 1;
        const limit = normalizeLimit(args.limit, 20, 100);
        const result = await listMomentRows(context.db, { page, limit });
        return textResult({
            size: result.size,
            has_next: result.hasNext,
            data: result.rows.map((row) => ({
                id: row.id,
                content: row.content,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                user: row.user ? { id: row.user.id, username: row.user.username } : null,
            })),
        });
    },
};

const listFriendsTool: McpToolDefinition = {
    name: "list_friends",
    title: "列出友链",
    description: "按分页列出友链条目。",
    inputSchema: z.object({
        page: z.number().int().min(1).optional().describe("页码，从 1 开始，默认 1"),
        limit: z.number().int().min(1).max(100).optional().describe("每页数量，默认 20，最大 100"),
    }),
    scope: MCP_CONTENT_READ_SCOPE,
    handler: async (args, context) => {
        const page = normalizePage(args.page, 1) - 1;
        const limit = normalizeLimit(args.limit, 20, 100);
        const result = await listFriendRows(context.db, { page, limit });
        return textResult({
            size: result.size,
            has_next: result.hasNext,
            data: result.rows.map((row) => ({
                id: row.id,
                name: row.name,
                desc: row.desc,
                avatar: row.avatar,
                url: row.url,
                group: row.group,
                accepted: row.accepted,
                sort_order: row.sort_order,
            })),
        });
    },
};

const createPostTool: McpToolDefinition = {
    name: "create_post",
    title: "创建文章",
    description: "创建一篇文章，默认保存为草稿，需要发布时把 draft 设为 false。",
    inputSchema: z.object({
        title: z.string().min(1).describe("文章标题"),
        content: z.string().min(1).describe("文章正文，Markdown"),
        summary: z.string().optional().describe("文章摘要，留空时自动截取正文"),
        alias: z.string().optional().describe("文章别名"),
        tags: z.array(z.string()).optional().describe("标签名称列表"),
        listed: z.boolean().optional().describe("是否出现在列表，默认 true"),
        draft: z.boolean().optional().describe("是否为草稿，默认 true"),
        createdAt: z.string().optional().describe("创建时间，ISO 8601 字符串"),
    }),
    scope: "feed.write",
    handler: async (args, context) => {
        const title = args.title.trim();
        const content = args.content;
        if (!title) {
            return errorResult("title 不能为空");
        }
        if (!content.trim()) {
            return errorResult("content 不能为空");
        }

        const tags = Array.isArray(args.tags) ? args.tags.filter((item: unknown): item is string => typeof item === "string") : [];
        const date = args.createdAt ? new Date(args.createdAt) : new Date();
        if (Number.isNaN(date.getTime())) {
            return errorResult("createdAt 不是合法的日期字符串");
        }
        const draft = args.draft ?? true;

        const inserted = await insertFeed(context.db, {
            title,
            content,
            summary: args.summary ?? "",
            ai_summary: "",
            ai_summary_status: "idle",
            ai_summary_error: "",
            uid: API_KEY_CONTENT_OWNER_UID,
            alias: args.alias ?? null,
            listed: (args.listed ?? true) ? 1 : 0,
            draft: draft ? 1 : 0,
            createdAt: date,
            updatedAt: date,
        });

        if (!inserted) {
            return errorResult("创建文章失败");
        }

        await bindTagToPost(context.db, inserted.insertedId, tags);
        await syncFeedAISummaryQueueState(context.db, context.serverConfig, context.env, inserted.insertedId, {
            draft,
            updatedAt: date,
            resetSummary: true,
        });
        await clearFeedCollectionCaches(context.cache);

        return textResult({ success: true, id: inserted.insertedId });
    },
};

const updatePostTool: McpToolDefinition = {
    name: "update_post",
    title: "更新文章",
    description: "按文章 ID 更新标题、正文、摘要、别名、标签或发布状态，未提供的字段保持原值。",
    inputSchema: z.object({
        id: z.number().int().min(1).describe("文章 ID"),
        title: z.string().min(1).optional().describe("文章标题"),
        content: z.string().optional().describe("文章正文，Markdown"),
        summary: z.string().optional().describe("文章摘要"),
        alias: z.string().optional().describe("文章别名"),
        tags: z.array(z.string()).optional().describe("标签名称列表，传入即整体替换"),
        listed: z.boolean().optional().describe("是否出现在列表"),
        draft: z.boolean().optional().describe("是否为草稿"),
        createdAt: z.string().optional().describe("创建时间，ISO 8601 字符串"),
    }),
    scope: "feed.write",
    handler: async (args, context) => {
        const feed = await findFeedById(context.db, args.id);
        if (!feed) {
            return errorResult("文章不存在");
        }

        let createdAt: Date | undefined;
        if (args.createdAt) {
            createdAt = new Date(args.createdAt);
            if (Number.isNaN(createdAt.getTime())) {
                return errorResult("createdAt 不是合法的日期字符串");
            }
        }

        const contentChanged = args.content !== undefined && args.content !== feed.content;
        const isDraft = args.draft ?? (feed.draft === 1);
        const shouldQueueAISummary = (contentChanged && !isDraft) || (!isDraft && feed.draft === 1 && !feed.ai_summary);
        const updatedAt = new Date();

        await updateFeedById(context.db, args.id, {
            title: args.title,
            content: args.content,
            summary: args.summary,
            ai_summary: shouldQueueAISummary ? "" : undefined,
            ai_summary_status: isDraft ? "idle" : undefined,
            ai_summary_error: shouldQueueAISummary || isDraft ? "" : undefined,
            alias: args.alias,
            listed: args.listed === undefined ? undefined : (args.listed ? 1 : 0),
            draft: args.draft === undefined ? undefined : (args.draft ? 1 : 0),
            createdAt,
            updatedAt,
        });

        if (Array.isArray(args.tags)) {
            const tags = args.tags.filter((item: unknown): item is string => typeof item === "string");
            await bindTagToPost(context.db, args.id, tags);
        }

        if (shouldQueueAISummary || isDraft) {
            await syncFeedAISummaryQueueState(context.db, context.serverConfig, context.env, args.id, {
                draft: isDraft,
                updatedAt,
                resetSummary: shouldQueueAISummary,
            });
        }

        await clearFeedCache(context.cache, args.id, feed.alias, args.alias ?? null);

        return textResult({ success: true, id: args.id });
    },
};

const deletePostTool: McpToolDefinition = {
    name: "delete_post",
    title: "删除文章",
    description: "按文章 ID 删除文章。",
    inputSchema: z.object({
        id: z.number().int().min(1).describe("文章 ID"),
    }),
    scope: "feed.write",
    handler: async (args, context) => {
        const feed = await findFeedById(context.db, args.id);
        if (!feed) {
            return errorResult("文章不存在");
        }

        await deleteFeedById(context.db, args.id);
        await clearFeedCache(context.cache, args.id, feed.alias, null);

        return textResult({ success: true, id: args.id });
    },
};

const createMomentTool: McpToolDefinition = {
    name: "create_moment",
    title: "发布动态",
    description: "发布一条动态。",
    inputSchema: z.object({
        content: z.string().min(1).describe("动态内容"),
    }),
    scope: "moment.write",
    handler: async (args, context) => {
        const content = typeof args.content === "string" ? args.content : "";
        if (!content.trim()) {
            return errorResult("content 不能为空");
        }

        const date = new Date();
        const inserted = await context.db.insert(moments).values({
            content,
            uid: API_KEY_CONTENT_OWNER_UID,
            createdAt: date,
            updatedAt: date,
        }).returning({ insertedId: moments.id });

        await context.cache.deletePrefix("moments_");

        return textResult({ success: true, id: inserted[0]?.insertedId });
    },
};

const updateMomentTool: McpToolDefinition = {
    name: "update_moment",
    title: "更新动态",
    description: "按动态 ID 更新动态内容。",
    inputSchema: z.object({
        id: z.number().int().min(1).describe("动态 ID"),
        content: z.string().min(1).describe("动态内容"),
    }),
    scope: "moment.write",
    handler: async (args, context) => {
        const moment = await context.db.query.moments.findFirst({ where: eq(moments.id, args.id) });
        if (!moment) {
            return errorResult("动态不存在");
        }

        const content = typeof args.content === "string" ? args.content : "";
        if (!content.trim()) {
            return errorResult("content 不能为空");
        }

        await context.db.update(moments).set({
            content,
            updatedAt: new Date(),
        }).where(eq(moments.id, args.id));

        await context.cache.deletePrefix("moments_");

        return textResult({ success: true, id: args.id });
    },
};

const deleteMomentTool: McpToolDefinition = {
    name: "delete_moment",
    title: "删除动态",
    description: "按动态 ID 删除动态。",
    inputSchema: z.object({
        id: z.number().int().min(1).describe("动态 ID"),
    }),
    scope: "moment.write",
    handler: async (args, context) => {
        const moment = await context.db.query.moments.findFirst({ where: eq(moments.id, args.id) });
        if (!moment) {
            return errorResult("动态不存在");
        }

        await context.db.delete(moments).where(eq(moments.id, args.id));
        await context.cache.deletePrefix("moments_");

        return textResult({ success: true, id: args.id });
    },
};

const createFriendTool: McpToolDefinition = {
    name: "create_friend",
    title: "创建友链",
    description: "创建一条友链条目。",
    inputSchema: z.object({
        name: z.string().min(1).max(20).describe("友链名称"),
        desc: z.string().min(1).max(100).describe("友链描述"),
        avatar: z.string().min(1).max(100).describe("头像地址"),
        url: z.string().min(1).max(100).describe("站点地址"),
        group: z.string().max(20).optional().describe("分组名称"),
        accepted: z.boolean().optional().describe("是否通过审核，默认 true"),
        sort_order: z.number().optional().describe("排序权重，默认 0"),
    }),
    scope: "friend.write",
    handler: async (args, context) => {
        const name = args.name.trim();
        const desc = args.desc.trim();
        const avatar = args.avatar.trim();
        const url = args.url.trim();

        if (!name || !desc || !avatar || !url) {
            return errorResult("name、desc、avatar 与 url 均为必填项");
        }

        const inserted = await context.db.insert(friends).values({
            name,
            desc,
            avatar,
            url,
            uid: API_KEY_CONTENT_OWNER_UID,
            accepted: (args.accepted ?? true) ? 1 : 0,
            health: "",
            sort_order: args.sort_order ?? 0,
            group: args.group ?? "",
        }).returning({ insertedId: friends.id });

        return textResult({ success: true, id: inserted[0]?.insertedId });
    },
};

const updateFriendTool: McpToolDefinition = {
    name: "update_friend",
    title: "更新友链",
    description: "按友链 ID 更新友链信息，未提供的字段保持原值。",
    inputSchema: z.object({
        id: z.number().int().min(1).describe("友链 ID"),
        name: z.string().min(1).max(20).optional().describe("友链名称"),
        desc: z.string().max(100).optional().describe("友链描述"),
        avatar: z.string().min(1).max(100).optional().describe("头像地址"),
        url: z.string().min(1).max(100).optional().describe("站点地址"),
        group: z.string().max(20).optional().describe("分组名称"),
        accepted: z.boolean().optional().describe("是否通过审核"),
        sort_order: z.number().optional().describe("排序权重"),
    }),
    scope: "friend.write",
    handler: async (args, context) => {
        const exist = await context.db.query.friends.findFirst({ where: eq(friends.id, args.id) });
        if (!exist) {
            return errorResult("友链不存在");
        }

        const updates: Partial<typeof friends.$inferInsert> = {};

        if (args.name !== undefined) {
            const name = args.name.trim();
            if (!name) {
                return errorResult("name 不能为空");
            }
            updates.name = name;
        }
        if (args.desc !== undefined) {
            updates.desc = args.desc.trim();
        }
        if (args.avatar !== undefined) {
            const avatar = args.avatar.trim();
            if (!avatar) {
                return errorResult("avatar 不能为空");
            }
            updates.avatar = avatar;
        }
        if (args.url !== undefined) {
            const url = args.url.trim();
            if (!url) {
                return errorResult("url 不能为空");
            }
            updates.url = url;
        }
        if (args.group !== undefined) {
            updates.group = args.group.trim();
        }
        if (args.accepted !== undefined) {
            updates.accepted = args.accepted ? 1 : 0;
        }
        if (args.sort_order !== undefined) {
            updates.sort_order = args.sort_order;
        }

        if (Object.keys(updates).length === 0) {
            return textResult({ success: true, id: args.id });
        }

        updates.updatedAt = new Date();

        await context.db.update(friends)
            .set(updates)
            .where(eq(friends.id, args.id));

        return textResult({ success: true, id: args.id });
    },
};

const deleteFriendTool: McpToolDefinition = {
    name: "delete_friend",
    title: "删除友链",
    description: "按友链 ID 删除友链条目。",
    inputSchema: z.object({
        id: z.number().int().min(1).describe("友链 ID"),
    }),
    scope: "friend.write",
    handler: async (args, context) => {
        const exist = await context.db.query.friends.findFirst({ where: eq(friends.id, args.id) });
        if (!exist) {
            return errorResult("友链不存在");
        }

        await context.db.delete(friends).where(eq(friends.id, args.id));

        return textResult({ success: true, id: args.id });
    },
};

const getConfigTool: McpToolDefinition = {
    name: "get_config",
    title: "读取配置",
    description: "读取设置页中某个分区的配置项，需要该分区对应的 config.* 权限。",
    inputSchema: z.object({
        section: z.string().min(1).describe("配置分区名称，例如 site、personalization、ai"),
    }),
    scopes: MCP_CONFIG_SCOPES,
    handler: async (args, context) => {
        const section = resolveApiKeyConfigSection(args.section);
        if (!section) {
            return errorResult(`未知配置分区: ${args.section}`);
        }
        if (!hasScope(context, section.scope)) {
            return errorResult(`当前密钥缺少 "${section.scope}" 权限`);
        }

        const clientValues: Record<string, unknown> = {};
        for (const key of section.clientKeys) {
            clientValues[key] = await context.clientConfig.get(key);
        }

        const serverValues: Record<string, unknown> = {};
        for (const key of section.serverKeys) {
            serverValues[key] = await context.serverConfig.get(key);
        }

        let aiValues: Record<string, unknown> | undefined;
        if (section.includeAI) {
            const aiConfig = await getAIConfig(context.serverConfig);
            aiValues = {
                "ai_summary.enabled": aiConfig.enabled,
                "ai_summary.provider": aiConfig.provider,
                "ai_summary.model": aiConfig.model,
                "ai_summary.api_url": aiConfig.api_url,
                "ai_summary.retries": aiConfig.retries,
                "ai_summary.failover": aiConfig.failover,
                "ai_summary.api_key_set": aiConfig.api_key.length > 0,
                "ai_search.enabled": serverValues["ai_search.enabled"],
            };
        }

        return textResult({
            section: args.section,
            scope: section.scope,
            client: clientValues,
            server: serverValues,
            ...(aiValues ? { ai: aiValues } : {}),
        });
    },
};

const updateConfigTool: McpToolDefinition = {
    name: "update_config",
    title: "更新配置",
    description: "更新设置页中某个分区的配置项，需要该分区对应的 config.* 权限，越权键会被拒绝。",
    inputSchema: z.object({
        section: z.string().min(1).describe("配置分区名称，例如 site、personalization、ai"),
        values: z.record(z.string(), z.unknown()).describe("配置键值对，键名形如 site.name"),
    }),
    scopes: MCP_CONFIG_SCOPES,
    handler: async (args, context) => {
        const section = resolveApiKeyConfigSection(args.section);
        if (!section) {
            return errorResult(`未知配置分区: ${args.section}`);
        }
        if (!hasScope(context, section.scope)) {
            return errorResult(`当前密钥缺少 "${section.scope}" 权限`);
        }

        const values = args.values ?? {};
        const rejected: string[] = [];
        const clientUpdates: Record<string, unknown> = {};
        const serverUpdates: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(values)) {
            if (!isAllowedConfigKey(section, key)) {
                rejected.push(key);
                continue;
            }
            if (section.clientKeys.includes(key)) {
                clientUpdates[key] = value;
            } else {
                serverUpdates[key] = value;
            }
        }

        if (rejected.length > 0) {
            return errorResult(`以下配置项无法使用 "${section.scope}" 权限写入: ${rejected.join(", ")}`);
        }
        if (Object.keys(clientUpdates).length === 0 && Object.keys(serverUpdates).length === 0) {
            return errorResult("没有可写入的配置项");
        }

        const { regularConfig: regularClient } = splitConfigPayload(clientUpdates);
        const { regularConfig: regularServer, aiConfigUpdates } = splitConfigPayload(serverUpdates);

        if (Object.keys(regularClient).length > 0) {
            await persistRegularConfig(context.clientConfig, regularClient);
        }
        if (Object.keys(regularServer).length > 0) {
            await persistRegularConfig(context.serverConfig, regularServer);
        }
        if (Object.keys(aiConfigUpdates).length > 0) {
            await setAIConfig(context.serverConfig, aiConfigUpdates);
        }

        return textResult({
            success: true,
            section: args.section,
            updated: Object.keys(values),
        });
    },
};

export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
    whoamiTool,
    listPostsTool,
    getPostTool,
    searchPostsTool,
    listTagsTool,
    listMomentsTool,
    listFriendsTool,
    createPostTool,
    updatePostTool,
    deletePostTool,
    createMomentTool,
    updateMomentTool,
    deleteMomentTool,
    createFriendTool,
    updateFriendTool,
    deleteFriendTool,
    getConfigTool,
    updateConfigTool,
];

export function selectMcpToolDefinitions(scopes: string[]): McpToolDefinition[] {
    return MCP_TOOL_DEFINITIONS.filter((tool) => {
        if (tool.scope) {
            return scopes.includes(tool.scope);
        }
        if (tool.scopes) {
            return tool.scopes.some((scope) => scopes.includes(scope));
        }
        return true;
    });
}
