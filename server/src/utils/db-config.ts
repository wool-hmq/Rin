import type { AIConfig, AISummaryFailoverItem } from "@rin/api";
import { AI_CONFIG_PREFIX, DEFAULT_AI_CONFIG } from "@rin/config";

type ConfigReader = {
    get(key: string): Promise<unknown>;
};

type ConfigWriter = ConfigReader & {
    set(key: string, value: unknown, save?: boolean): Promise<void>;
    save(): Promise<void>;
};

const AI_CONFIG_FIELDS = ["enabled", "provider", "model", "api_key", "api_url", "failover"] as const;

function parseFailover(value: unknown): AISummaryFailoverItem[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
            provider: typeof item.provider === "string" ? item.provider : "",
            model: typeof item.model === "string" ? item.model : "",
        }))
        .filter((item) => item.provider.length > 0 && item.model.length > 0);
}

function parseStoredFailover(value: unknown): AISummaryFailoverItem[] {
    if (Array.isArray(value)) {
        return parseFailover(value);
    }

    if (typeof value === "string" && value.trim().length > 0) {
        try {
            return parseFailover(JSON.parse(value));
        } catch {
            return [];
        }
    }

    return [];
}

function serializeFailover(value: unknown): string {
    const items = Array.isArray(value)
        ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        : [];
    return JSON.stringify(
        items
            .map((item) => ({
                provider: typeof item.provider === "string" ? item.provider : "",
                model: typeof item.model === "string" ? item.model : "",
            }))
            .filter((item) => item.provider.length > 0 && item.model.length > 0),
    );
}

export function readAIConfigFromValues(values: Record<string, unknown>): AIConfig {
    const config: AIConfig = { ...DEFAULT_AI_CONFIG };

    const enabled = values[AI_CONFIG_PREFIX + "enabled"];
    if (enabled != null) {
        config.enabled = enabled === true || enabled === "true";
    }

    const provider = values[AI_CONFIG_PREFIX + "provider"];
    if (typeof provider === "string" && provider.length > 0) {
        config.provider = provider;
    }

    const model = values[AI_CONFIG_PREFIX + "model"];
    if (typeof model === "string") {
        config.model = model;
    }

    const apiKey = values[AI_CONFIG_PREFIX + "api_key"];
    if (typeof apiKey === "string") {
        config.api_key = apiKey;
    }

    const apiUrl = values[AI_CONFIG_PREFIX + "api_url"];
    if (typeof apiUrl === "string") {
        config.api_url = apiUrl;
    }

    const failover = values[AI_CONFIG_PREFIX + "failover"];
    if (failover != null) {
        config.failover = parseStoredFailover(failover);
    }

    return config;
}

export function readAIConfigFromMap(values: Map<string, unknown>): AIConfig {
    return readAIConfigFromValues(Object.fromEntries(values));
}

export async function getAIConfig(config: ConfigReader): Promise<AIConfig> {
    const values = await Promise.all(
        AI_CONFIG_FIELDS.map(async (field) => [field, await config.get(AI_CONFIG_PREFIX + field)] as const),
    );

    return readAIConfigFromValues(
        Object.fromEntries(values.map(([field, value]) => [AI_CONFIG_PREFIX + field, value])),
    );
}

export async function getFrontendAIEnabled(config: ConfigReader): Promise<boolean> {
    const enabled = await config.get(AI_CONFIG_PREFIX + "enabled");
    return enabled == null ? DEFAULT_AI_CONFIG.enabled : enabled === true || enabled === "true";
}

export async function setAIConfig(config: ConfigWriter, updates: Partial<AIConfig>): Promise<void> {
    for (const field of AI_CONFIG_FIELDS) {
        const value = updates[field];
        if (value === undefined) {
            continue;
        }

        if (field === "api_key" && typeof value === "string" && value.trim() === "") {
            continue;
        }

        await config.set(
            AI_CONFIG_PREFIX + field,
            field === "failover" ? serializeFailover(value) : value,
            false,
        );
    }

    await config.save();
}

export async function getAIConfigForFrontend(
    config: ConfigReader,
): Promise<AIConfig & { api_key_set: boolean }> {
    const aiConfig = await getAIConfig(config);
    return {
        ...aiConfig,
        api_key: "",
        api_key_set: aiConfig.api_key.length > 0,
    };
}
