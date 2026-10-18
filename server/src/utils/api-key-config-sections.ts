export interface ApiKeyConfigSection {
    scope: string;
    clientKeys: string[];
    serverKeys: string[];
    includeAI?: boolean;
}

const CLIENT_SITE_KEYS = [
    "site.name",
    "site.description",
    "site.avatar",
    "site.page_size",
    "announcement.content",
    "announcement.speed",
];

const CLIENT_PERSONALIZATION_KEYS = [
    "header.layout",
    "header.behavior",
    "feed.layout",
    "feed.card_variant",
    "theme.color",
];

const CLIENT_OTHER_KEYS = [
    "login.enabled",
    "counter.enabled",
    "rss",
    "footer",
    "cache.enabled",
];

const CLIENT_COMMENT_KEYS = [
    "comment.enabled",
    "comment.default",
    "comment.systemOrder",
    "twikoo.enabled",
    "twikoo.envId",
    "giscus.enabled",
    "giscus.repo",
    "giscus.repoId",
    "giscus.category",
    "giscus.categoryId",
    "waline.enabled",
    "waline.serverURL",
    "cwd.enabled",
    "cwd.apiBaseUrl",
    "cwd.siteId",
    "gitalk.enabled",
    "gitalk.clientID",
    "gitalk.clientSecret",
    "gitalk.repo",
    "gitalk.owner",
    "gitalk.admin",
    "utterances.enabled",
    "utterances.repo",
    "utterances.issueTerm",
    "discuss.enabled",
    "discuss.api",
    "discuss.token",
    "discuss.repo",
    "discuss.channel",
];

const CLIENT_SUPPORTLY_KEYS = [
    "supportly.enabled",
    "supportly.channelId",
    "supportly.title",
    "supportly.widgetUrl",
];

const SERVER_WEBHOOK_KEYS = [
    "webhook_url",
    "webhook.method",
    "webhook.content_type",
    "webhook.headers",
    "webhook.body_template",
];

const CLIENT_FRIEND_KEYS = [
    "friend_apply_enable",
    "friend_groups",
    "friend_group_order",
];

const SERVER_FRIEND_KEYS = ["friend_crontab", "friend_ua"];

const CLIENT_MAINTENANCE_KEYS = ["cache.enabled"];

const SERVER_AI_KEYS = ["ai_search.enabled"];

export const API_KEY_CONFIG_SECTIONS: Record<string, ApiKeyConfigSection> = {
    site: {
        scope: "config.site",
        clientKeys: CLIENT_SITE_KEYS,
        serverKeys: [],
    },
    personalization: {
        scope: "config.personalization",
        clientKeys: CLIENT_PERSONALIZATION_KEYS,
        serverKeys: [],
    },
    other: {
        scope: "config.other",
        clientKeys: CLIENT_OTHER_KEYS,
        serverKeys: [],
    },
    comment: {
        scope: "config.comment",
        clientKeys: CLIENT_COMMENT_KEYS,
        serverKeys: [],
    },
    supportly: {
        scope: "config.supportly",
        clientKeys: CLIENT_SUPPORTLY_KEYS,
        serverKeys: [],
    },
    webhook: {
        scope: "config.webhook",
        clientKeys: [],
        serverKeys: SERVER_WEBHOOK_KEYS,
    },
    friend: {
        scope: "config.friend",
        clientKeys: CLIENT_FRIEND_KEYS,
        serverKeys: SERVER_FRIEND_KEYS,
    },
    maintenance: {
        scope: "config.maintenance",
        clientKeys: CLIENT_MAINTENANCE_KEYS,
        serverKeys: [],
    },
    ai: {
        scope: "config.ai",
        clientKeys: [],
        serverKeys: SERVER_AI_KEYS,
        includeAI: true,
    },
};

export const API_KEY_CONFIG_SECTION_NAMES = Object.keys(API_KEY_CONFIG_SECTIONS);

export function resolveApiKeyConfigSection(name: string): ApiKeyConfigSection | null {
    return API_KEY_CONFIG_SECTIONS[name] ?? null;
}

export function isAllowedConfigKey(section: ApiKeyConfigSection, key: string): boolean {
    if (section.includeAI && key.startsWith("ai_summary.")) {
        return true;
    }
    return section.clientKeys.includes(key) || section.serverKeys.includes(key);
}
