const test = require("node:test");
const assert = require("node:assert/strict");
const { recordToDocumentBundle, exportAll } = require("../src/services/fhir");
const abha = require("../src/services/abha");

const user = {
  _id: "u1",
  fullName: "Asha Rao",
  gender: "female",
  dateOfBirth: new Date("1984-03-02T00:00:00Z"),
  abha: { number: "91-1234-5678-9012", address: "asha.rao@abdm", mock: true },
};

const labRecord = {
  _id: "r1",
  category: "lab_report",
  title: "CBC",
  documentDate: new Date("2026-09-01T00:00:00Z"),
  provider: { hospital: "Sunrise Diagnostics", doctor: "Dr. A. Rao" },
  tests: [
    { name: "Haemoglobin", loinc: "718-7", value: "9.8", numericValue: 9.8, unit: "g/dL", referenceRange: "13.0 - 17.0", refLow: 13, refHigh: 17, flag: "low" },
    { name: "Urine Protein", value: "Positive", numericValue: null, unit: "", referenceRange: "Negative", flag: "abnormal" },
  ],
  medicines: [],
  diagnoses: [],
};

const rxRecord = {
  _id: "r2",
  category: "prescription",
  title: "Prescription",
  documentDate: new Date("2026-09-05T00:00:00Z"),
  provider: { doctor: "Dr. A. Rao" },
  medicines: [{ name: "Tab. Ferrous Ascorbate", dosage: "100 mg", frequency: "once daily", duration: "30 days", instructions: "after food" }],
  diagnoses: ["Iron deficiency anaemia"],
  tests: [],
};

const byType = (bundle, type) => bundle.entry.filter((e) => e.resource.resourceType === type).map((e) => e.resource);

/** Every internal reference must resolve to an entry in the same document bundle. */
function assertReferencesResolve(bundle) {
  const urls = new Set(bundle.entry.map((e) => e.fullUrl));
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      if (typeof node.reference === "string") assert.ok(urls.has(node.reference), `dangling reference ${node.reference}`);
      Object.values(node).forEach(walk);
    }
  };
  bundle.entry.forEach((e) => walk(e.resource));
}

test("lab report -> ABDM DiagnosticReportRecord document bundle", () => {
  const b = recordToDocumentBundle(labRecord, user);
  assert.equal(b.resourceType, "Bundle");
  assert.equal(b.type, "document");
  const comp = b.entry[0].resource;
  assert.equal(comp.resourceType, "Composition"); // a document bundle must start with the Composition
  assert.equal(comp.type.coding[0].code, "721981007");
  assert.match(comp.meta.profile[0], /StructureDefinition\/DiagnosticReportRecord$/);
  assert.equal(byType(b, "Observation").length, 2);
  assert.equal(byType(b, "DiagnosticReport")[0].result.length, 2);
  assertReferencesResolve(b);
});

test("observations carry LOINC, UCUM-free quantity, interpretation and reference range", () => {
  const [hb, urine] = byType(recordToDocumentBundle(labRecord, user), "Observation");
  assert.equal(hb.code.coding[0].system, "http://loinc.org");
  assert.equal(hb.code.coding[0].code, "718-7");
  assert.deepEqual(hb.valueQuantity, { value: 9.8, unit: "g/dL" });
  assert.equal(hb.interpretation[0].coding[0].code, "L");
  assert.equal(hb.referenceRange[0].low.value, 13);
  assert.equal(hb.referenceRange[0].text, "13.0 - 17.0");
  assert.equal(urine.valueString, "Positive");
  assert.equal(urine.code.coding, undefined); // no LOINC known -> text-only code, never a made-up one
});

