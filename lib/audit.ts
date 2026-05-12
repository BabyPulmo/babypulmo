import { supabaseAdmin } from "./supabase";

interface AuditPayload {
  eventType: string;
  payload: Record<string, unknown>;
  recordingId?: string;
  classificationId?: string;
  caregiverId?: string;
}

// Immutable audit log — every classification + decision + escalation is recorded.
// Required for responsible AI compliance (BMRC ethics review trail).
export async function audit(p: AuditPayload): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_log").insert({
    event_type: p.eventType,
    payload: p.payload,
    recording_id: p.recordingId ?? null,
    classification_id: p.classificationId ?? null,
    caregiver_id: p.caregiverId ?? null
  });
  if (error) console.error("[audit]", error);
}
