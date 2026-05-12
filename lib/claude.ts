import Anthropic from "@anthropic-ai/sdk";
import type {
  ClassificationResult,
  ImciChunk,
  ChildProfile,
  Guidance,
  RecommendedAction,
  Severity,
  CoughClass
} from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Rules-gated severity table. NOT LLM discretion — deterministic.
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

export async function generateBanglaGuidance(
  classification: ClassificationResult,
  chunks: ImciChunk[],
  child: ChildProfile
): Promise<Pick<Guidance, "banglaText" | "recommendedAction" | "severity" | "mustEscalate">> {
  const decision = decideSeverity(classification);

  const chunksFormatted = chunks.length
    ? chunks
        .map(
          (c, i) =>
            `[${i + 1}] ${c.title} (${c.source}, age ${c.ageRange}):\n${c.body}`
        )
        .join("\n\n")
    : "(no chunks retrieved — use general WHO IMCI knowledge)";

  const system = `You are ShishuKantho ("Child's Voice"), a Bangla-language pediatric AI advisor for Bangladeshi mothers and community health workers.

CRITICAL RULES (never violate):
1. You NEVER diagnose. You say "the cough shows signs of X" — not "your child has X."
2. You ALWAYS recommend the action the rules layer has pre-decided. Do NOT change it.
3. You write in warm, rural-friendly Bangla (Bengali script). Avoid medical jargon.
4. Stay under 80 words.
5. If the action is "see_chw_now," tell the caregiver a CHW has been alerted and is on the way.
6. End with one sentence of reassurance.
7. Add the standard disclaimer at the end: "Ei tothyo doctor-er bikolpo noy."

Return ONLY the Bangla audio script. No English, no JSON, no preamble.`;

  const user = `Cough classifier output:
  predicted_class: ${classification.class}
  confidence: ${(classification.confidence * 100).toFixed(0)}%

Child:
  age: ${child.ageMonths} months
  sex: ${child.sex}
  symptom_days: ${child.symptomDays ?? "unknown"}

Retrieved WHO IMCI / DGHS protocol chunks:
${chunksFormatted}

Pre-decided action (REQUIRED — do not change): ${decision.recommendedAction}
Pre-decided severity: ${decision.severity}
Must escalate to CHW: ${decision.mustEscalate}

Write the Bangla audio script now.`;

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 500,
    system,
    messages: [{ role: "user", content: user }]
  });

  const text = msg.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return {
    banglaText: text,
    recommendedAction: decision.recommendedAction,
    severity: decision.severity,
    mustEscalate: decision.mustEscalate
  };
}
