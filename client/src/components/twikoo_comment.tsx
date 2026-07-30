import { useEffect, useRef, useContext } from "react";
import { ClientConfigContext } from "../state/config";

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

  const twikooEnabled = config.getBoolean("twikoo.enabled");
  const twikooEnvId = config.get("twikoo.envId");

  useEffect(() => {
    if (!twikooEnabled || !twikooEnvId || !containerRef.current || initializedRef.current) {
      return;
    }

    const loadTwikoo = async () => {
      if (!window.twikoo) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/twikoo@1.7.15/dist/twikoo.min.js";
        script.crossOrigin = "anonymous";
        script.integrity = "sha384-4KfOjEinLSkv1i1J8TzlkC/RTnuiLoR1OLerVgjEKoH5djYtbf7mzEFsz9p3nfuA";
        document.body.appendChild(script);

        script.onload = () => {
          if (window.twikoo) {
            initTwikoo();
          }
        };
      } else {
        initTwikoo();
      }
    };

    const initTwikoo = () => {
      if (!window.twikoo) return;

      window.twikoo
        .init({
          envId: twikooEnvId as string,
          el: "#twikoo-container",
          path: `/feed/${feedId}`,
          lang: "zh-CN",
        })
        .then(() => {
          initializedRef.current = true;
        })
        .catch((err) => {
          console.error("Twikoo init failed:", err);
        });
    };

    loadTwikoo();
  }, [twikooEnabled, twikooEnvId, feedId]);

  if (!twikooEnabled || !twikooEnvId) {
    return null;
  }

  return (
    <div className="w-full mt-4">
      <div id="twikoo-container" ref={containerRef} />
    </div>
  );
}
