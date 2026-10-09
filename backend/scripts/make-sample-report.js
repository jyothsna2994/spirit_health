/*
  Generates synthetic (fake patient) bilingual documents for demos and for smoke-testing the AI:
    node scripts/make-sample-report.js            ->  backend/samples/
      sample-lab-report.png            CBC + biochemistry, 12/09/2026 (Hb low, fasting sugar high)
      sample-lab-report-followup.png   same panel, 02/10/2026 (Hb improving) - gives the Trend screen two points
      sample-prescription.png          printed prescription, 14/09/2026
*/
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const outDir = process.argv[2] || path.join(__dirname, "..", "samples");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const text = (x, y, s, extra = "") => `<text x="${x}" y="${y}" ${extra}>${esc(s)}</text>`;
const page = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="760">
  <rect width="100%" height="100%" fill="white"/>
  <g font-family="Segoe UI, Nirmala UI, Noto Sans, Noto Sans Devanagari, Arial, sans-serif" fill="black">${body.join("\n")}</g>
</svg>`;

function labReport({ date, rows, advice, adviceHi }) {
  return page([
    text(40, 60, "SUNRISE DIAGNOSTICS", 'font-size="30" font-weight="bold"'),
    text(40, 90, "सनराइज डायग्नोस्टिक्स  |  Hyderabad", 'font-size="18"'),
    text(40, 140, "Patient: Sample Patient    Age/Sex: 42 / Male", 'font-size="20"'),
    text(40, 170, `Referred by: Dr. A. Rao    Date: ${date}`, 'font-size="20"'),
    text(40, 200, `रिपोर्ट की तारीख: ${date}`, 'font-size="18"'),
    text(40, 250, "COMPLETE BLOOD COUNT & BIOCHEMISTRY", 'font-size="22" font-weight="bold"'),
    text(40, 290, "Test", 'font-size="18" font-weight="bold"'),
    text(330, 290, "Result", 'font-size="18" font-weight="bold"'),
    text(450, 290, "Unit", 'font-size="18" font-weight="bold"'),
    text(560, 290, "Reference Range", 'font-size="18" font-weight="bold"'),
    text(790, 290, "Flag", 'font-size="18" font-weight="bold"'),
    '<line x1="40" y1="300" x2="860" y2="300" stroke="black" stroke-width="2"/>',
    ...rows.flatMap(([name, value, unit, range, flag], i) => {
      const y = 335 + i * 38;
      return [
        text(40, y, name, 'font-size="19"'),
        text(330, y, value, 'font-size="19"'),
        text(450, y, unit, 'font-size="19"'),
        text(560, y, range, 'font-size="19"'),
        text(790, y, flag, 'font-size="19" font-weight="bold"'),
      ];
    }),
    text(40, 620, advice, 'font-size="18"'),
    text(40, 650, adviceHi, 'font-size="18"'),
    text(40, 720, "*** End of Report - synthetic sample, not a real patient ***", 'font-size="14" font-style="italic"'),
  ]);
}

const files = {
  "sample-lab-report.png": labReport({
    date: "12/09/2026",
    rows: [
      ["Haemoglobin (Hb)", "9.8", "g/dL", "13.0 - 17.0", "L"],
      ["Total Leucocyte Count", "7200", "/cumm", "4000 - 11000", ""],
      ["Platelet Count", "250000", "/cumm", "150000 - 410000", ""],
      ["Fasting Blood Sugar", "112", "mg/dL", "70 - 100", "H"],
      ["Total Cholesterol", "185", "mg/dL", "< 200", ""],
      ["TSH", "2.40", "uIU/mL", "0.40 - 4.00", ""],
    ],
    advice: "Advice: Repeat CBC after 4 weeks. Reduce sugar intake.",
    adviceHi: "सलाह: 4 सप्ताह बाद दोबारा जांच कराएं।",
  }),

  "sample-lab-report-followup.png": labReport({
    date: "02/10/2026",
    rows: [
      ["Haemoglobin (Hb)", "11.4", "g/dL", "13.0 - 17.0", "L"],
      ["Total Leucocyte Count", "6800", "/cumm", "4000 - 11000", ""],
      ["Platelet Count", "262000", "/cumm", "150000 - 410000", ""],
      ["Fasting Blood Sugar", "98", "mg/dL", "70 - 100", ""],
      ["Total Cholesterol", "181", "mg/dL", "< 200", ""],
      ["TSH", "2.10", "uIU/mL", "0.40 - 4.00", ""],
    ],
    advice: "Advice: Continue iron supplements. Review in 4 weeks.",
    adviceHi: "सलाह: आयरन की दवा जारी रखें। 4 सप्ताह बाद दिखाएं।",
  }),

  "sample-prescription.png": page([
    text(40, 60, "CITY CARE CLINIC", 'font-size="30" font-weight="bold"'),
    text(40, 90, "Dr. A. Rao, MBBS MD (General Medicine)   |   Reg. No. 12345", 'font-size="17"'),
    text(40, 140, "Name: Sample Patient    Age/Sex: 42 / M    Date: 14/09/2026", 'font-size="19"'),
    text(40, 175, "Diagnosis: Iron deficiency anaemia, Impaired fasting glucose", 'font-size="19"'),
    text(40, 215, "निदान: आयरन की कमी से खून की कमी", 'font-size="17"'),
    text(40, 270, "Rx", 'font-size="34" font-weight="bold" font-style="italic"'),
    text(40, 320, "1. Tab. Ferrous Ascorbate 100 mg   1-0-1   x 30 days   (after food)", 'font-size="19"'),
    text(40, 360, "2. Tab. Metformin 500 mg   1-0-1   x 3 months   (with meals)", 'font-size="19"'),
    text(40, 400, "3. Tab. Pantoprazole 40 mg   1-0-0   x 10 days   (before breakfast)", 'font-size="19"'),
    text(40, 450, "4. Cap. Vitamin B12 1500 mcg   OD   x 2 weeks", 'font-size="19"'),
    text(40, 520, "Advice: Walk 30 minutes daily. Avoid sweets. Drink plenty of water.", 'font-size="18"'),
    text(40, 550, "सलाह: रोज 30 मिनट टहलें। मीठा कम खाएं।", 'font-size="17"'),
    text(40, 600, "Review after 4 weeks with repeat CBC and fasting sugar.", 'font-size="18"'),
    text(40, 720, "*** synthetic sample, not a real patient or prescription ***", 'font-size="14" font-style="italic"'),
  ]),
};

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, svg] of Object.entries(files)) {
    const file = path.join(outDir, name);
    await sharp(Buffer.from(svg)).png().toFile(file);
    console.log("Wrote", file);
  }
})();
