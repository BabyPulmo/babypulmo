// Uploads pre-rendered <hash>.mp3 files into the TTS cache bucket at the exact
// path lib/tts.ts::synthesizeBanglaCached reads (tts-cache/<hash>.mp3).
//
//   npx tsx scripts/upload-tts-cache.ts tts-manifest.json out_dir/
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { supabaseAdmin } from "../lib/supabase";

const [manifestPath, dir] = process.argv.slice(2);
const bucket = process.env.TTS_CACHE_BUCKET ?? "recordings";
const entries: { key: string; hash: string }[] = JSON.parse(readFileSync(manifestPath, "utf8"));

let uploaded = 0;
for (const e of entries) {
  const file = path.join(dir, `${e.hash}.mp3`);
  if (!existsSync(file)) {
    console.error(`missing ${file} (${e.key})`);
    process.exitCode = 1;
    continue;
  }
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(`tts-cache/${e.hash}.mp3`, readFileSync(file), { contentType: "audio/mpeg", upsert: true });
  if (error) {
    console.error(`upload failed ${e.key}: ${error.message}`);
    process.exitCode = 1;
  } else {
    uploaded++;
    console.log(`uploaded ${e.key}`);
  }
}
console.log(`${uploaded}/${entries.length} uploaded to ${bucket}/tts-cache/`);
