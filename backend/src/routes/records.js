const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");

const config = require("../config");
const { requireAuth } = require("../middleware/auth");
const { HealthRecord } = require("../models/HealthRecord");
const FamilyMember = require("../models/FamilyMember");
const { extractDocument } = require("../services/extraction");
const { summarizeRecord, buildAbnormalFindings } = require("../services/summarize");
const { serializeRecord } = require("../services/profile");
const { recordToDocumentBundle } = require("../services/fhir");
const { ocrImage } = require("../services/ocrFallback");
const { LANGUAGE_CODES, CORE_LANGUAGES } = require("../languages");
const router = express.Router();
router.use(requireAuth);
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter: (req, file, cb) =>
    ALLOWED_TYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only JPG, PNG and PDF files are allowed")),
});
const MIRROR = { en: "healthSummary", hi: "hindiSummary", te: "teluguSummary" };
/** Keep the first-prototype summary fields in step with `summaries`, so older screens keep working. */
function applySummaries(record, summaries) {
  for (const [lang, text] of Object.entries(summaries)) {
    record.summaries[lang] = text;
    if (MIRROR[lang]) record[MIRROR[lang]] = text;
  }
}

/* Same envelope the first prototype returned (`data`), plus the full record. */
function uploadResponse(record, extra = {}) {
  const r = serializeRecord(record);
  return {
    success: true,
    mode: record.mode,
    recordId: r.id,
    record: r,
    data: {
      documentType: r.documentType,
      patientName: r.patientName,
      medicines: r.medicines,
      tests: r.tests,
      diagnoses: r.diagnoses,
      abnormalFindings: r.abnormalFindings,
      healthSummary: r.summaries.en || "",
      teluguSummary: r.summaries.te || "",
      hindiSummary: r.summaries.hi || "",
      tamilSummary: r.summaries.ta || "",
      timelineEvent: r.timelineEvent,
    },
    ...extra,
  };
}

async function aiFailure(res, error, file) {
  const message = error.message || "";
  console.error("AI processing failed:", message.slice(0, 300));

  if (/unsupported image format|Input buffer|corrupt/i.test(message)) {
    return res.status(400).json({ success: false, message: "This file could not be read. Please upload a clear JPG, PNG or PDF." });
  }
  const quota = /429|RESOURCE_EXHAUSTED|quota/i.test(message);

  /* Best effort: at least give the user the English text of a photo. */
  let extractedText = "";
  if (file.mimetype.startsWith("image/")) {
    try {
      extractedText = await ocrImage(file.buffer);
    } catch (e) {
      console.error("Fallback OCR failed:", e.message);
    }
  }
  res.status(503).json({
    success: false,
    mode: "ocr-only",
    message: quota
      ? "Gemini AI quota is currently exhausted. Please try again in a little while."
      : "Gemini AI analysis failed. Please try again.",
    ...(config.isProduction ? {} : { error: message }),
    extractedText,
  });
}
router.post(
  "/upload",
  upload.array("document", MAX_FILES),
  async (req, res) => {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "No medical document uploaded.",
      });
    }
    // Multiple files must be images. Keep single-PDF uploads working.
    if (
      files.length > 1 &&
      files.some((file) => !file.mimetype.startsWith("image/"))
    ) {
      return res.status(400).json({
        success: false,
        message:
          "For a multi-page upload, please select JPG or PNG images only. PDFs can still be uploaded individually.",
      });
    }
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 25 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: "The combined upload must be 25 MB or less.",
      });
    }
    const userId = String(req.user._id);
    // Validate the selected family member before processing.
const familyMemberId = String(req.body?.familyMemberId || "").trim();
if (familyMemberId) {
  if (!mongoose.isValidObjectId(familyMemberId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid family member ID.",
    });
  }
  const familyMember = await FamilyMember.findOne({
    _id: familyMemberId,
    userId: req.user._id,
  });
  if (!familyMember) {
    return res.status(404).json({
      success: false,
      message: "Family member not found.",
    });
  }
}
    // Hash all files in order to identify this report as one record.
    const hasher = crypto.createHash("sha256");
    for (const file of files) {
      hasher.update(String(file.buffer.length));
      hasher.update(":");
      hasher.update(file.buffer);
    }
    const contentHash = hasher.digest("hex");
   const existing = await HealthRecord.findOne({
  userId,
  familyMemberId: familyMemberId || null,
  contentHash,
});
    if (existing) {
      return res.json(
        uploadResponse(existing, {
          duplicate: true,
          message: "This report is already in your health timeline.",
        })
      );
    }
    let extraction;
    let model;
    try {
      ({ extraction, model } = await extractDocument(
        files.length === 1 ? files[0] : files,
        { userGender: req.user.gender }
      ));
    } catch (error) {
      return aiFailure(res, error, files[0]);
    }
    
const hasContent = Boolean(
  extraction.medicines?.length ||
  extraction.tests?.length ||
  extraction.diagnoses?.length ||
  extraction.advice?.length ||
  extraction.followUp
);

