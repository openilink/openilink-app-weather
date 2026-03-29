/**
 * Mock Hub Server — 模拟 OpeniLink Hub 行为
 */
import http from "node:http";
import crypto from "node:crypto";

/** Mock Hub 使用的常量 */
export const WEBHOOK_SECRET = "mock-webhook-secret";
export const APP_TOKEN = "mock_app_token";
export const INSTALLATION_ID = "mock-inst";
export const BOT_ID = "mock-bot";

// App 的 webhook URL
let appWebhookUrl: string;

// 记录 App 发送的消息
let sentMessages: any[] = [];

/**
 * 创建 Mock Hub Server
 */
export function createMockHub(port: number, webhookUrl: string): http.Server {
  appWebhookUrl = webhookUrl;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);
    const body = await readBody(req);

    // POST /mock/event — 注入命令事件
    if (req.method === "POST" && url.pathname === "/mock/event") {
      try {
        const { command, args } = JSON.parse(body.toString());

        const hubEvent = {
          v: "1",
          type: "event",
          trace_id: `tr_${Date.now()}`,
          installation_id: INSTALLATION_ID,
          bot: { id: BOT_ID },
          event: {
            type: "command",
            id: `evt_${Date.now()}`,
            timestamp: new Date().toISOString(),
            data: { command, args, user_id: "test-user" },
          },
        };

        const eventBody = JSON.stringify(hubEvent);
        const sig = crypto
          .createHmac("sha256", WEBHOOK_SECRET)
          .update(eventBody)
          .digest("hex");

        const appResp = await fetch(appWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hub-Signature": sig,
          },
          body: eventBody,
          signal: AbortSignal.timeout(10000),
        });
        const appResult = await appResp.text();
        jsonReply(res, 200, { ok: true, app_response: appResult });
      } catch (err: any) {
        jsonReply(res, 502, { ok: false, error: err.message });
      }
      return;
    }

    // POST /api/bot/tool-result — 记录工具执行结果
    if (req.method === "POST" && url.pathname === "/api/bot/tool-result") {
      const msg = JSON.parse(body.toString());
      sentMessages.push({ ...msg, received_at: new Date().toISOString() });
      jsonReply(res, 200, { ok: true });
      return;
    }

    // POST /api/bot/message — 记录发送的消息
    if (req.method === "POST" && url.pathname === "/api/bot/message") {
      const msg = JSON.parse(body.toString());
      sentMessages.push({ ...msg, received_at: new Date().toISOString() });
      jsonReply(res, 200, { ok: true, data: { messageId: `msg_${Date.now()}` } });
      return;
    }

    // GET /health — 健康检查
    if (url.pathname === "/health") {
      jsonReply(res, 200, { status: "ok" });
      return;
    }

    jsonReply(res, 404, { error: "not found" });
  });

  return server;
}

/** 获取记录的消息 */
export function getSentMessages(): any[] {
  return sentMessages;
}

/** 清空消息记录 */
export function resetSentMessages(): void {
  sentMessages = [];
}

/** 读取请求体 */
function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/** 返回 JSON 响应 */
function jsonReply(res: http.ServerResponse, status: number, data: any) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
