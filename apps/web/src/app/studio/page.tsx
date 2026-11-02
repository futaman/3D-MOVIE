"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ModelViewer } from "@/components/ModelViewerClient";
import { JobList } from "@/components/JobList";
import type { Asset, Scene } from "@/types";

/**
 * Studio の骨組み: 左=アセット / 中央=ビューポート / 右=プロパティ / 下=タイムライン / 最下段=プロンプトバー。
 * この版では「シーン作成 → アセットを 1 つ配置 → 保存 → レンダリング投入」までが動く。
 * TODO(MVP): 複数ノード表示、ギズモ、モーションクリップ、カメラ/ライトプリセット UI、タイムライン実装、LLM プロンプト操作。
 */
export default function StudioPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scene, setScene] = useState<Scene | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    api.scenes.list().then(setScenes).catch(() => {});
    api.assets.list().then((a) => setAssets(a.filter((x) => x.kind === "humanoid" || x.kind === "prop"))).catch(() => {});
  }, []);

  async function newScene() {
    const s = await api.scenes.create(`シーン ${scenes.length + 1}`);
    setScenes([s, ...scenes]); setScene(s);
  }
  async function place(a: Asset) {
    if (!scene) return;
    const node = { id: `node_${Math.random().toString(36).slice(2, 10)}`, asset_id: a.id, name: a.name,
      transform: { position: [scene.nodes.length * 0.8, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, visible: true };
    const next = { ...scene, nodes: [...scene.nodes, node] } as Scene;
    setScene(await api.scenes.save(next));
  }
  async function render() {
    if (!scene) return;
    await api.jobs.create("render_video", { scene_id: scene.id });
  }
  const selected = scene?.nodes[scene.nodes.length - 1];
  const selectedAsset = assets.find((a) => a.id === selected?.asset_id);

  return (
    <div className="grid grid-cols-12 gap-3" style={{ gridTemplateRows: "auto auto auto" }}>
      <div className="col-span-12 flex items-center gap-2">
        <h1 className="font-medium">Studio · 動かす</h1>
        <select className="input w-56" value={scene?.id ?? ""} onChange={(e) => setScene(scenes.find((s) => s.id === e.target.value) ?? null)}>
          <option value="">シーンを選択</option>
          {scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn" onClick={newScene}>+ 新規シーン</button>
        <button className="btn ml-auto" disabled={!scene} onClick={render}>本番レンダリング</button>
      </div>

      <aside className="col-span-2 panel p-2 text-sm">
        <div className="font-medium mb-2">アセット</div>
        {assets.map((a) => (
          <button key={a.id} className="block w-full text-left px-2 py-1 rounded hover:bg-black/30 truncate" disabled={!scene} onClick={() => place(a)}>
            <span className="muted text-xs mr-1">{a.kind === "humanoid" ? "人" : "物"}</span>{a.name}
          </button>
        ))}
        <div className="font-medium mt-4 mb-1">モーション</div><p className="muted text-xs">Mixamo 取り込み後に表示(MVP)</p>
      </aside>

      <section className="col-span-8">
        <ModelViewer url={api.fileUrl(selectedAsset?.files.glb)} className="h-[460px]" />
      </section>

      <aside className="col-span-2 panel p-2 text-sm">
        <div className="font-medium mb-2">プロパティ</div>
        {scene ? (
          <>
            <div className="muted text-xs">長さ {scene.duration}s · {scene.render.width}×{scene.render.height} @{scene.render.fps} · {scene.camera.preset} · {scene.lighting.preset}</div>
            <div className="mt-2 font-medium">ノード ({scene.nodes.length})</div>
            <ul className="text-xs">{scene.nodes.map((n) => <li key={n.id} className="truncate">{n.name}</li>)}</ul>
          </>
        ) : <p className="muted text-xs">シーンを選択</p>}
      </aside>

      <section className="col-span-12 panel p-2 h-36 text-xs muted flex items-center justify-center">
        タイムライン(トラック / クリップ / キーフレーム)— MVP で実装
      </section>

      <section className="col-span-12 flex gap-2">
        <input className="input" placeholder="例: 男が椅子に座ってランタンを持ち上げる。カメラは正面から寄る(LLM 連携は MVP で実装)" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <button className="btn" disabled>適用</button>
      </section>

      <div className="col-span-12"><JobList limit={3} /></div>
    </div>
  );
}
