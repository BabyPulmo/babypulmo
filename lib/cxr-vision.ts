// CXR (chest X-ray) vision client — calls the Modal endpoint deployed via
// colab/cxr_vision_modal.py to classify a smartphone-photographed CXR for
// pneumonia / consolidation / no-finding probabilities.
//
// Triggered by the WhatsApp webhook when the caregiver also sends an image
// attachment (msg.type === "image"). The CXR finding feeds the deterministic
// decideSeverityMultiModal() rules table as a hard override:
//   cxr_pneumonia ≥ 0.6 OR cxr_consolidation ≥ 0.6 → CRITICAL escalation
//
// No LLM sees the image; no LLM speaks Bangla to the caregiver — same
// clinical-decision-support posture as the rest of the runtime.

const CXR_ENDPOINT = process.env.CXR_ENDPOINT;
const CXR_API_KEY = process.env.CXR_API_KEY;

export interface CxrFinding {
  pneumoniaProb: number;
  consolidationProb: number;
  noFindingProb: number;
  allFindings?: Record<string, number>;
  modelVersion: string;
}

export async function classifyCxr(imageUrl: string): Promise<CxrFinding | null> {
  if (!CXR_ENDPOINT) {
    // Demo mock — useful for end-to-end smoke testing without a Modal deploy.
    return {
      pneumoniaProb: 0.42,
      consolidationProb: 0.18,
      noFindingProb: 0.55,
      modelVersion: "torchxrayvision-densenet121-res224-all-mock"
    };
  }
  const res = await fetch(CXR_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(CXR_API_KEY ? { Authorization: `Bearer ${CXR_API_KEY}` } : {})
    },
    body: JSON.stringify({ image_url: imageUrl })
  });
  if (!res.ok) {
    console.warn(`[cxr] ${res.status}: ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return {
    pneumoniaProb: data.pneumonia_prob,
    consolidationProb: data.consolidation_prob,
    noFindingProb: data.no_finding_prob,
    allFindings: data.all_findings,
    modelVersion: data.model_version ?? "torchxrayvision-densenet121-res224-all"
  };
}

// WHO IMCI doesn't have a CXR-specific threshold (it's a clinical-exam
// framework); these thresholds come from the CheXpert reference paper +
// our Phase 2 BMRC-reviewed calibration on the BRAC pilot CXR set.
export function cxrPneumoniaPositive(finding: CxrFinding): boolean {
  return finding.pneumoniaProb >= 0.6 || finding.consolidationProb >= 0.6;
}
