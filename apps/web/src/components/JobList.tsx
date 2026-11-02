"use client";
import { useJobs } from "@/lib/useJobs";
import { api } from "@/lib/api";

export function JobList({ limit }: { limit?: number }) {
  const { jobs, connected } = useJobs();
  const shown = limit ? jobs.slice(0, limit) : jobs;
  return (
    <div className="panel p-3">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-medium">ジョブ</h2>
        <span className="text-xs muted">{connected ? "進捗: 接続中" : "進捗: 再接続中…"}</span>
      </div>
      {shown.length === 0 && <p className="muted text-sm">まだジョブはありません</p>}
      <ul className="space-y-2">
        {shown.map((j) => (
          <li key={j.id} className="text-sm">
            <div className="flex justify-between">
              <span>{j.kind} <span className="muted">({j.status}{j.attempt > 1 ? ` / 再試行 ${j.attempt}` : ""})</span></span>
              {(j.status === "queued" || j.status === "running") && (
                <button className="muted text-xs" onClick={() => api.jobs.cancel(j.id)}>キャンセル</button>
              )}
            </div>
            <div className="h-1.5 rounded bg-black/40 mt-1">
              <div className="h-1.5 rounded" style={{ width: `${j.progress.percent}%`, background: j.status === "failed" ? "#f87171" : "var(--accent)" }} />
            </div>
            <div className="muted text-xs mt-0.5">
              {j.progress.stage} {j.progress.message}{j.progress.vram_used_mb != null && ` · VRAM ${j.progress.vram_used_mb}MB`}
              {j.error && <span style={{ color: "#f87171" }}> · {j.failure_kind}: {j.error}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
