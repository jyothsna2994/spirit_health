/*
  Fills a running demo server (npm run demo) with a demo account and the two sample documents:
    node scripts/seed-demo.js
  Login afterwards:  demo@spirit.test / demo1234
*/
const fs = require("fs");
const path = require("path");

const BASE = process.env.DEMO_URL || `http://localhost:${process.env.DEMO_PORT || 5055}`;
const EMAIL = "demo@spirit.test";
const PASSWORD = "demo1234";

async function json(res) {
  return res.json().catch(() => ({}));
}

(async () => {
  let auth = await json(await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Asha Rao", email: EMAIL, password: PASSWORD }),
  }));
  if (!auth.token) {
    auth = await json(await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }));
  }
  if (!auth.token) throw new Error(`Could not register or log in: ${auth.message}`);

  for (const name of ["sample-lab-report.png", "sample-prescription.png"]) {
    const file = path.join(__dirname, "..", "samples", name);
    if (!fs.existsSync(file)) throw new Error(`${name} is missing - run: npm run samples`);
    const form = new FormData();
    form.append("document", new Blob([fs.readFileSync(file)], { type: "image/png" }), name);
    process.stdout.write(`Uploading ${name} ... `);
    const res = await json(await fetch(`${BASE}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${auth.token}` }, body: form }));
    console.log(res.success ? `${res.record.category} (${res.mode})` : `FAILED: ${res.message}`);
  }
  console.log(`\nDone. Log in with ${EMAIL} / ${PASSWORD}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
