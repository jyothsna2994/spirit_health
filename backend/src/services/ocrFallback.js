/*
  Offline fallback: if Gemini is unreachable or out of quota, still read English text from a photo
  with Tesseract so the user gets something. Gemini (vision) is the primary reader - it handles
  Hindi / Telugu / Tamil, handwriting and PDFs, which Tesseract's English model cannot.
*/
const sharp = require("sharp");

async function ocrImage(buffer) {
  const Tesseract = require("tesseract.js"); // loaded lazily: only needed on the fallback path
  const processed = await sharp(buffer).rotate().resize({ width: 2000 }).grayscale().normalize().sharpen().png().toBuffer();
  const result = await Tesseract.recognize(processed, "eng");
  return result.data.text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

module.exports = { ocrImage };
