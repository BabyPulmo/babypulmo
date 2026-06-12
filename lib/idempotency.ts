import { supabaseAdmin } from "./supabase";

// Meta delivers webhooks at-least-once and retries on any non-2xx response, so
// the same message id (wamid) can arrive multiple times. claimMessage atomically
// records a wamid the first time it's seen; a duplicate insert hits the
// processed_messages primary-key constraint and returns false, letting the
// webhook skip reprocessing (no duplicate uploads / classifications / alerts).
//
// Requires the processed_messages table (see supabase/schema.sql).

const UNIQUE_VIOLATION = "23505";

export async function claimMessage(messageId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("processed_messages")
    .insert({ message_id: messageId });

  if (!error) return true; // first time we've seen this wamid
  if (error.code === UNIQUE_VIOLATION) return false; // duplicate delivery — skip

  // Unexpected DB error: fail safe by treating it as unclaimed so the message is
  // still processed (better a rare duplicate than silently dropping a caregiver's
  // cough). Surfaced in logs.
  console.error("[idempotency] claimMessage error", error);
  return true;
}
