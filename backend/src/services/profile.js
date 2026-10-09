/*
  Pure functions that turn a user's individual records into the unified health profile,
  timeline and lab trends. No database access here, so they are easy to unit test.
*/
const { isAbnormalFlag } = require("./labFlags");

const DAY = 24 * 3600 * 1000;
const MED_PREFIX = /^(tab|tablet|cap|capsule|syp|syrup|inj|injection)\.?\s+/i;

/** Date ON the document; legacy records fall back to a strict ISO timelineEvent.date, then upload time. */
function recordDate(rec) {
  if (rec.documentDate) return new Date(rec.documentDate);
  const legacy = rec.timelineEvent?.date;
  if (legacy && /^\d{4}-\d{2}-\d{2}/.test(legacy)) {
    const d = new Date(legacy);
    if (!isNaN(d)) return d;
  }
  return new Date(rec.createdAt || Date.now());
}

const iso = (d) => (d ? new Date(d).toISOString() : null);

/** API shape of a record: plain object, legacy summary fields folded into `summaries`. */
function serializeRecord(doc) {
  const r = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  const summaries = { ...(r.summaries || {}) };
  if (!summaries.en && r.healthSummary) summaries.en = r.healthSummary;
  if (!summaries.hi && r.hindiSummary) summaries.hi = r.hindiSummary;
  if (!summaries.te && r.teluguSummary) summaries.te = r.teluguSummary;

  const { __v, contentHash, ...rest } = r;
  return {
    ...rest,
    id: String(r._id),
    documentDate: iso(recordDate(r)),
    summaries,
    category: r.category || "other",
  };
}

/* Sentence ends that are not abbreviations ("Dr.", "Tab.", "Cap.") - used to cut a summary preview cleanly. */
const SENTENCE_END = /(?<!\b(?:Dr|Mr|Mrs|Ms|Tab|Cap|Syp|Inj|No|St|vs))[.!?।](?=\s)/g;

function firstSentences(text, max = 170) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  let lastStop = -1;
  for (const m of cut.matchAll(SENTENCE_END)) lastStop = m.index;
  return lastStop > 60 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, "") + "…";
}

/* What the timeline card shows under the title - taken from the extracted data, so it is always informative. */
function buildHighlights(rec) {
  const lines = [];
  const diagnoses = rec.diagnoses || [];
  if (diagnoses.length) lines.push(diagnoses.slice(0, 3).join(" · "));
  const meds = (rec.medicines || []).map((m) => String(m.name).replace(MED_PREFIX, ""));
  if (meds.length) lines.push(meds.slice(0, 3).join(", ") + (meds.length > 3 ? ` +${meds.length - 3}` : ""));
  return lines;
}

