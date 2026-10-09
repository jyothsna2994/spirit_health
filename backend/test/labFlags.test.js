const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeTest, parseRange, parseNumber, identifyTest, statusToFlag } = require("../src/services/labFlags");

test("parseNumber handles plain, comma and qualified values", () => {
  assert.deepEqual(parseNumber("13.2"), { num: 13.2, qualifier: "" });
  assert.deepEqual(parseNumber("1,200"), { num: 1200, qualifier: "" });
  assert.deepEqual(parseNumber("<0.5"), { num: 0.5, qualifier: "<" });
  assert.equal(parseNumber("Positive"), null);
  assert.equal(parseNumber("1:80"), null);
  assert.equal(parseNumber(""), null);
});

test("parseRange handles the common printed formats", () => {
  assert.deepEqual(parseRange("13.0 - 17.0"), { low: 13, high: 17 });
  assert.deepEqual(parseRange("0.4–4.0"), { low: 0.4, high: 4 });
  assert.deepEqual(parseRange("4 to 11"), { low: 4, high: 11 });
  assert.deepEqual(parseRange("< 200"), { low: null, high: 200 });
  assert.deepEqual(parseRange("Up to 100"), { low: null, high: 100 });
  assert.deepEqual(parseRange("> 40"), { low: 40, high: null });
  assert.equal(parseRange(""), null);
  assert.equal(parseRange("Negative"), null);
});

test("sex-specific ranges need a known sex, otherwise they are ambiguous", () => {
  const text = "Male: 13.0-17.0 Female: 12.0-15.0";
  assert.deepEqual(parseRange(text, { gender: "male" }), { low: 13, high: 17 });
  assert.deepEqual(parseRange(text, { gender: "female" }), { low: 12, high: 15 });
  assert.equal(parseRange(text), null);
});

test("multi-level lipid ranges use the desirable band", () => {
  const text = "Desirable: <200 Borderline: 200-239 High: >=240";
  assert.deepEqual(parseRange(text), { low: null, high: 200 });
});

test("analyzeTest computes the flag from the numbers, not from the printed text", () => {
  const low = analyzeTest({ name: "Haemoglobin", value: "9.8", referenceRange: "13.0 - 17.0", status: "Normal" });
  assert.equal(low.flag, "low");
  assert.equal(low.flagSource, "computed");
  assert.equal(low.canonicalName, "hemoglobin");
  assert.equal(low.loinc, "718-7");

  const high = analyzeTest({ name: "Total Cholesterol", value: "245", referenceRange: "< 200" });
  assert.equal(high.flag, "high");

  const ok = analyzeTest({ name: "TSH", value: "2.1", referenceRange: "0.4 - 4.0" });
  assert.equal(ok.flag, "normal");

  const edge = analyzeTest({ name: "Hb", value: "13.0", referenceRange: "13.0 - 17.0" });
  assert.equal(edge.flag, "normal"); // boundaries are inclusive
});

test("analyzeTest falls back to the lab's printed flag when it cannot compute", () => {
  const t = analyzeTest({ name: "Urine Protein", value: "Positive (++)", referenceRange: "Negative", status: "" });
  assert.equal(t.flag, "unknown");

  const r = analyzeTest({ name: "HIV Antibody", value: "Non Reactive", referenceRange: "", status: "Non Reactive" });
  assert.equal(r.flag, "normal");
  assert.equal(r.flagSource, "reported");

  const q = analyzeTest({ name: "CRP", value: "<0.5", referenceRange: "< 6", status: "H" });
  assert.equal(q.flag, "high"); // qualified values are not compared numerically
});

test("statusToFlag", () => {
  assert.equal(statusToFlag("H"), "high");
  assert.equal(statusToFlag("LOW"), "low");
  assert.equal(statusToFlag("Within normal limits"), "normal");
  assert.equal(statusToFlag("Abnormal"), "abnormal");
  assert.equal(statusToFlag("Not detected"), "normal");
  assert.equal(statusToFlag("Borderline High"), "high");
  assert.equal(statusToFlag(""), null);
});

test("identifyTest groups aliases and keeps unknown tests stable", () => {
  assert.equal(identifyTest("Haemoglobin (Hb)").key, "hemoglobin");
  assert.equal(identifyTest("HbA1c (Glycosylated Hemoglobin)").key, "hba1c");
  assert.equal(identifyTest("LDL Cholesterol").key, "ldl");
  assert.equal(identifyTest("VLDL").key, "vldl");
  assert.equal(identifyTest("MCHC").key, "mchc");
  assert.equal(identifyTest("Fasting Blood Sugar").key, "glucose_fasting");
  assert.equal(identifyTest("Serum Ferritin").key, "ferritin");
  for (const wbc of ["Total Leucocyte Count", "Total Leukocyte Count (TLC)", "WBC", "Leucocytes", "White Blood Cell Count"]) {
    assert.equal(identifyTest(wbc).key, "wbc", wbc); // found by a real Gemini run: "leucocyte" was missed
  }
  assert.equal(identifyTest("Some Rare Test (XYZ)").key, "some_rare_test");
});
