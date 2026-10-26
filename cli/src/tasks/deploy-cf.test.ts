import { describe, expect, it } from "bun:test";
import {
  buildWranglerObservabilityConfig,
  buildWranglerQueueConfig,
  buildWranglerTriggersConfig,
  buildWranglerVarsConfig,
  collectWorkerSecrets,
} from "./deploy-cf";

describe("collectWorkerSecrets", () => {
  it("includes supported non-empty worker secrets", () => {
    const secrets = collectWorkerSecrets({
      JWT_SECRET: "jwt-secret",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "password",
      RIN_GITHUB_CLIENT_ID: "client-id",
      RIN_GITHUB_CLIENT_SECRET: "client-secret",
      RIN_GITEE_CLIENT_ID: "gitee-client-id",
      RIN_GITEE_CLIENT_SECRET: "gitee-client-secret",
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: "secret-key",
      UNUSED: "ignored",
    });

    expect(secrets).toEqual({
      JWT_SECRET: "jwt-secret",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "password",
      RIN_GITHUB_CLIENT_ID: "client-id",
      RIN_GITHUB_CLIENT_SECRET: "client-secret",
      RIN_GITEE_CLIENT_ID: "gitee-client-id",
      RIN_GITEE_CLIENT_SECRET: "gitee-client-secret",
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: "secret-key",
    });
  });

  it("omits empty secret values", () => {
    const secrets = collectWorkerSecrets({
      JWT_SECRET: "",
      ADMIN_USERNAME: undefined,
      ADMIN_PASSWORD: "password",
    });

    expect(secrets).toEqual({
      ADMIN_PASSWORD: "password",
    });
  });
});

describe("buildWranglerTriggersConfig", () => {
  it("omits cron triggers for preview deploys", () => {
    expect(buildWranglerTriggersConfig(true)).toBe("");
  });

  it("includes cron triggers for production deploys", () => {
    expect(buildWranglerTriggersConfig(false)).toContain("[triggers]");
    expect(buildWranglerTriggersConfig(false)).toContain('crons = ["*/20 * * * *"]');
  });
});

describe("buildWranglerQueueConfig", () => {
  it("includes queue consumers for preview deploys", () => {
    const config = buildWranglerQueueConfig("rin-preview-tasks", true);
    expect(config).toContain('queue = "rin-preview-tasks"');
    expect(config).toContain("[[queues.consumers]]");
  });

  it("includes queue consumers for production deploys", () => {
    const config = buildWranglerQueueConfig("rin-tasks", false);
    expect(config).toContain("[[queues.producers]]");
    expect(config).toContain("[[queues.consumers]]");
  });
});

describe("buildWranglerObservabilityConfig", () => {
  it("enables invocation logs and disables traces for preview deploys", () => {
    const config = buildWranglerObservabilityConfig(true);
    expect(config).toContain("[observability]");
    expect(config).toContain("[observability.logs]");
    expect(config).toContain("enabled = true");
    expect(config).toContain("invocation_logs = true");
    expect(config).toContain("[observability.traces]");
    expect(config).toContain("enabled = false");
  });

  it("omits observability overrides for production deploys", () => {
    expect(buildWranglerObservabilityConfig(false)).toBe("");
  });
});

describe("buildWranglerVarsConfig", () => {
  const baseVars = {
    s3Folder: "images/",
    s3CacheFolder: "cache/",
    s3Region: "auto",
    s3Endpoint: "",
    s3AccessHost: "",
    s3Bucket: "",
    s3ForcePathStyle: "false",
    webhookUrl: "",
    rssTitle: "",
    rssDescription: "",
    cacheStorageMode: "s3",
    emailResendUrl: "",
    emailSendUrls: "",
    name: "Rin",
    description: "",
    avatar: "",
    pageSize: "5",
    rssEnable: "false",
    frontendUrl: "",
    mcpAllowedHosts: "",
  };

  it("exports the frontend origin and the MCP host allowlist to the worker", () => {
    const config = buildWranglerVarsConfig({
      ...baseVars,
      frontendUrl: "https://jiaoblog.dpdns.org",
      mcpAllowedHosts: "jiaoblog.dpdns.org,blog.example.com",
    });

    expect(config).toContain('[vars]');
    expect(config).toContain('FRONTEND_URL = "https://jiaoblog.dpdns.org"');
    expect(config).toContain('MCP_ALLOWED_HOSTS = "jiaoblog.dpdns.org,blog.example.com"');
  });

  it("keeps empty optional values as empty strings", () => {
    const config = buildWranglerVarsConfig(baseVars);

    expect(config).toContain('FRONTEND_URL = ""');
    expect(config).toContain('MCP_ALLOWED_HOSTS = ""');
  });

  it("escapes quotes in configured values", () => {
    const config = buildWranglerVarsConfig({
      ...baseVars,
      mcpAllowedHosts: 'blog"example.com',
    });

    expect(config).toContain('MCP_ALLOWED_HOSTS = "blog\\"example.com"');
  });
});
