import { SettingsCard, SettingsCardBody, SettingsCardHeader, SettingsCardRow, Modal } from "@rin/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { client } from "../app/runtime";
import { Button } from "../components/button";
import type { ApiKeyRecord, ApiKeyScopeInfo } from "../api/client";
import { ItemTitle } from "./settings-items";

const KEY_TYPE_REST = 1;
const KEY_TYPE_MCP = 2;

type KeyType = typeof KEY_TYPE_REST | typeof KEY_TYPE_MCP;

interface KeyFormState {
  name: string;
  scopes: string[];
  visible: boolean;
  type: KeyType;
}

const emptyForm = (type: KeyType): KeyFormState => ({ name: "", scopes: [], visible: false, type });

export function ApiKeysSettings() {
  const { t } = useTranslation();

  const [keyType, setKeyType] = useState<KeyType>(KEY_TYPE_REST);
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [scopes, setScopes] = useState<Record<number, ApiKeyScopeInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<KeyFormState>(() => emptyForm(KEY_TYPE_REST));

  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const [plaintext, setPlaintext] = useState<string | null>(null);

  useEffect(() => {
    void loadAll(keyType);
  }, [keyType]);

  const loadAll = async (type: KeyType) => {
    setLoading(true);
    try {
      const [keysRes, scopesRes] = await Promise.all([
        client.user.listApiKeys(type),
        client.user.listApiKeyScopes(type),
      ]);
      if (keysRes.error) {
        setError(String(keysRes.error.value));
      }
      if (scopesRes.error) {
        setError(String(scopesRes.error.value));
      }
      setKeys(keysRes.data?.keys ?? []);
      setScopes((prev) => ({ ...prev, [type]: scopesRes.data?.scopes ?? [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const openCreate = () => {
    setError("");
    setSuccess("");
    setEditingId(null);
    setForm(emptyForm(keyType));
    setEditorOpen(true);
    if (!scopes[keyType]) {
      void loadAll(keyType);
    }
  };

  const openEdit = (key: ApiKeyRecord) => {
    resetMessages();
    setEditingId(key.id);
    setForm({
      name: key.name,
      scopes: key.scopes,
      visible: key.visible,
      type: key.type === KEY_TYPE_MCP ? KEY_TYPE_MCP : KEY_TYPE_REST,
    });
    setEditorOpen(true);
  };

  const toggleScope = (scope: string) => {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((item) => item !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const saveKey = async () => {
    resetMessages();
    if (!form.name.trim()) {
      setError(t("api_keys.error_name_required"));
      return;
    }
    if (form.scopes.length === 0) {
      setError(t("api_keys.error_scopes_required"));
      return;
    }

    setSaving(true);
    try {
      if (editingId === null) {
        const res = await client.user.createApiKey({
          name: form.name.trim(),
          scopes: form.scopes,
          visible: form.visible,
          type: form.type,
        });
        if (res.error) {
          setError(String(res.error.value));
          return;
        }
        setPlaintext(res.data?.plaintext ?? null);
        setSuccess(t("api_keys.created"));
      } else {
        const res = await client.user.updateApiKey(editingId, {
          name: form.name.trim(),
          scopes: form.scopes,
          visible: form.visible,
        });
        if (res.error) {
          setError(String(res.error.value));
          return;
        }
        setSuccess(t("api_keys.updated"));
      }
      setEditorOpen(false);
      await loadAll(keyType);
    } finally {
      setSaving(false);
    }
  };

  const rotateKey = async (key: ApiKeyRecord) => {
    resetMessages();
    if (!confirm(t("api_keys.rotate_confirm", { name: key.name }))) {
      return;
    }
    setSaving(true);
    try {
      const res = await client.user.rotateApiKey(key.id);
      if (res.error) {
        setError(String(res.error.value));
        return;
      }
      setPlaintext(res.data?.plaintext ?? null);
      setSuccess(t("api_keys.rotated"));
      await loadAll(keyType);
    } finally {
      setSaving(false);
    }
  };

  const deleteKey = async (key: ApiKeyRecord) => {
    resetMessages();
    if (!confirm(t("api_keys.delete_confirm", { name: key.name }))) {
      return;
    }
    setSaving(true);
    try {
      const res = await client.user.deleteApiKey(key.id);
      if (res.error) {
        setError(String(res.error.value));
        return;
      }
      setSuccess(t("api_keys.deleted"));
      await loadAll(keyType);
    } finally {
      setSaving(false);
    }
  };

  const revealKey = async (key: ApiKeyRecord) => {
    resetMessages();
    if (revealed[key.id]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[key.id];
        return next;
      });
      return;
    }
    if (key.visible && key.key) {
      setRevealed((prev) => ({ ...prev, [key.id]: key.key as string }));
      return;
    }
    const res = await client.user.listApiKeys(key.type === KEY_TYPE_MCP ? KEY_TYPE_MCP : KEY_TYPE_REST);
    if (res.error) {
      setError(String(res.error.value));
      return;
    }
    const fresh = res.data?.keys.find((item) => item.id === key.id);
    if (fresh?.key) {
      setRevealed((prev) => ({ ...prev, [key.id]: fresh.key as string }));
    } else {
      setError(t("api_keys.reveal_unavailable"));
    }
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setSuccess(t("api_keys.copied"));
    } catch {
      setError(t("api_keys.copy_failed"));
    }
  };

  const scopeOptions = scopes[form.type] ?? [];
  const keyTypeLabel = (type: number) => (type === KEY_TYPE_MCP ? t("api_keys.tab_mcp") : t("api_keys.tab_rest"));

  return (
    <div className="w-full space-y-2">
      <ItemTitle title={t("api_keys.title")} />

      <div className="flex gap-2">
        {([KEY_TYPE_REST, KEY_TYPE_MCP] as KeyType[]).map((type) => (
          <button
            key={type}
            onClick={() => {
              resetMessages();
              setKeyType(type);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              keyType === type ? "bg-theme text-white" : "bg-w-secondary t-secondary"
            }`}
          >
            {keyTypeLabel(type)}
          </button>
        ))}
      </div>

      <SettingsCard>
        <SettingsCardRow
          header={
            <SettingsCardHeader
              title={keyType === KEY_TYPE_MCP ? t("api_keys.title_mcp") : t("api_keys.title_rest")}
              description={
                keyType === KEY_TYPE_MCP
                  ? t("api_keys.description_mcp", { url: `${window.location.origin}/mcp` })
                  : t("api_keys.description_rest")
              }
            />
          }
          action={<Button title={t("api_keys.create")} onClick={openCreate} />}
        />
        <SettingsCardBody>
          {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
          {success && <p className="mb-3 text-sm text-green-500">{success}</p>}

          {plaintext && (
            <div className="mb-3 rounded-xl border border-theme/40 bg-w-secondary p-3">
              <p className="mb-2 text-sm font-medium t-primary">{t("api_keys.plaintext_hint")}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-black/5 px-3 py-2 font-mono text-sm dark:bg-white/10">
                  {plaintext}
                </code>
                <button
                  onClick={() => void copyToClipboard(plaintext)}
                  className="rounded-lg bg-theme px-3 py-2 text-xs text-white"
                >
                  {t("api_keys.copy")}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="py-4 text-sm t-secondary">{t("api_keys.loading_text")}</p>
          ) : keys.length === 0 ? (
            <p className="py-4 text-sm t-secondary">{t("api_keys.empty")}</p>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key.id} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium t-primary">{key.name}</span>
                        <span className="rounded-full bg-theme/10 px-2 py-0.5 text-xs text-theme">
                          {keyTypeLabel(key.type)}
                        </span>
                        <span className="rounded-full bg-w-secondary px-2 py-0.5 text-xs t-secondary">
                          {key.visible ? t("api_keys.visible") : t("api_keys.encrypted")}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {key.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="rounded bg-w-secondary px-2 py-0.5 font-mono text-xs t-secondary"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                      {revealed[key.id] && (
                        <code className="mt-2 block break-all rounded-lg bg-black/5 px-3 py-2 font-mono text-xs dark:bg-white/10">
                          {revealed[key.id]}
                        </code>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button onClick={() => openEdit(key)} className="text-xs text-theme hover:underline">
                        {t("edit")}
                      </button>
                      <button onClick={() => void revealKey(key)} className="text-xs text-theme hover:underline">
                        {t("api_keys.reveal")}
                      </button>
                      <button onClick={() => void rotateKey(key)} className="text-xs text-theme hover:underline">
                        {t("api_keys.rotate")}
                      </button>
                      <button onClick={() => void deleteKey(key)} className="text-xs text-red-500 hover:underline">
                        {t("api_keys.delete")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsCardBody>
      </SettingsCard>

      <Modal
        isOpen={editorOpen}
        onRequestClose={() => setEditorOpen(false)}
        contentLabel={editingId === null ? t("api_keys.create") : t("api_keys.edit")}
      >
        <div className="flex w-full flex-col gap-4 p-6">
          <h2 className="text-lg font-bold t-primary">
            {editingId === null ? t("api_keys.create") : t("api_keys.edit")}
          </h2>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium t-secondary">{t("api_keys.name")}</label>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder={t("api_keys.name_placeholder")}
              className="rounded-lg border border-black/10 bg-w px-3 py-2 text-sm dark:border-white/10"
            />
          </div>

          <div className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
            <p className="t-primary">{keyTypeLabel(form.type)}</p>
            <p className="mt-1 text-xs t-secondary">{t("api_keys.type_locked")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium t-secondary">{t("api_keys.scopes")}</label>
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-auto pr-1">
              {scopeOptions.length === 0 && (
                <p className="text-xs t-secondary">{t("api_keys.scopes_empty")}</p>
              )}
              {scopeOptions.map((scope) => (
                <label
                  key={scope.scope}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-black/10 p-2 text-sm dark:border-white/10"
                >
                  <input
                    type="checkbox"
                    checked={form.scopes.includes(scope.scope)}
                    onChange={() => toggleScope(scope.scope)}
                    className="mt-1"
                  />
                  <span className="flex flex-col">
                    <span className="t-primary">{scope.title}</span>
                    <span className="font-mono text-xs t-secondary">{scope.scope}</span>
                    <span className="text-xs t-secondary">{scope.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {editingId === null || form.visible ? (
            <label className="flex items-start gap-2 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(event) => setForm((prev) => ({ ...prev, visible: event.target.checked }))}
                className="mt-1"
              />
              <span className="flex flex-col">
                <span className="t-primary">{t("api_keys.visible_option")}</span>
                <span className="text-xs t-secondary">
                  {form.visible ? t("api_keys.visible_option_desc") : t("api_keys.visible_option_desc_off")}
                </span>
              </span>
            </label>
          ) : (
            <div className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
              <p className="t-primary">{t("api_keys.encrypted_option_title")}</p>
              <p className="mt-1 text-xs t-secondary">{t("api_keys.encrypted_option_desc")}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEditorOpen(false)}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm t-secondary"
            >
              {t("cancel")}
            </button>
            <button
              onClick={() => void saveKey()}
              disabled={saving}
              className="rounded-lg bg-theme px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {t("save")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
