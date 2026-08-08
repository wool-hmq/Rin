import { useContext, useEffect, useRef, useState } from "react";
import { ClientConfigContext } from "../state/config";
import { useColorMode } from "../utils/darkModeUtils";

const CWD_CDN_JS = "https://cdn.jsdelivr.net/npm/cwd-widget@0.1.13/dist/cwd.js";

interface CWDCommentsConfig {
  el: string | HTMLElement;
  apiBaseUrl: string;
  postSlug?: string;
  siteId?: string;
  lang?: string;
  theme?: "light" | "dark";
  pageSize?: number;
  customCssUrl?: string;
}

interface CWDCommentsInstance {
  mount: () => void;
  unmount: () => void;
  updateConfig: (config: Partial<CWDCommentsConfig>) => void;
  getConfig: () => CWDCommentsConfig;
}

declare global {
  interface Window {
    CWDComments?: new (config: CWDCommentsConfig) => CWDCommentsInstance;
  }
}

interface CWDCommentProps {
  feedId: string;
}

export function CWDComment({ feedId }: CWDCommentProps) {
  const config = useContext(ClientConfigContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<CWDCommentsInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const colorMode = useColorMode();
  const colorModeRef = useRef(colorMode);

  const cwdEnabled = config.getBoolean("cwd.enabled");
  const apiBaseUrl = String(config.get("cwd.apiBaseUrl") || "");
  const siteId = String(config.get("cwd.siteId") || "");

  useEffect(() => {
    colorModeRef.current = colorMode;
  }, [colorMode]);

  useEffect(() => {
    if (!cwdEnabled || !apiBaseUrl || !containerRef.current) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const cleanup = () => {
      cancelled = true;
      commentsRef.current?.unmount();
      commentsRef.current = null;
    };

    const initCWD = () => {
      if (cancelled || !window.CWDComments || !containerRef.current) return;
      try {
        commentsRef.current?.unmount();
        const comments = new window.CWDComments({
          el: containerRef.current,
          apiBaseUrl,
          siteId: siteId || undefined,
          postSlug: `/feed/${feedId}`,
          theme: colorModeRef.current,
        });
        commentsRef.current = comments;
        comments.mount();
        setLoading(false);
      } catch (err: any) {
        setError(`CWD 初始化失败：${err?.message || err}`);
        setLoading(false);
      }
    };

    if (window.CWDComments) {
      initCWD();
      return cleanup;
    }

    const script = document.createElement("script");
    script.src = CWD_CDN_JS;
    script.crossOrigin = "anonymous";
    script.async = true;

    script.onload = () => {
      if (window.CWDComments) {
        initCWD();
      } else {
        setError("CWD 加载失败：window.CWDComments 未定义");
        setLoading(false);
      }
    };

    script.onerror = () => {
      setError("CWD 脚本加载失败，请检查网络连接");
      setLoading(false);
    };

    document.body.appendChild(script);

    return cleanup;
  }, [cwdEnabled, apiBaseUrl, siteId, feedId]);

  useEffect(() => {
    commentsRef.current?.updateConfig({ theme: colorMode });
  }, [colorMode]);

  if (!cwdEnabled) {
    return null;
  }

  if (!apiBaseUrl) {
    return (
      <div className="w-full mt-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            CWD 配置不完整，请在设置中配置 API 地址
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
          <span className="ml-2 text-gray-500">加载 CWD 评论中...</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <i className="ri-error-warning-line text-red-500 mr-2"></i>
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                CWD 加载失败
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                请确认：1) 已部署 CWD API 2) API 地址填写正确 3) 网络连接正常
              </p>
            </div>
          </div>
        </div>
      )}
      <div id="cwd-container" ref={containerRef} className={loading || error ? "hidden" : ""} />
    </div>
  );
}
