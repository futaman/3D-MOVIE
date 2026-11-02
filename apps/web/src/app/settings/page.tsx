import { API_URL } from "@/lib/api";

export default function SettingsPage() {
  return (
    <div className="panel p-4 text-sm space-y-2 max-w-xl">
      <h1 className="font-medium">Settings</h1>
      <p>API: <code>{API_URL}</code></p>
      <p className="muted">プロバイダ(dummy / hunyuan3d)、VRAM 予算、Blender パスは <code>.env</code> で設定します。UI からの変更は v1 で対応。</p>
    </div>
  );
}
