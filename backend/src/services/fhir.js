/*
  FHIR R4 export, structured the way ABDM (NRCeS "FHIR Implementation Guide for ABDM") expects:
  one *document* Bundle per record, whose first entry is a Composition that carries the
  health-information-type (Prescription / Diagnostic report / Discharge summary / Health document).

  Verified against https://nrces.in/ndhm/fhir/r4/ :
    - profile canonicals  https://nrces.in/ndhm/fhir/r4/StructureDefinition/<Name>
    - Composition.type    PrescriptionRecord 440545006 | DischargeSummaryRecord 373942005 |
                          DiagnosticReport type 721981007 | HealthDocumentRecord 419891008 (SNOMED CT)
    - Patient.identifier  type MR, system https://healthid.ndhm.gov.in, value = ABHA number (XX-XXXX-XXXX-XXXX)
    - resource profiles   DocumentBundle, Patient, Practitioner, Organization, Condition, MedicationRequest,
                          Observation, DiagnosticReportLab, DiagnosticReportImaging (all listed in the IG)

  NOT validated with the official ABDM validator / sandbox - treat it as "ABDM-shaped", and run it
  through the NRCeS validator before connecting a real HIP/HIU gateway.
*/
const crypto = require("crypto");
const { recordDate } = require("./profile");

const NRCES = "https://nrces.in/ndhm/fhir/r4/StructureDefinition/";
const SNOMED = "http://snomed.info/sct";
const LOINC = "http://loinc.org";
const V3_INTERP = "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";

const RECORD_TYPES = {
  prescription: { profile: "PrescriptionRecord", code: "440545006", display: "Prescription record" },
  discharge_summary: { profile: "DischargeSummaryRecord", code: "373942005", display: "Discharge summary" },
  lab_report: { profile: "DiagnosticReportRecord", code: "721981007", display: "Diagnostic studies report" },
  diagnostic_report: { profile: "DiagnosticReportRecord", code: "721981007", display: "Diagnostic studies report" },
  imaging_report: { profile: "DiagnosticReportRecord", code: "721981007", display: "Diagnostic studies report" },
  consultation_note: { profile: "HealthDocumentRecord", code: "419891008", display: "Record artifact" },
  other: { profile: "HealthDocumentRecord", code: "419891008", display: "Record artifact" },
};

const INTERPRETATION = {
  low: { code: "L", display: "Low" },
  high: { code: "H", display: "High" },
  normal: { code: "N", display: "Normal" },
  abnormal: { code: "A", display: "Abnormal" },
};

const uuid = () => `urn:uuid:${crypto.randomUUID()}`;
const ref = (fullUrl) => ({ reference: fullUrl });
const dateOnly = (d) => new Date(d).toISOString().slice(0, 10);

function buildPatient(user) {
  const identifier = [
    {
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MR", display: "Medical record number" }] },
      system: "urn:spirit-health:patient",
      value: String(user._id),
    },
  ];
  if (user.abha?.number) {
    identifier.push({
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MR", display: "Medical record number" }], text: "ABHA number" },
      system: "https://healthid.ndhm.gov.in",
      value: user.abha.number,
    });
  }
  if (user.abha?.address) {
    identifier.push({
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MR", display: "Medical record number" }], text: "ABHA address" },
      value: user.abha.address,
    });
  }
  const patient = {
    resourceType: "Patient",
    meta: { profile: [`${NRCES}Patient`] },
    identifier,
    name: [{ text: user.fullName }],
    gender: ["male", "female", "other"].includes(user.gender) ? user.gender : "unknown",
  };
  if (user.dateOfBirth) patient.birthDate = dateOnly(user.dateOfBirth);
  return patient;
}

