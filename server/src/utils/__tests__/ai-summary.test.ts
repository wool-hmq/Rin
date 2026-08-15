import { afterEach, describe, expect, it, mock } from "bun:test";
import type { AIConfig } from "@rin/api";
import { AI_CONFIG_PREFIX } from "@rin/config";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createAIConfigReader(config: AIConfig) {
  const values = new Map<string, unknown>(
    Object.entries(config).map(([key, value]) => [`${AI_CONFIG_PREFIX}${key}`, value]),
  );

  return {
    async get(key: string) {
      return values.get(key);
    },
  };
}

describe("generateAISummaryResult", () => {
  it("returns a concrete error when AI responds with empty content", async () => {
    const serverConfig = createAIConfigReader({
      enabled: true,
      provider: "worker-ai",
      model: "gpt-oss-120b",
      api_key: "",
      api_url: "",
      retries: 0,
      failover: [],
    });

    const { generateAISummaryResult } = await import("../ai");

    const result = await generateAISummaryResult({
      AI: {
        run: async () => ({ response: "" }),
      },
    } as unknown as Env, serverConfig, "test content");

    expect(result.summary).toBeNull();
    expect(result.skipped).toBe(false);
    expect(result.error).toContain('Empty response from AI provider "worker-ai"');
  });

  it("sends summary system prompt to Workers AI", async () => {
    const serverConfig = createAIConfigReader({
      enabled: true,
      provider: "worker-ai",
      model: "gpt-oss-120b",
      api_key: "",
      api_url: "",
      retries: 0,
      failover: [],
    });

    const calls: Array<any> = [];
    const { AI_SUMMARY_SYSTEM_PROMPT, generateAISummaryResult } = await import("../ai");

    const result = await generateAISummaryResult({
      AI: {
        run: async (_model: string, payload: any) => {
          calls.push(payload);
          return { response: "summary" };
        },
      },
    } as unknown as Env, serverConfig, "test content");

    expect(result.summary).toBe("summary");
    expect(calls).toHaveLength(1);
    expect(calls[0].messages[0]).toEqual({
      role: "system",
      content: AI_SUMMARY_SYSTEM_PROMPT,
    });
    expect(calls[0].messages[1]).toEqual({
      role: "user",
      content: "test content",
    });
  });

  it("sends summary system prompt to external AI providers", async () => {
    const serverConfig = createAIConfigReader({
      enabled: true,
      provider: "openai",
      model: "gpt-4o-mini",
      api_key: "secret",
      api_url: "https://api.openai.com/v1",
      retries: 0,
      failover: [],
    });

    const requests: Array<any> = [];
    globalThis.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(init);
      return new Response(JSON.stringify({
        choices: [{ message: { content: "summary" } }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const { AI_SUMMARY_SYSTEM_PROMPT, generateAISummaryResult } = await import("../ai");

    const result = await generateAISummaryResult({} as Env, serverConfig, "external content");

    expect(result.summary).toBe("summary");
    expect(requests).toHaveLength(1);
    const body = JSON.parse(String(requests[0].body));
    expect(body.messages[0]).toEqual({
      role: "system",
      content: AI_SUMMARY_SYSTEM_PROMPT,
    });
    expect(body.messages[1]).toEqual({
      role: "user",
      content: "external content",
    });
  });

  it("uses each failover item's own API key", async () => {
    const serverConfig = createAIConfigReader({
      enabled: true,
      provider: "openai",
      model: "gpt-4o-mini",
      api_key: "primary-key",
      api_url: "https://api.openai.com/v1",
      retries: 0,
      failover: [{ provider: "deepseek", model: "deepseek-chat", api_key: "failover-key", api_url: "", retries: 0 }],
    });

    const calls: Array<{ headers: Record<string, string>; body: any }> = [];
    globalThis.fetch = mock(async (_url, init) => {
      const headers = (init?.headers as Record<string, string>) ?? {};
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ headers, body });
      if (calls.length === 1) {
        return new Response("server error", { status: 500 });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "summary" } }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const { generateAISummaryResult } = await import("../ai");

    const result = await generateAISummaryResult({} as Env, serverConfig, "test content");

    expect(result.summary).toBe("summary");
    expect(calls).toHaveLength(2);
    expect(calls[0].headers["Authorization"]).toContain("primary-key");
    expect(calls[1].headers["Authorization"]).toContain("failover-key");
    expect(calls[1].body.model).toBe("deepseek-chat");
  });

  it("uses each failover item's own API URL for custom providers", async () => {
    const serverConfig = createAIConfigReader({
      enabled: true,
      provider: "openai",
      model: "gpt-4o-mini",
      api_key: "primary-key",
      api_url: "https://api.openai.com/v1",
      retries: 0,
      failover: [{ provider: "custom", model: "my-model", api_key: "custom-key", api_url: "https://custom.example.com/v1", retries: 0 }],
    });

    const urls: string[] = [];
    const calls: Array<{ headers: Record<string, string>; body: any }> = [];
    globalThis.fetch = mock(async (url, init) => {
      urls.push(String(url));
      const headers = (init?.headers as Record<string, string>) ?? {};
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ headers, body });
      if (calls.length === 1) {
        return new Response("server error", { status: 500 });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "summary" } }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const { generateAISummaryResult } = await import("../ai");

    const result = await generateAISummaryResult({} as Env, serverConfig, "test content");

    expect(result.summary).toBe("summary");
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe("https://api.openai.com/v1/chat/completions");
    expect(urls[1]).toBe("https://custom.example.com/v1/chat/completions");
    expect(calls[1].headers["Authorization"]).toContain("custom-key");
    expect(calls[1].body.model).toBe("my-model");
  });
});
