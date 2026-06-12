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

// The trained Wav2Vec2 model emits the 6-class training label space
// (colab/train_wav2vec2.py): healthy, common_cold, bronchiolitis, pneumonia,
// asthma, croup. The runtime CoughClass (lib/types.ts) predates that and uses
// normal/pertussis. Map model labels → runtime classes here so the deployed
// model is plug-and-play without renaming the runtime everywhere. Both "healthy"
// and "common_cold" are non-dangerous → "normal" (severity low/observe). Labels
// already in the runtime space pass through unchanged.
const MODEL_LABEL_MAP: Record<string, CoughClass> = {
  healthy: "normal",
  common_cold: "normal",
  bronchiolitis: "bronchiolitis",
  pneumonia: "pneumonia",
  asthma: "asthma",
  croup: "croup"
};

function toRuntimeClass(label: string): CoughClass {
  return MODEL_LABEL_MAP[label] ?? (CLASSES.includes(label as CoughClass) ? (label as CoughClass) : "insufficient_quality");
}

function remapProbs(probs: Record<string, number> | undefined): Record<CoughClass, number> {
  const out = {} as Record<CoughClass, number>;
  for (const c of CLASSES) out[c] = 0;
  if (probs) for (const [k, v] of Object.entries(probs)) out[toRuntimeClass(k)] += Number(v) || 0;
  return out;
}

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
    class: toRuntimeClass(String(data.class)),
    confidence: data.confidence,
    classProbs: remapProbs(data.class_probs),
    heatmapUrl: data.heatmap_url,
    modelVersion: data.model_version ?? "wav2vec2-fused-pediatric-v1",
    inferenceMs: Date.now() - start,
    breathsPerMin:
      typeof data.breaths_per_min === "number" ? data.breaths_per_min : null,
    rrConfidence: data.rr_confidence
  };
}

// Randomized SIMULATED classifier for the interactive /demo when no real model
// endpoint is configured. Picks a plausible class with a believable confidence so the
// demo feels varied — the UI labels this "simulated · model in training" so it never
// masquerades as a trained model. breathsPerMin is overridden by the real, browser-
// measured respiratory rate in /api/demo-classify, so it's left null here.
export function simulateClassification(): ClassificationResult {
  // Weighted pick — pneumonia/normal/bronchiolitis more common than croup/pertussis.
  const weighted: CoughClass[] = [
    "pneumonia", "pneumonia",
    "bronchiolitis", "bronchiolitis",
    "normal", "normal",
    "asthma",
    "croup",
    "pertussis"
  ];
  const picked = weighted[Math.floor(Math.random() * weighted.length)];
  const top = 0.55 + Math.random() * 0.4; // 0.55–0.95

  // Distribute the remaining probability across the other classes.
  const others = CLASSES.filter((c) => c !== picked);
  const rest = others.map(() => Math.random());
  const restSum = rest.reduce((a, b) => a + b, 0) || 1;
  const classProbs = {} as Record<CoughClass, number>;
  classProbs[picked] = top;
  others.forEach((c, i) => (classProbs[c] = ((1 - top) * rest[i]) / restSum));

  return {
    class: picked,
    confidence: Number(top.toFixed(2)),
    classProbs,
    heatmapUrl: undefined,
    modelVersion: "simulated-v0",
    inferenceMs: 40 + Math.floor(Math.random() * 60),
    breathsPerMin: null,
    rrConfidence: undefined
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
