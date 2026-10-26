export interface ApiKeyScopeDefinition {
    scope: string;
    title: string;
    description: string;
    endpoints: string[];
}

export const API_KEY_SCOPES: ApiKeyScopeDefinition[] = [
    {
        scope: "content.read",
        title: "内容读取",
        description: "通过 MCP 读取文章、标签、动态与友链内容。",
        endpoints: ["POST /mcp (tools/list, tools/call)"],
    },
    {
        scope: "feed.write",
        title: "文章管理",
        description: "通过 API 发布、编辑、删除文章。",
        endpoints: [
            "POST /api/key/feed",
            "POST /api/key/feed/:id",
            "DELETE /api/key/feed/:id",
        ],
    },
    {
        scope: "friend.write",
        title: "友链管理",
        description: "通过 API 创建、编辑、删除友链。",
        endpoints: [
            "POST /api/key/friend",
            "PUT /api/key/friend/:id",
            "DELETE /api/key/friend/:id",
        ],
    },
    {
        scope: "moment.write",
        title: "动态管理",
        description: "通过 API 发布、编辑、删除动态。",
        endpoints: [
            "POST /api/key/moment",
            "POST /api/key/moment/:id",
            "DELETE /api/key/moment/:id",
        ],
    },
    {
        scope: "config.site",
        title: "站点信息",
        description: "编辑设置中「站点信息」一节的配置项。",
        endpoints: ["GET /api/key/config/site", "POST /api/key/config/site"],
    },
    {
        scope: "config.personalization",
        title: "个性化",
        description: "编辑设置中「个性化」一节的配置项。",
        endpoints: [
            "GET /api/key/config/personalization",
            "POST /api/key/config/personalization",
        ],
    },
    {
        scope: "config.other",
        title: "其它设置",
        description: "编辑设置中「其它」一节的配置项，网站图标不在该权限范围内。",
        endpoints: ["GET /api/key/config/other", "POST /api/key/config/other"],
    },
    {
        scope: "config.comment",
        title: "评论管理",
        description: "编辑设置中「评论管理」一节的配置项。",
        endpoints: [
            "GET /api/key/config/comment",
            "POST /api/key/config/comment",
        ],
    },
    {
        scope: "config.supportly",
        title: "Supportly 客服",
        description: "编辑设置中 Supportly 客服相关配置项。",
        endpoints: [
            "GET /api/key/config/supportly",
            "POST /api/key/config/supportly",
        ],
    },
    {
        scope: "config.webhook",
        title: "Webhook",
        description: "编辑 Webhook 配置并触发测试 Webhook。",
        endpoints: [
            "GET /api/key/config/webhook",
            "POST /api/key/config/webhook",
            "POST /api/key/config/webhook/test",
        ],
    },
    {
        scope: "config.friend",
        title: "友链设置",
        description: "编辑设置中「友链设置」一节的配置项。",
        endpoints: [
            "GET /api/key/config/friend",
            "POST /api/key/config/friend",
        ],
    },
    {
        scope: "config.maintenance",
        title: "维护",
        description: "编辑设置中「维护」一节的配置项，并清空缓存。",
        endpoints: [
            "GET /api/key/config/maintenance",
            "POST /api/key/config/maintenance",
            "DELETE /api/key/config/cache",
        ],
    },
    {
        scope: "config.ai",
        title: "AI 设置",
        description: "编辑 AI 摘要与 AI 搜索相关配置。",
        endpoints: ["GET /api/key/config/ai", "POST /api/key/config/ai"],
    },
];

export const API_KEY_SCOPE_NAMES = API_KEY_SCOPES.map((item) => item.scope);

export const API_KEY_TYPE_REST = 1;
export const API_KEY_TYPE_MCP = 2;

export type ApiKeyType = typeof API_KEY_TYPE_REST | typeof API_KEY_TYPE_MCP;

export interface ApiKeyTypeDefinition {
    type: ApiKeyType;
    title: string;
    description: string;
}

export const API_KEY_TYPES: ApiKeyTypeDefinition[] = [
    {
        type: API_KEY_TYPE_REST,
        title: "API 接口",
        description: "用于外部脚本调用 /api/key/* 接口读写内容。",
    },
    {
        type: API_KEY_TYPE_MCP,
        title: "MCP",
        description: "用于 MCP 客户端调用 /mcp 端点。",
    },
];

// content.read only powers the MCP read tools, so REST keys skip it.
const MCP_ONLY_SCOPE_NAMES = new Set<string>(["content.read"]);

export function isApiKeyType(value: unknown): value is ApiKeyType {
    return value === API_KEY_TYPE_REST || value === API_KEY_TYPE_MCP;
}

export function isScopeAllowedForApiKeyType(scope: string, type: ApiKeyType): boolean {
    if (!isApiKeyScope(scope)) {
        return false;
    }
    if (type === API_KEY_TYPE_MCP) {
        return true;
    }
    return !MCP_ONLY_SCOPE_NAMES.has(scope);
}

export function getApiKeyScopesForType(type: ApiKeyType): ApiKeyScopeDefinition[] {
    return API_KEY_SCOPES.filter((item) => isScopeAllowedForApiKeyType(item.scope, type));
}

export function describeApiKeyType(type: ApiKeyType): string {
    return type === API_KEY_TYPE_MCP ? "MCP" : "API";
}

export function isApiKeyScope(value: string): boolean {
    return API_KEY_SCOPE_NAMES.includes(value);
}

export function hasApiKeyScope(scopes: string[], required: string): boolean {
    return scopes.includes(required);
}
