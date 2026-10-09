const { GoogleGenAI } = require("@google/genai");
const config = require("../config");

let client;
function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: config.geminiApiKey });
  return client;
}

let lastModel = config.geminiModels[0];

/* A model that just said "quota exhausted" or "overloaded" is skipped for a while, so every
   request does not pay for the same failed attempts first. Cooled-down models stay available as a last resort. */
const cooldownUntil = new Map();
const COOLDOWN_MS = { quota: 60 * 1000, overloaded: 15 * 1000, missing: 10 * 60 * 1000 };

function isRetryable(message) {
  return /429|RESOURCE_EXHAUSTED|404|NOT_FOUND|500|INTERNAL|503|UNAVAILABLE|overloaded/i.test(
    message || ""
  );
}

function coolDown(model, message) {
  const kind = /429|RESOURCE_EXHAUSTED/i.test(message) ? "quota" : /404|NOT_FOUND/i.test(message) ? "missing" : "overloaded";
  cooldownUntil.set(model, Date.now() + COOLDOWN_MS[kind]);
}

function modelOrder() {
  const now = Date.now();
  const all = [lastModel, ...config.geminiModels.filter((m) => m !== lastModel)];
  const ready = all.filter((m) => (cooldownUntil.get(m) || 0) <= now);
  const cooling = all.filter((m) => (cooldownUntil.get(m) || 0) > now);
  return [...ready, ...cooling];
}

/**
 * Call Gemini, trying the next configured model when one is rate-limited, missing or slow.
 * Returns { text, model }.
 */
async function generate({ contents, config: genConfig = {}, timeoutMs }) {
  let lastError;

  for (const model of modelOrder()) {
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("503 UNAVAILABLE: model timed out"));
        }, timeoutMs);
      });
      const response = await Promise.race([
        getClient().models.generateContent({
          model,
          contents,
          config: { ...genConfig, abortSignal: controller.signal },
        }),
        timeout,
      ]);
      lastModel = model;
      cooldownUntil.delete(model);
      return { text: response.text, model };
    } catch (error) {
      lastError = error;
      if (!isRetryable(error.message)) throw error;
      coolDown(model, error.message);
      console.log(`Gemini model ${model} unavailable (${String(error.message).slice(0, 80)}). Trying next model...`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function cleanJson(text) {
  let cleaned = String(text || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "");
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) cleaned = cleaned.substring(start, end + 1);
  return cleaned.trim();
}

/**
 * Ask Gemini for JSON. Uses a response schema when the model accepts one, and
 * falls back to prompt-only JSON if the schema is rejected or the output is malformed.
 */
async function generateJson({ contents, systemInstruction, schema, timeoutMs, temperature = 0.1 }) {
  const base = { systemInstruction, temperature, responseMimeType: "application/json" };
  let useSchema = Boolean(schema);
  let lastError;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { text, model } = await generate({
        contents,
        timeoutMs,
        config: useSchema ? { ...base, responseJsonSchema: schema } : base,
      });
      return { data: JSON.parse(cleanJson(text)), model };
    } catch (error) {
      lastError = error;
      if (useSchema && /INVALID_ARGUMENT|400/.test(error.message || "")) {
        useSchema = false; // model/schema combination not supported - retry without schema
        continue;
      }
      if (error instanceof SyntaxError) continue; // malformed JSON - try again
      throw error;
    }
  }
  throw lastError;
}

module.exports = { generate, generateJson, cleanJson };
