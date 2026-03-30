# @openilink/app-weather

天气查询工具，基于 Open-Meteo 免费 API，支持全球天气查询、城市名查询和空气质量查询。

## 特色

- **无需 API Key** — 使用完全免费的 Open-Meteo API
- **按城市名查询** — 自动解析城市经纬度
- **未来 3 天预报** — 包含最高/最低温度和天气状况
- **空气质量查询** — PM2.5、PM10 和 US AQI 指数

## 快速开始

```bash
npm install
npm run dev
```

### Docker 部署

```bash
docker-compose up -d
```

## 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `HUB_URL` | 是 | — | OpeniLink Hub 服务地址 |
| `BASE_URL` | 是 | — | 本服务的公网回调地址 |
| `DB_PATH` | 否 | `data/weather.db` | SQLite 数据库文件路径 |
| `PORT` | 否 | `8091` | HTTP 服务端口 |

## 3 个 AI Tools

| 工具名 | 说明 |
|--------|------|
| `get_weather` | 根据经纬度查询天气 |
| `get_weather_by_city` | 按城市名查询天气 |
| `get_air_quality` | 查询空气质量 |

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/hub/webhook` | 接收 Hub 推送的事件 |
| `GET` | `/oauth/setup` | 启动 OAuth 安装流程 |
| `GET` | `/oauth/redirect` | OAuth 回调处理 |
| `GET` | `/manifest.json` | 返回应用清单 |
| `GET` | `/health` | 健康检查 |

## 使用方式

安装到 Bot 后，支持三种方式调用：

### 自然语言（推荐）

直接用微信跟 Bot 对话，Hub AI 会自动识别意图并调用对应功能：

- "北京天气怎么样"
- "东京今天多少度"
- "查一下上海的空气质量"

### 命令调用

也可以使用 `/命令名 参数` 的格式直接调用：

- `/get_weather_by_city --city 北京`

### AI 自动调用

Hub AI 在多轮对话中会自动判断是否需要调用本 App 的功能，无需手动触发。

## 安全与隐私

- **无需 API Key**：本 App 使用免费公开 API，不需要任何认证信息
- **不存储数据**：纯工具型应用，请求即响应，无任何持久化
- 如需自部署：`docker compose up -d`

## License

MIT
