import { useContext, useEffect, useRef, memo } from "react";
import { ClientConfigContext } from "../state/config";

interface GiscusCommentProps {
  feedId: string;
}

interface GiscusConfig {
  repo: string | null;
  repoId: string | null;
  category: string | null;
  categoryId: string | null;
}

export const GiscusComment = memo(function GiscusComment({ feedId }: GiscusCommentProps) {
  const config = useContext(ClientConfigContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const giscusEnabled = config.getBoolean("giscus.enabled");
  
  const giscusRepo = config.get("giscus.repo");
  const giscusRepoId = config.get("giscus.repoId");
  const giscusCategory = config.get("giscus.category");
  const giscusCategoryId = config.get("giscus.categoryId");

  useEffect(() => {
    if (!giscusEnabled || !containerRef.current || initializedRef.current) {
      return;
    }

    if (!giscusRepo || !giscusRepoId) {
      console.error("Giscus: Missing required configuration");
      return;
    }

    const loadGiscus = () => {
      if (document.querySelector("script[src*='giscus.app']")) {
        initGiscus();
        return;
      }

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
        initGiscus();
      };

      script.onerror = () => {
        console.error("Failed to load Giscus script");
      };

      document.body.appendChild(script);
    };

    const initGiscus = () => {
      const giscusContainer = document.querySelector(".giscus");
      if (giscusContainer && containerRef.current) {
        initializedRef.current = true;
      }
    };

    loadGiscus();

    return () => {
      initializedRef.current = false;
    };
  }, [giscusEnabled, giscusRepo, giscusRepoId, giscusCategory, giscusCategoryId, feedId]);

  if (!giscusEnabled) {
    return null;
  }

  return (
    <div className="w-full mt-4">
      <div ref={containerRef} className="giscus-container" />
    </div>
  );
});
