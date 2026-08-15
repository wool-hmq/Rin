import { useEffect, useState } from 'react';
import { Padding as RinPadding } from "@rin/ui";

const SIDEBAR_URL = 'https://r2page.jiaoblog.dpdns.org/sidebar.json';

const getSocialIcon = (platform: string) => {
  const p = platform.toLowerCase();
  if (p === 'bilibili') return null;
  return `https://img.icons8.com/ios-filled/50/ffffff/${p === 'youtube' ? 'youtube-play' : p === 'telegram' ? 'telegram-app' : p}.png`;
};

export function Padding({ children, className, mode = 'both' }: { children?: React.ReactNode, className?: string, mode?: 'left' | 'right' | 'both' }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (mode === 'left' || mode === 'right') {
      fetch(SIDEBAR_URL, { cache: 'no-cache' })
        .then(res => res.json())
        .then(json => setData(json))
        .catch(err => console.error("R2 Data Load Failed:", err));
    }
  }, [mode]);

  if (mode === 'left') {
    const card = data?.leftCard;
    const ad = data?.ad;
    const selection = data?.selection;
    if (!card && !ad && !selection) return null;
    return (
      <div className="flex flex-col gap-5 w-full">
        {card && (
          <div className="bg-white dark:bg-gray-900 rounded-[1.8rem] overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="bg-gradient-to-br from-[#0f766e] to-[#134e4a] p-5 text-center rounded-b-[1.8rem] overflow-hidden">
              {card.avatar && (
                <div className="w-14 h-14 bg-white/20 rounded-full mx-auto mb-3 border border-white/30 overflow-hidden">
                  <img src={card.avatar} className="w-full h-full object-cover" alt={card.name || ""} />
                </div>
              )}
              {card.name && (
                <h3 className="text-white font-bold text-base leading-tight">{card.name}</h3>
              )}
              {card.title && (
                <p className="text-teal-100 text-[9px] mt-1 tracking-widest uppercase opacity-80">{card.title}</p>
              )}
              {card.socials && (
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-center gap-3">
                  {Object.entries(card.socials).map(([platform, url]) => {
                    if (platform.toLowerCase() === 'bilibili') {
                      return (
                        <a key={platform} href={url as string} target="_blank" rel="noreferrer"
                          className="w-8 h-8 bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:-translate-y-1 rounded-full ring-1 ring-white/10 text-white font-black text-[10px]">
                          B
                        </a>
                      );
                    }
                    const icon = getSocialIcon(platform);
                    if (!icon) return null;
                    return (
                      <a key={platform} href={url as string} target="_blank" rel="noreferrer"
                        className="w-8 h-8 bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:-translate-y-1 rounded-full ring-1 ring-white/10 shadow-sm">
                        <img src={icon} className="w-4 h-4" alt={platform}
                          onError={(e: any) => { e.target.src = 'https://img.icons8.com/ios-filled/50/ffffff/link.png' }}
                        />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
            {card.services && card.services.length > 0 && (
              <div className="p-4 bg-white dark:bg-gray-900 text-left">
                <ul className="space-y-2.5">
                  {card.services.map((s: string, i: number) => (
                    <li key={i} className="flex items-center text-gray-700 dark:text-gray-300 text-[14px] font-bold">
                      <span className="w-3.5 h-3.5 bg-teal-50 dark:bg-teal-900/50 text-[#0f766e] dark:text-teal-400 rounded-full flex items-center justify-center mr-2 text-[9px]">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {ad && ad.link && (
          <a href={ad.link} target="_blank" rel="noreferrer"
            className="block w-full rounded-[1.8rem] overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 group transition-all">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0f766e]/10 to-[#134e4a]/10 rounded-b-[1.8rem]">
              {ad.imageUrl && (
                <img src={ad.imageUrl} className="w-full h-40 object-cover" alt={ad.title || ""} />
              )}
            </div>
            <div className="p-3.5 border-t border-gray-50 dark:border-gray-800 bg-white dark:bg-gray-900">
              <h4 className="text-gray-800 dark:text-gray-100 font-bold text-[15px] truncate mb-1">
                {[ad.title, ad.subtitle].filter(Boolean).join(' · ')}
              </h4>
              <div className="flex items-center justify-between">
                {ad.buttonText && (
                  <span className="text-[#0f766e] dark:text-teal-400 text-[12px] font-bold bg-teal-50 dark:bg-teal-900/50 px-1.5 py-0.5 rounded-md">{ad.buttonText}</span>
                )}
                <span className="text-gray-300 dark:text-gray-600 group-hover:text-[#0f766e] dark:group-hover:text-teal-400 transition-colors text-xs">→</span>
              </div>
            </div>
          </a>
        )}

        {selection && selection.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-[1.8rem] p-4 border border-gray-100 dark:border-gray-800 shadow-sm text-left">
            <h4 className="text-[11px] font-black text-gray-400 dark:text-gray-500 mb-3 tracking-widest uppercase flex items-center px-1">
              <span className="w-1 h-1 bg-[#0f766e] mr-2 rounded-full"></span> 实用工具
            </h4>
            <nav className="flex flex-col gap-0.5">
              {selection.map((item: any, i: number) => (
                <a key={i} href={item.link} target="_blank" rel="noopener"
                  className="flex items-center py-2 px-2 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-900/30 text-gray-700 dark:text-gray-300 font-bold text-[14px] transition-all">
                  <span className="text-base">{item.emoji}</span>
                  <span className="ml-3 flex-1 truncate">{item.text}</span>
                </a>
              ))}
            </nav>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'right') {
    if (!data || !data.latestPosts) return null;
    return (
      <div className="flex flex-col gap-5 w-full text-left">
        <div className="bg-white dark:bg-gray-900 rounded-[1.8rem] p-6 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-50 dark:border-gray-800">
            <span className="text-lg">🔥</span>
            <h4 className="font-bold text-gray-800 dark:text-gray-100 text-[15px]">推荐阅读</h4>
          </div>
          <nav className="flex flex-col">
            {data.latestPosts.map((post: any, i: number) => (
              <a key={i} href={post.url} className="py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 flex items-start gap-2 group transition-all">
                <span className="text-gray-300 dark:text-gray-600 group-hover:text-[#0f766e] transition-colors mt-0.5">#</span>
                <span className="text-[14px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#0f766e] dark:group-hover:text-[#14b8a6] group-hover:translate-x-1 transition-all duration-300 line-clamp-1">
                  {post.title}
                </span>
              </a>
            ))}
          </nav>
        </div>
      </div>
    );
  }

  return <RinPadding className={className}>{children}</RinPadding>;
}
