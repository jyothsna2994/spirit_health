const mongoose = require("mongoose");
const { LANGUAGE_CODES } = require("../languages");

const CATEGORIES = [
  "prescription",
  "lab_report",
  "discharge_summary",
  "diagnostic_report",
  "imaging_report",
  "consultation_note",
  "other",
];

/* One summary string per supported language: summaries.en, summaries.hi ... */
const summaries = Object.fromEntries(LANGUAGE_CODES.map((code) => [code, String]));

/*
  Internal model. Every field maps onto a FHIR R4 resource in services/fhir.js:
    medicines -> MedicationRequest      tests -> Observation (+ DiagnosticReport)
    diagnoses -> Condition              documentType/documentDate -> Composition
  Fields from the first prototype (healthSummary, teluguSummary, hindiSummary, timelineEvent,
  abnormalFindings, extractedText, mode) are kept so existing records and screens keep working.
*/
const healthRecordSchema = new mongoose.Schema({
  userId: { type: String, index: true },

  documentType: String, // display label, e.g. "Lab Report"
  category: { type: String, enum: CATEGORIES, default: "other", index: true },
  title: String,
  documentDate: { type: Date, index: true }, // date ON the document (falls back to upload date)
  dateFromDocument: { type: Boolean, default: true }, // false when no date was readable and upload time was used
  patientName: String,
  patientAge: String,
  patientGender: String,
  provider: { hospital: String, doctor: String },

  medicines: [
    {
      name: String,
      genericName: String,
      dosage: String,
      frequency: String,
      duration: String,
      route: String,
      instructions: String,
    },
  ],
  tests: [
    {
      name: String,
      canonicalName: String, // stable key for trends: "hemoglobin"
      loinc: String,
      value: String,
      numericValue: Number,
      unit: String,
      referenceRange: String,
      refLow: Number,
      refHigh: Number,
      status: String, // display label derived from flag ("High"/"Low"/"Normal")
      flag: { type: String, enum: ["low", "high", "normal", "abnormal", "unknown"], default: "unknown" },
      flagSource: String,
    },
  ],
  diagnoses: [String],
  advice: [String],
  followUp: String,
  abnormalFindings: [{ finding: String, explanation: String }],

  summaries,
  healthSummary: String, // legacy mirror of summaries.en
  teluguSummary: String, // legacy mirror of summaries.te
  hindiSummary: String, // legacy mirror of summaries.hi
  timelineEvent: { date: String, event: String },

  extractedText: String,
  extractionNotes: String,
  languagesDetected: [String],
  handwritten: Boolean,
  mode: String, // "gemini" | "mock"
  aiModel: String,
  summaryStatus: { type: String, enum: ["ready", "pending"], default: "ready" },

  fileName: String,
  mimeType: String,
  contentHash: { type: String, index: true }, // sha256 of the uploaded file: stops duplicate timeline entries

  createdAt: { type: Date, default: Date.now },
});

healthRecordSchema.index({ userId: 1, documentDate: -1 });

module.exports = {
  HealthRecord: mongoose.models.HealthRecord || mongoose.model("HealthRecord", healthRecordSchema),
  CATEGORIES,
};
