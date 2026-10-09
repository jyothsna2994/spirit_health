/*
  MOCK_AI=true: canned output so the app can be demoed / developed / tested without Gemini quota.
  Every mock record is stored with mode "mock" and its summaries start with "[Sample]", so it can
  never be mistaken for a real analysis.
*/
const { LANGUAGES } = require("../languages");

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

let counter = 0;

function mockExtraction() {
  counter += 1;
  /* Alternate between a lab report and a prescription so a demo timeline has variety. */
  if (counter % 2 === 0) {
    return {
      category: "prescription",
      title: "Prescription - Dr. A. Rao",
      documentDate: isoDaysAgo(2),
      patient: { name: "Sample Patient", age: "42", gender: "male" },
      provider: { hospital: "City Care Clinic", doctor: "Dr. A. Rao" },
      languagesDetected: ["en", "hi"],
      handwritten: true,
      medicines: [
        { name: "Tab. Ferrous Ascorbate", genericName: "", dosage: "100 mg tablet", frequency: "once daily", duration: "30 days", route: "oral", instructions: "after food" },
        { name: "Tab. Atorvastatin", genericName: "Atorvastatin", dosage: "10 mg tablet", frequency: "at bedtime", duration: "ongoing", route: "oral", instructions: "" },
      ],
      tests: [],
      diagnoses: ["Iron deficiency anaemia", "Dyslipidaemia"],
      advice: ["Include iron-rich foods", "Walk 30 minutes daily"],
      followUp: "Review after 4 weeks with repeat CBC",
      extractionNotes: "Sample data (mock mode).",
    };
  }
  return {
    category: "lab_report",
    title: "Complete Blood Count and Lipid Profile",
    documentDate: isoDaysAgo(30),
    patient: { name: "Sample Patient", age: "42", gender: "male" },
    provider: { hospital: "Sunrise Diagnostics", doctor: "Dr. A. Rao" },
    languagesDetected: ["en"],
    handwritten: false,
    medicines: [],
    tests: [
      { name: "Haemoglobin", value: "9.8", unit: "g/dL", referenceRange: "13.0 - 17.0", status: "L" },
      { name: "Total Leucocyte Count", value: "7200", unit: "/cumm", referenceRange: "4000 - 11000", status: "" },
      { name: "Platelet Count", value: "250000", unit: "/cumm", referenceRange: "150000 - 410000", status: "" },
      { name: "Total Cholesterol", value: "245", unit: "mg/dL", referenceRange: "< 200", status: "H" },
      { name: "HDL Cholesterol", value: "38", unit: "mg/dL", referenceRange: "> 40", status: "L" },
      { name: "Fasting Blood Sugar", value: "92", unit: "mg/dL", referenceRange: "70 - 100", status: "" },
    ],
    diagnoses: [],
    advice: [],
    followUp: "",
    extractionNotes: "Sample data (mock mode).",
  };
}

const SAMPLE = {
  en: "[Sample] This is a sample summary shown because the app is running in mock mode. Your haemoglobin is below the reference range and your cholesterol is above it. Please discuss these results with your doctor.",
  hi: "[नमूना] यह एक नमूना सारांश है क्योंकि ऐप मॉक मोड में चल रहा है। हीमोग्लोबिन सामान्य सीमा से कम और कोलेस्ट्रॉल अधिक है। कृपया अपने डॉक्टर से बात करें।",
  te: "[నమూనా] ఇది మాక్ మోడ్‌లో చూపబడే నమూనా సారాంశం. హిమోగ్లోబిన్ సాధారణ పరిధి కంటే తక్కువగా, కొలెస్ట్రాల్ ఎక్కువగా ఉంది. దయచేసి మీ వైద్యుడిని సంప్రదించండి.",
  ta: "[மாதிரி] இது மாக் பயன்முறையில் காட்டப்படும் மாதிரி சுருக்கம். ஹீமோகுளோபின் குறைவாகவும் கொலஸ்ட்ரால் அதிகமாகவும் உள்ளது. உங்கள் மருத்துவரிடம் பேசவும்.",
};

function mockSummaries(langs) {
  const summaries = {};
  for (const l of langs) {
    summaries[l] = SAMPLE[l] || `[Sample] ${LANGUAGES[l].name} translation is not available in mock mode.`;
  }
  return {
    summaries,
    abnormalExplanations: [
      { test: "Haemoglobin", explanation: "Haemoglobin carries oxygen in the blood. A low value can be linked to iron deficiency or other causes - your doctor can tell which." },
      { test: "Total Cholesterol", explanation: "A high value can be linked to diet, activity and family history and is worth discussing with your doctor." },
      { test: "HDL Cholesterol", explanation: "HDL is the 'good' cholesterol; a low value is worth discussing with your doctor." },
    ],
    model: "mock",
  };
}

function mockOverview(lang) {
  return `[Sample] ${SAMPLE[lang] || SAMPLE.en}`;
}

module.exports = { mockExtraction, mockSummaries, mockOverview };
