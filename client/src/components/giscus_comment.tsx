import { useContext, useEffect, useRef, memo, useCallback } from "react";
import { ClientConfigContext } from "../state/config";

interface GiscusCommentProps {
  feedId: string;
}

declare global {
  interface Window {
    giscus?: {
      config: Record<string, string>;
    };
  }
}

export const GiscusComment = memo(function GiscusComment({ feedId }: GiscusCommentProps) {
  const config = useContext(ClientConfigContext);
  const scriptLoadedRef = useRef(false);

  const giscusEnabled = config.getBoolean("giscus.enabled");
  
  const giscusRepo = String(config.get("giscus.repo") || "");
  const giscusRepoId = String(config.get("giscus.repoId") || "");
  const giscusCategory = String(config.get("giscus.category") || "");
  const giscusCategoryId = String(config.get("giscus.categoryId") || "");

  const loadGiscus = useCallback(() => {
    if (!giscusEnabled || !giscusRepo || !giscusRepoId) {
      return;
    }

    // Remove existing giscus script and container if switching from another view
    document.querySelectorAll("script[src*='giscus.app']").forEach(el => el.remove());
    document.querySelectorAll(".giscus").forEach(el => el.remove());

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.crossOrigin = "anonymous";
    script.async = true;
    script.setAttribute("data-repo", giscusRepo);
    script.setAttribute("data-repo-id", giscusRepoId);
    script.setAttribute("data-category", giscusCategory || "Announcements");
    script.setAttribute("data-category-id", giscusCategoryId || "");
    script.setAttribute("data-mapping", "url");
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", "preferred_color_scheme");
    script.setAttribute("data-lang", "zh-CN");
    script.setAttribute("data-loading", "lazy");

    script.onload = () => {
      console.log("Giscus script loaded successfully");
      scriptLoadedRef.current = true;
    };

    script.onerror = (err) => {
      console.error("Failed to load Giscus script:", err);
    };

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [giscusEnabled, giscusRepo, giscusRepoId, giscusCategory, giscusCategoryId]);

  useEffect(() => {
    if (!giscusEnabled) {
      return;
    }

    loadGiscus();

    return () => {
      // Cleanup giscus when component unmounts
      document.querySelectorAll(".giscus").forEach(el => {
        if (el.parentElement?.id !== 'giscus-comments-root') {
          el.remove();
        }
      });
    };
  }, [giscusEnabled, loadGiscus, feedId]);

  if (!giscusEnabled) {
    return null;
  }

  if (!giscusRepo || !giscusRepoId) {
    return (
      <div className="w-full mt-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Giscus 配置不完整，请在设置中配置 GitHub 仓库信息
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mt-4">
      <div className="giscus-container min-h-[200px]" />
    </div>
  );
});
