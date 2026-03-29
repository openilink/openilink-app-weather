/**
 * Store 持久化层测试
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Store } from "../src/store.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Store", () => {
  let store: Store;
  let dbPath: string;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "weather-store-test-"));
    dbPath = path.join(tmpDir, "test.db");
    store = new Store(dbPath);
  });

  afterEach(() => {
    store.close();
    const dir = path.dirname(dbPath);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("saveInstallation / getInstallation", () => {
    it("保存并读取安装记录", () => {
      const inst = {
        id: "inst-001",
        hubUrl: "https://hub.example.com",
        appId: "app-001",
        botId: "bot-001",
        appToken: "token-001",
        webhookSecret: "secret-001",
        createdAt: "2025-01-01T00:00:00.000Z",
      };

      store.saveInstallation(inst);
      const result = store.getInstallation("inst-001");

      expect(result).toBeDefined();
      expect(result!.id).toBe("inst-001");
      expect(result!.hubUrl).toBe("https://hub.example.com");
      expect(result!.appToken).toBe("token-001");
    });

    it("查询不存在的安装记录返回 undefined", () => {
      const result = store.getInstallation("nonexistent");
      expect(result).toBeUndefined();
    });

    it("更新已有的安装记录", () => {
      const inst = {
        id: "inst-001",
        hubUrl: "https://hub.example.com",
        appId: "app-001",
        botId: "bot-001",
        appToken: "old-token",
        webhookSecret: "old-secret",
      };

      store.saveInstallation(inst);
      store.saveInstallation({ ...inst, appToken: "new-token", webhookSecret: "new-secret" });

      const result = store.getInstallation("inst-001");
      expect(result!.appToken).toBe("new-token");
      expect(result!.webhookSecret).toBe("new-secret");
    });
  });

  describe("getAllInstallations", () => {
    it("返回所有安装记录", () => {
      store.saveInstallation({
        id: "inst-001", hubUrl: "https://hub.test", appId: "app-001",
        botId: "bot-001", appToken: "t1", webhookSecret: "s1",
      });
      store.saveInstallation({
        id: "inst-002", hubUrl: "https://hub.test", appId: "app-002",
        botId: "bot-002", appToken: "t2", webhookSecret: "s2",
      });

      const all = store.getAllInstallations();
      expect(all).toHaveLength(2);
    });

    it("空数据库返回空数组", () => {
      const all = store.getAllInstallations();
      expect(all).toEqual([]);
    });
  });
});
