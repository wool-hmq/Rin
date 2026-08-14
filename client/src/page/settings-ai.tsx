import {
  SearchableSelect,
  SettingsBadge,
  SettingsCard,
  SettingsCardBody,
  SettingsCardHeader,
  SettingsCardRow,
} from "@rin/ui";
import * as Switch from "@radix-ui/react-switch";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import { client } from "../app/runtime";
import { Button } from "../components/button";
import { useAlert } from "../components/dialog";
import { ItemTitle } from "./settings-items";
import {
  AI_MODEL_PRESETS,
  AI_PROVIDER_PRESETS,
  MASKED_SECRET,
  buildAITestRequest,
  getAIProviderFields,
  getAIProviderPreset,
  type AIFailoverItem,
} from "./settings-helpers";

export type AISettingsValue = {
  enabled: boolean;
  provider: string;
  model: string;
  apiKey: string;
  apiKeySet: boolean;
  apiUrl: string;
  customCode?: string;
  failover: AIFailoverItem[];
  aiSearchEnabled: boolean;
};

export function AISummarySettings({
  value,
  onChange,
}: {
  value: AISettingsValue;
  onChange: (updates: Partial<AISettingsValue>) => void;
}) {
  const { t } = useTranslation();
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<{ success?: boolean; response?: string; error?: string; details?: string } | null>(null);
  const [failoverTest, setFailoverTest] = useState<{
    index: number;
    status: "idle" | "testing" | "success" | "error";
    result: { success?: boolean; response?: string; error?: string; details?: string } | null;
  } | null>(null);
  const { AlertUI } = useAlert();
  const providerFields = getAIProviderFields(value.provider);

  const handleProviderChange = (nextProvider: string) => {
    const preset = getAIProviderPreset(nextProvider);
    const models = AI_MODEL_PRESETS[nextProvider] || [];

    onChange({
      provider: nextProvider,
      apiUrl: preset?.url ?? "",
      model: nextProvider === "custom" ? value.model : (models[0] ?? value.model),
    });
  };

  const handleTestModel = async () => {
    setTestStatus("testing");
    setTestResult(null);
    try {
      const requestBody = buildAITestRequest({
        provider: value.provider,
        model: value.model,
        apiUrl: value.apiUrl,
        apiKey: value.apiKey,
      });

      const { data, error } = await client.config.testAI(requestBody);

      if (error) {
        setTestStatus("error");
        setTestResult({
          success: false,
          error: error.value || t("settings.ai_summary.test.failed"),
          details: t("settings.ai_summary.test.http_error$status", { status: error.status }),
        });
      } else if (data?.success) {
        setTestStatus("success");
        setTestResult({
          success: true,
          response: data.response || t("settings.ai_summary.test.success"),
        });
      } else {
        setTestStatus("error");
        setTestResult({
          success: false,
          error: data?.error || t("settings.ai_summary.test.failed"),
          details: data?.details,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestStatus("error");
      setTestResult({
        success: false,
        error: message || t("settings.ai_summary.test.error"),
      });
    }
  };

  const handleTestFailover = async (index: number) => {
    const item = value.failover[index];
    if (!item) {
      return;
    }

    setFailoverTest({ index, status: "testing", result: null });
    try {
      const useStoredKey = item.api_key === MASKED_SECRET;
      const requestBody = buildAITestRequest({
        provider: item.provider,
        model: item.model,
        apiUrl: item.api_url,
        apiKey: useStoredKey ? "" : item.api_key,
      });
      if (item.provider === "custom") {
        requestBody.api_url = item.api_url;
      }
      if (useStoredKey) {
        requestBody.use_stored_key = "true";
      }

      const { data, error } = await client.config.testAI(requestBody);

      if (error) {
        setFailoverTest({
          index,
          status: "error",
          result: {
            success: false,
            error: error.value || t("settings.ai_summary.test.failed"),
            details: t("settings.ai_summary.test.http_error$status", { status: error.status }),
          },
        });
      } else if (data?.success) {
        setFailoverTest({
          index,
          status: "success",
          result: {
            success: true,
            response: data.response || t("settings.ai_summary.test.success"),
          },
        });
      } else {
        setFailoverTest({
          index,
          status: "error",
          result: {
            success: false,
            error: data?.error || t("settings.ai_summary.test.failed"),
            details: data?.details,
          },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFailoverTest({
        index,
        status: "error",
        result: {
          success: false,
          error: message || t("settings.ai_summary.test.error"),
        },
      });
    }
  };

  const modelOptions = AI_MODEL_PRESETS[value.provider] || [];
  const providerOptions = AI_PROVIDER_PRESETS.map((p) => ({
    label: p.label,
    value: p.value,
  }));
  const modelSelectOptions = modelOptions.map((m) => ({
    label: m,
    value: m,
  }));
  const modelOptionsForProvider = (provider: string) =>
    (AI_MODEL_PRESETS[provider] || []).map((m) => ({ label: m, value: m }));

  return (
    <>
      <ItemTitle title={t("settings.ai_summary.title")} />
      <SettingsCard>
        <SettingsCardRow
          header={<SettingsCardHeader title={t("settings.ai_summary.enable.title")} description={t("settings.ai_summary.enable.desc")} />}
          action={
            <Switch.Root
              className="SwitchRoot"
              checked={value.enabled}
              onCheckedChange={(checked) => {
                onChange({ enabled: checked });
              }}
            >
              <Switch.Thumb className="SwitchThumb" />
            </Switch.Root>
          }
        />
      </SettingsCard>

      <SettingsCard>
        <SettingsCardRow
          header={
            <SettingsCardHeader
              title={t("settings.ai_summary.search.enable.title")}
              description={t("settings.ai_summary.search.enable.desc")}
            />
          }
          action={
            <Switch.Root
              className="SwitchRoot"
              checked={value.aiSearchEnabled}
              onCheckedChange={(checked) => {
                onChange({ aiSearchEnabled: checked });
              }}
            >
              <Switch.Thumb className="SwitchThumb" />
            </Switch.Root>
          }
        />
      </SettingsCard>

      {value.enabled && (
        <>
          <SettingsCard>
            <SettingsCardRow
              header={<SettingsCardHeader title={t("settings.ai_summary.provider.title")} description={t("settings.ai_summary.provider.desc")} />}
              action={
                <SearchableSelect
                  value={value.provider}
                  onChange={handleProviderChange}
                  options={providerOptions}
                  placeholder={t("settings.ai_summary.provider.title")}
                  searchable={false}
                />
              }
            />
            <SettingsCardBody>
              {value.provider === "custom" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium t-primary">{t("settings.ai_summary.custom.base_url")}</p>
                    <input
                      type="text"
                      value={value.apiUrl}
                      onChange={(event) => {
                        onChange({ apiUrl: event.target.value });
                      }}
                      placeholder="https://api.openai.com/v1"
                      className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium t-primary">{t("settings.ai_summary.custom.model_id")}</p>
                    <input
                      type="text"
                      value={value.model}
                      onChange={(event) => {
                        onChange({ model: event.target.value });
                      }}
                      placeholder="gpt-4o-mini"
                      className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <p className="text-sm font-medium t-primary">
                      {t("settings.ai_summary.custom.api_key")}
                      {value.apiKeySet && (
                        <span className="ml-2">
                          <SettingsBadge tone="success">{t("settings.ai_summary.api_key.set")}</SettingsBadge>
                        </span>
                      )}
                    </p>
                    <input
                      type="password"
                      name="rin-ai-api-key"
                      autoComplete="new-password"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={value.apiKey}
                      onChange={(event) => {
                        onChange({ apiKey: event.target.value });
                      }}
                      placeholder={value.apiKeySet ? t("settings.ai_summary.api_key.placeholder_set") : "sk-..."}
                      className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none"
                    />
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">{t("settings.ai_summary.custom.hint")}</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium t-primary">{t("settings.ai_summary.model.title")}</p>
                  <SearchableSelect
                    value={value.model}
                    onChange={(nextValue) => {
                      onChange({ model: nextValue });
                    }}
                    options={modelSelectOptions}
                    placeholder={t("settings.ai_summary.model.desc")}
                    searchPlaceholder={t("settings.ai_summary.model.desc")}
                    emptyLabel={t("no_more")}
                    allowCustomValue
                    customValueLabel={(nextValue) => `${t("update.title")}: ${nextValue}`}
                  />
                </div>
                {providerFields.requiresApiKey ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium t-primary">
                      {t("settings.ai_summary.api_key.title")}
                      {value.apiKeySet && (
                        <span className="ml-2">
                          <SettingsBadge tone="success">{t("settings.ai_summary.api_key.set")}</SettingsBadge>
                        </span>
                      )}
                    </p>
                    <input
                      type="password"
                      name="rin-ai-api-key"
                      autoComplete="new-password"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={value.apiKey}
                      onChange={(event) => {
                        onChange({ apiKey: event.target.value });
                      }}
                      placeholder={value.apiKeySet ? t("settings.ai_summary.api_key.placeholder_set") : "sk-..."}
                      className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none"
                    />
                  </div>
                ) : null}
                {providerFields.requiresApiUrl ? (
                  <div className="space-y-2 lg:col-span-2">
                    <p className="text-sm font-medium t-primary">{t("settings.ai_summary.api_url.title")}</p>
                    <input
                      type="text"
                      value={value.apiUrl}
                      onChange={(event) => {
                        onChange({ apiUrl: event.target.value });
                      }}
                      placeholder="https://api.openai.com/v1"
                      className="w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none"
                    />
                  </div>
                ) : null}
                </div>
              )}
            </SettingsCardBody>
          </SettingsCard>

          <SettingsCard tone={testStatus === "error" ? "danger" : testStatus === "success" ? "success" : "default"}>
            <SettingsCardRow
              header={<SettingsCardHeader title={t("settings.ai_summary.test.title")} description={t("settings.ai_summary.test.desc")} />}
              action={
                <>
                  {testStatus === "testing" && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
                  <Button
                    title={t("settings.ai_summary.test.button")}
                    onClick={handleTestModel}
                    disabled={testStatus === "testing"}
                  />
                </>
              }
            />
            {testStatus === "success" && testResult && (
              <SettingsCardBody>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">{t("settings.ai_summary.test.success")}</p>
                <p className="mt-1 text-sm text-green-700/90 dark:text-green-300/90">{testResult.response}</p>
              </SettingsCardBody>
            )}
            {testStatus === "error" && testResult && (
              <SettingsCardBody>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{t("settings.ai_summary.test.failed")}</p>
                {testResult.error && <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">{testResult.error}</p>}
                {testResult.details && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{testResult.details}</p>}
                {!testResult.error && !testResult.details && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">{JSON.stringify(testResult)}</p>
                )}
              </SettingsCardBody>
            )}
          </SettingsCard>

          <SettingsCard>
            <SettingsCardHeader
              title={t("settings.ai_summary.failover.title")}
              description={t("settings.ai_summary.failover.desc")}
            />
            <SettingsCardBody>
              <div className="space-y-3">
                {value.failover.map((item, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <SearchableSelect
                      value={item.provider}
                      onChange={(nextProvider) => {
                        const preset = getAIProviderPreset(nextProvider);
                        const models = AI_MODEL_PRESETS[nextProvider] || [];
                        const nextItems = [...value.failover];
                        nextItems[index] = {
                          provider: nextProvider,
                          model: nextProvider === "custom" ? item.model : (models[0] ?? item.model),
                          api_url: nextProvider === "custom" ? item.api_url : (preset?.url ?? item.api_url),
                          api_key: item.api_key === MASKED_SECRET ? "" : item.api_key,
                        };
                        onChange({ failover: nextItems });
                      }}
                      options={providerOptions}
                      placeholder={t("settings.ai_summary.provider.title")}
                      searchable={false}
                    />
                    {item.provider === "custom" ? (
                      <>
                        <input
                          type="text"
                          value={item.api_url}
                          onChange={(event) => {
                            const nextItems = [...value.failover];
                            nextItems[index] = { ...item, api_url: event.target.value };
                            onChange({ failover: nextItems });
                          }}
                          placeholder={t("settings.ai_summary.custom.base_url")}
                          className="w-56 rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={item.model}
                          onChange={(event) => {
                            const nextItems = [...value.failover];
                            nextItems[index] = {
                              ...item,
                              model: event.target.value,
                              api_key: item.api_key === MASKED_SECRET ? "" : item.api_key,
                            };
                            onChange({ failover: nextItems });
                          }}
                          placeholder={t("settings.ai_summary.custom.model_id")}
                          className="w-56 rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none"
                        />
                        <div className="relative">
                          <input
                            type="password"
                            name="rin-ai-failover-api-key"
                            autoComplete="new-password"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            value={item.api_key === MASKED_SECRET ? "" : item.api_key}
                            onChange={(event) => {
                              const nextItems = [...value.failover];
                              nextItems[index] = { ...item, api_key: event.target.value };
                              onChange({ failover: nextItems });
                            }}
                            placeholder={
                              item.api_key === MASKED_SECRET
                                ? t("settings.ai_summary.api_key.placeholder_set")
                                : "sk-..."
                            }
                            className="w-56 rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none"
                          />
                          {item.api_key === MASKED_SECRET && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                              <SettingsBadge tone="success">{t("settings.ai_summary.api_key.set")}</SettingsBadge>
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <SearchableSelect
                          value={item.model}
                          onChange={(nextModel) => {
                            const nextItems = [...value.failover];
                            nextItems[index] = {
                              ...item,
                              model: nextModel,
                              api_key: item.api_key === MASKED_SECRET ? "" : item.api_key,
                            };
                            onChange({ failover: nextItems });
                          }}
                          options={modelOptionsForProvider(item.provider)}
                          placeholder={t("settings.ai_summary.model.title")}
                          searchPlaceholder={t("settings.ai_summary.model.desc")}
                          emptyLabel={t("no_more")}
                          allowCustomValue
                          customValueLabel={(nextValue) => `${t("update.title")}: ${nextValue}`}
                        />
                        {getAIProviderFields(item.provider).requiresApiKey ? (
                          <div className="relative">
                            <input
                              type="password"
                              name="rin-ai-failover-api-key"
                              autoComplete="new-password"
                              autoCapitalize="off"
                              autoCorrect="off"
                              spellCheck={false}
                              value={item.api_key === MASKED_SECRET ? "" : item.api_key}
                              onChange={(event) => {
                                const nextItems = [...value.failover];
                                nextItems[index] = { ...item, api_key: event.target.value };
                                onChange({ failover: nextItems });
                              }}
                              placeholder={
                                item.api_key === MASKED_SECRET
                                  ? t("settings.ai_summary.api_key.placeholder_set")
                                  : "sk-..."
                              }
                              className="w-56 rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none"
                            />
                            {item.api_key === MASKED_SECRET && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                <SettingsBadge tone="success">{t("settings.ai_summary.api_key.set")}</SettingsBadge>
                              </span>
                            )}
                          </div>
                        ) : null}
                      </>
                    )}
                    <button
                      type="button"
                      title={t("settings.ai_summary.test.button")}
                      onClick={() => {
                        handleTestFailover(index);
                      }}
                      disabled={failoverTest?.index === index && failoverTest.status === "testing"}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 text-sm text-neutral-500 transition-colors hover:border-green-200 hover:bg-green-50 hover:text-green-600 disabled:opacity-50 dark:border-white/10 dark:hover:border-green-800 dark:hover:bg-green-900/20 dark:hover:text-green-400"
                    >
                      <i
                        className={
                          failoverTest?.index === index && failoverTest.status === "testing"
                            ? "ri-loader-4-line animate-spin"
                            : "ri-flask-line"
                        }
                      />
                    </button>
                    <button
                      type="button"
                      title={t("delete.title")}
                      onClick={() => {
                        onChange({ failover: value.failover.filter((_, i) => i !== index) });
                        setFailoverTest(null);
                      }}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 text-sm text-neutral-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                    {failoverTest?.index === index && failoverTest.status === "success" && (
                      <span className="w-full text-sm font-medium text-green-600 dark:text-green-400">
                        {failoverTest.result?.response}
                      </span>
                    )}
                    {failoverTest?.index === index && failoverTest.status === "error" && (
                      <span className="w-full text-sm text-red-600 dark:text-red-400">
                        {failoverTest.result?.error}
                        {failoverTest.result?.details ? ` — ${failoverTest.result.details}` : ""}
                      </span>
                    )}
                  </div>
                ))}
                <Button
                  secondary
                  title={t("settings.ai_summary.failover.add")}
                  onClick={() => {
                    const defaultProvider = providerOptions[0]?.value ?? "openai";
                    setFailoverTest(null);
                    onChange({
                      failover: [
                        ...value.failover,
                        {
                          provider: defaultProvider,
                          model: AI_MODEL_PRESETS[defaultProvider]?.[0] ?? "",
                          api_key: "",
                          api_url: "",
                        },
                      ],
                    });
                  }}
                />
              </div>
            </SettingsCardBody>
          </SettingsCard>
        </>
      )}
      <AlertUI />
    </>
  );
}
