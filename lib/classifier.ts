import type { ClassificationResult, CoughClass } from "./types";

const ENDPOINT = process.env.CLASSIFIER_ENDPOINT;
const API_KEY = process.env.CLASSIFIER_API_KEY;

const CLASSES: CoughClass[] = [
  "pneumonia",
  "bronchiolitis",
  "asthma",
  "croup",
  "pertussis",
  "normal",
  "insufficient_quality"
];

export async function classifyCough(audioUrl: string): Promise<ClassificationResult> {
  if (!ENDPOINT) return mockClassify();

  const start = Date.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {})
    },
    body: JSON.stringify({ audio_url: audioUrl })
  });
  if (!res.ok) throw new Error(`Classifier ${res.status}: ${await res.text()}`);
  const data = await res.json();

  return {
    class: data.class as CoughClass,
    confidence: data.confidence,
    classProbs: data.class_probs,
    heatmapUrl: data.heatmap_url,
    modelVersion: data.model_version ?? "wav2vec2-fused-pediatric-v1",
    inferenceMs: Date.now() - start,
    breathsPerMin:
      typeof data.breaths_per_min === "number" ? data.breaths_per_min : null,
    rrConfidence: data.rr_confidence
  };
}

// Demo fallback used until the Colab-trained model is deployed.
// Returns deterministic mock output for testing the pipeline without a live endpoint.
function mockClassify(): ClassificationResult {
  const classProbs: Record<CoughClass, number> = {
    pneumonia: 0.71,
    bronchiolitis: 0.12,
    asthma: 0.06,
    croup: 0.05,
    pertussis: 0.03,
    normal: 0.02,
    insufficient_quality: 0.01
  };
  return {
    class: "pneumonia",
    confidence: 0.71,
    classProbs,
    heatmapUrl: undefined,
    modelVersion: "mock-v0",
    inferenceMs: 50,
    breathsPerMin: 52, // tachypneic for a 1-yr-old → demo triggers override
    rrConfidence: "medium"
  };
}
