// Smoke test for caregiver-audio path + size logic, run against the REAL shipped
// module (lib/audio-path.ts — the same code lib/storage.ts uses).
// Run: npm run smoke:storage

import { createHash } from "node:crypto";

const { buildAudioKey, assertWithinSize, FileTooLargeError, MAX_AUDIO_BYTES } =
  await import("../lib/audio-path.ts");

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) {
    console.log(`PASS: ${name}`);
  } else {
    failures++;
    console.error(`FAIL: ${name}${detail ? " -- " + detail : ""}`);
  }
}

const today = new Date().toISOString().slice(0, 10);

// --- AC1/AC2: path format + SHA-256 hash, no plaintext phone ---
{
  const phone = "+8801711111111";
  const key = buildAudioKey(phone, "wamid.HBgABC/123==", "audio/ogg");
  console.log(`built key: recordings/${key}`);
  const [hash, date, file] = key.split("/");
  const expectedHash = createHash("sha256").update(phone).digest("hex");

  check("AC1: 3 path segments {hash}/{date}/{file}", key.split("/").length === 3, key);
  check("AC2: hash is SHA-256 of phone", hash === expectedHash, `${hash} vs ${expectedHash}`);
  check("AC2: hash is 64 hex chars", /^[0-9a-f]{64}$/.test(hash), hash);
  check("AC2: no plaintext phone digits in key", !key.includes("8801"), key);
  check("AC1: date segment is today (YYYY-MM-DD)", date === today, `${date} vs ${today}`);
  check("AC1: ext from audio/ogg is .ogg", file.endsWith(".ogg"), file);
  check("AC1: message-id sanitized (no / or =)", file === "wamid.HBgABC_123__.ogg", file);
}

// --- AC1: ext fallback ---
{
  const key = buildAudioKey("x", "m1", "audio/mpeg");
  check("AC1: non-ogg mime falls back to .mp3", key.endsWith(".mp3"), key);
}

// --- AC3: 5MB threshold + reject ---
{
  check("AC3: MAX_AUDIO_BYTES === 5MB", MAX_AUDIO_BYTES === 5 * 1024 * 1024, String(MAX_AUDIO_BYTES));

  let ok4mb = true;
  try { assertWithinSize(4 * 1024 * 1024); } catch { ok4mb = false; }
  check("AC3: 4MB accepted (no throw)", ok4mb);

  let okExact = true;
  try { assertWithinSize(5 * 1024 * 1024); } catch { okExact = false; }
  check("AC3: exactly 5MB accepted (boundary)", okExact);

  let threw = null;
  try { assertWithinSize(5 * 1024 * 1024 + 1); } catch (e) { threw = e; }
  check("AC3: 5MB+1 throws", threw !== null);
  check("AC3: throws FileTooLargeError", threw instanceof FileTooLargeError, threw && threw.name);
  check("AC3: error carries byte count", threw && threw.bytes === 5 * 1024 * 1024 + 1, threw && String(threw.bytes));

  let threw6 = false;
  try { assertWithinSize(6 * 1024 * 1024); } catch { threw6 = true; }
  check("AC3: 6MB rejected", threw6);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll storage path/size checks passed (against the real lib/audio-path.ts)");
