/**
 * Submit the stock Bangla guidance scripts as Meta WhatsApp message templates.
 *
 * PRODUCTION PREP — run by Ferdous during go-live (#19), NOT here:
 *   npm run submit:templates
 * Requires a real WhatsApp Business Account and, in .env.local:
 *   META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_WABA_ID, STOCK_BANGLA_JSON
 *
 * The Bangla bodies come from the PRIVATE STOCK_BANGLA_JSON at run time — this
 * script never hardcodes clinical content, and it cannot run without a real WABA
 * (Meta production verification). One template per stock (class:severity) script.
 */

import { templateName, toMetaTemplate } from "../lib/whatsapp-templates";

const TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN;
const WABA_ID = process.env.META_WHATSAPP_WABA_ID;
const GRAPH = `https://graph.facebook.com/${process.env.META_WHATSAPP_GRAPH_VERSION ?? "v21.0"}`;

function loadStockBangla(): Record<string, string> {
  const raw = process.env.STOCK_BANGLA_JSON;
  if (!raw || raw.trim() === "{}") {
    throw new Error("STOCK_BANGLA_JSON not set — load the private clinical-content first");
  }
  return JSON.parse(raw) as Record<string, string>;
}

async function main() {
  if (!TOKEN || !WABA_ID) {
    throw new Error("need META_WHATSAPP_ACCESS_TOKEN + META_WHATSAPP_WABA_ID (real WABA)");
  }

  const stock = loadStockBangla();
  const entries = Object.entries(stock).filter(([, body]) => body && body.trim());
  console.log(`Submitting ${entries.length} templates to WABA ${WABA_ID} …`);

  for (const [stockKey, body] of entries) {
    const tmpl = toMetaTemplate(templateName(stockKey), body);
    const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${TOKEN}`
      },
      body: JSON.stringify(tmpl)
    });
    const out = await res.text();
    console.log(`  ${tmpl.name}: ${res.status} ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
