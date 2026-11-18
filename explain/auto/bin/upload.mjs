// final.mp4 を YouTube に「非公開」でアップロードする。公開は YouTube Studio で人が行う。
// 使い方: node bin/upload.mjs episodes/<id>   (事前に node bin/yt-auth.mjs)
import { readFileSync, statSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
const dir = process.argv[2], out = path.join(dir, "out"), meta = JSON.parse(readFileSync(path.join(out, "metadata.json"), "utf8"));
const tokFile = new URL("../.yt-token.json", import.meta.url), { YT_CLIENT_ID: id, YT_CLIENT_SECRET: secret } = process.env;
if (!id || !secret || !existsSync(tokFile)) { console.error("先に YT_CLIENT_ID / YT_CLIENT_SECRET を設定し、node bin/yt-auth.mjs を実行してください。"); process.exit(1); }
if (meta.unverified.length && !process.argv.includes("--allow-unverified")) { console.error("未確認の事実があるためアップロードしません:\n  " + meta.unverified.join("\n  ") + "\n出典を確かめて episode.json の status を confirmed にしてください。"); process.exit(2); }
const tok = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: JSON.parse(readFileSync(tokFile, "utf8")).refresh_token, grant_type: "refresh_token" }) })).json();
if (!tok.access_token) { console.error("アクセストークンを取得できません", tok); process.exit(1); }
const file = path.join(out, "final.mp4"), size = statSync(file).size;
const body = { snippet: { title: meta.title, description: meta.description, tags: meta.tags, categoryId: meta.categoryId, defaultLanguage: "ja" }, status: { privacyStatus: "private", selfDeclaredMadeForKids: false, containsSyntheticMedia: false } };
const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", { method: "POST", headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": "video/mp4", "x-upload-content-length": String(size) }, body: JSON.stringify(body) });
if (!init.ok) { console.error("アップロードを開始できません", init.status, await init.text()); process.exit(1); }
const put = await fetch(init.headers.get("location"), { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(size) }, body: readFileSync(file) });
const j = await put.json(); if (!put.ok) { console.error("アップロードに失敗", put.status, j); process.exit(1); }
writeFileSync(path.join(out, "upload.json"), JSON.stringify({ id: j.id, url: `https://studio.youtube.com/video/${j.id}/edit`, at: new Date().toISOString() }, null, 2));
console.log(`■ 非公開でアップロードしました: https://studio.youtube.com/video/${j.id}/edit`);
