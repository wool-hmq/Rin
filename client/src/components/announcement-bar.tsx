import { useContext } from "react";
import { ClientConfigContext } from "../state/config";

const ANNOUNCEMENT_CONTENT_KEY = "announcement.content";

export function AnnouncementBar() {
  const config = useContext(ClientConfigContext);
  const content = String(config.get<string>(ANNOUNCEMENT_CONTENT_KEY) ?? "").trim();

  if (!content) {
    return null;
  }

  return (
    <div className="announcement-bar w-full overflow-hidden bg-black">
      <div className="announcement-track flex w-max whitespace-nowrap">
        <span className="px-8 py-1.5 text-sm text-red-500">{content}</span>
        <span className="px-8 py-1.5 text-sm text-red-500" aria-hidden>
          {content}
        </span>
      </div>
      <style>{`
        @keyframes announcement-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .announcement-track {
          animation: announcement-scroll 22s linear infinite;
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
