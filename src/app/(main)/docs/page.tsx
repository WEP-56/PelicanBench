import type { Metadata } from "next";
import Link from "next/link";
import { STANDARD_PROMPT } from "@/lib/constants";
import { HEADER_PRESETS, HEADERS_RESEARCHED_AT, BROWSER_HEADER_SOURCE } from "@/lib/header-presets";

export const metadata: Metadata = { title: "文档" };

const TOC = [
  ["what", "这是什么"],
  ["method", "测试方法"],
  ["read", "怎么读结果"],
  ["protocol", "协议与思考"],
  ["headers", "请求头与客户端预设"],
  ["privacy", "隐私澄清"],
  ["rules", "公示规则"],
  ["disclaimer", "免责声明"],
];

export default function DocsPage() {
  return (
    <div className="page">
      <div className="docs-layout">
        <nav className="docs-toc" aria-label="文档目录">
          <p className="docs-toc-title">本页目录</p>
          <div className="docs-toc-links">
            {TOC.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </div>
        </nav>
        <div className="docs-content stack">
          <section className="md-card doc-block" id="what">
            <p className="eyebrow">PelicanBench</p>
            <h2 className="h2">一只鹈鹕，用来看见模型还在不在</h2>
            <p>PelicanBench 是社区里流传开的一种人工测试。不打分，不跑自动评测集。它只做一件事：用固定提示词，让模型生成一段可运行的单文件 HTML，里面用内联 SVG 画一只骑自行车的鹈鹕。</p>
            <p>测试者看外形和动态。喙是不是喙，轮子是不是在转，踩踏有没有接上曲柄，动画循环时会不会跳。这些地方一旦被替换模型、被路由到更便宜的模型，或者被降智，常常会先从画面上露出来。</p>
            <p>它传播得广，是因为它便宜、直观，而且不依赖某个厂商的排行榜。它也因此不能被当成科学证明。</p>
          </section>
          <section className="md-card doc-block" id="method">
            <h2 className="h2">测试方法</h2>
            <ol>
              <li>准备你自己的 Base URL 和 API Key。官方、中转站、兼容网关都可以。</li>
              <li>选择协议：OpenAI Chat Completions、OpenAI Responses，或 Claude Messages。</li>
              <li>用「获取模型」读取对方的 <code>/models</code>，或自己填模型名。</li>
              <li>选择思考强度。关闭、低、中、高、极高会映射到对应协议的推理参数。</li>
              <li>发送下面这段固定提示词。站点不会替你改写。</li>
              <li>在右侧直接渲染返回的 HTML。可以看源码、看提示词、下载。</li>
              <li>对照检查单做人工判断。满意或不满意，都可以选择不公示。</li>
            </ol>
            <pre className="code-view">{STANDARD_PROMPT}</pre>
          </section>
          <section className="md-card doc-block" id="read">
            <h2 className="h2">怎么读一张图</h2>
            <ul>
              <li>喙和喉囊应该分开，朝向合理，而不是糊成一块橙色。</li>
              <li>头、颈、身体、翅膀、尾巴最好能各自指认。</li>
              <li>自行车至少有两个独立车轮，并且轮子在转。</li>
              <li>车架、车座、车把、脚踏应该在，踩踏最好跟着曲柄走。</li>
              <li>动画应当循环衔接。第一帧和最后一帧不要明显跳一下。</li>
              <li>提示词禁止外部资源。预览会挡住外链；如果源码里出现 http 图片，这本身就是一条观察。</li>
            </ul>
            <p>首页的三套视觉基准是站点画的，不是模型成绩。它们只负责提醒：结构清楚时长什么样。</p>
          </section>
          <section className="md-card doc-block" id="protocol">
            <h2 className="h2">协议与思考强度</h2>
            <ul>
              <li>OpenAI Chat：<code>POST /v1/chat/completions</code>。思考强度写入 <code>reasoning_effort</code>，极高为 <code>max</code>。</li>
              <li>OpenAI Responses：<code>POST /v1/responses</code>。思考强度写入 <code>reasoning.effort</code>，并尽量设置 <code>store: false</code>。</li>
              <li>Claude Messages：<code>POST /v1/messages</code>。思考开启时使用 extended thinking 的 <code>budget_tokens</code>，温度固定为 1。</li>
            </ul>
            <p>非推理模型如果收到推理参数，接口可能会直接拒绝。那时把思考强度改成关闭再试。部分中转站不认识 <code>max_completion_tokens</code> 或 <code>max</code>，页面会根据错误再试一次常见写法，但仍不保证所有网关都兼容。</p>
            <p>用时从浏览器发出请求算到收到完整响应，包含排队。Token 以接口返回的 usage 为准；没返回就记为「未返回」，不会编一个 0。</p>
          </section>
          <section className="md-card doc-block" id="headers">
            <p className="eyebrow">客户端兼容 · {HEADERS_RESEARCHED_AT} 核验</p>
            <h2 className="h2">请求头配置</h2>
            <p>测试页的「请求头配置」可为获取模型和生成添加额外 HTTP 请求头。用于你有权访问、且服务商允许的网关兼容场景；这些标识不会提供额外权限，不保证通过中转站的客户端校验，也不是完整 CLI 模拟。</p>
            <ol>
              <li>展开配置，选择标准 API、Codex CLI、OpenCode 或 Claude Code。切换预设会替换现有条目，但不会改动协议、提示词或发送方式。</li>
              <li>可以修改头名称、值，逐条停用或删除，也可以导入名称到字符串值的 JSON 对象。名称大小写不敏感，重复条目会报错。</li>
              <li>用 <code>{"{{API_KEY}}"}</code> 引用上方 API Key，例如 <code>{"Bearer {{API_KEY}}"}</code>。启用的自定义头会覆盖协议生成的同名头；Content-Type、Accept 和连接/安全相关头不能覆盖。</li>
              <li>预览会隐藏鉴权、密钥与非标准自定义值。全部配置只在当前页面内存中，刷新或离开后清除；不写入历史、公示或下载文件。</li>
            </ol>
            <h3 className="h3">为什么 User-Agent 需要中转？</h3>
            <p>User-Agent 已不属于规范中的禁止头，但 Chrome 仍可能在 fetch 中静默丢弃它。因此，启用该头时必须明确开启「始终通过本站一次性中转」，或先停用该项。不会先偷偷尝试直连，也不会自动替你授权中转。<a href={BROWSER_HEADER_SOURCE} target="_blank" rel="noopener noreferrer">MDN 浏览器限制说明 ↗</a></p>
            <p>默认仍为浏览器优先，是否跨域失败后中转由原有开关决定；「始终中转」是独立的显式选择。中转会接收密钥与自定义头用于当次转发，但不写入数据库或日志。内网地址、重定向、Host、Cookie、Origin、Referer、Sec-*、X-Forwarded-* 和本站校验头等仍被保护。</p>
            <h3 className="h3">预设从哪里来？</h3>
            {HEADER_PRESETS.filter((preset) => preset.id !== "default").map((preset) => (
              <div key={preset.id} className="md-card-filled" style={{ marginTop: 12 }}>
                <h4 style={{ margin: 0, fontWeight: 500 }}>{preset.label} · {preset.version}</h4>
                <p>{preset.detail}</p>
                <ul>{preset.headers.filter((header) => header.enabled !== false).map((header) => <li key={header.name}><code>{header.name}</code>：<code>{header.value}</code></li>)}</ul>
                <div className="stack" style={{ gap: 6 }}>{preset.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--md-primary)", fontSize: 13 }}>{source.title} ↗</a>)}</div>
              </div>
            ))}
            <p>Claude Code 的 <code>anthropic-beta</code> 取决于版本和启用的能力，预设只保留一个默认停用的空项。本站不会注入 OAuth 标记、设备或账户信息，也不伪造会话 ID。若网关检查请求体、TLS 特征或订阅身份，单改请求头可能无效，请按服务商允许的方式连接。</p>
          </section>
          <section className="md-card doc-block" id="privacy">
            <h2 className="h2">隐私澄清</h2>
            <ul>
              <li>API Key 不会写入数据库，也不会写进服务器日志。</li>
              <li>默认由浏览器直接请求你填写的地址。密钥只留在内存，以及你主动打开的「记住密钥」本地存储里。</li>
              <li>如果允许跨域失败后中转，或在请求头配置中明确开启「始终中转」，服务器会在内存中转发这一次请求。密钥和自定义请求头不入库、不写日志；日志仅保留主机名、路径、状态码/失败类别和耗时。</li>
              <li>中转拒绝内网地址、云元数据地址，以及模型列表和生成接口以外的路径，避免被当成开放代理。</li>
              <li>本地历史、外观、检查单都在 localStorage / sessionStorage。清除站点数据即消失。</li>
              <li>访问统计只记录路径、时间、IP、User-Agent 和来源页，用来做管理端的流量图。不记录密钥，也不自动上传你的生成结果。</li>
              <li>公示是另一次明确动作。上传内容是 HTML、模型、协议、思考强度、token、用时、昵称和备注。官方渠道不上传 Base URL；第三方渠道只公开域名，不包含协议、端口、路径、账号或查询参数。</li>
            </ul>
          </section>
          <section className="md-card doc-block" id="rules">
            <h2 className="h2">公示规则</h2>
            <ul>
              <li>只有包含内联 SVG、且使用标准提示词的结果可以公示。</li>
              <li>选择公示之后，才会出现渠道选项。</li>
              <li>官方渠道：公开展示「官方渠道」，不展示 Base URL。如果地址不是 api.openai.com 或 api.anthropic.com，管理端会看到域名不一致标记，地址仍然不公开。</li>
              <li>第三方渠道：只公开域名（例如 <code>hongshu.shop</code>），不展示协议、端口或 API 路径。这是为了让社区能对照中转站，不是站点自动认定对方有问题。</li>
              <li>你可以附上昵称、短备注，以及「像真身 / 存疑 / 像被降智」的个人判断。判断是你的，不是站点的评分。</li>
              <li>管理端可以隐藏或删除公示，也可以封禁滥用地址。</li>
            </ul>
          </section>
          <section className="md-card doc-block" id="disclaimer">
            <h2 className="h2">免责声明</h2>
            <p>PelicanBench 是社区工具，与 OpenAI、Anthropic 或任何模型厂商无关。一次动画不能证明路由、降智、计费异常或模型身份。画面差，可能是提示词、温度、思考预算、网关截断、模型本身不擅长 SVG，也可能是被替换了。画面好，同样不能单独证明「这就是原版」。</p>
            <p>公示里的渠道、地址和判断由提交者声明。站点会做基本清理和隔离预览，但不能保证内容真实、合法、无冒犯。若一条公示侵犯权利或暴露了不该公开的信息，请从本页底部进入管理入口处理，或等待维护者隐藏。</p>
            <p>生成内容的版权和合规责任由调用模型的人承担。请勿把密钥发给他人，也不要在备注里粘贴密钥。</p>
          </section>
          <section className="admin-entry" id="admin">
            <p className="eyebrow">运维</p>
            <h2 className="h3">管理入口</h2>
            <Link className="md-btn md-btn-outlined" href="/admin">打开管理入口</Link>
          </section>
        </div>
      </div>
    </div>
  );
}
