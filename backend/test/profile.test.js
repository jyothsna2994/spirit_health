const test = require("node:test");
const assert = require("node:assert/strict");
const { buildProfile, buildTimeline, buildTrend, parseDurationDays, recordDate, serializeRecord } = require("../src/services/profile");

const NOW = new Date("2026-10-08T00:00:00Z");

const rec = (id, date, extra = {}) => ({ _id: id, documentDate: new Date(date), category: "other", ...extra });
const hb = (value, flag, extra = {}) => ({
  name: "Haemoglobin", canonicalName: "hemoglobin", value: String(value), numericValue: value, unit: "g/dL",
  referenceRange: "13 - 17", refLow: 13, refHigh: 17, flag, ...extra,
});

const user = { _id: "u1", fullName: "Asha", email: "a@x.in", gender: "female", preferredLanguage: "hi" };

test("parseDurationDays", () => {
  assert.equal(parseDurationDays("5 days"), 5);
  assert.equal(parseDurationDays("2 weeks"), 14);
  assert.equal(parseDurationDays("1 month"), 30);
  assert.equal(parseDurationDays("x 3 months"), 90);
  assert.equal(parseDurationDays("ongoing"), null);
  assert.equal(parseDurationDays(""), null);
});

test("recordDate prefers the document date, then strict ISO legacy date, then upload time", () => {
  assert.equal(recordDate({ documentDate: "2026-01-02T00:00:00Z" }).toISOString().slice(0, 10), "2026-01-02");
  assert.equal(recordDate({ timelineEvent: { date: "2025-12-31" }, createdAt: "2026-05-05" }).toISOString().slice(0, 10), "2025-12-31");
  // "03/04/2025" is ambiguous (DD/MM vs MM/DD), so legacy free-text dates are NOT guessed at
  assert.equal(recordDate({ timelineEvent: { date: "03/04/2025" }, createdAt: "2026-05-05T00:00:00Z" }).toISOString().slice(0, 10), "2026-05-05");
});

test("timeline is newest first and counts abnormal results", () => {
  const events = buildTimeline([
    rec("a", "2026-01-01", { tests: [hb(12, "low")], summaries: { en: "Old report." } }),
    rec("b", "2026-06-01", { tests: [hb(14, "normal")], category: "lab_report" }),
  ]);
  assert.deepEqual(events.map((e) => e.id), ["b", "a"]);
  assert.equal(events[1].counts.abnormal, 1);
  assert.equal(events[1].abnormalTests[0].name, "Haemoglobin");
  assert.equal(events[1].summary, "Old report.");
});

test("profile: latest lab per test with previous value and direction of change", () => {
  const profile = buildProfile(user, [
    rec("old", "2026-03-01", { tests: [hb(9.8, "low")] }),
    rec("new", "2026-09-01", { tests: [hb(11.5, "low")] }),
  ], NOW);
  const lab = profile.labs.find((l) => l.key === "hemoglobin");
  assert.equal(lab.numericValue, 11.5);
  assert.equal(lab.previous.numericValue, 9.8);
  assert.equal(lab.change, "up");
  assert.equal(lab.readings, 2);
  assert.equal(profile.stats.abnormalLabs, 1);
});

test("profile: medicines are de-duplicated (newest wins) and statused by duration", () => {
  const profile = buildProfile(user, [
    rec("p1", "2026-02-01", { medicines: [{ name: "Tab. Paracetamol", duration: "5 days" }] }),
    rec("p2", "2026-10-05", { medicines: [{ name: "Paracetamol", duration: "5 days" }, { name: "Cap. Omeprazole", duration: "2 weeks" }] }),
    rec("p3", "2026-01-01", { medicines: [{ name: "Metformin", duration: "ongoing" }] }),
    rec("p4", "2026-08-01", { medicines: [{ name: "Amlodipine", duration: "continue" }] }),
  ], NOW);
  const byName = Object.fromEntries(profile.medicines.map((m) => [m.name, m]));
  assert.equal(profile.medicines.filter((m) => /paracetamol/i.test(m.name)).length, 1);
  assert.equal(byName["Paracetamol"].status, "active");
  assert.equal(byName["Cap. Omeprazole"].status, "active");
  assert.equal(byName["Metformin"].status, "past"); // open-ended, but prescribed >180 days ago
  assert.equal(byName["Amlodipine"].status, "active");
  assert.equal(profile.medicines[0].status, "active"); // active medicines sort first
});

test("profile: conditions merge repeated diagnoses and track first/last seen", () => {
  const profile = buildProfile(user, [
    rec("a", "2026-01-10", { diagnoses: ["Type 2 Diabetes"] }),
    rec("b", "2026-07-10", { diagnoses: ["type 2 diabetes", "Hypertension"] }),
  ], NOW);
  const dm = profile.conditions.find((c) => /diabetes/i.test(c.name));
  assert.equal(dm.mentions, 2);
  assert.equal(dm.firstSeen.slice(0, 10), "2026-01-10");
  assert.equal(dm.lastSeen.slice(0, 10), "2026-07-10");
  assert.equal(profile.conditions.length, 2);
});

test("trend returns numeric points oldest to newest with the latest reference range", () => {
  const trend = buildTrend([
    rec("a", "2026-09-01", { tests: [hb(11.5, "low")] }),
    rec("b", "2026-03-01", { tests: [hb(9.8, "low")] }),
    rec("c", "2026-06-01", { tests: [{ name: "Haemoglobin", canonicalName: "hemoglobin", value: "pending", numericValue: null }] }),
  ], "hemoglobin");
  assert.deepEqual(trend.points.map((p) => p.value), [9.8, 11.5]);
  assert.equal(trend.refLow, 13);
  assert.equal(trend.unit, "g/dL");
});

test("serializeRecord folds legacy summary fields into summaries and hides internals", () => {
  const r = serializeRecord({ _id: "x", healthSummary: "EN", hindiSummary: "HI", teluguSummary: "TE", contentHash: "secret", __v: 3, createdAt: "2026-01-01T00:00:00Z" });
  assert.deepEqual(r.summaries, { en: "EN", hi: "HI", te: "TE" });
  assert.equal(r.contentHash, undefined);
  assert.equal(r.id, "x");
  assert.equal(r.category, "other");
});
