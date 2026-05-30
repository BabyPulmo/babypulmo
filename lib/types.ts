export type CoughClass =
  | "pneumonia"
  | "bronchiolitis"
  | "asthma"
  | "croup"
  | "pertussis"
  | "normal"
  | "insufficient_quality";

export type Severity = "critical" | "high" | "moderate" | "low";

export type RecommendedAction =
  | "see_chw_now"
  | "see_doctor_24h"
  | "observe_24h"
  | "normal";

export interface ClassificationResult {
  class: CoughClass;
  confidence: number;
  classProbs: Record<CoughClass, number>;
  heatmapUrl?: string;
  modelVersion: string;
  inferenceMs: number;
  // Respiratory rate (breaths/min) computed alongside classification by the
  // Modal endpoint via envelope-peak detection on the breathing segment.
  // null when the audio is too noisy to confidently detect ≥3 breaths;
  // multi-modal severity decision then falls back to audio-class only.
  breathsPerMin?: number | null;
  rrConfidence?: "high" | "medium" | "low";
}

export interface ChildProfile {
  ageMonths: number;
  sex: "M" | "F" | "O";
  symptomDays?: number;
  fever?: boolean;
}

// Optional chest X-ray finding — second clinical modality alongside cough
// audio + respiratory rate. Populated when the caregiver also uploads a
// smartphone-photographed CXR (msg.type === "image" in the webhook).
export interface CxrSignal {
  pneumoniaProb: number;
  consolidationProb: number;
  noFindingProb: number;
}

// Multi-modal severity input — audio classifier + auto-measured respiratory
// rate + caregiver-reported child profile + optional CXR finding. Consumed
// by decideSeverityMultiModal().
export interface MultiModalInput {
  classification: ClassificationResult;
  profile: ChildProfile;
  breathsPerMin: number | null;  // null = RR could not be measured reliably
  cxr?: CxrSignal | null;
}

export interface ImciChunk {
  id: string;
  source: string;
  title: string;
  ageRange: string;
  body: string;
  similarity: number;
}

export interface Guidance {
  banglaText: string;
  audioUrl: string;
  recommendedAction: RecommendedAction;
  severity: Severity;
  mustEscalate: boolean;
  retrievedChunks: ImciChunk[];
}

export interface Caregiver {
  id: string;
  whatsappNumber: string;
  name?: string;
  district?: string;
  preferredLanguage: string;
  location?: { lat: number; lon: number };
}

export interface Chw {
  id: string;
  name: string;
  whatsappNumber: string;
  district: string;
  distanceKm: number;
}
