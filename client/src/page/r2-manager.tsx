import { useState, useEffect, useRef } from "react";
import { client } from "../app/runtime";
import { useAlert } from "../components/dialog";
import ReactLoading from "react-loading";
import Modal from "react-modal";

type R2File = {
  key: string;
  size: number;
  lastModified: string;
  etag?: string;
};

const EDITABLE_EXTENSIONS = new Set([
  "json", "txt", "md", "html", "htm", "css", "js", "mjs", "cjs",
  "ts", "tsx", "jsx", "yml", "yaml", "xml", "svg", "ini", "toml",
  "conf", "log", "csv",
]);

const CONTENT_TYPES: Record<string, string> = {
  json: "application/json;charset=UTF-8",
  md: "text/markdown;charset=UTF-8",
  html: "text/html;charset=UTF-8",
  htm: "text/html;charset=UTF-8",
  css: "text/css;charset=UTF-8",
  js: "text/javascript;charset=UTF-8",
  mjs: "text/javascript;charset=UTF-8",
  cjs: "text/javascript;charset=UTF-8",
  ts: "text/typescript;charset=UTF-8",
  tsx: "text/typescript;charset=UTF-8",
  jsx: "text/javascript;charset=UTF-8",
  svg: "image/svg+xml;charset=UTF-8",
  xml: "application/xml;charset=UTF-8",
  yml: "text/yaml;charset=UTF-8",
  yaml: "text/yaml;charset=UTF-8",
  txt: "text/plain;charset=UTF-8",
};

function getFileExtension(key: string): string {
  if (!key.includes(".")) return "";
  return key.split(".").pop()!.toLowerCase();
}

function getContentType(key: string): string {
  return CONTENT_TYPES[getFileExtension(key)] || "text/plain;charset=UTF-8";
}

