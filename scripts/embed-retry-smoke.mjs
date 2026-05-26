// Smoke test for embed() retry/backoff behavior (no network, no real waiting).
// Run: npm run smoke:embed
//
// Demonstrates:
//   1. 429 x3 then 200  -> 4 fetch calls, backoffs [250,500,1000], returns embedding
//   2. 401              -> throws immediately, 1 fetch call, no backoff
//   3. 429 always       -> throws after 4 calls, backoffs [250,500,1000]

process.env.OPENAI_API_KEY = "sk-test"; // must be set before the module reads it

const { embed } = await import("../lib/embeddings.ts");

function makeResponse(status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    text: async () => `status ${status}`
  };
}

// Returns a fake fetch that yields the given status sequence (repeats the last).
function sequenceFetch(statuses) {
  const calls = { count: 0 };
  const fetchImpl = async () => {
    const status = statuses[Math.min(calls.count, statuses.length - 1)];
    calls.count++;
    return makeResponse(status);
  };
  return { fetchImpl, calls };
}

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`PASS: ${name}`);
  } else {
    failures++;
    console.error(`FAIL: ${name} -- ${detail}`);
  }
}

function arrEq(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// --- Case 1: 429 x3 then 200 ---
{
  const { fetchImpl, calls } = sequenceFetch([429, 429, 429, 200]);
  const sleeps = [];
  const sleepImpl = async (ms) => { sleeps.push(ms); };
  const result = await embed("hello", { fetchImpl, sleepImpl });
  check("429x3-then-200: 4 fetch calls", calls.count === 4, `got ${calls.count}`);
  check("429x3-then-200: backoffs [250,500,1000]", arrEq(sleeps, [250, 500, 1000]), `got ${JSON.stringify(sleeps)}`);
  check("429x3-then-200: returns embedding", Array.isArray(result) && arrEq(result, [0.1, 0.2, 0.3]), `got ${JSON.stringify(result)}`);
}

// --- Case 2: 401 immediate ---
{
  const { fetchImpl, calls } = sequenceFetch([401]);
  const sleeps = [];
  const sleepImpl = async (ms) => { sleeps.push(ms); };
  let threw = false;
  try {
    await embed("hello", { fetchImpl, sleepImpl });
  } catch {
    threw = true;
  }
  check("401: throws", threw, "did not throw");
  check("401: no retry (1 fetch call)", calls.count === 1, `got ${calls.count}`);
  check("401: no backoff", sleeps.length === 0, `got ${JSON.stringify(sleeps)}`);
}

// --- Case 2b: 403 immediate ---
{
  const { fetchImpl, calls } = sequenceFetch([403]);
  const sleeps = [];
  const sleepImpl = async (ms) => { sleeps.push(ms); };
  let threw = false;
  try {
    await embed("hello", { fetchImpl, sleepImpl });
  } catch {
    threw = true;
  }
  check("403: throws", threw, "did not throw");
  check("403: no retry (1 fetch call)", calls.count === 1, `got ${calls.count}`);
  check("403: no backoff", sleeps.length === 0, `got ${JSON.stringify(sleeps)}`);
}

// --- Case 3: 429 always (retries exhausted) ---
{
  const { fetchImpl, calls } = sequenceFetch([429]);
  const sleeps = [];
  const sleepImpl = async (ms) => { sleeps.push(ms); };
  let threw = false;
  try {
    await embed("hello", { fetchImpl, sleepImpl });
  } catch {
    threw = true;
  }
  check("429-always: throws after exhausting retries", threw, "did not throw");
  check("429-always: 4 fetch calls (1 + 3 retries)", calls.count === 4, `got ${calls.count}`);
  check("429-always: backoffs [250,500,1000]", arrEq(sleeps, [250, 500, 1000]), `got ${JSON.stringify(sleeps)}`);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll embed() retry checks passed");
