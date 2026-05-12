import { supabaseAdmin } from "./supabase";
import type { Chw } from "./types";

// Default location for demo: center of Bogura district (24.8463 N, 89.3719 E).
// In production: read caregiver's GPS from their WhatsApp location message or profile.
const DEFAULT_LAT = 24.8463;
const DEFAULT_LON = 89.3719;

export async function findNearestChw(
  lat: number = DEFAULT_LAT,
  lon: number = DEFAULT_LON
): Promise<Chw | null> {
  const { data, error } = await supabaseAdmin.rpc("find_nearest_chw", {
    caregiver_lat: lat,
    caregiver_lon: lon
  });
  if (error) {
    console.error("[escalation] find_nearest_chw error", error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  return {
    id: row.chw_id,
    name: row.chw_name,
    whatsappNumber: row.chw_whatsapp,
    district: "",
    distanceKm: Number(row.distance_km)
  };
}
