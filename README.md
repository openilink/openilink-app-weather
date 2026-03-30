# @openilink/app-weather

微信查天气 -- 全球城市天气预报 + 空气质量，基于 Open-Meteo 免费 API，零配置即用。

> **一键安装** -- 前往 [OpeniLink Hub 应用市场](https://hub.openilink.com) 搜索「天气」，点击安装即可在微信中使用。

## 功能亮点

- **全球城市查询** -- 直接输入城市名，自动解析经纬度并返回结果
- **3 天天气预报** -- 最高/最低温度、天气状况一目了然
- **空气质量查询** -- PM2.5、PM10、US AQI 指数实时获取
- **无需 API Key** -- 使用完全免费的 Open-Meteo API，零配置

## 使用方式

安装到 Bot 后，直接用微信对话即可：

**自然语言（推荐）**

- "北京天气怎么样"
- "东京今天多少度"
- "查一下上海的空气质量"

**命令调用**

- `/get_weather_by_city --city 北京`

**AI 自动调用** -- Hub AI 在多轮对话中会自动判断是否需要调用天气功能，无需手动触发。

### AI Tools

| 工具名 | 说明 |
|--------|------|
| `get_weather` | 根据经纬度查询天气 |
| `get_weather_by_city` | 按城市名查询天气 |
| `get_air_quality` | 查询空气质量 |

<details>
<summary><strong>部署与开发</strong></summary>

### 快速开始

```bash
npm install
npm run dev
```

### Docker 部署

```bash
docker-compose up -d
```

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `HUB_URL` | 是 | -- | OpeniLink Hub 服务地址 |
| `BASE_URL` | 是 | -- | 本服务的公网回调地址 |
| `DB_PATH` | 否 | `data/weather.db` | SQLite 数据库文件路径 |
| `PORT` | 否 | `8091` | HTTP 服务端口 |

### API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/hub/webhook` | 接收 Hub 推送的事件 |
| `GET` | `/oauth/setup` | 启动 OAuth 安装流程 |
| `GET` | `/oauth/redirect` | OAuth 回调处理 |
| `GET` | `/manifest.json` | 返回应用清单 |
| `GET` | `/health` | 健康检查 |

</details>

## 安全与隐私

- **无需 API Key** -- 使用免费公开 API，不需要任何认证信息
- **不存储数据** -- 纯工具型应用，请求即响应，无任何持久化
- 如需自部署：`docker compose up -d`

## License

MIT
