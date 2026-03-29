/**
 * 应用清单定义
 *
 * 向 Hub 注册时使用的元信息，包含应用名称、图标、订阅的事件类型等。
 */

/** 应用清单结构 */
export interface AppManifest {
  /** 应用唯一标识（URL 友好） */
  slug: string;
  /** 应用显示名称 */
  name: string;
  /** 应用图标（emoji 或 URL） */
  icon: string;
  /** 应用描述 */
  description: string;
  /** 订阅的事件类型列表 */
  events: string[];
}

/** 天气查询应用清单 */
export const manifest: AppManifest = {
  slug: "weather",
  name: "天气查询",
  icon: "🌤️",
  description: "查询全球天气信息，支持按城市名或经纬度查询当前天气、未来预报和空气质量",
  events: ["command"],
};
