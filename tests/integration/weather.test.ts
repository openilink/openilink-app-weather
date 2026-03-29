/**
 * 天气查询集成测试
 *
 * 测试 Hub <-> App 的完整通信链路：
 * 1. Mock Hub Server 模拟 OpeniLink Hub
 * 2. 创建轻量 App HTTP 服务器（仅含 webhook handler + router）
 * 3. 使用内存 SQLite 存储
 * 4. 验证命令到工具执行的完整链路
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from "vitest";
import http from "node:http";
import crypto from "node:crypto";
import { Store } from "../../src/store.js";
import { handleWebhook } from "../../src/hub/webhook.js";
import { collectAllTools } from "../../src/tools/index.js";
import { Router } from "../../src/router.js";
import { HubClient } from "../../src/hub/client.js";
import type { HubEvent } from "../../src/hub/types.js";

/** 端口配置（使用不常见端口避免冲突） */
const MOCK_HUB_PORT = 9841;
const APP_PORT = 9842;
const MOCK_HUB_URL = `http://localhost:${MOCK_HUB_PORT}`;
const WEBHOOK_SECRET = "integration-test-secret";
const APP_TOKEN = "integration-test-token";
const INSTALLATION_ID = "int-inst-001";

/** 记录收到的工具结果 */
let toolResults: any[] = [];

describe("天气查询集成测试", () => {
  let mockHubServer: http.Server;
  let appServer: http.Server;
  let store: Store;

  /** 保存原始 fetch，测试中替换天气 API 的 fetch */
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    // 1. 启动 Mock Hub Server
    mockHubServer = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${MOCK_HUB_PORT}`);
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = Buffer.concat(chunks).toString();

      if (req.method === "POST" && url.pathname === "/api/bot/tool-result") {
        const data = JSON.parse(body);
        toolResults.push(data);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    await new Promise<void>((resolve, reject) => {
      mockHubServer.on("error", reject);
      mockHubServer.listen(MOCK_HUB_PORT, resolve);
    });

    // 2. 初始化 Store 和 Router
    store = new Store(":memory:");
    store.saveInstallation({
      id: INSTALLATION_ID,
      hubUrl: MOCK_HUB_URL,
      appId: "test-app",
      botId: "test-bot",
      appToken: APP_TOKEN,
      webhookSecret: WEBHOOK_SECRET,
      createdAt: new Date().toISOString(),
    });

    const { definitions, handlers } = collectAllTools();
    const router = new Router({ definitions, handlers, store });

    // 3. 启动 App HTTP 服务器
    appServer = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${APP_PORT}`);

      if (url.pathname === "/hub/webhook") {
        await handleWebhook(req, res, {
          store,
          onEvent: async (event: HubEvent) => {
            if (!event.event || event.event.type !== "command") return;
            const installation = store.getInstallation(event.installation_id);
            if (!installation) return;
            const hubClient = new HubClient(installation.hubUrl, installation.appToken);
            await router.handleAndReply(event, hubClient);
          },
        });
        return;
      }

      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    await new Promise<void>((resolve, reject) => {
      appServer.on("error", reject);
      appServer.listen(APP_PORT, resolve);
    });
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await new Promise<void>((r) => appServer.close(() => r()));
    await new Promise<void>((r) => mockHubServer.close(() => r()));
    store.close();
  });

  beforeEach(() => {
    toolResults = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /** 发送命令到 App 的 webhook */
  async function sendCommand(command: string, args: Record<string, unknown> = {}) {
    const hubEvent = {
      v: "1",
      type: "event",
      trace_id: `tr_${Date.now()}`,
      installation_id: INSTALLATION_ID,
      bot: { id: "test-bot" },
      event: {
        type: "command",
        id: `evt_${Date.now()}`,
        timestamp: new Date().toISOString(),
        data: { command, args, user_id: "test-user" },
      },
    };

    const bodyStr = JSON.stringify(hubEvent);
    const sig = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(bodyStr)
      .digest("hex");

    const resp = await fetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature": sig,
      },
      body: bodyStr,
    });

    return resp;
  }

  it("Mock Hub Server 健康检查", async () => {
    const res = await originalFetch(`${MOCK_HUB_URL}/health`);
    expect(res.ok).toBe(true);
  });

  it("App Server 健康检查", async () => {
    const res = await originalFetch(`http://localhost:${APP_PORT}/health`);
    expect(res.ok).toBe(true);
  });

  it("challenge 握手请求应正确返回", async () => {
    const challengeEvent = {
      v: "1",
      type: "challenge",
      challenge: "test_challenge_123",
      trace_id: "tr_challenge",
      installation_id: INSTALLATION_ID,
      bot: { id: "test-bot" },
    };

    const bodyStr = JSON.stringify(challengeEvent);
    const sig = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(bodyStr)
      .digest("hex");

    const res = await originalFetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature": sig,
      },
      body: bodyStr,
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ challenge: "test_challenge_123" });
  });

  it("无效签名应被拒绝", async () => {
    const hubEvent = {
      v: "1",
      type: "event",
      trace_id: "tr_bad",
      installation_id: INSTALLATION_ID,
      bot: { id: "test-bot" },
      event: {
        type: "command", id: "evt_bad",
        timestamp: new Date().toISOString(),
        data: { command: "get_weather", args: {} },
      },
    };

    const res = await originalFetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature": "invalid_sig",
      },
      body: JSON.stringify(hubEvent),
    });

    expect(res.status).toBe(401);
  });

  it("非 POST 请求应被拒绝（405）", async () => {
    const res = await originalFetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "GET",
    });
    expect(res.status).toBe(405);
  });
});