if (!hasContent) {
  return res.status(422).json({
    success: false,
    message:
      "⚠️ Invalid Health Report. The uploaded file does not appear to contain medical information. Please upload a valid prescription, lab report, discharge summary, or other health record.",
    extractionNotes: extraction.extractionNotes,
  });
}

    let summary = null;
    try {
      summary = await summarizeRecord(extraction, CORE_LANGUAGES);
    } catch (error) {
      console.error(
        "Summary generation failed:",
        String(error.message).slice(0, 200)
      );
    }
    const dateFromDocument = Boolean(extraction.documentDate);
    const documentDate = extraction.documentDate || new Date();
    // Preserve existing timeline behavior.
    const timelineDate = new Date(documentDate);
    timelineDate.setDate(timelineDate.getDate() + 10);
    const isMultiPage = files.length > 1;
    const folderName = isMultiPage
      ? `Medical Report - ${documentDate.toISOString().slice(0, 10)}`
      : "";
    const pages = files.map((file, index) => ({
      pageNumber: index + 1,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      storageKey: "",
    }));
    const record = new HealthRecord({
      userId,
      ...extraction,
      familyMemberId: familyMemberId || null,
      documentDate,
      dateFromDocument,
      abnormalFindings: buildAbnormalFindings(
        extraction.tests,
        summary?.abnormalExplanations
      ),
      timelineEvent: {
        date: timelineDate.toISOString().slice(0, 10),
        event: extraction.title,
      },
      mode: config.mockAi ? "mock" : "gemini",
      aiModel: model,
      summaryStatus: summary ? "ready" : "pending",
      // Existing fields remain supported.
      fileName: files[0].originalname,
      mimeType: files[0].mimetype,
      // New multi-page folder metadata.
      isMultiPage,
      folderName,
      pageCount: files.length,
      pages,
      contentHash,
    });
    if (summary) {
      applySummaries(record, summary.summaries);
    }
    await record.save();
    return res.json(
      uploadResponse(record, {
        message: summary
          ? isMultiPage
            ? `${files.length} medical report pages processed as one record.`
            : "Medical document processed successfully."
          : "Document read successfully, but the plain-language summary is not ready yet. Open the record to generate it.",
      })
    );
  }
);

function validId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ success: false, message: "Medical record not found" });
  }
  next();
}

router.get("/records", async (req, res) => {
  const filter = { userId: String(req.user._id) };
  if (req.query.familyMemberId) {
  const familyMemberId = String(req.query.familyMemberId);

  if (!mongoose.isValidObjectId(familyMemberId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid family member ID.",
    });
  }

  const member = await FamilyMember.findOne({
    _id: familyMemberId,
    userId: req.user._id,
  });

  if (!member) {
    return res.status(404).json({
      success: false,
      message: "Family member not found.",
    });
  }

  filter.familyMemberId = member._id;
} else {
  filter.familyMemberId = null;
}
  if (req.query.category) filter.category = String(req.query.category);
  const records = await HealthRecord.find(filter).select("-extractedText -contentHash").sort({ createdAt: -1 });
  res.json({ success: true, count: records.length, records: records.map(serializeRecord) });
});

async function findOwned(req, res) {
  const record = await HealthRecord.findOne({ _id: req.params.id, userId: String(req.user._id) });
  if (!record) res.status(404).json({ success: false, message: "Medical record not found" });
  return record;
}

router.get("/records/:id", validId, async (req, res) => {
  const record = await findOwned(req, res);
  if (record) res.json({ success: true, record: serializeRecord(record) });
});

router.delete("/records/:id", validId, async (req, res) => {
  const result = await HealthRecord.deleteOne({ _id: req.params.id, userId: String(req.user._id) });
  if (!result.deletedCount) return res.status(404).json({ success: false, message: "Medical record not found" });
  res.json({ success: true, message: "Record deleted." });
});

/* Summary in any supported language. Cached on the record, so each language costs one Gemini call, once. */
router.post("/records/:id/summary", validId, async (req, res) => {
  const lang = String(req.body?.lang || "en");
  if (!LANGUAGE_CODES.includes(lang)) {
    return res.status(400).json({ success: false, message: `Unsupported language. Use one of: ${LANGUAGE_CODES.join(", ")}` });
  }
  const record = await findOwned(req, res);
  if (!record) return;

  const cached = record.summaries?.[lang] || (lang === "en" && record.healthSummary) || "";
  if (cached && !req.body?.refresh) return res.json({ success: true, lang, summary: cached, cached: true });

  /* A record whose upload-time summary failed gets all core languages in one go. */
  const langs = record.summaryStatus === "pending" ? [...new Set([...CORE_LANGUAGES, lang])] : [lang];
  try {
    const result = await summarizeRecord(record.toObject(), langs);
    applySummaries(record, result.summaries);
    if (record.summaryStatus === "pending") {
      record.summaryStatus = "ready";
      record.abnormalFindings = buildAbnormalFindings(record.tests, result.abnormalExplanations);
    }
    await record.save();
    res.json({ success: true, lang, summary: result.summaries[lang], cached: false });
  } catch (error) {
    console.error("Summary failed:", String(error.message).slice(0, 200));
    const quota = /429|RESOURCE_EXHAUSTED|quota/i.test(error.message || "");
    res.status(503).json({
      success: false,
      message: quota ? "Gemini AI quota is currently exhausted. Please try again in a little while." : "Could not generate the summary. Please try again.",
    });
  }
});

router.get("/records/:id/fhir", validId, async (req, res) => {
  const record = await findOwned(req, res);
  if (record) res.json(recordToDocumentBundle(record.toObject(), req.user));
});

module.exports = router;