function buildObservation(test, patientRef, when) {
  const obs = {
    resourceType: "Observation",
    status: "final",
    category: [
      { coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory", display: "Laboratory" }] },
    ],
    code: {
      ...(test.loinc ? { coding: [{ system: LOINC, code: test.loinc }] } : {}),
      text: test.name,
    },
    subject: ref(patientRef),
    effectiveDateTime: when,
  };

  if (test.numericValue !== null && test.numericValue !== undefined) {
    obs.valueQuantity = { value: test.numericValue, ...(test.unit ? { unit: test.unit } : {}) };
  } else if (test.value) {
    obs.valueString = test.unit ? `${test.value} ${test.unit}` : test.value;
  }

  const interp = INTERPRETATION[test.flag];
  if (interp) obs.interpretation = [{ coding: [{ system: V3_INTERP, ...interp }] }];

  if (test.referenceRange || test.refLow != null || test.refHigh != null) {
    const range = {};
    if (test.refLow != null) range.low = { value: test.refLow, ...(test.unit ? { unit: test.unit } : {}) };
    if (test.refHigh != null) range.high = { value: test.refHigh, ...(test.unit ? { unit: test.unit } : {}) };
    if (test.referenceRange) range.text = test.referenceRange;
    obs.referenceRange = [range];
  }
  return obs;
}

function buildMedicationRequest(med, patientRef, authorRef, when, reasonRefs) {
  const text = [med.dosage, med.frequency, med.duration && `for ${med.duration}`, med.instructions].filter(Boolean).join(", ");
  const dosage = { text: text || med.name };
  if (med.frequency) dosage.timing = { code: { text: med.frequency } };
  if (med.route) dosage.route = { text: med.route };
  return {
    resourceType: "MedicationRequest",
    status: "active",
    intent: "order",
    medicationCodeableConcept: { text: med.genericName ? `${med.name} (${med.genericName})` : med.name },
    subject: ref(patientRef),
    authoredOn: when,
    requester: ref(authorRef),
    ...(reasonRefs.length ? { reasonReference: reasonRefs.map(ref) } : {}),
    dosageInstruction: [dosage],
  };
}

/** One ABDM-style document Bundle for one record. `user` supplies the Patient. */
function recordToDocumentBundle(rec, user) {
  const type = RECORD_TYPES[rec.category] || RECORD_TYPES.other;
  const when = recordDate(rec).toISOString();
  const entries = []; // { fullUrl, resource }
  const add = (resource) => {
    const fullUrl = uuid();
    entries.push({ fullUrl, resource: { ...resource, id: fullUrl.slice(9) } });
    return fullUrl;
  };

  const patientUrl = add(buildPatient(user));
  const orgUrl = rec.provider?.hospital
    ? add({ resourceType: "Organization", meta: { profile: [`${NRCES}Organization`] }, name: rec.provider.hospital })
    : null;
  const practitionerUrl = rec.provider?.doctor
    ? add({ resourceType: "Practitioner", meta: { profile: [`${NRCES}Practitioner`] }, name: [{ text: rec.provider.doctor }] })
    : null;
  /* A document the patient uploaded themselves is authored by the patient if no doctor is printed on it. */
  const authorUrl = practitionerUrl || patientUrl;

  const conditionUrls = (rec.diagnoses || []).map((name) =>
    add({
      resourceType: "Condition",
      meta: { profile: [`${NRCES}Condition`] },
      clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
      code: { text: name },
      subject: ref(patientUrl),
      recordedDate: when,
    })
  );

  const medUrls = (rec.medicines || []).map((m) =>
    add({
      ...buildMedicationRequest(m, patientUrl, authorUrl, when, conditionUrls),
      meta: { profile: [`${NRCES}MedicationRequest`] },
    })
  );

  const obsUrls = (rec.tests || []).map((t) =>
    add({ ...buildObservation(t, patientUrl, when), meta: { profile: [`${NRCES}Observation`] } })
  );

  let reportUrl = null;
  if (obsUrls.length || ["lab_report", "diagnostic_report", "imaging_report"].includes(rec.category)) {
    const isImaging = rec.category === "imaging_report";
    reportUrl = add({
      resourceType: "DiagnosticReport",
      meta: { profile: [`${NRCES}${isImaging ? "DiagnosticReportImaging" : "DiagnosticReportLab"}`] },
      status: "final",
      category: [
        {
          coding: [
            { system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: isImaging ? "RAD" : "LAB", display: isImaging ? "Radiology" : "Laboratory" },
          ],
        },
      ],
      code: { text: rec.title || rec.documentType || "Diagnostic report" },
      subject: ref(patientUrl),
      effectiveDateTime: when,
      issued: when,
      performer: [ref(orgUrl || authorUrl)],
      ...(obsUrls.length ? { result: obsUrls.map(ref) } : {}),
      ...((rec.diagnoses || []).length ? { conclusion: rec.diagnoses.join("; ") } : {}),
    });
  }

  /* Composition sections: the Prescription and DiagnosticReport profiles allow only their own entry types. */
  const sections = [];
  if (type.profile === "PrescriptionRecord") {
    sections.push({ title: "Prescription", code: { coding: [{ system: SNOMED, code: "440545006", display: "Prescription record" }] }, entry: medUrls.map(ref) });
  } else if (type.profile === "DiagnosticReportRecord") {
    sections.push({ title: "Investigations", entry: [ref(reportUrl)] });
  } else {
    if (medUrls.length) sections.push({ title: "Medications", code: { coding: [{ system: SNOMED, code: "1003606003", display: "Medications" }] }, entry: medUrls.map(ref) });
    if (reportUrl) sections.push({ title: "Investigations", code: { coding: [{ system: SNOMED, code: "721981007", display: "Investigations" }] }, entry: [ref(reportUrl)] });
    if (conditionUrls.length) sections.push({ title: "Diagnoses", entry: conditionUrls.map(ref) });
  }
  if (!sections.length) sections.push({ title: type.display, emptyReason: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/list-empty-reason", code: "unavailable" }] } });

  const compositionUrl = uuid();
  const composition = {
    resourceType: "Composition",
    id: compositionUrl.slice(9),
    meta: { profile: [`${NRCES}${type.profile}`] },
    status: "final",
    type: { coding: [{ system: SNOMED, code: type.code, display: type.display }], text: type.display },
    subject: ref(patientUrl),
    date: when,
    author: [ref(authorUrl)],
    title: rec.title || type.display,
    ...(orgUrl ? { custodian: ref(orgUrl) } : {}),
    section: sections,
  };

  const bundleId = crypto.randomUUID();
  return {
    resourceType: "Bundle",
    id: bundleId,
    identifier: { system: "urn:spirit-health:bundle", value: String(rec._id) },
    type: "document",
    timestamp: new Date().toISOString(),
    meta: {
      profile: [`${NRCES}DocumentBundle`],
      /* Makes it obvious downstream that ABHA data in this export came from the prototype's mock link. */
      ...(user.abha?.mock ? { tag: [{ system: "urn:spirit-health:tags", code: "mock-abha" }] } : {}),
    },
    entry: [{ fullUrl: compositionUrl, resource: composition }, ...entries],
  };
}

/** Everything a patient has uploaded, as a collection of ABDM-style document bundles. */
function exportAll(user, records) {
  return {
    resourceType: "Bundle",
    id: crypto.randomUUID(),
    type: "collection",
    timestamp: new Date().toISOString(),
    total: records.length,
    entry: records.map((rec) => ({ fullUrl: uuid(), resource: recordToDocumentBundle(rec, user) })),
  };
}

module.exports = { recordToDocumentBundle, exportAll, RECORD_TYPES };
