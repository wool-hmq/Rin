import type { ReactNode } from "react";
import { Helmet } from "react-helmet";
import type { ConfigWrapper } from "@rin/config";
import type { Profile } from "../state/profile";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";

export function AppProviders({
  children,
  config,
  profile,
}: {
  children: ReactNode;
  config: ConfigWrapper;
  profile: Profile | undefined | null;
}) {
  const supportlyEnabled = config.getBoolean("supportly.enabled");
  const supportlyChannelId = String(config.get("supportly.channelId") || "");
  const supportlyTitle = String(config.get("supportly.title") || "在线客服");

  return (
    <ClientConfigContext.Provider value={config}>
      <ProfileContext.Provider value={profile}>
        <Helmet>
          <link rel="icon" href="/favicon.ico" />
          {supportlyEnabled && supportlyChannelId && (
            <script
              src="https://supportly-api.jiaoblog.dpdns.org/widget/supportly.js"
              data-channel-id={supportlyChannelId}
              data-title={supportlyTitle}
              async
            />
          )}
        </Helmet>
        {children}
      </ProfileContext.Provider>
    </ClientConfigContext.Provider>
  );
}
