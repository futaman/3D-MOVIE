import type { Asset, Job, Scene } from "@/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const WS_URL = API_URL.replace(/^http/, "ws") + "/ws/jobs";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 ? (undefined as T) : r.json();
}

export const api = {
  health: () => req<{ ok: boolean; redis: boolean; queue_backend: string }>("/health"),
  assets: {
    list: (kind?: string) => req<Asset[]>(`/assets${kind ? `?kind=${kind}` : ""}`),
    get: (id: string) => req<Asset>(`/assets/${id}`),
    create: (body: { kind: string; name: string; prompt?: { text: string; negative?: string; style?: string; seed?: number | null } }) =>
      req<Asset>("/assets", { method: "POST", body: JSON.stringify(body) }),
  },
  jobs: {
    list: () => req<Job[]>("/jobs"),
    create: (kind: string, params: Record<string, unknown>) =>
      req<Job>("/jobs", { method: "POST", body: JSON.stringify({ kind, params }) }),
    cancel: (id: string) => req<Job>(`/jobs/${id}/cancel`, { method: "POST" }),
  },
  scenes: {
    list: () => req<Scene[]>("/scenes"),
    create: (name: string) => req<Scene>("/scenes", { method: "POST", body: JSON.stringify({ name }) }),
    save: (scene: Scene) => req<Scene>(`/scenes/${scene.id}`, { method: "PUT", body: JSON.stringify(scene) }),
  },
  fileUrl: (rel: string | null | undefined) => (rel ? `${API_URL}/files/${rel}` : null),
};
