# PelicanBench

**给模型一辆自行车，看看它能不能画好鹈鹕。**

PelicanBench 是一个开源的社区模型观察与对比平台。它用同一道创作挑战，让模型生成一段可运行的动画，再把结果放进画廊里，方便人们直观地浏览、比较和讨论。画面之外，调用协议、思考强度、耗时和 token 用量也一并记录，让每份样本都有更多上下文。

在测试台中，你可以连接 OpenAI 兼容服务或 Anthropic 服务，选择浏览器直连，或按需使用本站的一次性中转。确认后可将结果发布到社区画廊；第三方渠道只公开域名，不公开端口、路径或凭据。历史记录保存在本机，公开内容可以浏览、筛选和分享。

PelicanBench 适合模型爱好者、开发者和服务提供方，用一个轻松、可视化的挑战观察模型表现。它是社区样本与个人判断的集合，不是模型身份、路由或服务质量的权威认证。

## 部署流程

PelicanBench 需要 **Node.js 20.9+**、一个 PostgreSQL 数据库和可运行 Next.js 的 Node.js 服务。它依赖服务端 API 与数据库，不能作为纯静态网站部署。

### 1. 获取项目并安装依赖

```bash
git clone https://github.com/WEP-56/PelicanBench.git
cd PelicanBench
npm ci --include=dev
```

### 2. 配置环境变量

在部署平台的服务环境变量中配置：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `ADMIN_PASSWORD` | 管理后台登录口令，请使用唯一且高强度的随机值 |
| `ADMIN_SESSION_SECRET` | 管理会话签名密钥，建议使用独立随机值 |
| `CSRF_SECRET` | 请求校验签名密钥；多实例部署必须在所有实例设置相同值 |
| `APP_URL` | 可选的站点公开来源，例如 `https://bench.example.com` |

可用 `openssl rand -hex 32` 生成随机密钥。不要将真实口令、数据库连接字符串或签名密钥提交到 Git。

### 3. 初始化数据库

在部署环境中设置好 `DATABASE_URL` 后执行：

```bash
npx drizzle-kit push --dialect postgresql --schema ./src/db/schema.ts --url "$DATABASE_URL"
```

首次部署和数据库结构更新时运行此命令。生产环境请先做好数据库备份，并确认连接的是目标数据库。

### 4. 构建并启动

```bash
npm run build
npm run start
```

将服务交给支持 Next.js 的 Node.js 托管平台或进程管理器运行，并按平台要求开放端口。新版本部署时重新构建并重启服务。

### 5. 配置域名并检查服务

为站点配置 HTTPS。若使用反向代理，需传递正确的 `X-Forwarded-Host` 和 `X-Forwarded-Proto`，并覆盖客户端传入的同名请求头。设置 `APP_URL` 时应与用户访问的公开来源完全一致，包含协议和域名，不包含路径。

部署完成后访问 `/api/health`。返回 `ok: true`、`database: true`、`schemaReady: true` 且 `adminConfigured: true` 表示数据库和管理口令已就绪；随后打开 `/admin` 检查管理入口，并在 `/test` 完成一次端到端验证。
