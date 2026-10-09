/*
  Run the real AI pipeline on one file, with no database and no server:
    node scripts/smoke-extract.js path/to/report.(jpg|png|pdf)
  Prints the structured extraction (with computed lab flags) and the plain-language summaries.
  Uses your GEMINI_API_KEY (2 Gemini calls).
*/
const fs = require("fs");
const path = require("path");
const config = require("../src/config");
const { extractDocument } = require("../src/services/extraction");
const { summarizeRecord } = require("../src/services/summarize");

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".pdf": "application/pdf" };

(async () => {
  const file = process.argv[2];
  if (!file) return console.error("Usage: node scripts/smoke-extract.js <file>");

  const mimetype = MIME[path.extname(file).toLowerCase()];
  if (!mimetype) return console.error("Use a .jpg, .png or .pdf file");
  console.log(`Models: ${config.geminiModels.slice(0, 3).join(", ")} ...  (mock: ${config.mockAi})`);

  const t0 = Date.now();
  const { extraction, model } = await extractDocument({ buffer: fs.readFileSync(file), mimetype });
  console.log(`\n=== EXTRACTION (${model}, ${((Date.now() - t0) / 1000).toFixed(1)}s) ===`);
  console.log(JSON.stringify(extraction, null, 2));

  const t1 = Date.now();
  const summary = await summarizeRecord(extraction);
  console.log(`\n=== SUMMARIES (${summary.model}, ${((Date.now() - t1) / 1000).toFixed(1)}s) ===`);
  for (const [lang, text] of Object.entries(summary.summaries)) console.log(`\n[${lang}] ${text}`);
  console.log("\nabnormalExplanations:", JSON.stringify(summary.abnormalExplanations, null, 2));
})().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
