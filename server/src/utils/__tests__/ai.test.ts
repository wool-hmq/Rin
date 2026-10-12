import { describe, expect, it } from "bun:test";
import {
    buildExternalAIChatCompletionsUrl,
    isAIModelConfigured,
    normalizeExternalAIBaseUrl,
} from "../ai";

describe("normalizeExternalAIBaseUrl", () => {
    it("removes trailing slash", () => {
        expect(normalizeExternalAIBaseUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1");
    });

    it("removes chat completions suffix", () => {
        expect(normalizeExternalAIBaseUrl("https://api.openai.com/v1/chat/completions")).toBe("https://api.openai.com/v1");
    });

    it("removes chat completions suffix after trimming", () => {
        expect(normalizeExternalAIBaseUrl(" https://api.openai.com/v1/chat/completions/ ")).toBe("https://api.openai.com/v1");
    });
});

describe("buildExternalAIChatCompletionsUrl", () => {
    it("builds standard chat completions URL from base URL", () => {
        expect(buildExternalAIChatCompletionsUrl("openai", "https://api.openai.com/v1")).toBe(
            "https://api.openai.com/v1/chat/completions",
        );
    });

    it("normalizes full chat completions URL before rebuilding", () => {
        expect(buildExternalAIChatCompletionsUrl("openai", "https://api.openai.com/v1/chat/completions")).toBe(
            "https://api.openai.com/v1/chat/completions",
        );
    });

    it("falls back to provider preset when api URL is empty", () => {
        expect(buildExternalAIChatCompletionsUrl("openai", "")).toBe(
            "https://api.openai.com/v1/chat/completions",
        );
    });
});

describe("isAIModelConfigured", () => {
    it("is configured when provider, model and api key are set", () => {
        expect(isAIModelConfigured({
            enabled: false,
            provider: "openai",
            model: "gpt-4o-mini",
            api_key: "secret",
            api_url: "",
            retries: 0,
            failover: [],
        })).toBe(true);
    });

    it("is unconfigured without a provider or model", () => {
        expect(isAIModelConfigured({
            enabled: true,
            provider: "",
            model: "",
            api_key: "secret",
            api_url: "",
            retries: 0,
            failover: [],
        })).toBe(false);
    });

    it("is unconfigured for a keyed provider without an api key", () => {
        expect(isAIModelConfigured({
            enabled: true,
            provider: "openai",
            model: "gpt-4o-mini",
            api_key: "",
            api_url: "",
            retries: 0,
            failover: [],
        })).toBe(false);
    });

    it("is configured for worker-ai without an api key", () => {
        expect(isAIModelConfigured({
            enabled: false,
            provider: "worker-ai",
            model: "glm-4.7-flash",
            api_key: "",
            api_url: "",
            retries: 0,
            failover: [],
        })).toBe(true);
    });
});
