import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function placeholder(label: string): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(
        `[supabase] ${label} called but NEXT_PUBLIC_SUPABASE_URL or related env var is not set. ` +
          `See .env.example.`
      );
    }
  });
}

// Server-side: service role bypasses RLS. Lazy — only throws when actually used.
export const supabaseAdmin: SupabaseClient =
  url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
    : placeholder("supabaseAdmin");

// Client-side: anon key, RLS enforced. Lazy — only throws when actually used.
export const supabaseAnon: SupabaseClient =
  url && anonKey ? createClient(url, anonKey) : placeholder("supabaseAnon");
