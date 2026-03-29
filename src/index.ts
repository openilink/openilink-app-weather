/**
 * 应用主入口 — 天气查询服务
 *
 * 初始化流程：
 * 1. 加载配置 → 创建 Store
 * 2. 收集所有工具 → 创建 Router
 * 3. 启动 HTTP Server，注册路由
 * 4. 监听 SIGINT/SIGTERM 优雅关闭
 */

import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig } from "./config.js";
import { Store } from "./store.js";
import { collectAllTools } from "./tools/index.js";
import { Router } from "./router.js";
import { handleWebhook } from "./hub/webhook.js";
import { handleOAuthStart, handleOAuthCallback } from "./hub/oauth.js";
import { manifest } from "./hub/manifest.js";
import { HubClient } from "./hub/client.js";
import type { HubEvent } from "./hub/types.js";

// ─── 初始化 ────────────────────────────────────────────────

const config = loadConfig();
const store = new Store(config.dbPath);

console.log(`[app] 启动 ${manifest.name} (${manifest.slug})`);
console.log(`[app] Hub: ${config.hubUrl}`);
console.log(`[app] 回调地址: ${config.baseUrl}`);

// 收集所有 AI Tools 并创建路由器
const { definitions, handlers } = collectAllTools();
const router = new Router({ definitions, handlers, store });
console.log(`[app] 已注册 ${definitions.length} 个工具`);

// ─── Hub 事件处理 ─────────────────────────────────────────

async function onEvent(event: HubEvent): Promise<void> {
  const subType = event.event?.type;
  console.log(`[event] 收到事件: type=${subType}, id=${event.event?.id}, trace=${event.trace_id}`);

  if (!subType) return;

  const installation = store.getInstallation(event.installation_id);
  if (!installation) {
    console.warn("[event] 安装实例不存在:", event.installation_id);
    return;
  }

  const hubClient = new HubClient(installation.hubUrl, installation.appToken);

  switch (subType) {
    case "command": {
      await router.handleAndReply(event, hubClient);
      break;
    }
    default:
      console.log(`[event] 未处理的事件类型: ${subType}`);
  }
}

// ─── HTTP Server ──────────────────────────────────────────

const oauthOpts = { config, store };

async function requestHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  try {
    if (pathname === "/hub/webhook" && req.method === "POST") {
      await handleWebhook(req, res, { store, onEvent });
      return;
    }

    if (pathname === "/oauth/setup" && req.method === "GET") {
      handleOAuthStart(req, res, oauthOpts);
      return;
    }

    if (pathname === "/oauth/redirect" && req.method === "GET") {
      await handleOAuthCallback(req, res, oauthOpts);
      return;
    }

    if (pathname === "/manifest.json" && req.method === "GET") {
      const body = { ...manifest, tools: definitions };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body, null, 2));
      return;
    }

    if (pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", tools: definitions.length }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  } catch (err) {
    console.error("[http] 请求处理异常:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }
}

const server = createServer((req, res) => {
  requestHandler(req, res).catch((err) => {
    console.error("[http] 未捕获异常:", err);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end();
    }
  });
});

server.listen(Number(config.port), () => {
  console.log(`[app] 服务已启动，监听端口 ${config.port}`);
  console.log(`[app] 路由: POST /hub/webhook | GET /oauth/setup | GET /oauth/redirect | GET /manifest.json | GET /health`);
});

// ─── 优雅关闭 ─────────────────────────────────────────────

function shutdown(signal: string): void {
  console.log(`\n[app] 收到 ${signal}，正在关闭服务...`);
  store.close();

  server.close(() => {
    console.log("[app] 服务已关闭");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[app] 关闭超时，强制退出");
    process.exit(1);
  }, 10_000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
