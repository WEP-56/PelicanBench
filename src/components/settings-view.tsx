"use client";

import { SEEDS, type Appearance } from "@/lib/appearance";
import { clearApiKey, clearHistory } from "@/lib/storage";
import { useAppearance, useSnackbar } from "./theme-provider";
import { Button, Segmented, Switch } from "./ui";

const SEED_COLORS: Record<Appearance["seed"], [string, string, string]> = {
  teal: ["#08665e", "#4a635e", "#8b5000"],
  blue: ["#0b57d0", "#545f73", "#7d5260"],
  violet: ["#6750a4", "#625b71", "#7d5260"],
  amber: ["#8b5000", "#725a42", "#08665e"],
  green: ["#1b6d32", "#516351", "#39656c"],
};

export function SettingsView() {
  const { appearance, update, reset } = useAppearance();
  const { notify } = useSnackbar();
  return (
    <div className="page stack">
      <div>
        <p className="eyebrow">Material You</p>
        <h2 className="h1">外观跟着这台浏览器走</h2>
        <p className="lede">色板、明暗、形状和密度只存在本地。换一台电脑，或者清掉站点数据，就会回到鹈鹕青。</p>
      </div>
      <section className="md-card stack">
        <h3 className="h3">明暗</h3>
        <Segmented
          value={appearance.mode}
          onChange={(mode) => update({ mode })}
          options={[
            { value: "light", label: "浅色" },
            { value: "dark", label: "深色" },
            { value: "system", label: "跟随系统" },
          ]}
        />
        <h3 className="h3">色板</h3>
        <div className="seed-grid">
          {SEEDS.map((seed) => (
            <button key={seed.id} type="button" className="seed-card" aria-pressed={appearance.seed === seed.id} onClick={() => update({ seed: seed.id })}>
              <span className="swatches">{SEED_COLORS[seed.id].map((color) => <i key={color} style={{ background: color }} />)}</span>
              <strong>{seed.label}</strong>
              <div className="field-support">{seed.hint}</div>
            </button>
          ))}
        </div>
        <h3 className="h3">对比与形状</h3>
        <Segmented
          label="对比"
          value={appearance.contrast}
          onChange={(contrast) => update({ contrast })}
          options={[{ value: "standard", label: "标准" }, { value: "high", label: "增强" }]}
        />
        <Segmented
          label="形状"
          value={appearance.shape}
          onChange={(shape) => update({ shape })}
          options={[{ value: "round", label: "圆润" }, { value: "standard", label: "方正" }]}
        />
        <Segmented
          label="密度"
          value={appearance.density}
          onChange={(density) => update({ density })}
          options={[{ value: "comfortable", label: "舒适" }, { value: "compact", label: "紧凑" }]}
        />
        <Switch checked={appearance.motion === "reduced"} onChange={(reduced) => update({ motion: reduced ? "reduced" : "full" })} label="减少动效" support="预览框里的鹈鹕动画不受影响" />
        <div className="cluster">
          <Button variant="outlined" onClick={() => { reset(); notify("已恢复默认外观"); }}>恢复默认</Button>
        </div>
      </section>
      <section className="md-card">
        <h3 className="h3">当前主题预览</h3>
        <p className="muted">按钮、芯片和输入框会立刻跟着色板变。</p>
        <div className="cluster" style={{ marginTop: 12 }}>
          <Button>填充按钮</Button>
          <Button variant="tonal">色调按钮</Button>
          <Button variant="outlined">表面按钮</Button>
          <span className="md-chip active">已选芯片</span>
          <span className="md-chip">普通芯片</span>
        </div>
      </section>
      <section className="md-card stack">
        <h3 className="h3">本机数据</h3>
        <p className="muted">密钥和历史都在这台浏览器里。清除不会影响已经公示的记录。</p>
        <div className="cluster">
          <Button variant="outlined" onClick={() => { clearApiKey(); notify("本机密钥已清除"); }}>清除密钥</Button>
          <Button variant="danger" onClick={() => { clearHistory(); notify("本机历史已清除"); }}>清除历史</Button>
        </div>
      </section>
    </div>
  );
}