function buildTimeline(records) {
  return records
    .map((rec) => {
      const tests = rec.tests || [];
      const abnormal = tests.filter((t) => isAbnormalFlag(t.flag));
      const summary = rec.summaries?.en || rec.healthSummary || "";
      return {
        id: String(rec._id),
        date: iso(recordDate(rec)),
        dateFromDocument: rec.dateFromDocument !== false,
        category: rec.category || "other",
        documentType: rec.documentType || "Medical Document",
        title: rec.title || rec.documentType || "Medical Document",
        doctor: rec.provider?.doctor || "",
        hospital: rec.provider?.hospital || "",
        summary: firstSentences(summary),
        highlights: buildHighlights(rec),
        counts: {
          medicines: (rec.medicines || []).length,
          tests: tests.length,
          abnormal: abnormal.length,
          diagnoses: (rec.diagnoses || []).length,
        },
        abnormalTests: abnormal.slice(0, 3).map((t) => ({ name: t.name, flag: t.flag })),
        diagnoses: (rec.diagnoses || []).slice(0, 3),
        medicines: (rec.medicines || []).slice(0, 3).map((m) => m.name),
        handwritten: Boolean(rec.handwritten),
        mock: rec.mode === "mock",
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/* ---------- medicines ---------- */

const ONGOING = /continue|ongoing|long.?term|regular|lifelong|life.?long|till further|permanent|daily/i;

function parseDurationDays(text) {
  const m = String(text || "").match(/(\d+(?:\.\d+)?)\s*(day|days|d|week|weeks|wk|wks|month|months|mo|year|years|yr|yrs)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("d")) return Math.round(n);
  if (unit.startsWith("w")) return Math.round(n * 7);
  if (unit.startsWith("m")) return Math.round(n * 30);
  return Math.round(n * 365);
}

const medKey = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(MED_PREFIX, "")
    .replace(/\s+/g, " ")
    .trim();

function medicineStatus(med, prescribedOn, now) {
  const days = parseDurationDays(med.duration);
  if (days !== null) {
    const endsOn = new Date(prescribedOn.getTime() + days * DAY);
    return { status: now <= endsOn ? "active" : "completed", endsOn };
  }
  const age = (now - prescribedOn) / DAY;
  if (ONGOING.test(med.duration || "") || !med.duration) {
    /* Open-ended prescriptions are treated as current for 6 months, undated ones for 30 days. */
    const window = med.duration ? 180 : 30;
    return { status: age <= window ? "active" : "past", endsOn: null };
  }
  return { status: age <= 30 ? "active" : "past", endsOn: null };
}

function buildMedicines(sortedDesc, now) {
  const seen = new Map();
  for (const rec of sortedDesc) {
    const prescribedOn = recordDate(rec);
    for (const med of rec.medicines || []) {
      const key = medKey(med.name);
      if (!key || seen.has(key)) continue; // newest prescription of a drug wins
      const { status, endsOn } = medicineStatus(med, prescribedOn, now);
      seen.set(key, {
        name: med.name,
        dosage: med.dosage || "",
        frequency: med.frequency || "",
        duration: med.duration || "",
        instructions: med.instructions || "",
        prescribedOn: iso(prescribedOn),
        endsOn: iso(endsOn),
        status,
        recordId: String(rec._id),
      });
    }
  }
  const rank = { active: 0, past: 1, completed: 2 };
  return [...seen.values()].sort((a, b) => rank[a.status] - rank[b.status] || new Date(b.prescribedOn) - new Date(a.prescribedOn));
}

/* ---------- labs ---------- */

function buildLatestLabs(sortedDesc) {
  const byKey = new Map();
  for (const rec of sortedDesc) {
    const date = iso(recordDate(rec));
    for (const t of rec.tests || []) {
      const key = t.canonicalName || String(t.name).toLowerCase();
      const point = {
        key,
        name: t.name,
        value: t.value,
        numericValue: t.numericValue ?? null,
        unit: t.unit || "",
        referenceRange: t.referenceRange || "",
        refLow: t.refLow ?? null,
        refHigh: t.refHigh ?? null,
        flag: t.flag || "unknown",
        date,
        recordId: String(rec._id),
      };
      const entry = byKey.get(key);
      if (!entry) byKey.set(key, { ...point, readings: 1, previous: null });
      else {
        entry.readings += 1;
        if (!entry.previous) entry.previous = { value: point.value, numericValue: point.numericValue, flag: point.flag, date };
      }
    }
  }
  return [...byKey.values()].map((l) => {
    let change = null;
    if (l.previous && l.numericValue !== null && l.previous.numericValue !== null) {
      change = l.numericValue > l.previous.numericValue ? "up" : l.numericValue < l.previous.numericValue ? "down" : "same";
    }
    return { ...l, change };
  });
}

function buildTrend(records, key) {
  const points = [];
  let latest = null;
  for (const rec of records) {
    for (const t of rec.tests || []) {
      const k = t.canonicalName || String(t.name).toLowerCase();
      if (k !== key || t.numericValue === null || t.numericValue === undefined) continue;
      const date = recordDate(rec);
      points.push({ date: iso(date), value: t.numericValue, flag: t.flag || "unknown", recordId: String(rec._id) });
      if (!latest || date > latest.date) latest = { date, t };
    }
  }
  points.sort((a, b) => new Date(a.date) - new Date(b.date));
  return {
    key,
    name: latest?.t.name || key,
    unit: latest?.t.unit || "",
    refLow: latest?.t.refLow ?? null,
    refHigh: latest?.t.refHigh ?? null,
    referenceRange: latest?.t.referenceRange || "",
    points,
  };
}

/* ---------- conditions ---------- */

function buildConditions(sortedDesc) {
  const map = new Map();
  for (const rec of sortedDesc) {
    const date = iso(recordDate(rec));
    for (const name of rec.diagnoses || []) {
      const key = name.toLowerCase().trim();
      if (!key) continue;
      const c = map.get(key);
      if (!c) map.set(key, { name, firstSeen: date, lastSeen: date, mentions: 1, recordId: String(rec._id) });
      else {
        c.mentions += 1;
        c.firstSeen = date; // iterating newest-first, so the last assignment is the oldest
      }
    }
  }
  return [...map.values()];
}

function ageFrom(user, sortedDesc) {
  if (user.dateOfBirth) {
    const years = Math.floor((Date.now() - new Date(user.dateOfBirth)) / (365.25 * DAY));
    if (years >= 0 && years < 130) return String(years);
  }
  const fromRecord = sortedDesc.find((r) => r.patientAge)?.patientAge;
  return fromRecord || "";
}

function buildProfile(user, records, now = new Date()) {
  const sortedDesc = [...records].sort((a, b) => recordDate(b) - recordDate(a));
  const labs = buildLatestLabs(sortedDesc);
  const byCategory = {};
  for (const r of sortedDesc) byCategory[r.category || "other"] = (byCategory[r.category || "other"] || 0) + 1;

  return {
    user: {
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      age: ageFrom(user, sortedDesc),
      gender: user.gender || sortedDesc.find((r) => r.patientGender)?.patientGender || "",
      dateOfBirth: iso(user.dateOfBirth),
      preferredLanguage: user.preferredLanguage || "en",
      abha: user.abha?.number || user.abha?.address
        ? { number: user.abha.number || "", address: user.abha.address || "", linkedAt: iso(user.abha.linkedAt), mock: Boolean(user.abha.mock) }
        : null,
    },
    stats: {
      records: sortedDesc.length,
      byCategory,
      firstRecordDate: sortedDesc.length ? iso(recordDate(sortedDesc[sortedDesc.length - 1])) : null,
      lastRecordDate: sortedDesc.length ? iso(recordDate(sortedDesc[0])) : null,
      abnormalLabs: labs.filter((l) => isAbnormalFlag(l.flag)).length,
    },
    medicines: buildMedicines(sortedDesc, now),
    conditions: buildConditions(sortedDesc),
    labs: labs.sort((a, b) => Number(isAbnormalFlag(b.flag)) - Number(isAbnormalFlag(a.flag)) || new Date(b.date) - new Date(a.date)),
  };
}

/** Compact facts handed to the AI for the profile overview (no email / ids). */
function profileFacts(profile) {
  return {
    patient: { name: profile.user.fullName, age: profile.user.age, gender: profile.user.gender },
    recordsOnFile: profile.stats.records,
    conditionsInRecords: profile.conditions.map((c) => c.name),
    currentMedicines: profile.medicines
      .filter((m) => m.status === "active")
      .map((m) => [m.name, m.dosage, m.frequency].filter(Boolean).join(" ")),
    labResultsOutsideRange: profile.labs
      .filter((l) => isAbnormalFlag(l.flag))
      .map((l) => ({
        test: l.name,
        value: `${l.value} ${l.unit}`.trim(),
        reference: l.referenceRange,
        result: l.flag,
        date: l.date?.slice(0, 10),
        previous: l.previous ? `${l.previous.value} on ${l.previous.date?.slice(0, 10)}` : null,
      })),
  };
}

module.exports = {
  recordDate,
  serializeRecord,
  buildTimeline,
  buildProfile,
  buildTrend,
  profileFacts,
  parseDurationDays,
};
