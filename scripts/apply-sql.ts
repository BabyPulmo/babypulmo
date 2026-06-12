// apply-sql.ts — dev helper to run .sql files against a Postgres database.
// Reads the connection string from DATABASE_URL (never hardcode it). Used to apply
// supabase/schema.sql + seeds without the dashboard SQL editor.
//
//   $env:DATABASE_URL="postgresql://..."; npx tsx scripts/apply-sql.ts supabase/schema.sql supabase/seed_imci.sql
//
// Each file is run as one multi-statement batch inside a transaction; on error the
// file's changes roll back and the error is printed.

import { readFileSync } from "node:fs";
import { Client } from "pg";

async function main() {
  const files = process.argv.slice(2);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  if (files.length === 0) throw new Error("usage: tsx scripts/apply-sql.ts <file.sql> [...]");

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("[apply-sql] connected");

  for (const f of files) {
    const sql = readFileSync(f, "utf8");
    process.stdout.write(`[apply-sql] ${f} … `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log("OK");
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.log("FAILED");
      console.error(String((e as Error).message));
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("[apply-sql] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
