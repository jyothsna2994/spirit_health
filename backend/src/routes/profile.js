const express = require("express");
const { requireAuth, publicUser } = require("../middleware/auth");
const { HealthRecord } = require("../models/HealthRecord");
const { buildTimeline, buildProfile, buildTrend, profileFacts } = require("../services/profile");
const { overviewProfile } = require("../services/summarize");
const { exportAll } = require("../services/fhir");
const abha = require("../services/abha");
const { LANGUAGE_CODES } = require("../languages");

const router = express.Router();
router.use(requireAuth);

const loadRecords = (user) => HealthRecord.find({ userId: String(user._id) }).select("-extractedText").lean();

/* ---------- account ---------- */

router.get("/me", (req, res) => res.json({ success: true, user: publicUser(req.user) }));

router.patch("/me", async (req, res) => {
  const { preferredLanguage, gender, dateOfBirth, fullName } = req.body || {};
  const user = req.user;

  if (preferredLanguage !== undefined) {
    if (!LANGUAGE_CODES.includes(preferredLanguage)) {
      return res.status(400).json({ success: false, message: "Unsupported language." });
    }
    user.preferredLanguage = preferredLanguage;
  }
  if (gender !== undefined) {
    if (!["male", "female", "other", ""].includes(gender)) {
      return res.status(400).json({ success: false, message: "Gender must be male, female or other." });
    }
    user.gender = gender;
  }
  if (dateOfBirth !== undefined) {
    if (dateOfBirth === "" || dateOfBirth === null) user.dateOfBirth = undefined;
    else {
      const d = new Date(`${dateOfBirth}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || isNaN(d) || d > new Date() || d.getUTCFullYear() < 1900) {
        return res.status(400).json({ success: false, message: "Date of birth must be a valid past date (YYYY-MM-DD)." });
      }
      user.dateOfBirth = d;
    }
  }
  if (fullName !== undefined) {
    if (!String(fullName).trim()) return res.status(400).json({ success: false, message: "Name cannot be empty." });
    user.fullName = String(fullName).trim();
  }
  await user.save();
  res.json({ success: true, user: publicUser(user) });
});

/* ---------- unified health profile ---------- */

router.get("/timeline", async (req, res) => {
  const records = await loadRecords(req.user);
  const events = buildTimeline(records);
  res.json({ success: true, count: events.length, events });
});

router.get("/profile", async (req, res) => {
  const records = await loadRecords(req.user);
  res.json({ success: true, profile: buildProfile(req.user, records) });
});

router.get("/trends/:key", async (req, res) => {
  const records = await loadRecords(req.user);
  res.json({ success: true, trend: buildTrend(records, req.params.key) });
});

router.post("/profile/overview", async (req, res) => {
  const lang = String(req.body?.lang || req.user.preferredLanguage || "en");
  if (!LANGUAGE_CODES.includes(lang)) return res.status(400).json({ success: false, message: "Unsupported language." });

  const records = await loadRecords(req.user);
  if (!records.length) {
    return res.status(400).json({ success: false, message: "Add at least one medical record to get an overview." });
  }
  try {
    const overview = await overviewProfile(profileFacts(buildProfile(req.user, records)), lang);
    res.json({ success: true, lang, overview });
  } catch (error) {
    console.error("Overview failed:", String(error.message).slice(0, 200));
    res.status(503).json({ success: false, message: "Could not generate the overview right now. Please try again." });
  }
});

/* ---------- ABDM readiness ---------- */

router.get("/fhir/bundle", async (req, res) => {
  const records = await loadRecords(req.user);
  res.json(exportAll(req.user, records));
});

router.post("/abha/link/initiate", (req, res) => {
  const result = abha.initiate(req.user._id, req.body || {});
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json({ success: true, ...result });
});

router.post("/abha/link/verify", async (req, res) => {
  const result = abha.verify(req.user._id, req.body || {});
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  req.user.abha = result.abha;
  await req.user.save();
  res.json({ success: true, message: "ABHA linked (demo).", user: publicUser(req.user) });
});

router.delete("/abha", async (req, res) => {
  req.user.abha = undefined;
  await req.user.save();
  res.json({ success: true, user: publicUser(req.user) });
});

module.exports = router;
