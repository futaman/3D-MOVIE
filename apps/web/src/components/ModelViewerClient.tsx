"use client";
import dynamic from "next/dynamic";

/** ModelViewer はブラウザ専用(WebGL)。SSR/プリレンダリングを避けてクライアントだけで読み込む。 */
export const ModelViewer = dynamic(() => import("./ModelViewer").then((m) => m.ModelViewer), {
  ssr: false,
  loading: () => <div className="panel flex items-center justify-center muted text-sm" style={{ minHeight: 320 }}>ビューア読み込み中…</div>,
});
