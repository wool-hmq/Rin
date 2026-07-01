import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { resolveStorageTarget, putStorageObjectAtKey, getStorageObject } from "../utils/storage";
import { createS3Client } from "../utils/s3";

// 列出 R2 中的文件
async function listR2Objects(env: Env, prefix?: string, delimiter?: string) {
  const target = resolveStorageTarget(env);

  if (target.type === "r2") {
    const objects = await target.bucket.list({
      prefix: prefix || "",
      delimiter: delimiter || "",
    });

    return objects.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      lastModified: obj.uploaded.toISOString(),
      etag: obj.etag,
    }));
  }

  // S3 兼容模式
  const client = createS3Client(env);
  const url = new URL(env.S3_ENDPOINT);
  const bucket = env.S3_BUCKET;
  const forcePathStyle = env.S3_FORCE_PATH_STYLE === 'true';

  let listUrl: string;
  if (forcePathStyle) {
    listUrl = `${url.toString()}/${bucket}?list-type=2`;
  } else {
    listUrl = `${url.protocol}//${bucket}.${url.host}?list-type=2`;
  }

  if (prefix) {
    listUrl += `&prefix=${encodeURIComponent(prefix)}`;
  }

  const response = await client.fetch(listUrl, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to list objects: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  // 简单解析 XML（仅处理基本场景）
  const files: { key: string; size: number; lastModified: string }[] = [];
  const keyMatches = text.matchAll(/<Key>([^<]+)<\/Key>/g);
  const sizeMatches = text.matchAll(/<Size>([^<]+)<\/Size>/g);
  const lastModifiedMatches = text.matchAll(/<LastModified>([^<]+)<\/LastModified>/g);

  const keys = [...keyMatches];
  const sizes = [...sizeMatches];
  const lastModifieds = [...lastModifiedMatches];

  for (let i = 0; i < keys.length; i++) {
    files.push({
      key: keys[i][1],
      size: parseInt(sizes[i]?.[1] || "0"),
      lastModified: lastModifieds[i]?.[1] || new Date().toISOString(),
    });
  }

  return files;
}

export function R2Service(): Hono {
  const app = new Hono();

  // GET /r2/list - 列出文件
  app.get("/list", async (c: AppContext) => {
    const uid = c.get("uid");
    if (!uid) {
      return c.text("Unauthorized", 401);
    }

    const env = c.get("env");
    const prefix = c.req.query("prefix") || "";
    const delimiter = c.req.query("delimiter") || "";

    try {
      const files = await profileAsync(c, "r2_list", () => listR2Objects(env, prefix, delimiter));
      return c.json({ files });
    } catch (e: any) {
      console.error("R2 list failed:", e);
      return c.text(e.message || "List failed", 500);
    }
  });

  // POST /r2/upload - 上传文件
  app.post("/upload", async (c: AppContext) => {
    const uid = c.get("uid");
    if (!uid) {
      return c.text("Unauthorized", 401);
    }

    const env = c.get("env");
    const body = await c.req.parseBody();
    const key = body.key as string;
    const file = body.file as File;

    if (!key || !file) {
      return c.text("Missing key or file", 400);
    }

    try {
      const fileBuffer = await file.arrayBuffer();
      const result = await profileAsync(c, "r2_put", () =>
        putStorageObjectAtKey(env, key, fileBuffer, file.type, new URL(c.req.url).origin)
      );
      return c.json({ key: result.key, url: result.url });
    } catch (e: any) {
      console.error("R2 upload failed:", e);
      return c.text(e.message || "Upload failed", 500);
    }
  });

  // DELETE /r2/:key - 删除文件
  app.delete("/:key", async (c: AppContext) => {
    const uid = c.get("uid");
    if (!uid) {
      return c.text("Unauthorized", 401);
    }

    const env = c.get("env");
    const key = c.req.param("key");

    if (!key) {
      return c.text("Missing key", 400);
    }

    try {
      const target = resolveStorageTarget(env);
      const decodedKey = decodeURIComponent(key);

      if (target.type === "r2") {
        await target.bucket.delete(decodedKey);
      } else {
        // S3 删除
        const client = createS3Client(env);
        const s3Url = new URL(env.S3_ENDPOINT);
        const bucket = env.S3_BUCKET;
        const forcePathStyle = env.S3_FORCE_PATH_STYLE === 'true';
        let deleteUrl: string;
        if (forcePathStyle) {
          deleteUrl = `${s3Url.toString()}/${bucket}/${decodedKey}`;
        } else {
          deleteUrl = `${s3Url.protocol}//${bucket}.${s3Url.host}/${decodedKey}`;
        }
        const response = await client.fetch(deleteUrl, { method: "DELETE" });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
        }
      }

      return c.json({ success: true });
    } catch (e: any) {
      console.error("R2 delete failed:", e);
      return c.text(e.message || "Delete failed", 500);
    }
  });

  return app;
}
