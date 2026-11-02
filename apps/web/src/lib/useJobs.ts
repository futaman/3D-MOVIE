"use client";
import { useEffect, useRef, useState } from "react";
import { api, WS_URL } from "./api";
import type { Job } from "@/types";

/** ジョブ一覧を取得し、WebSocket の進捗で差分更新する。完了時にブラウザ通知を出す。 */
export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [connected, setConnected] = useState(false);
  const seenDone = useRef(new Set<string>());

  useEffect(() => {
    api.jobs.list().then(setJobs).catch(() => {});
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); timer = setTimeout(connect, 2000); };
      ws.onmessage = (ev) => {
        const job: Job = JSON.parse(ev.data);
        setJobs((prev) => {
          const i = prev.findIndex((j) => j.id === job.id);
          if (i < 0) return [job, ...prev];
          const next = prev.slice(); next[i] = job; return next;
        });
        if ((job.status === "succeeded" || job.status === "failed") && !seenDone.current.has(job.id)) {
          seenDone.current.add(job.id);
          notify(job);
        }
      };
    };
    connect();
    return () => { clearTimeout(timer); ws?.close(); };
  }, []);

  return { jobs, connected };
}

function notify(job: Job) {
  if (typeof Notification === "undefined") return;
  const body = `${job.kind} が ${job.status === "succeeded" ? "完了" : "失敗"}しました`;
  if (Notification.permission === "granted") new Notification("3D-MOVIE", { body });
  else if (Notification.permission !== "denied") Notification.requestPermission();
}
