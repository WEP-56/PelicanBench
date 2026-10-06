# PelicanBench

Next.js App Router + PostgreSQL / Drizzle 的社区鹈鹕动画测试站点。模型生成优先在浏览器直接调用，公示、流量统计和管理由本站后端提供。管理和上传不是静态演示功能。

## 本地启动

1. 安装依赖：`npm install`。
2. 在 `.env` 中配置 `DATABASE_URL`，并让 `drizzle.config.json` 指向相同的 PostgreSQL 数据库。
3. 设置 `ADMIN_PASSWORD`。本地预览在 `.env.local` 中提供演示口令，正式部署必须替换；部署环境变量优先于本地文件。
4. 初始化数据库：`npx drizzle-kit push`。
5. 启动开发服务：`npm run dev`。正式部署使用 `npm run build` 后的 Next.js Node 服务，不能只托管静态文件。

`GET /api/health` 会检查数据库连接、四张业务表以及管理口令是否配置。它不会返回任何密钥、口令或数据库连接字符串。

## 反向代理

代理应设置 `X-Forwarded-Host` 为用户访问的域名，设置 `X-Forwarded-Proto` 为外部协议，并覆盖客户端提供的同名请求头。登录、上传和一次性模型中转会校验请求来源，跨站请求仍然被拒绝。

可选的 `APP_URL` 环境变量可以固定唯一公开来源，例如 `https://bench.example.com`。当请求有 Origin / Referer 时，来源必须与此地址完全一致。预览 iframe 如果屏蔽管理登录 Cookie，请在独立窗口打开 `/admin`。

### 预览环境与缺失来源头

来源校验优先使用 Origin，并支持同站 Referer、Sec-Fetch-Site。某些隐私设置或代理会移除这些头；此时本站请求会使用 `GET /api/request-token` 取得的短期签名令牌校验，而不是因缺少来源头直接报错，也不是无条件放行。这个只读接口不提供 CORS 授权，并禁止缓存。

令牌有效期为 30 分钟，只留在页面内存，通过 `X-PelicanBench-Request-Token` 发送给本站 API。不含 API Key，不写数据库或本地存储，不会带给模型服务商。只有校验层明确拒绝、尚未执行生成或上传的请求才会自动更新令牌并重试一次；普通接口错误不会触发这一重试。明确的外站 Origin、Referer 或跨站 Fetch Metadata 仍会被拒绝。

单实例预览无需额外配置。多实例部署请为所有实例设置相同的随机 `CSRF_SECRET`；未配置时依次使用 ADMIN_SESSION_SECRET、ADMIN_PASSWORD 或进程内随机密钥。不要在反向代理上移除 `X-PelicanBench-Request-Token`。

## 请求头配置与版本来源

测试页可展开「请求头配置」，逐项添加/停用/删除请求头，或导入 JSON 对象。有效条目大小写不敏感地覆盖默认同名头，可用 `{{API_KEY}}` 引用上方密钥。请求头配置只保存在当前页面内存，不写入 localStorage、sessionStorage、历史、公示或服务器日志；本站的签名校验头与上游请求头完全分离。

预设是**最小客户端标识**，不是完整的 CLI 协议模拟。2026-10-06 核验的来源：

- **Codex CLI 0.160.1**：`originator: codex_cli_rs` 和 `User-Agent: codex_cli_rs/0.160.1`。仅保留 UA 的产品/版本前缀，不虚构操作系统或终端后缀。[官方源码](https://github.com/openai/codex/blob/rust-v0.160.1/codex-rs/login/src/auth/default_client.rs)。
- **OpenCode 1.18.34**：`User-Agent: opencode/1.18.34`。不把动态会话 ID、项目 ID 或 SDK 后缀写死。[官方源码](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/session/llm/request.ts)。
- **Claude Code 2.1.63 历史快照**：`x-app: cli`、`User-Agent: claude-cli/2.1.63 (external, cli)` 和 `anthropic-version: 2023-06-01`，来自 [官方 npm 发布包](https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.63) 的 `cli.js`。不声称这是最新版本。`anthropic-beta` 留空且默认停用，能力值随版本变化，参见 [Anthropic 官方网关文档](https://code.claude.com/docs/en/llm-gateway-protocol#request-headers)。

[MDN](https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_request_header) 说明 Chrome 可能静默丢弃自定义 User-Agent。因此包含 UA 的配置在浏览器优先模式下会在发送前提示错误，必须由用户明确同意「始终通过本站一次性中转」，或停用 UA；不会偷偷切换路由。此设置对 `/models` 和生成均生效，开启时密钥与头经过本站内存转发但不持久化。普通 HTTP 错误不触发额外的路由重试。

后端对自定义头做同样校验：24 项自定义头上限、总计 16KB、单项 4KB；拒绝 CRLF、重复名称、Host/Cookie、连接控制头、转发 IP 头、Origin/Referer、Sec-*、Proxy-*、X-PelicanBench-* 等；不再静默丢弃合法未知头。Content-Type、Accept 等协议字段由应用生成。外站预设只用于用户有权访问且服务商允许的接口，不提供额外权限，也不保证通过基于请求体或其他特征的客户端限制。

## 布局

- 桌面导航支持 304px 抽屉与 88px MD3 紧凑导航切换，选择保存在本机。
- 980px 及以下使用独立的移动抽屉，不改变桌面的折叠偏好。
- 文档目录在桌面侧栏 sticky，在移动端作为正常文档内容布局，不覆盖正文。

## 回归验证

先启动完整应用，再执行：

- `npx playwright install chromium`
- `npx playwright test`

测试默认访问 `http://127.0.0.1:3000`。可用 `PELICANBENCH_TEST_URL` 指向其他测试实例。测试会读取环境变量中的管理口令，覆盖桌面折叠、375–980px 文档布局、代理来源校验、登录 Cookie、真实公示读写、管理操作与上传失败重试。测试不调用付费模型接口，结束时会清理新增的公示样本。

生产构建验证：`npx next typegen`、`npm exec tsc -- --noEmit --pretty false`、`npm run build`。
