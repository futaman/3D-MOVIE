// 投稿用のメタデータ(タイトル・説明文・タグ)を out/metadata.json に書く。
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const dir = process.argv[2], out = path.join(dir, "out"), ep = JSON.parse(readFileSync(path.join(dir, "episode.json"), "utf8")), tm = JSON.parse(readFileSync(path.join(out, "timing.json"), "utf8"));
const lines = [ep.meta?.description_lead || "", "", "【計算の前提】", ...(ep.checks || []).map((c) => `・${c.claim}`), "", "【出典・前提】", ...(ep.facts || []).map((f) => `・${f.claim}(${f.source})`), "",
  ...(ep.meta?.credits?.length ? ["【映像素材】", ...ep.meta.credits.map((c) => `・${c}`), ""] : []),
  "映像はコードで生成しています(動画生成 AI は不使用)。", tm.voice ? `音声: ${tm.voice.engine}` : ""].filter((x) => x !== null);
const meta = { title: `${ep.title} #shorts`.slice(0, 100), description: lines.join("\n").slice(0, 4900), tags: ep.meta?.tags || [], privacyStatus: "private", categoryId: "27", unverified: (ep.facts || []).filter((f) => f.status === "unverified").map((f) => f.claim) };
writeFileSync(path.join(out, "metadata.json"), JSON.stringify(meta, null, 2)); console.log(`■ メタデータ: 「${meta.title}」`);