export function R2ManagerPage() {
  const { showAlert, AlertUI } = useAlert();
  const [files, setFiles] = useState<R2File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [prefix, setPrefix] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await client.r2.list({ prefix: prefix || undefined });
      if (error) {
        showAlert(`加载失败: ${error.value}`);
      } else if (data) {
        setFiles(data.files || []);
      }
    } catch (err) {
      showAlert(`加载失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [prefix]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data, error } = await client.r2.upload({
        file,
        key: file.name,
      });
      if (error) {
        showAlert(`上传失败: ${error.value}`);
      } else {
        showAlert(`上传成功: ${data?.key || file.name}`);
        loadFiles();
      }
    } catch (err) {
      showAlert(`上传失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`确定要删除 "${key}" 吗？`)) return;
    setDeleting(key);
    try {
      const { error } = await client.r2.delete({ key });
      if (error) {
        showAlert(`删除失败: ${error.value}`);
      } else {
        showAlert(`删除成功: ${key}`);
        loadFiles();
      }
    } catch (err) {
      showAlert(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeleting(null);
    }
  };

  const openEditor = async (key: string) => {
    setEditingKey(key);
    setEditContent("");
    setEditLoading(true);
    try {
      const { data, error } = await client.r2.readText(key);
      if (error) {
        showAlert(`读取失败: ${error.value}`);
        setEditingKey(null);
      } else {
        setEditContent(data ?? "");
      }
    } catch (err) {
      showAlert(`读取失败: ${err instanceof Error ? err.message : String(err)}`);
      setEditingKey(null);
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingKey) return;
    const ext = getFileExtension(editingKey);
    if (ext === "json") {
      try {
        const parsed = JSON.parse(editContent);
        setEditContent(JSON.stringify(parsed, null, 2));
      } catch {
        showAlert("保存失败: JSON 格式不合法");
        return;
      }
    }

    setEditSaving(true);
    try {
      const { error } = await client.r2.updateText(editingKey, editContent, getContentType(editingKey));
      if (error) {
        showAlert(`保存失败: ${error.value}`);
      } else {
        showAlert(`保存成功: ${editingKey}`);
        setEditingKey(null);
        loadFiles();
      }
    } catch (err) {
      showAlert(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEditSaving(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="flex w-full flex-col">
      <div className="flex flex-col items-start space-y-4">
        {/* 工具栏 */}
        <div className="flex w-full flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-xl bg-theme px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-theme/80 disabled:opacity-50">
              {uploading ? "上传中..." : "上传文件"}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
            {uploading && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="筛选前缀 (如: images/)"
              className="rounded-xl border border-black/10 bg-w px-4 py-2 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 dark:border-white/10 dark:focus:border-white/20"
            />
            <button
              onClick={loadFiles}
              className="rounded-xl border border-black/10 px-4 py-2 text-sm t-primary transition-colors hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/5"
            >
              刷新
            </button>
          </div>
        </div>

        {/* 文件列表 */}
        {loading ? (
          <div className="flex h-64 w-full items-center justify-center">
            <ReactLoading width="2em" height="2em" type="spin" color="#FC466B" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex h-64 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 dark:border-white/10">
            <i className="ri-folder-2-line text-4xl text-neutral-300 dark:text-neutral-600" />
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {prefix ? `在 "${prefix}" 下没有找到文件` : "存储桶为空，上传第一个文件吧"}
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left dark:border-white/5">
                  <th className="pb-2 pr-4 font-medium text-neutral-500 dark:text-neutral-400">文件名</th>
                  <th className="pb-2 pr-4 font-medium text-neutral-500 dark:text-neutral-400">大小</th>
                  <th className="pb-2 pr-4 font-medium text-neutral-500 dark:text-neutral-400">修改时间</th>
                  <th className="pb-2 text-right font-medium text-neutral-500 dark:text-neutral-400">操作</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.key} className="border-b border-black/5 last:border-0 dark:border-white/5">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <i className="ri-file-line text-neutral-400" />
                        <span className="t-primary truncate max-w-[200px] md:max-w-[400px]">{file.key}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-neutral-500 dark:text-neutral-400">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="py-2 pr-4 text-neutral-500 dark:text-neutral-400">
                      {new Date(file.lastModified).toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-4">
                        {EDITABLE_EXTENSIONS.has(getFileExtension(file.key)) && (
                          <button
                            onClick={() => openEditor(file.key)}
                            disabled={deleting === file.key}
                            className="text-neutral-500 transition-colors hover:text-neutral-700 disabled:opacity-50 dark:hover:text-neutral-300"
                            title="编辑"
                          >
                            <i className="ri-edit-2-line" />
                          </button>
                        )}
                        <a
                          href={`/api/r2/${encodeURIComponent(file.key)}?download=1`}
                          download
                          className="text-neutral-500 transition-colors hover:text-neutral-700 dark:hover:text-neutral-300"
                          title="下载"
                        >
                          <i className="ri-download-2-line" />
                        </a>
                        <button
                          onClick={() => handleDelete(file.key)}
                          disabled={deleting === file.key}
                          className="text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
                        >
                          {deleting === file.key ? (
                            <ReactLoading width="1em" height="1em" type="spin" color="#ef4444" />
                          ) : (
                            <i className="ri-delete-bin-7-line" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal
        isOpen={editingKey !== null}
        shouldCloseOnOverlayClick={true}
        shouldCloseOnEsc={true}
        onRequestClose={() => {
          if (!editSaving) setEditingKey(null);
        }}
        style={{
          content: {
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            marginRight: "-50%",
            transform: "translate(-50%, -50%)",
            padding: "0",
            border: "none",
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "transparent",
            width: "min(44em, 92vw)",
            maxHeight: "80vh",
          },
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
          },
        }}
      >
        <div className="flex flex-col items-start space-y-4 bg-w p-4 w-full rounded-2xl">
          <div className="flex w-full items-center justify-between gap-4">
            <h1 className="truncate text-lg font-bold t-primary">
              编辑 {editingKey}
            </h1>
            <button
              onClick={() => setEditingKey(null)}
              disabled={editSaving}
              className="text-neutral-500 transition-colors hover:text-neutral-700 disabled:opacity-50 dark:hover:text-neutral-300"
            >
              <i className="ri-close-line text-xl" />
            </button>
          </div>
          {editLoading ? (
            <div className="flex h-64 w-full items-center justify-center">
              <ReactLoading width="2em" height="2em" type="spin" color="#FC466B" />
            </div>
          ) : (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              disabled={editSaving}
              spellCheck={false}
              className="h-96 w-full resize-none rounded-xl border border-black/10 bg-w p-3 font-mono text-sm t-primary outline-none transition-colors focus:border-black/20 dark:border-white/10 dark:focus:border-white/20"
            />
          )}
          <div className="flex w-full flex-row items-center justify-center space-x-2">
            <button
              onClick={handleSaveEdit}
              disabled={editLoading || editSaving}
              className="rounded-xl bg-theme px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-theme/80 disabled:opacity-50"
            >
              {editSaving ? "保存中..." : "保存"}
            </button>
            <button
              onClick={() => setEditingKey(null)}
              disabled={editSaving}
              className="rounded-xl border border-black/10 px-4 py-2 text-sm t-primary transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
            >
              取消
            </button>
          </div>
        </div>
      </Modal>
      <AlertUI />
    </div>
  );
}
