/**
 * Deterministic lab-result interpretation.
 *
 * The LLM only *reads* the report (name / value / unit / printed range / printed flag).
 * Whether a value is low, normal or high is decided here, from the numbers, so an AI
 * misreading cannot invent an abnormal result. The lab's own printed flag is used only
 * when the value or range cannot be parsed numerically.
 */

/* LOINC codes are indicative (common adult chemistry / haematology panels). Unknown tests get text-only codes. */
const KNOWN_TESTS = [
  { key: "hba1c", re: /(hba1c|hb\s*a1c|\ba1c\b|glyc(o)?sylated|glycated)/, loinc: "4548-4" },
  { key: "hemoglobin", re: /\b(h(a)?emoglobin|hgb|hb)\b/, loinc: "718-7" },
  { key: "wbc", re: /(\bwbc\b|\btlc\b|white blood|leu[ck]o?cytes?(\s+count)?\b)/, loinc: "6690-2" },
  { key: "rbc", re: /(\brbc\b|red blood cell|red cell count)/, loinc: "789-8" },
  { key: "platelets", re: /(platelet|\bplt\b)/, loinc: "777-3" },
  { key: "hematocrit", re: /(h(a)?ematocrit|\bpcv\b)/, loinc: "4544-3" },
  { key: "mchc", re: /\bmchc\b/, loinc: "786-4" },
  { key: "mch", re: /\bmch\b/, loinc: "785-6" },
  { key: "mcv", re: /\bmcv\b/, loinc: "787-2" },
  { key: "esr", re: /(\besr\b|erythrocyte sedimentation)/, loinc: "4537-7" },
  { key: "glucose_fasting", re: /((fasting).*(glucose|sugar)|(glucose|sugar).*fasting|\bfbs\b|\bfbg\b|\bfpg\b)/, loinc: "1558-6" },
  { key: "glucose_pp", re: /(post\s*-?\s*prandial|\bppbs\b|\bppg\b)/, loinc: null },
  { key: "glucose_random", re: /(random.*(glucose|sugar)|(glucose|sugar).*random|\brbs\b)/, loinc: "2345-7" },
  { key: "glucose", re: /(glucose|blood sugar)/, loinc: "2345-7" },
  { key: "cholesterol_total", re: /(total cholesterol|cholesterol,? total|^cholesterol$)/, loinc: "2093-3" },
  { key: "hdl", re: /\bhdl\b/, loinc: "2085-9" },
  { key: "vldl", re: /\bvldl\b/, loinc: "2091-7" },
  { key: "ldl", re: /\bldl\b/, loinc: "2089-1" },
  { key: "triglycerides", re: /(triglyceride|\btgl?\b)/, loinc: "2571-8" },
  { key: "creatinine", re: /creatinine(?!\s*clearance)/, loinc: "2160-0" },
  { key: "bun", re: /(blood urea nitrogen|\bbun\b)/, loinc: "3094-0" },
  { key: "urea", re: /\burea\b/, loinc: "3091-6" },
  { key: "uric_acid", re: /uric acid/, loinc: "3084-1" },
  { key: "sodium", re: /\b(sodium|na\+?)\b/, loinc: "2951-2" },
  { key: "potassium", re: /\b(potassium|k\+)\b/, loinc: "2823-3" },
  { key: "chloride", re: /\bchloride\b/, loinc: "2075-0" },
  { key: "calcium", re: /\bcalcium\b/, loinc: "17861-6" },
  { key: "tsh", re: /(\btsh\b|thyroid stimulating)/, loinc: "3016-3" },
  { key: "free_t4", re: /(free t4|\bft4\b|free thyroxine)/, loinc: "3024-7" },
  { key: "free_t3", re: /(free t3|\bft3\b)/, loinc: "3051-0" },
  { key: "t3", re: /\b(t3|triiodothyronine)\b/, loinc: "3053-6" },
  { key: "t4", re: /\b(t4|thyroxine)\b/, loinc: "3026-2" },
  { key: "alt", re: /(\balt\b|sgpt|alanine)/, loinc: "1742-6" },
  { key: "ast", re: /(\bast\b|sgot|aspartate)/, loinc: "1920-8" },
  { key: "alp", re: /(alkaline phosphatase|\balp\b)/, loinc: "6768-6" },
  { key: "bilirubin_direct", re: /(direct bilirubin|conjugated bilirubin)/, loinc: "1968-7" },
  { key: "bilirubin_total", re: /(total bilirubin|bilirubin,? total|^bilirubin$)/, loinc: "1975-2" },
  { key: "albumin", re: /\balbumin\b(?!.*globulin)/, loinc: "1751-7" },
  { key: "total_protein", re: /total protein/, loinc: "2885-2" },
  { key: "vitamin_b12", re: /(\bb12\b|cobalamin)/, loinc: "2132-9" },
  { key: "vitamin_d", re: /(vitamin d|25.?(oh|hydroxy))/, loinc: null },
  { key: "crp", re: /(\bcrp\b|c.?reactive)/, loinc: "1988-5" },
  { key: "ferritin", re: /ferritin/, loinc: "2276-4" },
  { key: "psa", re: /(\bpsa\b|prostate specific)/, loinc: "2857-1" },
];

