import { useContext, useEffect, useRef } from "react";
import { ClientConfigContext } from "../state/config";

interface GiscusCommentProps {
  feedId: string;
}

export function GiscusComment({ feedId }: GiscusCommentProps) {
  const config = useContext(ClientConfigContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const giscusEnabled = config.getBoolean("giscus.enabled");
  const giscusConfig = {
    repo: config.get("giscus.repo") || "",
    repoId: config.get("giscus.repoId") || "",
    category: config.get("giscus.category") || "",
    categoryId: config.get("giscus.categoryId") || "",
  };

  useEffect(() => {
    if (!giscusEnabled || !containerRef.current || initializedRef.current) {
      return;
    }

    if (!giscusConfig.repo || !giscusConfig.repoId) {
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
      script.setAttribute("data-repo", giscusConfig.repo);
      script.setAttribute("data-repo-id", giscusConfig.repoId);
      script.setAttribute("data-category", giscusConfig.category);
      script.setAttribute("data-category-id", giscusConfig.categoryId);
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
  }, [giscusEnabled, giscusConfig, feedId]);

  if (!giscusEnabled) {
    return null;
  }

  return (
    <div className="w-full mt-4">
      <div ref={containerRef} className="giscus-container" />
    </div>
  );
}
