import { afterEach, describe, expect, it, mock } from "bun:test";
import type { AIConfig } from "@rin/api";
import { AI_CONFIG_PREFIX, AI_SEARCH_ENABLED_KEY } from "@rin/config";
import { cleanupTestDB, createMockDB } from "../../../tests/fixtures";
import type { AISearchCandidate } from "../ai-search";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createConfigReader(config: AIConfig, aiSearchEnabled = true) {
  const values = new Map<string, unknown>(
    Object.entries(config).map(([key, value]) => [`${AI_CONFIG_PREFIX}${key}`, value]),
  );
  values.set(AI_SEARCH_ENABLED_KEY, aiSearchEnabled);

  return {
    async get(key: string) {
      return values.get(key);
    },
  };
}

const enabledConfig: AIConfig = {
  enabled: true,
  provider: "openai",
  model: "gpt-4o-mini",
  api_key: "secret",
  api_url: "https://api.openai.com/v1",
  failover: [],
};

describe("getAISearchCandidates", () => {
  it("filters published feeds by keyword", async () => {
    const { db, sqlite } = createMockDB();
    sqlite.exec(`
      INSERT INTO users (id, username, avatar, openid, permission) VALUES (1, 'u', '', 'o', 0);
      INSERT INTO feeds (id, title, content, summary, ai_summary, uid, draft) VALUES
        (1, 'TypeScript Tips', 'content one', 'sum one', '', 1, 0),
        (2, 'Rust Notes', 'content two', 'sum two', '', 1, 0),
        (3, 'TypeScript Draft', 'content three', '', '', 1, 1);
    `);

    const { getAISearchCandidates } = await import("../ai-search");
    const rows = await getAISearchCandidates(db, "TypeScript");

    expect(rows.map((row) => row.id)).toEqual([1]);
    expect(rows[0]).toMatchObject({ title: "TypeScript Tips", summary: "sum one", ai_summary: "" });
    cleanupTestDB(sqlite);
  });

  it("limits candidate count to the configured maximum", async () => {
    const { db, sqlite } = createMockDB();
    sqlite.exec(`
      INSERT INTO users (id, username, avatar, openid, permission) VALUES (1, 'u', '', 'o', 0);
      INSERT INTO feeds (id, title, content, summary, ai_summary, uid, draft) VALUES
        (1, 'Common keyword', 'content', '', '', 1, 0),
        (2, 'Common keyword two', 'content', '', '', 1, 0);
    `);

    const { getAISearchCandidates } = await import("../ai-search");
    const rows = await getAISearchCandidates(db, "Common", 1);

    expect(rows).toHaveLength(1);
    cleanupTestDB(sqlite);
  });
});

describe("buildSearchPrompt", () => {
  it("includes title, summary and ai_summary for each candidate", async () => {
    const { buildSearchPrompt } = await import("../ai-search");
    const candidates: AISearchCandidate[] = [
      { id: 7, title: "Hello World", summary: "A short intro", ai_summary: "AI recap" },
    ];

    const messages = buildSearchPrompt("hello", candidates);

    expect(messages[0].role).toBe("system");
    expect(messages[1].content).toContain("用户搜索：hello");
    expect(messages[1].content).toContain("[id: 7] 标题：Hello World");
    expect(messages[1].content).toContain("简介：A short intro");
    expect(messages[1].content).toContain("AI 总结：AI recap");
  });

  it("truncates long title, summary and ai_summary fields", async () => {
    const { buildSearchPrompt } = await import("../ai-search");
    const candidates: AISearchCandidate[] = [
      { id: 1, title: "t".repeat(500), summary: "s".repeat(500), ai_summary: "a".repeat(500) },
    ];

    const messages = buildSearchPrompt("x", candidates);

    expect(messages[1].content).toContain("t".repeat(100) + "...");
    expect(messages[1].content).toContain("s".repeat(300) + "...");
    expect(messages[1].content).toContain("a".repeat(300) + "...");
  });
});

describe("parseSearchResult", () => {
  it("parses a plain JSON array", async () => {
    const { parseSearchResult } = await import("../ai-search");
    expect(parseSearchResult('["12","5","3"]')).toEqual(["12", "5", "3"]);
  });

  it("parses a JSON array wrapped in a code fence", async () => {
    const { parseSearchResult } = await import("../ai-search");
    expect(parseSearchResult('```json\n["2","1"]\n```')).toEqual(["2", "1"]);
  });

  it("extracts the array from text with extra explanation", async () => {
    const { parseSearchResult } = await import("../ai-search");
    expect(parseSearchResult('Here are results:\n["4", "8"]\nHope it helps')).toEqual(["4", "8"]);
  });

  it("falls back to line/comma separated ids for non-JSON output", async () => {
    const { parseSearchResult } = await import("../ai-search");
    expect(parseSearchResult("12, 5\n3")).toEqual(["12", "5", "3"]);
  });

  it("returns an empty array for empty input", async () => {
    const { parseSearchResult } = await import("../ai-search");
    expect(parseSearchResult("")).toEqual([]);
    expect(parseSearchResult("no ids here")).toEqual(["no ids here"]);
  });
});

