// Prints every Bangla text the runtime can voice, with the exact cache key
// lib/tts.ts::synthesizeBanglaCached looks up. Feed to scripts/prerender_tts.py.
//
//   STOCK_BANGLA_JSON='…' npx tsx scripts/tts-manifest.ts > tts-manifest.json
import { GENERIC_BANGLA, SCREENING_UNAVAILABLE_BANGLA, STOCK_BANGLA, hashKey } from "../lib/tts";

const entries: { key: string; hash: string; text: string }[] = [];
for (const [key, text] of Object.entries(STOCK_BANGLA)) {
  if (text) entries.push({ key, hash: hashKey(text), text });
}
entries.push({ key: "fallback:generic", hash: hashKey(GENERIC_BANGLA), text: GENERIC_BANGLA });
entries.push({ key: "fallback:screening_unavailable", hash: hashKey(SCREENING_UNAVAILABLE_BANGLA), text: SCREENING_UNAVAILABLE_BANGLA });

if (Object.keys(STOCK_BANGLA).length === 0) {
  console.error("STOCK_BANGLA_JSON is not set — only fallbacks will be rendered");
}
process.stdout.write(JSON.stringify(entries, null, 2) + "\n");
