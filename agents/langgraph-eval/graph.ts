// Build-time eval synthesizer — LangGraph-driven synthetic test-case generator
// for regression-testing the pediatric cough classifier + multi-modal severity
// decision.
//
// ──────────────────────────────────────────────────────────────────────────
// CLINICAL POSTURE: This graph runs at build time only. It generates
// synthetic Bangla Q&A pairs + simulated (audio_class, breaths_per_min,
// ChildProfile) tuples that the regression suite uses to verify
// `decideSeverityMultiModal()` behavior. Zero involvement in the caregiver
// runtime path. The deterministic severity rules table remains the only
// path to a caregiver-facing decision. See ARCHITECTURE.md §3 carve-out.
// ──────────────────────────────────────────────────────────────────────────
//
// Pipeline (StateGraph):
//   sample_case → generate_bangla_qa → simulate_audio_class → score → emit
//
// Run:
//   npx tsx agents/langgraph-eval/graph.ts --n=20 > test-cases.jsonl

import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";

interface EvalState {
  ageMonths: number;
  expectedClass: string;
  expectedSeverity: string;
  banglaQaPair?: { question: string; answer: string };
  syntheticInput?: {
    cough_class: string;
    confidence: number;
    breaths_per_min: number | null;
    profile: { ageMonths: number; sex: "M" | "F"; fever: boolean; symptomDays: number };
  };
  score?: { passed: boolean; reason: string };
}

const COUGH_CLASSES = ["healthy", "common_cold", "bronchiolitis", "pneumonia", "asthma", "croup"];
const SEVERITIES = ["low", "moderate", "high", "critical"];

const llm = process.env.ANTHROPIC_API_KEY
  ? new ChatAnthropic({ model: "claude-haiku-4-5-20251001", temperature: 0.7 })
  : null;

async function sampleCase(_state: EvalState): Promise<Partial<EvalState>> {
  // Pick a class biased toward pneumonia/bronchiolitis since those are the
  // safety-critical buckets the regression suite must cover.
  const weights = [0.15, 0.15, 0.20, 0.30, 0.10, 0.10];
  const r = Math.random();
  let acc = 0;
  let cls = "pneumonia";
  for (let i = 0; i < COUGH_CLASSES.length; i++) {
    acc += weights[i];
    if (r <= acc) {
      cls = COUGH_CLASSES[i];
      break;
    }
  }
  const ageMonths = 1 + Math.floor(Math.random() * 60);
  // Expected severity is the ground-truth label the regression suite will
  // assert against. Mirrors the SEVERITY_RULES table.
  const sev = cls === "healthy"
    ? "low"
    : cls === "common_cold" || cls === "asthma"
    ? "moderate"
    : "high";
  return { ageMonths, expectedClass: cls, expectedSeverity: sev };
}

async function generateBanglaQa(state: EvalState): Promise<Partial<EvalState>> {
  if (!llm) {
    return {
      banglaQaPair: {
        question: `${state.expectedClass} সন্দেহজনক — ${state.ageMonths} মাস বয়সী শিশু`,
        answer: "synthesized fallback (no ANTHROPIC_API_KEY)"
      }
    };
  }
  const out = await llm.invoke([
    {
      role: "system",
      content:
        "You generate realistic Bangla caregiver questions for testing a pediatric cough triage app. Output a JSON object {question, answer} where 'question' is a caregiver question (Bangla) and 'answer' is a brief clinical-safe Bangla note about what the cough sounds like."
    },
    {
      role: "user",
      content: `Generate a (question, answer) pair for a ${state.ageMonths}-month-old presenting with ${state.expectedClass}. Output JSON only.`
    }
  ]);
  let parsed = { question: "", answer: "" };
  try {
    const text = typeof out.content === "string" ? out.content : JSON.stringify(out.content);
    const match = text.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : parsed;
  } catch {
    parsed = { question: String(out.content).slice(0, 100), answer: "" };
  }
  return { banglaQaPair: parsed };
}

async function simulateAudioClass(state: EvalState): Promise<Partial<EvalState>> {
  // Inject noise around the ground-truth class — confidence ranges that
  // would exercise both the audio_class rule and the tachypnea_override.
  const confidence = state.expectedClass === "healthy" ? 0.7 + Math.random() * 0.3 : 0.35 + Math.random() * 0.55;
  const isRespiratory = ["pneumonia", "bronchiolitis", "croup"].includes(state.expectedClass);
  const respiratoryRate = isRespiratory
    ? state.ageMonths < 12 ? 45 + Math.random() * 15 : 35 + Math.random() * 15
    : 25 + Math.random() * 10;
  return {
    syntheticInput: {
      cough_class: state.expectedClass,
      confidence,
      breaths_per_min: Math.round(respiratoryRate),
      profile: {
        ageMonths: state.ageMonths,
        sex: Math.random() > 0.5 ? "M" : "F",
        fever: Math.random() > 0.4,
        symptomDays: 1 + Math.floor(Math.random() * 7)
      }
    }
  };
}

async function scoreNode(state: EvalState): Promise<Partial<EvalState>> {
  // Stub — in production this calls decideSeverityMultiModal() and compares
  // result to expectedSeverity.
  return {
    score: {
      passed: true,
      reason: "scaffold — full assertion happens in the regression runner"
    }
  };
}

const graph = new StateGraph<EvalState>({
  channels: {
    ageMonths: { value: (x, y) => y ?? x, default: () => 0 },
    expectedClass: { value: (x, y) => y ?? x, default: () => "" },
    expectedSeverity: { value: (x, y) => y ?? x, default: () => "" },
    banglaQaPair: { value: (x, y) => y ?? x, default: () => undefined },
    syntheticInput: { value: (x, y) => y ?? x, default: () => undefined },
    score: { value: (x, y) => y ?? x, default: () => undefined }
  }
})
  .addNode("sample_case", sampleCase)
  .addNode("generate_bangla_qa", generateBanglaQa)
  .addNode("simulate_audio_class", simulateAudioClass)
  .addNode("score", scoreNode)
  .addEdge(START, "sample_case")
  .addEdge("sample_case", "generate_bangla_qa")
  .addEdge("generate_bangla_qa", "simulate_audio_class")
  .addEdge("simulate_audio_class", "score")
  .addEdge("score", END)
  .compile();

async function main() {
  const args = process.argv.slice(2);
  const nArg = args.find((a) => a.startsWith("--n="));
  const n = nArg ? parseInt(nArg.split("=")[1], 10) : 5;
  for (let i = 0; i < n; i++) {
    const result = await graph.invoke({} as EvalState);
    process.stdout.write(JSON.stringify(result) + "\n");
  }
}

if (process.argv[1].endsWith("graph.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { graph };
