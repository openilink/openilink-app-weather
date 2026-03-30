/**
 * 天气工具模块 — 天气查询、城市天气查询、空气质量查询
 */

import type { ToolModule, ToolDefinition, ToolHandler } from "../hub/types.js";

/** WMO 天气代码映射为中文描述 */
const WEATHER_CODE_MAP: Record<number, string> = {
  0: "晴天",
  1: "大部晴朗",
  2: "局部多云",
  3: "多云",
  45: "雾",
  48: "雾凇",
  51: "小毛毛雨",
  53: "中毛毛雨",
  55: "大毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "小冻雨",
  67: "大冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "雪粒",
  80: "小阵雨",
  81: "中阵雨",
  82: "大阵雨",
  85: "小阵雪",
  86: "大阵雪",
  95: "雷暴",
  96: "雷暴伴小冰雹",
  99: "雷暴伴大冰雹",
};

/** 将天气代码转为中文描述 */
function weatherCodeToText(code: number): string {
  return WEATHER_CODE_MAP[code] || `未知天气(${code})`;
}

/** 工具定义 */
const definitions: ToolDefinition[] = [
  {
    name: "get_weather",
    description: "根据经纬度查询天气，返回当前温度/天气/风速/湿度 + 未来3天预报",
    command: "get_weather",
    parameters: {
      type: "object",
      properties: {
        latitude: { type: "number", description: "纬度" },
        longitude: { type: "number", description: "经度" },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "get_weather_by_city",
    description: "按城市名查询天气，自动解析城市经纬度后查询天气信息",
    command: "get_weather_by_city",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "城市名称（支持中英文）" },
      },
      required: ["city"],
    },
  },
  {
    name: "get_air_quality",
    description: "根据经纬度查询空气质量，返回 PM2.5、PM10 和 US AQI 指数",
    command: "get_air_quality",
    parameters: {
      type: "object",
      properties: {
        latitude: { type: "number", description: "纬度" },
        longitude: { type: "number", description: "经度" },
      },
      required: ["latitude", "longitude"],
    },
  },
];

/**
 * 查询天气（核心函数，供其他工具复用）
 * @param latitude 纬度
 * @param longitude 经度
 * @returns 格式化的天气信息字符串
 */
export async function fetchWeather(latitude: number, longitude: number): Promise<string> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Open-Meteo API 请求失败: ${resp.status}`);
  }

  const data = await resp.json() as any;
  const current = data.current;
  const daily = data.daily;

  // 当前天气
  const lines: string[] = [];
  lines.push(`📍 坐标: (${latitude}, ${longitude})`);
  lines.push(`🌡️ 当前温度: ${current.temperature_2m}°C`);
  lines.push(`🌤️ 天气: ${weatherCodeToText(current.weather_code)}`);
  lines.push(`💨 风速: ${current.wind_speed_10m} km/h`);
  lines.push(`💧 湿度: ${current.relative_humidity_2m}%`);

  // 未来3天预报
  lines.push("");
  lines.push("📅 未来3天预报:");
  for (let i = 0; i < daily.time.length; i++) {
    const date = daily.time[i];
    const weatherText = weatherCodeToText(daily.weather_code[i]);
    const maxTemp = daily.temperature_2m_max[i];
    const minTemp = daily.temperature_2m_min[i];
    lines.push(`  ${date}: ${weatherText}，${minTemp}°C ~ ${maxTemp}°C`);
  }

  return lines.join("\n");
}

/**
 * 通过城市名获取经纬度
 * @param city 城市名称
 * @returns 城市的经纬度和名称信息
 */
export async function geocodeCity(city: string): Promise<{
  latitude: number;
  longitude: number;
  name: string;
  country: string;
}> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Geocoding API 请求失败: ${resp.status}`);
  }

  const data = await resp.json() as any;
  if (!data.results || data.results.length === 0) {
    throw new Error(`未找到城市: ${city}`);
  }

  const result = data.results[0];
  return {
    latitude: result.latitude,
    longitude: result.longitude,
    name: result.name || city,
    country: result.country || "",
  };
}

/**
 * 查询空气质量
 * @param latitude 纬度
 * @param longitude 经度
 * @returns 格式化的空气质量信息字符串
 */
export async function fetchAirQuality(latitude: number, longitude: number): Promise<string> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=pm2_5,pm10,us_aqi`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Air Quality API 请求失败: ${resp.status}`);
  }

  const data = await resp.json() as any;
  const current = data.current;

  const aqi = current.us_aqi;
  let aqiLevel: string;
  if (aqi <= 50) aqiLevel = "优";
  else if (aqi <= 100) aqiLevel = "良";
  else if (aqi <= 150) aqiLevel = "轻度污染";
  else if (aqi <= 200) aqiLevel = "中度污染";
  else if (aqi <= 300) aqiLevel = "重度污染";
  else aqiLevel = "严重污染";

  const lines: string[] = [];
  lines.push(`📍 坐标: (${latitude}, ${longitude})`);
  lines.push(`🌫️ PM2.5: ${current.pm2_5} μg/m³`);
  lines.push(`🌫️ PM10: ${current.pm10} μg/m³`);
  lines.push(`📊 US AQI: ${aqi}（${aqiLevel}）`);

  return lines.join("\n");
}

/** 创建处理函数 */
function createHandlers(): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  handlers.set("get_weather", async (ctx) => {
    try {
      const { latitude, longitude } = ctx.args;
      if (latitude == null || longitude == null) {
        return "错误：请提供经纬度参数（latitude, longitude）";
      }
      return await fetchWeather(Number(latitude), Number(longitude));
    } catch (err: any) {
      return `查询天气失败：${err.message}`;
    }
  });

  handlers.set("get_weather_by_city", async (ctx) => {
    try {
      const { city } = ctx.args;
      if (!city) return "错误：请提供城市名称（city）";

      const geo = await geocodeCity(String(city));
      const header = `🏙️ ${geo.name}（${geo.country}）\n`;
      const weather = await fetchWeather(geo.latitude, geo.longitude);
      return header + weather;
    } catch (err: any) {
      return `查询天气失败：${err.message}`;
    }
  });

  handlers.set("get_air_quality", async (ctx) => {
    try {
      const { latitude, longitude } = ctx.args;
      if (latitude == null || longitude == null) {
        return "错误：请提供经纬度参数（latitude, longitude）";
      }
      return await fetchAirQuality(Number(latitude), Number(longitude));
    } catch (err: any) {
      return `查询空气质量失败：${err.message}`;
    }
  });

  return handlers;
}

export const weatherTools: ToolModule = { definitions, createHandlers };
