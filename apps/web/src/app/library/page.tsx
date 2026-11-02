"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Asset } from "@/types";

const kinds = [["", "すべて"], ["humanoid", "人型"], ["prop", "小物"], ["motion", "モーション"], ["environment", "環境"]];

export default function LibraryPage() {
  const [kind, setKind] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(() => { api.assets.list(kind || undefined).then(setAssets).catch(() => setAssets([])); }, [kind]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="font-medium mr-2">Library</h1>
        {kinds.map(([v, l]) => (
          <button key={v} onClick={() => setKind(v)} className={`px-2 py-1 rounded text-sm ${kind === v ? "bg-[var(--panel)]" : "muted"}`}>{l}</button>
        ))}
        <Link href="/forge" className="btn ml-auto">+ 新規生成</Link>
      </div>
      {assets.length === 0 && <p className="muted text-sm">アセットがありません。Forge で生成してください。</p>}
      <ul className="grid grid-cols-6 gap-3">
        {assets.map((a) => (
          <li key={a.id} className="panel p-2 text-sm">
            <div className="aspect-square rounded bg-black/40 mb-2 flex items-center justify-center muted text-xs overflow-hidden">
              {a.files.thumbnail ? <img src={api.fileUrl(a.files.thumbnail)!} alt="" className="w-full h-full object-cover" /> : a.kind}
            </div>
            <div className="truncate">{a.name}</div>
            <div className="muted text-xs">{a.kind} · v{a.version}{a.rig ? " · rigged" : ""}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
