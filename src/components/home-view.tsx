import Link from "next/link";
import { formatCount, formatDuration, formatTokens } from "@/lib/format";
import type { HomeStats } from "@/lib/types";
import { ResultCard } from "./result-card";

export function HomeView({ stats }: { stats: HomeStats }) {
  return (
    <div className="page stack">
      {!stats.dbReady ? <div className="banner-error">统计暂时读不出来。测试仍可在浏览器里进行，公示会等数据库恢复后再提交。</div> : null}
      <section className="hero-card">
        <div>
          <p className="eyebrow">PelicanBench · 社区视觉基准</p>
          <h2 className="h-display" style={{ marginTop: 12 }}>一只鹈鹕，<br />一辆自行车。</h2>
          <p className="lede">
            把同一段提示词交给模型，看它能不能用内联 SVG 把外形、踩踏和车轮转起来。测试者对照画面，人工判断接进来的到底像不像模型真身，还是被路由、降智之后的替身。
          </p>
          <div className="hero-actions">
            <Link className="md-btn md-btn-filled md-btn-lg" href="/test">开始测试</Link>
            <Link className="md-btn md-btn-outlined md-btn-lg" href="/gallery">查看公示</Link>
          </div>
          <ul className="hero-points">
            <li>密钥默认只在这台浏览器里使用，服务器不保存</li>
            <li>提示词固定，方便社区对照，而不是比谁会改题</li>
            <li>第三方渠道可以自愿公开去掉密钥后的 Base URL</li>
          </ul>
        </div>
        <div className="hero-art">
          <img src="/images/hero-pelican.jpg" alt="一只鹈鹕骑着自行车，侧面看去车轮、车架和喙都清楚" />
        </div>
      </section>

      <section className="stat-grid" aria-label="站点统计">
        <article className="stat-card">
          <span>社区公示</span>
          <strong className="num">{formatCount(stats.submissions)}</strong>
          <em>不含视觉基准</em>
        </article>
        <article className="stat-card">
          <span>覆盖模型</span>
          <strong className="num">{formatCount(stats.models)}</strong>
          <em>按公示里的模型名去重</em>
        </article>
        <article className="stat-card">
          <span>第三方渠道</span>
          <strong className="num">{formatCount(stats.thirdParty)}</strong>
          <em>官方声明 {formatCount(stats.official)} 条</em>
        </article>
        <article className="stat-card">
          <span>近 24 小时访问</span>
          <strong className="num">{formatCount(stats.views24h)}</strong>
          <em>{formatCount(stats.unique24h)} 个地址</em>
        </article>
        <article className="stat-card">
          <span>累计访问</span>
          <strong className="num">{formatCount(stats.viewsTotal)}</strong>
          <em>只记页面，不记密钥</em>
        </article>
        <article className="stat-card">
          <span>平均耗时</span>
          <strong className="num">{formatDuration(stats.avgDurationMs)}</strong>
          <em>从发出到收完</em>
        </article>
        <article className="stat-card">
          <span>平均输出 Token</span>
          <strong className="num">{stats.avgOutputTokens == null ? "—" : formatTokens(stats.avgOutputTokens)}</strong>
          <em>接口没返回就空着</em>
        </article>
        <article className="stat-card">
          <span>视觉基准</span>
          <strong className="num">{formatCount(stats.references)}</strong>
          <em>人工绘制，不是模型</em>
        </article>
      </section>

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">怎么用</p>
            <h2 className="h2">三次动作，一次对照</h2>
          </div>
        </div>
        <div className="method-grid">
          <article className="md-card-filled">
            <div className="step-no">1</div>
            <h3 className="h3" style={{ marginTop: 12 }}>接上你的接口</h3>
            <p className="muted">填写 Base URL 和密钥，选择 Chat、Responses 或 Claude。模型列表从对方的 /models 读取。</p>
          </article>
          <article className="md-card-filled">
            <div className="step-no">2</div>
            <h3 className="h3" style={{ marginTop: 12 }}>用标准提示词生成</h3>
            <p className="muted">思考强度会映射到 reasoning_effort 或 Claude 的 budget。页面直接渲染返回的 HTML。</p>
          </article>
          <article className="md-card-filled">
            <div className="step-no">3</div>
            <h3 className="h3" style={{ marginTop: 12 }}>看完再决定公示</h3>
            <p className="muted">记录 token、用时、模型和思考强度。只有你打开公示，渠道选项才会出现。</p>
          </article>
        </div>
      </section>

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">最近公示</p>
            <h2 className="h2">社区交上来的画面</h2>
          </div>
          <Link className="md-btn md-btn-text" href="/gallery">全部公示</Link>
        </div>
        {stats.recent.length === 0 ? (
          <div className="md-card empty-state">
            <img src="/images/empty-bench.jpg" alt="" />
            <h3 className="h3">还没有社区样本</h3>
            <p className="muted">第一条公示可以来自你的浏览器。不上传的话，结果只留在本地历史。</p>
            <Link className="md-btn md-btn-filled" href="/test">去测一次</Link>
          </div>
        ) : (
          <div className="card-grid">
            {stats.recent.map((item) => <ResultCard key={item.id} item={item} />)}
          </div>
        )}
      </section>

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">视觉基准</p>
            <h2 className="h2">先看一只结构清楚的鹈鹕</h2>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>下面三套动画是站点绘制的对照，不是模型成绩。用来记住：喙、喉囊、两只轮子、车架和踩踏，应该能分开看见。</p>
        <div className="card-grid">
          {stats.referencesItems.map((item) => <ResultCard key={item.id} item={item} />)}
        </div>
      </section>

      <section className="md-card">
        <p className="eyebrow">边界</p>
        <h2 className="h2" style={{ marginTop: 8 }}>这不是自动评分器</h2>
        <p className="lede">画得好，不能单独证明模型没被路由；画得乱，也不能单独定罪。它只是让差异变得可见。同一模型、同一档思考，多看几次，再和基准、和其他渠道放在一起。</p>
      </section>
    </div>
  );
}
