import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Waiting } from "../components/loading";
import { fetchR2Text } from "../utils/r2";
import { useSiteConfig } from "../hooks/useSiteConfig";

// 替换为你的 R2 实际地址
const MY_ACTIVITY_R2_URL = "https://r2page.jiaoblog.dpdns.org/my-activity.html";

export function MyActivityPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchR2Text(MY_ACTIVITY_R2_URL)
      .then((data) => {
        if (data) {
          setContent(data);
        } else {
          setError("无法加载内容");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("加载失败，请稍后重试");
        setLoading(false);
      });
  }, []);

  return (
    <>
      <Helmet>
        <title>{`${t("my_activity")} - ${siteConfig.name}`}</title>
      </Helmet>
      <div className="w-full flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-4 t-primary">{t("my_activity")}</h1>
          <Waiting for={!loading || !!error}>
            {error ? (
              <div className="text-red-500 text-center py-8">{error}</div>
            ) : (
              <div
                className="prose prose-lg dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
          </Waiting>
        </div>
      </div>
    </>
  );
}
