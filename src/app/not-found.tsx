import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center-screen">
      <section className="md-card login-card stack">
        <p className="eyebrow">404</p>
        <h1 className="h2">这页不在路上</h1>
        <p className="muted">可能是公示已被隐藏，或者地址写错了。</p>
        <Link className="md-btn md-btn-filled" href="/">回到首页</Link>
      </section>
    </main>
  );
}