describe("runAISearchOnCandidates", () => {
  it("falls back to keyword mode when the AI search switch is off", async () => {
    const { runAISearchOnCandidates } = await import("../ai-search");
    const result = await runAISearchOnCandidates(
      {} as Env,
      createConfigReader(enabledConfig, false),
      "keyword",
      [{ id: 1, title: "A", summary: "", ai_summary: "" }],
    );

    expect(result.mode).toBe("keyword");
    expect(result.fallbackReason).toBe("ai_search.disabled");
  });

  it("falls back to keyword mode when AI summary is not enabled", async () => {
    const { runAISearchOnCandidates } = await import("../ai-search");
    const result = await runAISearchOnCandidates(
      {} as Env,
      createConfigReader({ ...enabledConfig, enabled: false }),
      "keyword",
      [{ id: 1, title: "A", summary: "", ai_summary: "" }],
    );

    expect(result.mode).toBe("keyword");
    expect(result.fallbackReason).toBe("ai_unconfigured");
  });

  it("returns an empty AI result when there are no candidates", async () => {
    const { runAISearchOnCandidates } = await import("../ai-search");
    const result = await runAISearchOnCandidates({} as Env, createConfigReader(enabledConfig), "keyword", []);

    expect(result.mode).toBe("ai");
    expect(result.ids).toEqual([]);
  });

  it("ranks candidate ids in the order returned by the LLM", async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '["2","1"]' } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    const { runAISearchOnCandidates } = await import("../ai-search");
    const result = await runAISearchOnCandidates(
      {} as Env,
      createConfigReader(enabledConfig),
      "keyword",
      [
        { id: 1, title: "A", summary: "", ai_summary: "" },
        { id: 2, title: "B", summary: "", ai_summary: "" },
      ],
    );

    expect(result.mode).toBe("ai");
    expect(result.ids).toEqual(["2", "1"]);
  });

  it("drops ids that are not in the candidate set", async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '["1","999"]' } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    const { runAISearchOnCandidates } = await import("../ai-search");
    const result = await runAISearchOnCandidates(
      {} as Env,
      createConfigReader(enabledConfig),
      "keyword",
      [{ id: 1, title: "A", summary: "", ai_summary: "" }],
    );

    expect(result.mode).toBe("ai");
    expect(result.ids).toEqual(["1"]);
  });

  it("falls back to keyword mode when the LLM returns no usable ids", async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "[]" } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    const { runAISearchOnCandidates } = await import("../ai-search");
    const result = await runAISearchOnCandidates(
      {} as Env,
      createConfigReader(enabledConfig),
      "keyword",
      [{ id: 1, title: "A", summary: "", ai_summary: "" }],
    );

    expect(result.mode).toBe("keyword");
    expect(result.fallbackReason).toBe("llm_failed");
  });

  it("falls back to keyword mode when the LLM request fails", async () => {
    globalThis.fetch = mock(async () => new Response("server error", { status: 500 })) as typeof fetch;

    const { runAISearchOnCandidates } = await import("../ai-search");
    const result = await runAISearchOnCandidates(
      {} as Env,
      createConfigReader(enabledConfig),
      "keyword",
      [{ id: 1, title: "A", summary: "", ai_summary: "" }],
    );

    expect(result.mode).toBe("keyword");
    expect(result.fallbackReason).toBe("llm_failed");
  });

  it("uses the failover provider when the primary provider fails", async () => {
    let callCount = 0;
    globalThis.fetch = mock(async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response("primary error", { status: 500 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: '["1"]' } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const { runAISearchOnCandidates } = await import("../ai-search");
    const result = await runAISearchOnCandidates(
      {} as Env,
      createConfigReader({
        ...enabledConfig,
        failover: [{ provider: "deepseek", model: "deepseek-chat", api_key: "fallback-key", api_url: "" }],
      }),
      "keyword",
      [{ id: 1, title: "A", summary: "", ai_summary: "" }],
    );

    expect(result.mode).toBe("ai");
    expect(result.ids).toEqual(["1"]);
    expect(callCount).toBe(2);
  });
});
