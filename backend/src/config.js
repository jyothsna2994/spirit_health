const crypto = require("crypto");
const dns = require("dns");
const dotenv = require("dotenv");

dotenv.config();

/* Some networks cannot resolve Atlas SRV records with the system DNS.
   Set DNS_SERVERS=system to keep the OS resolver. */
if (process.env.DNS_SERVERS !== "system") {
  dns.setServers(
    (process.env.DNS_SERVERS || "8.8.8.8,8.8.4.4").split(",").map((s) => s.trim())
  );
}

/* Free-tier quota is counted per model, so fall back to the next model when one is exhausted. */
const geminiModels = (
  process.env.GEMINI_MODELS ||
  process.env.GEMINI_MODEL ||
  "gemini-3.8-flash"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean)
  .concat([
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ])
  .filter((m, i, list) => list.indexOf(m) === i);

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString("hex");
  console.warn(
    "JWT_SECRET is not set - using a random secret. Everyone is logged out on every restart. Add JWT_SECRET to .env."
  );
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModels,
  /* Reading a multi-page PDF or a photo is slower than a text-only call. */
  extractionTimeoutMs: Number(process.env.EXTRACTION_TIMEOUT_MS) || 60000,
  textTimeoutMs: Number(process.env.TEXT_TIMEOUT_MS) || 30000,
  jwtSecret,
  jwtExpiresIn: "30d",
  /* MOCK_AI=true skips Gemini and returns a clearly-labelled sample record (demos, UI work, tests). */
  mockAi: process.env.MOCK_AI === "true",
  mockAbhaOtp: process.env.MOCK_ABHA_OTP || "123456",
  isProduction: process.env.NODE_ENV === "production",
};
