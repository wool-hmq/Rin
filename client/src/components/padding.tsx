import { useEffect, useState } from 'react';
import { Padding as RinPadding } from "@rin/ui";

export function Padding({ children, className, mode = 'both' }: { children?: React.ReactNode, className?: string, mode?: 'left' | 'right' | 'both' }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (mode === 'right') {
      fetch('https://r2page.jiaoblog.dpdns.org/sidebar.json', { cache: 'no-cache' })
        .then(res => res.json())
        .then(json => setData(json))
        .catch(err => console.error("R2 Data Load Failed:", err));
    }
  }, [mode]);

  if (mode === 'left') {
    return null;
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