function slug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Stable key so "Haemoglobin (Hb)" and "HGB" land on the same trend line. */
function identifyTest(name) {
  const text = String(name || "").toLowerCase();
  const hit = KNOWN_TESTS.find((t) => t.re.test(text));
  if (hit) return { key: hit.key, loinc: hit.loinc };
  return { key: slug(name) || "unknown_test", loinc: null };
}

/* ---------- value / range parsing ---------- */

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/,/g, "").trim();
  const m = s.match(/^(<=|>=|<|>|≤|≥)?\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const rest = s.slice(m[0].length);
  if (/^\s*[:/]\s*\d/.test(rest)) return null; // "1:80" titres, "120/80" pressures are not simple results
  return { num: parseFloat(m[2]), qualifier: m[1] || "" };
}

const NUM = "(-?\\d+(?:\\.\\d+)?)";

function parseSegment(text) {
  const s = String(text)
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/\bup\s*to\b/g, "upto")
    .replace(/\bto\b/g, "-")
    .replace(/,/g, "");

  let m = s.match(new RegExp(`${NUM}\\s*-\\s*${NUM}`));
  if (m) {
    const low = parseFloat(m[1]);
    const high = parseFloat(m[2]);
    if (low <= high) return { low, high };
  }
  m = s.match(new RegExp(`(?:<=|<|≤|less than|upto|up to|below|upper limit|max(?:imum)?)\\s*:?\\s*${NUM}`));
  if (m) return { low: null, high: parseFloat(m[1]) };
  m = s.match(new RegExp(`(?:>=|>|≥|greater than|above|more than|min(?:imum)?)\\s*:?\\s*${NUM}`));
  if (m) return { low: parseFloat(m[1]), high: null };
  return null;
}

const LABELS =
  "male|female|men|women|adult|child|children|infant|newborn|desirable|optimal|near optimal|borderline|very high|high|normal";

/**
 * Parse a printed reference range such as "13.0 - 17.0", "< 200", "Male: 13-17 Female: 12-15"
 * or "Desirable: <200 Borderline: 200-239 High: >=240". Returns { low, high } or null when
 * the range is missing or genuinely ambiguous (e.g. sex-specific ranges and the sex is unknown).
 */
function parseRange(text, { gender } = {}) {
  if (!text || !/\d/.test(String(text))) return null;

  const pieces = String(text)
    .split(new RegExp(`(?=\\b(?:${LABELS})\\b)`, "i"))
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const label = (p.match(new RegExp(`^(${LABELS})\\b`, "i")) || [])[1];
      return { label: label ? label.toLowerCase() : "", range: parseSegment(p) };
    });

  const sexPieces = pieces.filter((p) => /^(male|men|female|women)$/.test(p.label));
  if (sexPieces.length) {
    const want = gender === "female" ? /^(female|women)$/ : gender === "male" ? /^(male|men)$/ : null;
    if (!want) return null;
    const hit = sexPieces.find((p) => want.test(p.label) && p.range);
    return hit ? hit.range : null;
  }

  const normalish = pieces.find((p) => /^(normal|desirable|optimal|adult)$/.test(p.label) && p.range);
  if (normalish) return normalish.range;

  const plain = pieces.find((p) => !p.label && p.range);
  return plain ? plain.range : null;
}

/** Map a lab's printed flag ("H", "Low", "Within normal limits", "Positive"...) to our flag. */
function statusToFlag(status) {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return null;
  if (/\bab-?normal\b/.test(s)) return "abnormal";
  if (/not detected|non.?reactive|negative|absent|within|wnl|\bnil\b/.test(s)) return "normal";
  if (/^h{1,2}\*?$|high|elevated|increased|raised|above|↑/.test(s)) return "high";
  if (/^l{1,2}\*?$|low|decreased|reduced|below|↓/.test(s)) return "low";
  if (/positive|reactive|detected|present|critical/.test(s)) return "abnormal";
  if (/normal|desirable|optimal|adequate|sufficient/.test(s)) return "normal";
  return null;
}

/**
 * Interpret one extracted test row.
 * flag: "low" | "high" | "normal" | "abnormal" (qualitative) | "unknown"
 * flagSource: "computed" (value vs printed range) | "reported" (lab's printed flag) | "none"
 */
function analyzeTest(test, { gender } = {}) {
  const { key, loinc } = identifyTest(test.name);
  const parsed = parseNumber(test.value);
  const range = parseRange(test.referenceRange, { gender });

  const result = {
    canonicalName: key,
    loinc,
    numericValue: parsed ? parsed.num : null,
    refLow: range ? range.low : null,
    refHigh: range ? range.high : null,
    flag: "unknown",
    flagSource: "none",
  };

  if (parsed && !parsed.qualifier && range) {
    if (range.low !== null && parsed.num < range.low) result.flag = "low";
    else if (range.high !== null && parsed.num > range.high) result.flag = "high";
    else result.flag = "normal";
    result.flagSource = "computed";
    return result;
  }

  const reported = statusToFlag(test.status);
  if (reported) {
    result.flag = reported;
    result.flagSource = "reported";
  }
  return result;
}

const FLAG_LABEL = { low: "Low", high: "High", normal: "Normal", abnormal: "Abnormal", unknown: "" };
const isAbnormalFlag = (flag) => flag === "low" || flag === "high" || flag === "abnormal";

module.exports = {
  identifyTest,
  parseNumber,
  parseRange,
  statusToFlag,
  analyzeTest,
  isAbnormalFlag,
  FLAG_LABEL,
};
