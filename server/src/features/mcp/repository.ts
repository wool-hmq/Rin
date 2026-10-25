import { and, count, desc, eq } from "drizzle-orm";
import type { DB } from "../../core/hono-types";
import { feeds, friends, hashtags, moments } from "../../db/schema";

export type FeedListType = "normal" | "draft" | "unlisted" | "all";

export interface FeedListOptions {
    page: number;
    limit: number;
    type: FeedListType;
}

export async function listFeedRows(db: DB, options: FeedListOptions) {
    const where = options.type === "all"
        ? undefined
        : options.type === "draft"
            ? eq(feeds.draft, 1)
            : options.type === "unlisted"
                ? and(eq(feeds.draft, 0), eq(feeds.listed, 0))
                : and(eq(feeds.draft, 0), eq(feeds.listed, 1));

    const sizeRows = await db.select({ count: count() }).from(feeds).where(where);
    const rows = await db.query.feeds.findMany({
        where,
        with: {
            hashtags: {
                columns: {},
                with: { hashtag: { columns: { id: true, name: true } } },
            },
            user: { columns: { id: true, username: true, avatar: true } },
        },
        orderBy: [desc(feeds.top), desc(feeds.createdAt), desc(feeds.updatedAt)],
        offset: options.page * options.limit,
        limit: options.limit + 1,
    });

    const hasNext = rows.length > options.limit;
    if (hasNext) {
        rows.pop();
    }

    return {
        size: sizeRows[0]?.count ?? 0,
        rows,
        hasNext,
    };
}

export function findFeedDetail(db: DB, id: number) {
    return db.query.feeds.findFirst({
        where: eq(feeds.id, id),
        with: {
            hashtags: {
                columns: {},
                with: { hashtag: { columns: { id: true, name: true } } },
            },
            user: { columns: { id: true, username: true, avatar: true } },
        },
    });
}

export function findFeedDetailByAlias(db: DB, alias: string) {
    return db.query.feeds.findFirst({
        where: eq(feeds.alias, alias),
        with: {
            hashtags: {
                columns: {},
                with: { hashtag: { columns: { id: true, name: true } } },
            },
            user: { columns: { id: true, username: true, avatar: true } },
        },
    });
}

export async function listHashtagRows(db: DB, options: { page: number; limit: number }) {
    const sizeRows = await db.select({ count: count() }).from(hashtags);
    const rows = await db.query.hashtags.findMany({
        orderBy: [desc(hashtags.createdAt)],
        offset: options.page * options.limit,
        limit: options.limit,
    });

    return {
        size: sizeRows[0]?.count ?? 0,
        rows,
    };
}

export async function listMomentRows(db: DB, options: { page: number; limit: number }) {
    const sizeRows = await db.select({ count: count() }).from(moments);
    const rows = await db.query.moments.findMany({
        with: {
            user: { columns: { id: true, username: true, avatar: true } },
        },
        orderBy: [desc(moments.createdAt)],
        offset: options.page * options.limit,
        limit: options.limit + 1,
    });

    const hasNext = rows.length > options.limit;
    if (hasNext) {
        rows.pop();
    }

    return {
        size: sizeRows[0]?.count ?? 0,
        rows,
        hasNext,
    };
}

export async function listFriendRows(db: DB, options: { page: number; limit: number }) {
    const sizeRows = await db.select({ count: count() }).from(friends);
    const rows = await db.query.friends.findMany({
        orderBy: [desc(friends.sort_order), friends.createdAt],
        offset: options.page * options.limit,
        limit: options.limit + 1,
    });

    const hasNext = rows.length > options.limit;
    if (hasNext) {
        rows.pop();
    }

    return {
        size: sizeRows[0]?.count ?? 0,
        rows,
        hasNext,
    };
}

export function findMomentById(db: DB, id: number) {
    return db.query.moments.findFirst({ where: eq(moments.id, id) });
}

export function findFriendById(db: DB, id: number) {
    return db.query.friends.findFirst({ where: eq(friends.id, id) });
}
