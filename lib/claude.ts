import type {
  ClassificationResult,
  RecommendedAction,
  Severity,
  CoughClass
} from "./types";

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

export function decideSeverity(c: ClassificationResult) {
  const rule = SEVERITY_RULES[c.class] ?? DEFAULT_RULE;
  return {
    mustEscalate: rule.mustEscalate && c.confidence >= CONFIDENCE_THRESHOLD,
    severity: rule.severity,
    recommendedAction: rule.action
  };
}
