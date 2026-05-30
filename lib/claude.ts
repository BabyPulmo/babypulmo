import type {
  ClassificationResult,
  MultiModalInput,
  RecommendedAction,
  Severity,
  CoughClass
} from "./types";
import { meetsTachypneaCriteria } from "./respiratory-rate";

// Rules-gated severity table. NOT LLM discretion — deterministic. Loaded from
// SEVERITY_RULES_JSON env var (private clinical content). Canonical values live
// in the BabyPulmo/clinical-content repo, reviewed by Clinical Advisor. If the
// env var is unset, every classification falls through to a safe default
// (escalate + see_chw_now) — fail-closed.
type Rule = { mustEscalate: boolean; severity: Severity; action: RecommendedAction };

const DEFAULT_RULE: Rule = {
  mustEscalate: true,
  severity: "high",
  action: "see_chw_now"
};

function loadSeverityRules(): Partial<Record<CoughClass, Rule>> {
  const raw = process.env.SEVERITY_RULES_JSON;
  if (!raw) {
    console.warn("[claude] SEVERITY_RULES_JSON not set — fail-closed defaults active");
    return {};
  }
  try {
    return JSON.parse(raw) as Partial<Record<CoughClass, Rule>>;
  } catch (e) {
    console.error("[claude] SEVERITY_RULES_JSON parse error:", e);
    return {};
  }
}

const SEVERITY_RULES = loadSeverityRules();

const CONFIDENCE_THRESHOLD = 0.5;

export interface SeverityDecision {
  mustEscalate: boolean;
  severity: Severity;
  recommendedAction: RecommendedAction;
  // Which rule fired — for audit / explainability.
  reason:
    | "audio_class"
    | "tachypnea_override"
    | "cxr_override"
    | "fail_closed_default";
}

// Backwards-compatible single-input decision (audio classifier only).
export function decideSeverity(c: ClassificationResult): SeverityDecision {
  const rule = SEVERITY_RULES[c.class] ?? DEFAULT_RULE;
  const isDefault = !(c.class in SEVERITY_RULES);
  return {
    mustEscalate: rule.mustEscalate && c.confidence >= CONFIDENCE_THRESHOLD,
    severity: rule.severity,
    recommendedAction: rule.action,
    reason: isDefault ? "fail_closed_default" : "audio_class"
  };
}

// Multi-modal decision — audio class + respiratory rate + child profile +
// optional CXR. Hard overrides (highest precedence first):
//   1. CXR pneumonia or consolidation ≥ 0.6 → CRITICAL
//   2. WHO IMCI tachypnea + respiratory class + conf ≥ 0.3 → CRITICAL
//   3. else → audio_class rules table
// Both overrides preserve the BMRC-reviewed false-positive-tolerant bias
// (smoke detector logic — false alarm = CHW visit ($14); false negative =
// missed child death).
export function decideSeverityMultiModal(
  input: MultiModalInput
): SeverityDecision {
  // CXR override (highest precedence) — applies regardless of audio class,
  // because a positive consolidation on a chest film is more specific than
  // any acoustic signal and warrants immediate CHW referral.
  if (
    input.cxr &&
    (input.cxr.pneumoniaProb >= 0.6 || input.cxr.consolidationProb >= 0.6)
  ) {
    return {
      mustEscalate: true,
      severity: "critical",
      recommendedAction: "see_chw_now",
      reason: "cxr_override"
    };
  }

  // Tachypnea override: applies only to non-healthy classes (we don't want
  // a fast-breathing healthy child to escalate — they were just running).
  // For pneumonia / bronchiolitis / croup classes, tachypnea + any
  // confidence ≥ 0.3 → critical escalation, even below the normal 0.5 gate.
  const respiratoryClasses: CoughClass[] = [
    "pneumonia",
    "bronchiolitis",
    "croup"
  ];

  if (
    input.breathsPerMin !== null &&
    meetsTachypneaCriteria(input.breathsPerMin, input.profile.ageMonths) &&
    respiratoryClasses.includes(input.classification.class) &&
    input.classification.confidence >= 0.3
  ) {
    return {
      mustEscalate: true,
      severity: "critical",
      recommendedAction: "see_chw_now",
      reason: "tachypnea_override"
    };
  }

  return decideSeverity(input.classification);
}
