/* Languages the AI can write summaries in. `core` languages are generated at upload time
   (one Gemini call); the rest are generated on demand and cached on the record. */
const LANGUAGES = {
  en: { name: "English", native: "English", core: true },
  hi: { name: "Hindi", native: "हिन्दी", core: true },
  te: { name: "Telugu", native: "తెలుగు", core: true },
  ta: { name: "Tamil", native: "தமிழ்" },
  kn: { name: "Kannada", native: "ಕನ್ನಡ" },
  ml: { name: "Malayalam", native: "മലയാളം" },
  bn: { name: "Bengali", native: "বাংলা" },
  mr: { name: "Marathi", native: "मराठी" },
  gu: { name: "Gujarati", native: "ગુજરાતી" },
  pa: { name: "Punjabi", native: "ਪੰਜਾਬੀ" },
};

const LANGUAGE_CODES = Object.keys(LANGUAGES);
const CORE_LANGUAGES = LANGUAGE_CODES.filter((c) => LANGUAGES[c].core);

module.exports = { LANGUAGES, LANGUAGE_CODES, CORE_LANGUAGES };
