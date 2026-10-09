const mongoose = require("mongoose");
const { LANGUAGE_CODES } = require("../languages");

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }, // bcrypt hash
  createdAt: { type: Date, default: Date.now },

  preferredLanguage: { type: String, enum: LANGUAGE_CODES, default: "en" },
  dateOfBirth: Date,
  gender: { type: String, enum: ["male", "female", "other", ""], default: "" },

  /* ABDM readiness: ABHA link. `mock: true` until a real ABDM gateway is wired in. */
  abha: {
    number: String, // 14 digits, stored formatted XX-XXXX-XXXX-XXXX
    address: String, // username@abdm
    linkedAt: Date,
    mock: Boolean,
  },
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