test("prescription -> PrescriptionRecord with MedicationRequest and Condition", () => {
  const b = recordToDocumentBundle(rxRecord, user);
  const comp = b.entry[0].resource;
  assert.equal(comp.type.coding[0].code, "440545006");
  assert.match(comp.meta.profile[0], /PrescriptionRecord$/);
  assert.equal(comp.section[0].entry.length, 1);
  const med = byType(b, "MedicationRequest")[0];
  assert.match(med.dosageInstruction[0].text, /100 mg, once daily, for 30 days, after food/);
  assert.equal(med.reasonReference.length, 1);
  assert.equal(byType(b, "Condition")[0].code.text, "Iron deficiency anaemia");
  assertReferencesResolve(b);
});

test("patient carries the ABHA number in the ABDM identifier convention", () => {
  const patient = byType(recordToDocumentBundle(labRecord, user), "Patient")[0];
  const abhaId = patient.identifier.find((i) => i.system === "https://healthid.ndhm.gov.in");
  assert.equal(abhaId.value, "91-1234-5678-9012");
  assert.equal(abhaId.type.coding[0].code, "MR");
  assert.equal(patient.birthDate, "1984-03-02");
  assert.equal(patient.gender, "female");
});

test("a mock ABHA link is tagged in the export, and no ABHA means no ABHA identifier", () => {
  assert.equal(recordToDocumentBundle(labRecord, user).meta.tag[0].code, "mock-abha");
  const plain = recordToDocumentBundle(labRecord, { _id: "u2", fullName: "No Abha" });
  const patient = byType(plain, "Patient")[0];
  assert.equal(patient.identifier.length, 1);
  assert.equal(patient.gender, "unknown");
  assert.equal(plain.meta.tag, undefined);
});

test("unknown document types fall back to HealthDocumentRecord and still have a section", () => {
  const b = recordToDocumentBundle({ _id: "r3", category: "other", documentDate: new Date(), tests: [], medicines: [], diagnoses: [] }, user);
  const comp = b.entry[0].resource;
  assert.match(comp.meta.profile[0], /HealthDocumentRecord$/);
  assert.ok(comp.section.length >= 1);
});

test("exportAll wraps every record's document bundle", () => {
  const all = exportAll(user, [labRecord, rxRecord]);
  assert.equal(all.type, "collection");
  assert.equal(all.total, 2);
  assert.equal(all.entry[1].resource.resourceType, "Bundle");
});

/* ---------- mock ABHA ---------- */

test("ABHA number / address normalisation", () => {
  assert.equal(abha.normalizeAbhaNumber("91 1234 5678 9012"), "91-1234-5678-9012");
  assert.equal(abha.normalizeAbhaNumber("91123456789012"), "91-1234-5678-9012");
  assert.equal(abha.normalizeAbhaNumber("1234"), null);
  assert.equal(abha.normalizeAbhaAddress("Asha.Rao@abdm"), "asha.rao@abdm");
  assert.equal(abha.normalizeAbhaAddress("asha@gmail.com"), null);
});

test("ABHA link: wrong OTP is rejected, the right OTP links, a transaction is single-use and user-bound", () => {
  const started = abha.initiate("u1", { abhaNumber: "91-1234-5678-9012" });
  assert.ok(started.txnId);

  assert.match(abha.verify("u1", { txnId: started.txnId, otp: "000000" }).error, /Incorrect OTP/);
  assert.ok(abha.verify("someone-else", { txnId: started.txnId, otp: "123456" }).error); // bound to the user who started it

  const again = abha.initiate("u1", { abhaAddress: "asha.rao@abdm" });
  const ok = abha.verify("u1", { txnId: again.txnId, otp: "123456" });
  assert.equal(ok.abha.address, "asha.rao@abdm");
  assert.equal(ok.abha.mock, true);
  assert.ok(abha.verify("u1", { txnId: again.txnId, otp: "123456" }).error); // single use
});

test("ABHA initiate validates input", () => {
  assert.ok(abha.initiate("u1", {}).error);
  assert.ok(abha.initiate("u1", { abhaNumber: "123" }).error);
  assert.ok(abha.initiate("u1", { abhaAddress: "bad address" }).error);
});
