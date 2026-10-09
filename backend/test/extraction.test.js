const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeExtraction, explainFrequency } = require("../src/services/extraction");
const { buildTimeline } = require("../src/services/profile");

test("explainFrequency spells out Indian prescription shorthand and leaves plain English alone", () => {
  assert.equal(explainFrequency("1-0-1"), "1-0-1 (morning and night)");
  assert.equal(explainFrequency("1-1-1"), "1-1-1 (morning, afternoon and night)");
  assert.equal(explainFrequency("0-0-1"), "0-0-1 (night)");
  assert.equal(explainFrequency("1-0-0"), "1-0-0 (morning)");
  assert.equal(explainFrequency("1-1-1-1"), "1-1-1-1 (morning, afternoon, evening and night)");
  assert.equal(explainFrequency("½-0-½"), "½-0-½ (morning and night)");
  assert.equal(explainFrequency("OD"), "OD (once daily)");
  assert.equal(explainFrequency("BD"), "BD (twice daily)");
  assert.equal(explainFrequency("T.D.S."), "T.D.S. (three times daily)");
  assert.equal(explainFrequency("SOS"), "SOS (only if needed)");
  assert.equal(explainFrequency("twice daily"), "twice daily");
  assert.equal(explainFrequency("once daily at bedtime"), "once daily at bedtime");
  assert.equal(explainFrequency("0-0-0"), "0-0-0");
  assert.equal(explainFrequency(""), "");
});

test("normalizeExtraction cleans the model output and computes flags in code", () => {
  const n = normalizeExtraction({
    category: "lab_report",
    documentDate: "2026-09-12",
    patient: { name: " Asha ", gender: "Female", age: "42" },
    medicines: [{ name: "Tab. X", frequency: "1-0-1" }, { name: "  " }, null],
    tests: [
      { name: "Haemoglobin", value: "9.8", unit: "g/dL", referenceRange: "12.0 - 15.0", status: "Normal" },
      { name: "", value: "1" },
    ],
    diagnoses: ["Anaemia", "", "  "],
    languagesDetected: ["EN", "Hi"],
  });
  assert.equal(n.category, "lab_report");
  assert.equal(n.documentType, "Lab Report");
  assert.equal(n.documentDate.toISOString().slice(0, 10), "2026-09-12");
  assert.equal(n.patientName, "Asha");
  assert.equal(n.patientGender, "female");
  assert.equal(n.medicines.length, 1);
  assert.equal(n.medicines[0].frequency, "1-0-1 (morning and night)");
  assert.equal(n.tests.length, 1);
  assert.equal(n.tests[0].flag, "low"); // the report said "Normal"; 9.8 < 12.0 wins
  assert.equal(n.tests[0].status, "Low");
  assert.deepEqual(n.diagnoses, ["Anaemia"]);
  assert.deepEqual(n.languagesDetected, ["en", "hi"]);
});

test("normalizeExtraction rejects impossible, future and malformed dates and unknown categories", () => {
  assert.equal(normalizeExtraction({ documentDate: "2999-01-01" }).documentDate, null);
  assert.equal(normalizeExtraction({ documentDate: "2026-02-31" }).documentDate, null);
  assert.equal(normalizeExtraction({ documentDate: "12/09/2026" }).documentDate, null);
  assert.equal(normalizeExtraction({ documentDate: "1899-01-01" }).documentDate, null);
  assert.equal(normalizeExtraction({ documentDate: "" }).documentDate, null);
  assert.equal(normalizeExtraction({ category: "banana" }).category, "other");
  assert.deepEqual(normalizeExtraction({}).tests, []);
});

test("sex-specific reference ranges use the patient's sex from the document, else the account's", () => {
  const raw = { tests: [{ name: "Hb", value: "13.5", unit: "g/dL", referenceRange: "Male: 13.0-17.0 Female: 12.0-15.0" }] };
  assert.equal(normalizeExtraction({ ...raw, patient: { gender: "female" } }).tests[0].flag, "normal");
  assert.equal(normalizeExtraction(raw, { userGender: "male" }).tests[0].flag, "normal");
  assert.equal(normalizeExtraction(raw).tests[0].flagSource, "none"); // sex unknown -> ambiguous -> no computed flag
});

test("timeline highlights come from the extracted data; summary previews do not break at abbreviations", () => {
  const [e] = buildTimeline([
    {
      _id: "a",
      documentDate: new Date("2026-09-14"),
      diagnoses: ["Iron deficiency anaemia", "Impaired fasting glucose"],
      medicines: [{ name: "Tab. Ferrous Ascorbate" }, { name: "Tab. Metformin" }, { name: "Cap. B12" }, { name: "Syp. Cough" }],
      summaries: {
        en: "You have been prescribed four medicines by Dr. A. Rao for the next weeks. Tab. Ferrous Ascorbate is taken after food twice a day and Tab. Metformin is taken with meals every day.",
      },
    },
  ]);
  assert.deepEqual(e.highlights, ["Iron deficiency anaemia · Impaired fasting glucose", "Ferrous Ascorbate, Metformin, B12 +1"]);
  assert.ok(!/(Tab|Dr)\.$/.test(e.summary), `summary ends at an abbreviation: ${e.summary}`);
});
