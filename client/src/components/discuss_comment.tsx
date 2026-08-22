import { useContext, useEffect, useRef, useState } from "react";
import { ClientConfigContext } from "../state/config";

const DISCUSS_CDN = "https://sdk.discuss.team/npm/discuss.js";

interface DiscussOptions {
  el: string;
  api: string;
  token?: string;
  repo?: string;
  channel?: string;
  path?: string;
  lang?: string;
}

declare global {
  interface Window {
    Discuss?: new (options: DiscussOptions) => unknown;
  }
}

interface DiscussCommentProps {
  feedId: string;
}

export function DiscussComment({ feedId }: DiscussCommentProps) {
  const config = useContext(ClientConfigContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const discussEnabled = config.getBoolean("discuss.enabled");
  const discussApi = String(config.get("discuss.api") || "");
  const discussToken = String(config.get("discuss.token") || "");
  const discussRepo = String(config.get("discuss.repo") || "");
  const discussChannel = String(config.get("discuss.channel") || "");

  useEffect(() => {
    if (!discussEnabled || !discussApi || !containerRef.current || initializedRef.current) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const initDiscuss = () => {
      if (cancelled || !window.Discuss || !containerRef.current) return;
      try {
        new window.Discuss({
          el: "#discuss-container",
          api: discussApi,
          token: discussToken || undefined,
          repo: discussRepo || undefined,
          channel: discussChannel || undefined,
          path: `/feed/${feedId}`,
          lang: "zh-CN",
        });
        initializedRef.current = true;
        setLoading(false);
      } catch (err: any) {
        console.error("Discuss init failed:", err);
        setError(`Discuss 初始化失败：${err?.message || err}`);
        setLoading(false);
      }
    };

    if (window.Discuss) {
      initDiscuss();
      return;
    }

    const script = document.createElement("script");
    script.src = DISCUSS_CDN;
    script.crossOrigin = "anonymous";
    script.async = true;

    script.onload = () => {
      if (window.Discuss) {
        initDiscuss();
      } else {
        setError("Discuss 加载失败：window.Discuss 未定义");
        setLoading(false);
      }
    };

    script.onerror = () => {
      setError("Discuss 脚本加载失败，请检查网络连接");
      setLoading(false);
    };

    document.body.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [discussEnabled, discussApi, discussToken, discussRepo, discussChannel, feedId]);

  if (!discussEnabled) {
    return null;
  }

  if (!discussApi) {
    return (
      <div className="w-full mt-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Discuss 配置不完整，请在设置中配置 API 地址
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mt-4">
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme"></div>
          <span className="ml-2 text-gray-500">加载 Discuss 评论中...</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <i className="ri-error-warning-line text-red-500 mr-2"></i>
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Discuss 加载失败</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}
      <div id="discuss-container" ref={containerRef} className={loading || error ? "hidden" : ""} />
    </div>
  );
}