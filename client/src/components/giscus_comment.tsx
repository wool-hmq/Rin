import { useContext, useEffect, useRef } from "react";
import { ClientConfigContext } from "../state/config";

interface GiscusCommentSectionProps {
  feedId: string;
}

export function GiscusCommentSection({ feedId }: GiscusCommentSectionProps) {
  const config = useContext(ClientConfigContext);
  const containerRef = useRef<HTMLDivElement>(null);

  const giscusEnabled = config.getBoolean("giscus.enabled");
  const giscusRepo = String(config.get("giscus.repo") || "");
  const giscusRepoId = String(config.get("giscus.repoId") || "");
  const giscusCategory = String(config.get("giscus.category") || "");
  const giscusCategoryId = String(config.get("giscus.categoryId") || "");

  useEffect(() => {
    if (!giscusEnabled || !giscusRepo || !giscusRepoId || !containerRef.current) {
      return;
    }

    const cleanup = () => {
      containerRef.current?.querySelectorAll(".giscus").forEach(el => el.remove());
    };

    cleanup();

    const timer = setTimeout(() => {
      if (!containerRef.current) return;

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
        // Force re-render by toggling visibility
        if (containerRef.current) {
          containerRef.current.style.display = 'none';
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.style.display = 'block';
            }
          }, 50);
        }
      };

      script.onerror = (err) => {
        console.error("Failed to load Giscus script:", err);
      };

      containerRef.current.appendChild(script);
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [giscusEnabled, giscusRepo, giscusRepoId, giscusCategory, giscusCategoryId, feedId]);

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
    <div className="w-full mt-4" ref={containerRef}>
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme"></div>
        <span className="ml-2 text-gray-500">加载 Giscus 评论中...</span>
      </div>
    </div>
  );
}
