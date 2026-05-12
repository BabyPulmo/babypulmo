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
}

export interface ChildProfile {
  ageMonths: number;
  sex: "M" | "F" | "O";
  symptomDays?: number;
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
