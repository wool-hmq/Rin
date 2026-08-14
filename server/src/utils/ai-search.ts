import { and, desc, eq, like, or, type SQL } from "drizzle-orm";
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
    "你是一个中文搜索引擎排序助手。请理解用户的搜索意图，从候选文章中选择相关文章，并按相关度从高到低排列。" +
    "排序规则：1. 标题命中了全部搜索词的文章权重最高，排在前面，尤其是标题与搜索词高度重合的文章；" +
    "2. 标题部分命中、或简介/AI 总结命中相关内容且语义相关的文章其次；" +
    "3. 仅 AI 总结或简介中提及了某个词、但实际内容与搜索意图无关的文章，排在最后或排除；" +
    "4. 候选文章带有“命中情况”标注，标明标题/简介/AI 总结各命中了多少个搜索词，请据此并结合语义综合判断。" +
    "只返回文章 id 的 JSON 数组（例如 [\"12\",\"5\",\"3\"]），不要输出任何其他文字。如果没有文章相关，返回空数组 []。";

const CANDIDATE_LIMIT = 50;
const TITLE_MAX = 100;
const SUMMARY_MAX = 300;
const CANDIDATE_FETCH_MULTIPLIER = 4;

export type AISearchCandidate = {
    id: number;
    title: string | null;
    summary: string;
    ai_summary: string;
    hits?: string;
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
 * Split the search keyword into terms by whitespace and common punctuation.
 * A continuous Chinese phrase without spaces stays a single term, which is
 * then broken into 2-grams for loose matching.
 */
export function tokenizeKeyword(keyword: string): string[] {
    return keyword
        .split(/[\s\u3000,，。.!！?？;；:：'"“”‘’()（）\[\]【】{}<>《》/\\|·-]+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

/**
 * Build loose match units for a single search term: the full term plus every
 * contiguous 2-gram. This lets "AACC" recall a title like "AABBCC" because
 * they share "AA" and "CC".
 */
export function buildMatchUnits(token: string): string[] {
    const units = new Set<string>([token]);
    if (token.length >= 3) {
        for (let i = 0; i < token.length - 1; i++) {
            units.add(token.slice(i, i + 2));
        }
    }
    return Array.from(units);
}

function matchesField(text: string, units: string[]): boolean {
    const lower = text.toLowerCase();
    return units.some((unit) => lower.includes(unit.toLowerCase()));
}

/**
 * Score a candidate so that strong title matches rank above weak bigram
 * matches before the list is truncated for the LLM.
 */
function scoreCandidate(
    candidate: { title: string; summary: string; ai_summary: string },
    tokens: string[],
    unitMap: Map<string, string[]>,
): number {
    let score = 0;
    for (const token of tokens) {
        const units = unitMap.get(token) ?? [token];
        const fullUnits = [token];
        if (matchesField(candidate.title, fullUnits)) {
            score += 100;
        } else if (matchesField(candidate.title, units)) {
            score += 20;
        }
        if (matchesField(candidate.summary, fullUnits)) {
            score += 10;
        } else if (matchesField(candidate.summary, units)) {
            score += 5;
        }
        if (matchesField(candidate.ai_summary, fullUnits)) {
            score += 6;
        } else if (matchesField(candidate.ai_summary, units)) {
            score += 3;
        }
    }
    return score;
}

function asTimestamp(value: unknown): number {
    return value instanceof Date ? value.getTime() : Number(value);
}

/**
 * Describe how strongly each field matches the search terms. Full-term hits
 * are reported as strong matches; 2-gram-only hits as partial matches.
 */
export function describeHits(
    candidate: { title: string; summary: string; ai_summary: string },
    tokens: string[],
    unitMap: Map<string, string[]>,
): string {
    const fullTitle = tokens.filter((token) => matchesField(candidate.title, [token])).length;
    const partialTitle = tokens.filter(
        (token) => !matchesField(candidate.title, [token]) && matchesField(candidate.title, unitMap.get(token)!),
    ).length;
    const fullSummary = tokens.filter((token) => matchesField(candidate.summary, [token])).length;
    const partialSummary = tokens.filter(
        (token) => !matchesField(candidate.summary, [token]) && matchesField(candidate.summary, unitMap.get(token)!),
    ).length;
    const fullAI = tokens.filter((token) => matchesField(candidate.ai_summary, [token])).length;
    const partialAI = tokens.filter(
        (token) => !matchesField(candidate.ai_summary, [token]) && matchesField(candidate.ai_summary, unitMap.get(token)!),
    ).length;
    const n = tokens.length;

    const parts: string[] = [];
    if (fullTitle > 0) {
        parts.push(fullTitle === n ? "标题完整命中全部搜索词" : `标题完整命中 ${fullTitle}/${n} 个搜索词`);
    } else if (partialTitle > 0) {
        parts.push(`标题部分命中 ${partialTitle}/${n} 个搜索词`);
    }
    if (fullSummary > 0) {
        parts.push(fullSummary === n ? "简介完整命中全部搜索词" : `简介完整命中 ${fullSummary}/${n} 个搜索词`);
    } else if (partialSummary > 0) {
        parts.push(`简介部分命中 ${partialSummary}/${n} 个搜索词`);
    }
    if (fullAI > 0) {
        parts.push(fullAI === n ? "AI总结完整命中全部搜索词" : `AI总结完整命中 ${fullAI}/${n} 个搜索词`);
    } else if (partialAI > 0) {
        parts.push(`AI总结部分命中 ${partialAI}/${n} 个搜索词`);
    }
    return parts.join("；");
}

/**
 * Rough candidate recall for the LLM. Uses loose 2-gram matching across
 * title, summary and ai_summary so semantically relevant posts survive the
 * filter and reach the ranking stage.
 */
export async function getAISearchCandidates(
    db: any,
    keyword: string,
    limit: number = CANDIDATE_LIMIT,
): Promise<AISearchCandidate[]> {
    const tokens = tokenizeKeyword(keyword);
    if (tokens.length === 0) {
        return [];
    }

    const conditions: SQL[] = [];
    const unitMap = new Map<string, string[]>();
    for (const token of tokens) {
        const units = buildMatchUnits(token);
        unitMap.set(token, units);
        for (const unit of units) {
            const pattern = `%${unit}%`;
            conditions.push(like(feeds.title, pattern));
            conditions.push(like(feeds.summary, pattern));
            conditions.push(like(feeds.ai_summary, pattern));
        }
    }

    const rows = (await db.query.feeds.findMany({
        where: and(or(...conditions), eq(feeds.draft, 0), eq(feeds.listed, 1)),
        columns: {
            id: true,
            title: true,
            summary: true,
            ai_summary: true,
            createdAt: true,
        },
        orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
        limit: Math.max(1, Math.min(limit, CANDIDATE_LIMIT) * CANDIDATE_FETCH_MULTIPLIER),
    })) as Array<{
        id: number;
        title: string | null;
        summary: string | null;
        ai_summary: string | null;
        createdAt: unknown;
    }>;

    const scored = rows
        .map((row) => ({
            id: row.id,
            title: row.title ?? "",
            summary: row.summary ?? "",
            ai_summary: row.ai_summary ?? "",
            createdAt: row.createdAt,
        }))
        .map((candidate) => ({
            ...candidate,
            score: scoreCandidate(candidate, tokens, unitMap),
        }))
        .sort((a, b) => b.score - a.score || asTimestamp(b.createdAt) - asTimestamp(a.createdAt))
        .slice(0, Math.max(1, Math.min(limit, CANDIDATE_LIMIT)));

    return scored.map(({ score: _score, createdAt: _createdAt, ...candidate }) => ({
        ...candidate,
        hits: describeHits(candidate, tokens, unitMap),
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
        if (candidate.hits) {
            blocks.push(`命中情况：${candidate.hits}`);
        }
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
