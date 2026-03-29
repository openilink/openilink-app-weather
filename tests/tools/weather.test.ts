/**
 * 天气工具测试 — get_weather / get_weather_by_city / get_air_quality
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { weatherTools } from "../../src/tools/weather.js";
import type { ToolContext } from "../../src/hub/types.js";

/** 构建 ToolContext */
function makeCtx(args: Record<string, unknown>): ToolContext {
  return {
    installationId: "inst-001",
    botId: "bot-001",
    userId: "user-001",
    traceId: "trace-001",
    args,
  };
}

/** 保存原始 fetch */
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("weatherTools", () => {
  it("定义了 3 个工具", () => {
    expect(weatherTools.definitions).toHaveLength(3);
    expect(weatherTools.definitions.map((d) => d.name)).toEqual([
      "get_weather",
      "get_weather_by_city",
      "get_air_quality",
    ]);
  });

  describe("get_weather", () => {
    it("成功查询天气并返回格式化结果", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            current: {
              temperature_2m: 25.3,
              weather_code: 0,
              wind_speed_10m: 12.5,
              relative_humidity_2m: 45,
            },
            daily: {
              time: ["2025-06-01", "2025-06-02", "2025-06-03"],
              weather_code: [0, 1, 61],
              temperature_2m_max: [28, 27, 22],
              temperature_2m_min: [18, 17, 15],
            },
          }),
      });

      const handlers = weatherTools.createHandlers();
      const handler = handlers.get("get_weather")!;
      const result = await handler(makeCtx({ latitude: 39.9, longitude: 116.4 }));

      expect(result).toContain("25.3°C");
      expect(result).toContain("晴天");
      expect(result).toContain("12.5 km/h");
      expect(result).toContain("45%");
      expect(result).toContain("未来3天预报");
    });

    it("缺少参数返回错误信息", async () => {
      const handlers = weatherTools.createHandlers();
      const handler = handlers.get("get_weather")!;
      const result = await handler(makeCtx({}));
      expect(result).toContain("错误");
      expect(result).toContain("latitude");
    });

    it("API 异常时返回错误信息", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const handlers = weatherTools.createHandlers();
      const handler = handlers.get("get_weather")!;
      const result = await handler(makeCtx({ latitude: 39.9, longitude: 116.4 }));
      expect(result).toContain("查询天气失败");
    });
  });

  describe("get_weather_by_city", () => {
    it("成功通过城市名查询天气", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        callCount++;
        // 第一次调用：geocoding
        if (callCount === 1) {
          expect(url).toContain("geocoding-api");
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                results: [
                  { latitude: 39.9, longitude: 116.4, name: "北京", country: "中国" },
                ],
              }),
          });
        }
        // 第二次调用：天气
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              current: {
                temperature_2m: 30,
                weather_code: 3,
                wind_speed_10m: 8,
                relative_humidity_2m: 60,
              },
              daily: {
                time: ["2025-06-01"],
                weather_code: [3],
                temperature_2m_max: [32],
                temperature_2m_min: [22],
              },
            }),
        });
      });

      const handlers = weatherTools.createHandlers();
      const handler = handlers.get("get_weather_by_city")!;
      const result = await handler(makeCtx({ city: "北京" }));

      expect(result).toContain("北京");
      expect(result).toContain("中国");
      expect(result).toContain("30°C");
    });

    it("找不到城市时返回错误", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      const handlers = weatherTools.createHandlers();
      const handler = handlers.get("get_weather_by_city")!;
      const result = await handler(makeCtx({ city: "不存在的城市" }));
      expect(result).toContain("查询天气失败");
    });

    it("缺少 city 参数返回错误", async () => {
      const handlers = weatherTools.createHandlers();
      const handler = handlers.get("get_weather_by_city")!;
      const result = await handler(makeCtx({}));
      expect(result).toContain("错误");
      expect(result).toContain("city");
    });
  });

  describe("get_air_quality", () => {
    it("成功查询空气质量", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            current: {
              pm2_5: 35.2,
              pm10: 50.1,
              us_aqi: 45,
            },
          }),
      });

      const handlers = weatherTools.createHandlers();
      const handler = handlers.get("get_air_quality")!;
      const result = await handler(makeCtx({ latitude: 39.9, longitude: 116.4 }));

      expect(result).toContain("35.2");
      expect(result).toContain("50.1");
      expect(result).toContain("45");
      expect(result).toContain("优");
    });

    it("AQI 等级正确判断", async () => {
      // 测试 AQI = 120 应该是轻度污染（101-150）
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            current: { pm2_5: 80, pm10: 120, us_aqi: 120 },
          }),
      });

      const handlers = weatherTools.createHandlers();
      const handler = handlers.get("get_air_quality")!;
      const result = await handler(makeCtx({ latitude: 39.9, longitude: 116.4 }));
      expect(result).toContain("轻度污染");
    });

    it("缺少参数返回错误信息", async () => {
      const handlers = weatherTools.createHandlers();
      const handler = handlers.get("get_air_quality")!;
      const result = await handler(makeCtx({}));
      expect(result).toContain("错误");
    });
  });
});
