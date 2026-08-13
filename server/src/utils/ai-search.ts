import { and, desc, eq, like, or } from "drizzle-orm";
import { feeds } from "../db/schema";
import { getAIConfig, getAISearchEnabled } from "./db-config";
import { executeAICompletion } from "./ai";

type ConfigReader = {
    get(key: string): Promise<unknown>;
};

export const AI_SEARCH_FALLBACK_REASONS = {
    DISABLED: "ai_search.disabled",
    UNCONFIGURED: "ai_unconfigured",
    LLM_FAILED: "llm_failed",
} as const;

export const AI_SEARCH_SYSTEM_PROMPT =
    "你是一个中文博客搜索助手。请理解用户的搜索意图，从候选文章中选择相关文章，并按相关性从高到低排列。" +
    "只返回文章 id 的 JSON 数组（例如 [\"12\",\"5\",\"3\"]），不要输出任何其他文字。如果没有文章相关，返回空数组 []。";

const CANDIDATE_LIMIT = 50;
const TITLE_MAX = 100;
const SUMMARY_MAX = 300;

export type AISearchCandidate = {
    id: number;
    title: string | null;
    summary: string;
    ai_summary: string;
};

export type AISearchResult = {
    mode: "ai" | "keyword";
    fallbackReason?: string;
    ids?: string[];
};

function truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? value.slice(0, maxLength) + "..." : value;
}

/**
 * Rough keyword filter to build the candidate article set for the LLM.
 */
export async function getAISearchCandidates(
    db: any,
    keyword: string,
    limit: number = CANDIDATE_LIMIT,
): Promise<AISearchCandidate[]> {
    const searchKeyword = `%${keyword}%`;
    const whereClause = or(
        like(feeds.title, searchKeyword),
        like(feeds.content, searchKeyword),
        like(feeds.summary, searchKeyword),
        like(feeds.alias, searchKeyword),
    );

    const rows = await db.query.feeds.findMany({
        where: and(whereClause, eq(feeds.draft, 0)),
        columns: {
            id: true,
            title: true,
            summary: true,
            ai_summary: true,
        },
        orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
        limit: Math.max(1, Math.min(limit, CANDIDATE_LIMIT)),
    });

    return (rows as any[]).map((row) => ({
        id: row.id,
        title: row.title ?? "",
        summary: row.summary ?? "",
        ai_summary: row.ai_summary ?? "",
    }));
}

/**
 * Build the messages sent to the LLM for relevance ranking.
 */
export function buildSearchPrompt(
    keyword: string,
    candidates: AISearchCandidate[],
): Array<{ role: "system" | "user"; content: string }> {
    const lines = candidates.map((candidate) => {
        const blocks = [`[id: ${candidate.id}] 标题：${truncate(candidate.title ?? "", TITLE_MAX)}`];
        if (candidate.summary) {
            blocks.push(`简介：${truncate(candidate.summary, SUMMARY_MAX)}`);
        }
        if (candidate.ai_summary) {
            blocks.push(`AI 总结：${truncate(candidate.ai_summary, SUMMARY_MAX)}`);
        }
        return blocks.join("\n");
    });

    return [
        { role: "system" as const, content: AI_SEARCH_SYSTEM_PROMPT },
        { role: "user" as const, content: `用户搜索：${keyword}\n\n候选文章：\n${lines.join("\n\n")}` },
    ];
}

/**
 * Tolerant parser for the LLM's id list response.
 */
export function parseSearchResult(raw: string): string[] {
    const cleaned = raw.trim();
    if (!cleaned) {
        return [];
    }

    const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : cleaned;

    const arrayMatch = candidate.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        try {
            const parsed = JSON.parse(arrayMatch[0]);
            if (Array.isArray(parsed)) {
                return parsed.map(String).filter((id) => id.trim().length > 0);
            }
        } catch {
            // fall through to line-based parsing
        }
    }

    return candidate
        .split(/[\n,]+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

/**
 * Core AI search logic over an already-fetched candidate set.
 * Returns a keyword-mode result (with reason) when AI search cannot run.
 */
export async function runAISearchOnCandidates(
    env: Env,
    serverConfig: ConfigReader,
    keyword: string,
    candidates: AISearchCandidate[],
): Promise<AISearchResult> {
    if (!(await getAISearchEnabled(serverConfig))) {
        return { mode: "keyword", fallbackReason: AI_SEARCH_FALLBACK_REASONS.DISABLED };
    }

    const aiConfig = await getAIConfig(serverConfig);
    if (!aiConfig.enabled) {
        return { mode: "keyword", fallbackReason: AI_SEARCH_FALLBACK_REASONS.UNCONFIGURED };
    }

    if (candidates.length === 0) {
        return { mode: "ai", ids: [] };
    }

    const messages = buildSearchPrompt(keyword, candidates);
    const completion = await executeAICompletion(env, serverConfig, messages, {
        maxTokens: 1024,
        temperature: 0,
    });

    if (!completion.content) {
        return {
            mode: "keyword",
            fallbackReason: completion.skipped
                ? AI_SEARCH_FALLBACK_REASONS.UNCONFIGURED
                : AI_SEARCH_FALLBACK_REASONS.LLM_FAILED,
        };
    }

    const candidateIds = new Set(candidates.map((candidate) => String(candidate.id)));
    const validIds = parseSearchResult(completion.content).filter((id) => candidateIds.has(id));

    if (validIds.length === 0) {
        return { mode: "keyword", fallbackReason: AI_SEARCH_FALLBACK_REASONS.LLM_FAILED };
    }

    return { mode: "ai", ids: validIds };
}

/**
 * AI-enhanced search entrypoint: rough keyword filter, then LLM relevance ranking.
 */
export async function runAISearch(
    env: Env,
    serverConfig: ConfigReader,
    db: any,
    keyword: string,
): Promise<AISearchResult> {
    const candidates = await getAISearchCandidates(db, keyword);
    return runAISearchOnCandidates(env, serverConfig, keyword, candidates);
}
