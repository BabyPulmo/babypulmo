// Meta WhatsApp message-template helpers for the 7 stock Bangla guidance scripts.
//
// Content-agnostic on purpose: the actual Bangla bodies live in the private
// STOCK_BANGLA_JSON (clinical-content) and are supplied at submission time by
// scripts/submit-templates.ts — never hardcoded here. This module only shapes
// names + payloads for Meta's /{WABA_ID}/message_templates API.

export interface MetaTemplate {
  name: string;
  language: string; // BCP-47 / Meta code; Bangla = "bn"
  category: "UTILITY";
  components: Array<{ type: "BODY"; text: string }>;
}

// Stable, Meta-valid template name from a stock-script key like "pneumonia:high".
// Meta names allow only lowercase letters, digits, and underscores.
export function templateName(stockKey: string): string {
  return `bp_guidance_${stockKey}`.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

export function toMetaTemplate(name: string, body: string): MetaTemplate {
  return {
    name,
    language: "bn",
    category: "UTILITY",
    components: [{ type: "BODY", text: body }]
  };
}
