"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { JobList } from "@/components/JobList";
import { ModelViewer } from "@/components/ModelViewerClient";
import type { Asset } from "@/types";

const styles = [["semireal", "セミリアル"], ["realistic", "リアル"], ["anime", "アニメ調"], ["stylized", "スタイライズ"]];

export default function ForgePage() {
  const [kind, setKind] = useState<"humanoid" | "prop">("humanoid");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [negative, setNegative] = useState("");
  const [style, setStyle] = useState("semireal");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setBusy(true); setErr(null);
    try {
      const a = await api.assets.create({ kind, name: name || text.slice(0, 40), prompt: { text, negative, style } });
      setAsset(a);
      // 骨組み: 形状 → テクスチャ → (人型なら)リグ を順に投入。MVP では 4 候補生成と候補選択 UI に置き換える
      await api.jobs.create("generate_shape", { asset_id: a.id });
      await api.jobs.create("generate_texture", { asset_id: a.id });
      if (kind === "humanoid") await api.jobs.create("rig", { asset_id: a.id });
      setAsset(await api.assets.get(a.id));
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <section className="col-span-3 panel p-3 space-y-3">
        <h1 className="font-medium">Forge · 作る</h1>
        <div className="flex gap-2">
          {(["humanoid", "prop"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`flex-1 py-1.5 rounded-md text-sm border ${kind === k ? "border-[var(--accent)]" : "border-[var(--border)] muted"}`}>
              {k === "humanoid" ? "人型" : "小物"}
            </button>
          ))}
        </div>
        <input className="input" placeholder="名前(省略可)" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className="input h-28" placeholder={kind === "humanoid" ? "例: 黒いコートを着た 30 代の男性、短髪" : "例: 古い真鍮のランタン"} value={text} onChange={(e) => setText(e.target.value)} />
        <input className="input" placeholder="ネガティブ(省略可)" value={negative} onChange={(e) => setNegative(e.target.value)} />
        <select className="input" value={style} onChange={(e) => setStyle(e.target.value)}>
          {styles.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn w-full" disabled={busy || !text.trim()} onClick={generate}>{busy ? "生成中…" : "生成"}</button>
        {err && <p className="text-xs" style={{ color: "#f87171" }}>{err}</p>}
        <p className="muted text-xs">現在は dummy プロバイダ。実モデルはフェーズ 0 で差し替え。</p>
      </section>
      <section className="col-span-6 space-y-3">
        <ModelViewer url={api.fileUrl(asset?.files.glb)} className="h-[480px]" />
        {asset && (
          <div className="panel p-3 text-sm">
            <div className="font-medium">{asset.name} <span className="muted">v{asset.version} · {asset.kind}</span></div>
            <div className="muted text-xs mt-1">
              三角形 {asset.stats.triangles ?? "-"} · テクスチャ {asset.stats.texture_size ?? "-"} · リグ {asset.rig ? asset.rig.skeleton : "なし"}
              {" · "}{asset.pipeline.shape} / {asset.pipeline.texture} / {asset.pipeline.rig}
            </div>
          </div>
        )}
      </section>
      <aside className="col-span-3"><JobList limit={8} /></aside>
    </div>
  );
}
