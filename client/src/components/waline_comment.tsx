import { useContext, useEffect, useRef, useState } from "react";
import { ClientConfigContext } from "../state/config";

const WALINE_CDN_JS = "https://cdn.jsdelivr.net/npm/@waline/client@v3/dist/waline.js";
const WALINE_CDN_CSS = "https://cdn.jsdelivr.net/npm/@waline/client@v3/dist/waline.css";

interface WalineCommentProps {
  feedId: string;
}

export function WalineComment({ feedId }: WalineCommentProps) {
  const config = useContext(ClientConfigContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const walineEnabled = config.getBoolean("waline.enabled");
  const walineServerURL = String(config.get("waline.serverURL") || "");

  useEffect(() => {
    if (!walineEnabled || !walineServerURL || !containerRef.current) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = WALINE_CDN_CSS;
    document.head.appendChild(cssLink);

    import(/* @vite-ignore */ WALINE_CDN_JS)
      .then((mod) => {
        if (cancelled) return;
        console.log("Initializing Waline with serverURL:", walineServerURL, "path:", `/feed/${feedId}`);

        mod.init({
          el: "#waline-container",
          serverURL: walineServerURL,
          path: `/feed/${feedId}`,
          lang: "zh-CN",
        });
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load Waline script:", err);
        setError("Waline 脚本加载失败，请检查网络连接");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [walineEnabled, walineServerURL, feedId]);

  if (!walineEnabled) {
    return null;
  }

  if (!walineServerURL) {
    return (
      <div className="w-full mt-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Waline 配置不完整，请在设置中配置 Waline 服务端地址
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
          <span className="ml-2 text-gray-500">加载 Waline 评论中...</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <i className="ri-error-warning-line text-red-500 mr-2"></i>
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Waline 加载失败
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}
      <div id="waline-container" ref={containerRef} className={loading || error ? "hidden" : ""} />
    </div>
  );
}
