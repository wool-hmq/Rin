import { useContext, useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { useTranslation } from "react-i18next"
import { Link, useLocation, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../app/runtime"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { ClientConfigContext } from "../state/config"
import type { SearchMode } from "@rin/api"

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean,
    mode?: SearchMode,
    fallbackReason?: string
}

export function SearchPage({ keyword }: { keyword: string }) {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const clientConfig = useContext(ClientConfigContext);
    const [, navigate] = useLocation();
    const query = new URLSearchParams(useSearch());
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = useState<FeedsData>()
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(siteConfig.pageSize, query.get("limit"))
    const mode: SearchMode = query.get("mode") === "ai" ? "ai" : "keyword"
    const aiSearchEnabled = clientConfig.getBoolean("ai_search.enabled")
    const feedListClass = siteConfig.feedLayout === "masonry" ? "wauto columns-1 gap-5 md:columns-2" : "wauto flex flex-col";
    const feedData = Array.isArray(feeds?.data) ? feeds.data : [];
    const ref = useRef("")
    function switchMode(next: SearchMode) {
        if (next === "ai" && !aiSearchEnabled) return
        const params = new URLSearchParams(query);
        params.set("mode", next)
        navigate(`?${params.toString()}`, { replace: true })
    }
    function fetchFeeds() {
        if (!keyword) return
        client.search.search(keyword, {
            page,
            limit,
            mode,
        }).then(({ data }) => {
            if (data) {
                setFeeds(data)
                setStatus('idle')
            }
        })
    }
    useEffect(() => {
        const key = `${page} ${limit} ${keyword} ${mode}`
        if (ref.current == key) return
        setStatus('loading')
        fetchFeeds()
        ref.current = key
    }, [page, limit, keyword, mode])
    const title = t('article.search.title$keyword', { keyword })
    return (
        <>
            <Helmet>
                <title>{`${title} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={title} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>
                            {t('article.search.title')}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('article.total$count', { count: feeds?.size })}
                            </p>
                        </div>
                    </div>
                    <div className="wauto flex flex-row items-center gap-2 mt-2 mb-4">
                        <button
                            onClick={() => switchMode('keyword')}
                            className={`text-sm font-normal rounded-full px-4 py-1.5 ${mode === 'keyword' ? 'text-white bg-theme' : 'text-neutral-500 border border-neutral-300 dark:border-neutral-600'}`}
                        >
                            {t('article.search.mode.keyword')}
                        </button>
                        <button
                            onClick={() => switchMode('ai')}
                            disabled={!aiSearchEnabled}
                            title={aiSearchEnabled ? '' : t('article.search.ai_unavailable')}
                            className={`text-sm font-normal rounded-full px-4 py-1.5 ${mode === 'ai' ? 'text-white bg-theme' : 'text-neutral-500 border border-neutral-300 dark:border-neutral-600'} ${!aiSearchEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {t('article.search.mode.ai')}
                        </button>
                    </div>
                    {feeds?.fallbackReason && feeds.mode === 'keyword' &&
                        <div className="wauto text-sm text-neutral-500 mb-4">
                            {t('article.search.fallback', { reason: t(`article.search.reason.${feeds.fallbackReason}`, { defaultValue: feeds.fallbackReason }) })}
                        </div>
                    }
                    <Waiting for={status === 'idle'}>
                        <div className={feedListClass}>
                            {feedData.map(({ id, ...feed }: any) => (
                                <FeedCard key={id} id={id} {...feed} />
                            ))}
                        </div>
                        <div className="wauto flex flex-row items-center mt-4 ani-show">
                            {page > 1 &&
                                <Link href={`?page=${(page - 1)}&limit=${limit}&mode=${mode}`}
                                    className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}>
                                    {t('previous')}
                                </Link>
                            }
                            <div className="flex-1" />
                            {feeds?.hasNext && mode === 'keyword' &&
                                <Link href={`?page=${(page + 1)}&limit=${limit}&mode=${mode}`}
                                    className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}>
                                    {t('next')}
                                </Link>
                            }
                        </div>
                    </Waiting>
                </main>
            </Waiting>
        </>
    )
}
