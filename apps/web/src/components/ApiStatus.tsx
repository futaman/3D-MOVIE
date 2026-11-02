"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function ApiStatus() {
  const [state, setState] = useState<"checking" | "ok" | "down">("checking");
  const [redis, setRedis] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => api.health().then((h) => { setState("ok"); setRedis(h.redis); }).catch(() => setState("down"));
    tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, []);
  const color = state === "ok" ? "#4ade80" : state === "down" ? "#f87171" : "#facc15";
  return (
    <span className="text-xs muted flex items-center gap-2">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      API {state}{redis === false && " (redis down)"}
    </span>
  );
}
