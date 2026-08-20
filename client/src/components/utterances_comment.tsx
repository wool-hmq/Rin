import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ClientConfigContext } from "../state/config";
import { useColorMode } from "../utils/darkModeUtils";

const UTTERANCES_CDN_JS = "https://utteranc.es/client.js";

interface UtterancesCommentProps {
  feedId: string;
}

export function UtterancesComment({ feedId }: UtterancesCommentProps) {
  const config = useContext(ClientConfigContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const colorMode = useColorMode();

  const utterancesEnabled = config.getBoolean("utterances.enabled");
  const utterancesRepo = String(config.get("utterances.repo") || "");
  const utterancesTerm = String(config.get("utterances.issueTerm") || "pathname");

  const buildTheme = useCallback(() => {
    return colorMode === "dark" ? "github-dark" : "github-light";
  }, [colorMode]);

  useEffect(() => {
    if (!utterancesEnabled || !utterancesRepo || !containerRef.current) {
      return;
    }

    setLoading(true);
    setError(null);

    const cleanup = () => {
      containerRef.current?.querySelectorAll('iframe.utterances-frame, .utterances').forEach(el => el.remove());
    };

    cleanup();

    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      const script = document.createElement("script");
      script.src = UTTERANCES_CDN_JS;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.setAttribute("repo", utterancesRepo);
      script.setAttribute("issue-term", utterancesTerm || "pathname");
      script.setAttribute("theme", buildTheme());
      script.setAttribute("label", "utterances");

      script.onload = () => {
        console.log("Utterances script loaded successfully");
        setTimeout(() => {
          setLoading(false);
        }, 200);
      };

      script.onerror = (err) => {
        console.error("Failed to load Utterances script:", err);
        setError("Utterances 脚本加载失败，请检查网络连接");
        setLoading(false);
      };

      containerRef.current.appendChild(script);
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [utterancesEnabled, utterancesRepo, utterancesTerm, buildTheme, feedId]);

  useEffect(() => {
    if (!utterancesEnabled || !utterancesRepo) return;

    const iframe = containerRef.current?.querySelector<HTMLIFrameElement>('iframe.utterances-frame');
    if (!iframe) return;

    const message = { type: "set-theme", theme: buildTheme() };
    iframe.contentWindow?.postMessage(message, "https://utteranc.es");
  }, [buildTheme, utterancesEnabled, utterancesRepo]);

  if (!utterancesEnabled) {
    return null;
  }

  if (!utterancesRepo) {
    return (
      <div className="w-full mt-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Utterances 配置不完整，请在设置中配置 GitHub 仓库信息
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
          <span className="ml-2 text-gray-500">加载 Utterances 评论中...</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <i className="ri-error-warning-line text-red-500 mr-2"></i>
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Utterances 加载失败</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                请确认：1) 仓库格式为 username/repo 2) 仓库已公开 3) 仓库已安装 utterances app
              </p>
            </div>
          </div>
        </div>
      )}
      <div ref={containerRef} className={loading || error ? "hidden" : ""} />
    </div>
  );
}