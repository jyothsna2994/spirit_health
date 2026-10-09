/*
  End-to-end API test: real HTTP, real multipart upload, real MongoDB (in-memory), Gemini replaced by MOCK_AI.
  Needs `npm i -D mongodb-memory-server` (downloads a mongod binary on first run); skipped if it is missing.
*/
const test = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");

let MongoMemoryServer;
try {
  ({ MongoMemoryServer } = require("mongodb-memory-server"));
} catch {
  /* optional dev dependency */
}

test("API end to end", { skip: !MongoMemoryServer && "mongodb-memory-server is not installed" }, async (t) => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("spirit_test");
  process.env.MOCK_AI = "true";
  process.env.JWT_SECRET = "test-secret";
  process.env.DNS_SERVERS = "system";

  const mongoose = require("mongoose");
  const { app, connectMongoDB } = require("../server");
  await connectMongoDB();
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
  });

  const call = async (method, path, { token, json, form } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) },
      body: json ? JSON.stringify(json) : form,
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  };

  const image = (shade) =>
    sharp({ create: { width: 64, height: 64, channels: 3, background: { r: shade, g: 120, b: 200 } } }).png().toBuffer();
  const uploadForm = async (shade, name = "report.png", type = "image/png") => {
    const form = new FormData();
    form.append("document", new Blob([await image(shade)], { type }), name);
    return form;
  };

  /* ---------- health + auth ---------- */
  assert.equal((await call("GET", "/api/health")).body.mockAi, true);

  const reg = await call("POST", "/api/auth/register", { json: { fullName: "Asha Rao", email: "Asha@Example.com", password: "secret1" } });
  assert.equal(reg.status, 201);
  assert.ok(reg.body.token);
  assert.equal(reg.body.user.email, "asha@example.com");
  assert.equal((await call("POST", "/api/auth/register", { json: { fullName: "Dup", email: "asha@example.com", password: "secret1" } })).status, 409);
  assert.equal((await call("POST", "/api/auth/register", { json: { fullName: "X", email: "nope", password: "secret1" } })).status, 400);

  assert.equal((await call("POST", "/api/auth/login", { json: { email: "asha@example.com", password: "wrong" } })).status, 401);
  const login = await call("POST", "/api/auth/login", { json: { email: "asha@example.com", password: "secret1" } });
  assert.equal(login.status, 200);
  const token = login.body.token;

  /* ---------- everything health-related requires a valid token ---------- */
  for (const path of ["/api/records", "/api/timeline", "/api/profile", "/api/me", "/api/fhir/bundle"]) {
    assert.equal((await call("GET", path)).status, 401, `${path} must require auth`);
  }
  assert.equal((await call("GET", "/api/records", { token: "garbage" })).status, 401);
  assert.equal((await call("POST", "/api/upload", { form: await uploadForm(10) })).status, 401);

  /* ---------- upload -> extraction -> summary ---------- */
  const up = await call("POST", "/api/upload", { token, form: await uploadForm(10) });
  assert.equal(up.status, 200, JSON.stringify(up.body));
  assert.equal(up.body.mode, "mock");
  const rec = up.body.record;
  assert.equal(rec.category, "lab_report");
  assert.equal(rec.summaryStatus, "ready");
  const hb = rec.tests.find((x) => x.canonicalName === "hemoglobin");
  assert.equal(hb.flag, "low"); // 9.8 < 13.0, computed in code
  assert.equal(hb.status, "Low");
  assert.equal(hb.loinc, "718-7");
  assert.ok(up.body.data.healthSummary.startsWith("[Sample]")); // legacy envelope still present
  assert.ok(up.body.data.hindiSummary && up.body.data.teluguSummary);
  assert.ok(rec.abnormalFindings.length >= 2);
  assert.equal(rec.contentHash, undefined);

  /* same file again -> no duplicate timeline entry */
  const dup = await call("POST", "/api/upload", { token, form: await uploadForm(10) });
  assert.equal(dup.body.duplicate, true);
  assert.equal(dup.body.recordId, up.body.recordId);

  /* different file -> second record (the mock alternates to a prescription) */
  const up2 = await call("POST", "/api/upload", { token, form: await uploadForm(50) });
  assert.equal(up2.body.record.category, "prescription");
  assert.equal(up2.body.record.medicines.length, 2);

  /* bad uploads */
  const bad = new FormData();
  bad.append("document", new Blob(["hello"], { type: "text/plain" }), "x.txt");
  assert.equal((await call("POST", "/api/upload", { token, form: bad })).status, 400);
  assert.equal((await call("POST", "/api/upload", { token, form: new FormData() })).status, 400);

  /* ---------- timeline / profile / trends ---------- */
  const tl = await call("GET", "/api/timeline", { token });
  assert.equal(tl.body.count, 2);
  assert.equal(tl.body.events[0].category, "prescription"); // dated 2 days ago, newer than the lab report (30 days ago)
  assert.ok(tl.body.events[1].counts.abnormal >= 2);

  const prof = (await call("GET", "/api/profile", { token })).body.profile;
  assert.equal(prof.stats.records, 2);
  assert.ok(prof.labs.find((l) => l.key === "hemoglobin" && l.flag === "low"));
  assert.ok(prof.medicines.find((m) => /Atorvastatin/.test(m.name) && m.status === "active"));
  assert.ok(prof.conditions.find((c) => /anaemia/i.test(c.name)));

  const trend = (await call("GET", "/api/trends/hemoglobin", { token })).body.trend;
  assert.equal(trend.points.length, 1);
  assert.equal(trend.refLow, 13);

  /* ---------- languages ---------- */
  const ta = await call("POST", `/api/records/${rec.id}/summary`, { token, json: { lang: "ta" } });
  assert.equal(ta.status, 200);
  assert.equal(ta.body.cached, false);
  assert.equal((await call("POST", `/api/records/${rec.id}/summary`, { token, json: { lang: "ta" } })).body.cached, true);
  assert.equal((await call("POST", `/api/records/${rec.id}/summary`, { token, json: { lang: "xx" } })).status, 400);
  assert.ok((await call("GET", `/api/records/${rec.id}`, { token })).body.record.summaries.ta);

  const ov = await call("POST", "/api/profile/overview", { token, json: { lang: "hi" } });
  assert.equal(ov.status, 200);
  assert.ok(ov.body.overview);

  /* ---------- me / ABHA / FHIR ---------- */
  const patch = await call("PATCH", "/api/me", { token, json: { gender: "female", dateOfBirth: "1984-03-02", preferredLanguage: "te" } });
  assert.equal(patch.body.user.preferredLanguage, "te");
  assert.equal((await call("PATCH", "/api/me", { token, json: { dateOfBirth: "2999-01-01" } })).status, 400);

  const init = await call("POST", "/api/abha/link/initiate", { token, json: { abhaNumber: "91 1234 5678 9012" } });
  assert.equal(init.status, 200);
  assert.equal((await call("POST", "/api/abha/link/verify", { token, json: { txnId: init.body.txnId, otp: "111111" } })).status, 400);
  const linked = await call("POST", "/api/abha/link/verify", { token, json: { txnId: init.body.txnId, otp: "123456" } });
  assert.equal(linked.body.user.abha.number, "91-1234-5678-9012");
  assert.equal(linked.body.user.abha.mock, true);

  const fhir = (await call("GET", "/api/fhir/bundle", { token })).body;
  assert.equal(fhir.total, 2);
  const patient = fhir.entry[0].resource.entry.find((e) => e.resource.resourceType === "Patient").resource;
  assert.ok(patient.identifier.some((i) => i.value === "91-1234-5678-9012"));
  assert.equal(patient.birthDate, "1984-03-02");
  const one = (await call("GET", `/api/records/${rec.id}/fhir`, { token })).body;
  assert.equal(one.entry[0].resource.resourceType, "Composition");

  assert.equal((await call("DELETE", "/api/abha", { token })).body.user.abha, null);

  /* ---------- another user can never see or touch this data ---------- */
  const other = (await call("POST", "/api/auth/register", { json: { fullName: "Ravi", email: "ravi@example.com", password: "secret2" } })).body.token;
  assert.equal((await call("GET", "/api/records", { token: other })).body.count, 0);
  assert.equal((await call("GET", "/api/timeline", { token: other })).body.count, 0);
  assert.equal((await call("GET", `/api/records/${rec.id}`, { token: other })).status, 404);
  assert.equal((await call("DELETE", `/api/records/${rec.id}`, { token: other })).status, 404);
  assert.equal((await call("POST", `/api/records/${rec.id}/summary`, { token: other, json: { lang: "en" } })).status, 404);
  assert.equal((await call("GET", `/api/records/${rec.id}/fhir`, { token: other })).status, 404);
  assert.equal((await call("GET", "/api/records/not-an-id", { token })).status, 404);
  // the same file uploaded by another account is that account's own record, not a "duplicate" of someone else's
  const theirs = await call("POST", "/api/upload", { token: other, form: await uploadForm(10) });
  assert.equal(theirs.body.duplicate, undefined);
  assert.notEqual(theirs.body.recordId, up.body.recordId);

  /* ---------- delete ---------- */
  assert.equal((await call("DELETE", `/api/records/${rec.id}`, { token })).status, 200);
  assert.equal((await call("GET", "/api/timeline", { token })).body.count, 1);
});
