// YouTube にアップロードするための認可を 1 回だけ行い、リフレッシュトークンを .yt-token.json に保存する。
// 事前に環境変数 YT_CLIENT_ID / YT_CLIENT_SECRET(Google Cloud の OAuth クライアント「デスクトップアプリ」)を設定する。
import http from "node:http";
import { writeFileSync } from "node:fs";
const { YT_CLIENT_ID: id, YT_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) { console.error("YT_CLIENT_ID と YT_CLIENT_SECRET を設定してください(docs: explain/auto/README.md)"); process.exit(1); }
const PORT = 8719, redirect = `http://127.0.0.1:${PORT}`;
const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&access_type=offline&prompt=consent&scope=${encodeURIComponent("https://www.googleapis.com/auth/youtube.upload")}`;
console.log("ブラウザで次の URL を開き、アップロード先のチャンネルのアカウントで許可してください:\n\n" + url + "\n");
http.createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get("code"); if (!code) { res.end("code がありません"); return; }
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }) });
  const j = await r.json();
  if (!j.refresh_token) { res.end("失敗しました: " + JSON.stringify(j)); console.error(j); process.exit(1); }
  writeFileSync(new URL("../.yt-token.json", import.meta.url), JSON.stringify({ refresh_token: j.refresh_token }, null, 2));
  res.end("OK. このタブは閉じてかまいません。"); console.log("保存しました: .yt-token.json(git には入りません)"); process.exit(0);
}).listen(PORT, "127.0.0.1");
