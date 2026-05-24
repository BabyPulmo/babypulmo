import type {
  ClassificationResult,
  RecommendedAction,
  Severity,
  CoughClass
} from "./types";

// Rules-gated severity table. NOT LLM discretion — deterministic.
// Kept as the only "decision" code path; no LLM is called at runtime.
// Bangla text is served from the stock library in lib/tts.ts.
const SEVERITY_RULES: Record<
  CoughClass,
  { mustEscalate: boolean; severity: Severity; action: RecommendedAction }
> = {
  pneumonia: { mustEscalate: true, severity: "critical", action: "see_chw_now" },
  bronchiolitis: { mustEscalate: true, severity: "high", action: "see_chw_now" },
  croup: { mustEscalate: true, severity: "high", action: "see_chw_now" },
  pertussis: { mustEscalate: true, severity: "high", action: "see_doctor_24h" },
  asthma: { mustEscalate: false, severity: "moderate", action: "see_doctor_24h" },
  normal: { mustEscalate: false, severity: "low", action: "observe_24h" },
  insufficient_quality: { mustEscalate: false, severity: "low", action: "normal" }
};

const CONFIDENCE_THRESHOLD = 0.5;

export function decideSeverity(c: ClassificationResult) {
  const rule = SEVERITY_RULES[c.class];
  return {
    mustEscalate: rule.mustEscalate && c.confidence >= CONFIDENCE_THRESHOLD,
    severity: rule.severity,
    recommendedAction: rule.action
  };
}
