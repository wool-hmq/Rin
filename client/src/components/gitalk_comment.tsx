import { useContext, useEffect, useRef, useState } from "react";
import { ClientConfigContext } from "../state/config";

const GITALK_CDN_JS = "https://cdn.jsdelivr.net/npm/gitalk@1.8.0/dist/gitalk.min.js";
const GITALK_CDN_CSS = "https://cdn.jsdelivr.net/npm/gitalk@1.7.2/dist/gitalk.css";

interface GitalkOptions {
  clientID: string;
  clientSecret: string;
  repo: string;
  owner: string;
  admin: string[];
  id: string;
  title?: string;
  labels?: string[];
  distractionFreeMode?: boolean;
  language?: string;
  pagerDirection?: "last" | "first";
  createIssueManually?: boolean;
  enableHotKey?: boolean;
}

interface GitalkInstance {
  render: (el: string) => void;
  init: () => Promise<void>;
}

declare global {
  interface Window {
    Gitalk?: new (options: GitalkOptions) => GitalkInstance;
  }
}

interface GitalkCommentProps {
  feedId: string;
}

export function GitalkComment({ feedId }: GitalkCommentProps) {
  const config = useContext(ClientConfigContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const gitalkEnabled = config.getBoolean("gitalk.enabled");
  const gitalkClientID = String(config.get("gitalk.clientID") || "");
  const gitalkClientSecret = String(config.get("gitalk.clientSecret") || "");
  const gitalkRepo = String(config.get("gitalk.repo") || "");
  const gitalkOwner = String(config.get("gitalk.owner") || "");
  const gitalkAdmin = String(config.get("gitalk.admin") || gitalkOwner);

  useEffect(() => {
    if (!gitalkEnabled || !gitalkClientID || !gitalkRepo || !gitalkOwner || !containerRef.current || initializedRef.current) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = GITALK_CDN_CSS;
    document.head.appendChild(cssLink);

    const initGitalk = () => {
      if (cancelled || !window.Gitalk || !containerRef.current) return;
      try {
        const adminList = gitalkAdmin.split(",").map((item) => item.trim()).filter(Boolean);
        const gitalk = new window.Gitalk({
          clientID: gitalkClientID,
          clientSecret: gitalkClientSecret,
          repo: gitalkRepo,
          owner: gitalkOwner,
          admin: adminList.length > 0 ? adminList : [gitalkOwner],
          id: `feed-${feedId}`,
          distractionFreeMode: false,
          language: "zh-CN",
          pagerDirection: "last",
        });
        gitalk.render("gitalk-container");
        initializedRef.current = true;
        setLoading(false);
      } catch (err: any) {
        console.error("Gitalk init failed:", err);
        setError(`Gitalk 初始化失败：${err?.message || err}`);
        setLoading(false);
      }
    };

    if (window.Gitalk) {
      initGitalk();
      return;
    }

    const script = document.createElement("script");
    script.src = GITALK_CDN_JS;
    script.crossOrigin = "anonymous";
    script.async = true;

    script.onload = () => {
      if (window.Gitalk) {
        initGitalk();
      } else {
        setError("Gitalk 加载失败：window.Gitalk 未定义");
        setLoading(false);
      }
    };

    script.onerror = () => {
      setError("Gitalk 脚本加载失败，请检查网络连接");
      setLoading(false);
    };

    document.body.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [gitalkEnabled, gitalkClientID, gitalkClientSecret, gitalkRepo, gitalkOwner, gitalkAdmin, feedId]);

  if (!gitalkEnabled) {
    return null;
  }

  if (!gitalkClientID || !gitalkRepo || !gitalkOwner) {
    return (
      <div className="w-full mt-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Gitalk 配置不完整，请在设置中配置 GitHub OAuth 应用信息与仓库
          </p>
        </div>
      </div>
    );
  }

  const handleErrorClose = () => {
    setError(null);
    initializedRef.current = false;
  };

  return (
    <div className="w-full mt-4">
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme"></div>
          <span className="ml-2 text-gray-500">加载 Gitalk 评论中...</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <i className="ri-error-warning-line text-red-500 mr-2"></i>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Gitalk 加载失败</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                请确认：1) 已创建 GitHub OAuth App 2) Client ID/Secret 填写正确 3) 仓库已开启 Issues
              </p>
            </div>
            <button
              className="ml-2 flex-shrink-0 px-3 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full hover:bg-red-200 dark:hover:bg-red-800"
              onClick={handleErrorClose}
            >
              重试
            </button>
          </div>
        </div>
      )}
      <div id="gitalk-container" ref={containerRef} className={loading || error ? "hidden" : ""} />
    </div>
  );
}