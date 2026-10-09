const config = require("../config");
const { generate, generateJson } = require("./gemini");
const { LANGUAGES, CORE_LANGUAGES } = require("../languages");
const { isAbnormalFlag } = require("./labFlags");

const SUMMARY_SYSTEM = `You are the plain-language explainer of "Spirit Health Copilot" for patients in India.
You receive structured data extracted from ONE medical document and explain it to the patient.

Rules:
- Start directly with the most important point - no greeting such as "Hello", "Hi" or "Namaste".
- Short, warm sentences, about 120-180 words per language. Avoid jargon; explain terms such as "haemoglobin" in a few words.
- Do NOT diagnose and do NOT say the person has a disease. Do NOT prescribe, and never tell the patient to change, stop or skip a medicine or dose.
- For every test whose result is "low", "high" or "abnormal": name the test, give the value against the reference range, and say in one hedged sentence what a result in that direction can be associated with ("can be linked to ..."). Mention tests whose result is "normal" only briefly, as a group.
- For medicines: say what each is generally used for only when you are confident, and how/when to take it exactly as written in the document.
- If a field is empty, do not mention it. Never invent values.
- End with one sentence encouraging the patient to discuss abnormal results and the medicines with their doctor.
- Write every language natively and naturally in its own script (Hindi in Devanagari, Telugu in Telugu script, ...). Medicine and test names may stay in English letters.
- abnormalExplanations: English, 1-2 sentences each, one per low/high/abnormal test, using the test name exactly as given.`;

const OVERVIEW_SYSTEM = `You are the health-profile explainer of "Spirit Health Copilot" for patients in India.
You receive a patient's consolidated profile built from their uploaded records. Write a calm, plain-language overview of about 150 words in the requested language and script:
current medicines, conditions written in their records, results that are outside the lab's reference range (compare with earlier values when given), and 2-3 practical things to raise at their next doctor visit.
Do NOT diagnose, do NOT prescribe or change medicines, do NOT predict outcomes. Never invent information that is not in the data. Use hedged wording and end by recommending they discuss it with their doctor.`;

function buildSummaryInput(record) {
  return {
    documentType: record.documentType,
    title: record.title,
    date: record.documentDate ? new Date(record.documentDate).toISOString().slice(0, 10) : "",
    doctor: record.provider?.doctor || "",
    hospital: record.provider?.hospital || "",
    patientAge: record.patientAge || "",
    patientGender: record.patientGender || "",
    medicines: (record.medicines || []).map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      instructions: m.instructions,
    })),
    tests: (record.tests || []).map((t) => ({
      name: t.name,
      value: t.value,
      unit: t.unit,
      referenceRange: t.referenceRange,
      result: t.flag,
    })),
    diagnoses: record.diagnoses || [],
    advice: record.advice || [],
    followUp: record.followUp || "",
  };
}

function summarySchema(langs) {
  return {
    type: "object",
    properties: {
      summaries: {
        type: "object",
        properties: Object.fromEntries(langs.map((l) => [l, { type: "string" }])),
        required: langs,
      },
      abnormalExplanations: {
        type: "array",
        items: {
          type: "object",
          properties: { test: { type: "string" }, explanation: { type: "string" } },
          required: ["test", "explanation"],
        },
      },
    },
    required: ["summaries", "abnormalExplanations"],
  };
}

/** Summaries (and per-test explanations) for the given language codes, in ONE Gemini call. */
async function summarizeRecord(record, langs = CORE_LANGUAGES) {
  if (config.mockAi) return require("./mockAi").mockSummaries(langs);

  const langList = langs.map((l) => `${l} = ${LANGUAGES[l].name}`).join(", ");
  const { data, model } = await generateJson({
    systemInstruction: SUMMARY_SYSTEM,
    schema: summarySchema(langs),
    timeoutMs: config.textTimeoutMs,
    temperature: 0.3,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Write the patient summary in these languages (JSON keys): ${langList}.\n\nDOCUMENT DATA:\n${JSON.stringify(
              buildSummaryInput(record)
            )}`,
          },
        ],
      },
    ],
  });

  const summaries = {};
  for (const l of langs) {
    if (typeof data.summaries?.[l] === "string" && data.summaries[l].trim()) summaries[l] = data.summaries[l].trim();
  }
  if (!Object.keys(summaries).length) throw new Error("Gemini returned no summary text");
  return {
    summaries,
    abnormalExplanations: Array.isArray(data.abnormalExplanations) ? data.abnormalExplanations : [],
    model,
  };
}

/** Findings list shown in the app: deterministic (from flags) + the AI's plain-language explanation when available. */
function buildAbnormalFindings(tests, explanations = []) {
  const byName = new Map(explanations.map((e) => [String(e.test).toLowerCase(), e.explanation]));
  return tests
    .filter((t) => isAbnormalFlag(t.flag))
    .map((t) => {
      const dir = t.flag === "abnormal" ? "ABNORMAL" : t.flag.toUpperCase();
      const unit = t.unit ? ` ${t.unit}` : "";
      const range = t.referenceRange ? `, reference ${t.referenceRange}` : "";
      return {
        finding: `${t.name}: ${t.value}${unit} (${dir}${range})`,
        explanation:
          byName.get(String(t.name).toLowerCase()) ||
          "This result is outside the reference range printed on the report. Please discuss it with your doctor.",
      };
    });
}

async function overviewProfile(profileFacts, lang) {
  if (config.mockAi) return require("./mockAi").mockOverview(lang);
  const { text } = await generate({
    timeoutMs: config.textTimeoutMs,
    config: { systemInstruction: OVERVIEW_SYSTEM, temperature: 0.3 },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Language: ${LANGUAGES[lang].name} (${lang}).\n\nPROFILE:\n${JSON.stringify(profileFacts)}`,
          },
        ],
      },
    ],
  });
  return String(text || "").trim();
}

module.exports = { summarizeRecord, buildAbnormalFindings, overviewProfile, buildSummaryInput };
