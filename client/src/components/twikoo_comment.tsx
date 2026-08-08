import { useEffect, useRef, useContext, useState } from "react";
import { ClientConfigContext } from "../state/config";
import { useColorMode } from "../utils/darkModeUtils";

declare global {
  interface Window {
    twikoo?: {
      init: (options: {
        envId: string;
        el: string;
        region?: string;
        path?: string;
        lang?: string;
        onCommentLoaded?: () => void;
      }) => Promise<void>;
    };
  }
}

interface TwikooCommentProps {
  feedId: string;
}

export function TwikooComment({ feedId }: TwikooCommentProps) {
  const config = useContext(ClientConfigContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const colorMode = useColorMode();

  const twikooEnabled = config.getBoolean("twikoo.enabled");
  const twikooEnvId = config.get("twikoo.envId");

  useEffect(() => {
    if (!twikooEnabled || !twikooEnvId || !containerRef.current || initializedRef.current) {
      return;
    }

    setLoading(true);
    setError(null);

    const loadTwikoo = () => {
      if (window.twikoo) {
        initTwikoo();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/twikoo@1.7.15/dist/twikoo.min.js";
      script.crossOrigin = "anonymous";
      script.async = true;

      script.onload = () => {
        console.log("Twikoo script loaded successfully");
        if (window.twikoo) {
          initTwikoo();
        } else {
          setError("Twikoo 加载失败：window.twikoo 未定义");
          setLoading(false);
        }
      };

      script.onerror = () => {
        console.error("Failed to load Twikoo script");
        setError("Twikoo 脚本加载失败，请检查网络连接");
        setLoading(false);
      };

      document.body.appendChild(script);
    };

    const initTwikoo = () => {
      if (!window.twikoo) {
        setError("Twikoo 未初始化");
        setLoading(false);
        return;
      }

      console.log("Initializing Twikoo with envId:", twikooEnvId, "path:", `/feed/${feedId}`);

      window.twikoo
        .init({
          envId: twikooEnvId as string,
          el: "#twikoo-container",
          path: `/feed/${feedId}`,
          lang: "zh-CN",
          onCommentLoaded: () => {
            console.log("Twikoo comments loaded successfully");
          },
        })
        .then(() => {
          console.log("Twikoo initialized successfully");
          initializedRef.current = true;
          setLoading(false);
        })
        .catch((err) => {
          console.error("Twikoo init failed:", err);
          setError(`Twikoo 初始化失败：${err.message || err}`);
          setLoading(false);
        });
    };

    loadTwikoo();
  }, [twikooEnabled, twikooEnvId, feedId]);

  if (!twikooEnabled || !twikooEnvId) {
    return null;
  }

  return (
    <div className="w-full mt-4" data-theme={colorMode === "dark" ? "dark" : undefined}>
      <style>{`
        [data-theme="dark"] .tk-meta-input .el-input input,
        [data-theme="dark"] .tk-input .el-textarea__inner {
          color: #e5e7eb;
          background-color: #26262a;
          border-color: #3a3a3e;
        }
        [data-theme="dark"] .tk-meta-input .el-input input::placeholder,
        [data-theme="dark"] .tk-input .el-textarea__inner::placeholder {
          color: #9ca3af;
        }
      `}</style>
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme"></div>
          <span className="ml-2 text-gray-500">加载 Twikoo 评论中...</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <i className="ri-error-warning-line text-red-500 mr-2"></i>
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Twikoo 加载失败
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                请确认：1) Vercel 已部署 Twikoo 2) 环境 ID 填写正确 3) 网络连接正常
              </p>
            </div>
          </div>
        </div>
      )}
      <div id="twikoo-container" ref={containerRef} className={loading || error ? "hidden" : ""} />
    </div>
  );
}
