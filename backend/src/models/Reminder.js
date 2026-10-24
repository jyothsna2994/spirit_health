const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    familyMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FamilyMember",
      default: null,
    },

    type: {
      type: String,
      enum: ["medicine", "appointment"],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    // A familiar name chosen by the user.
    // Example: "Morning white tablet".
    displayName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    // Optional identification notes.
    // Appearance is not proof of medicine identity.
    identification: {
      color: { type: String, default: "" },
      shape: { type: String, default: "" },
      notes: { type: String, default: "" },
      photoUrl: { type: String, default: "" },
    },

    // Never automatically infer missing dosage.
    dosage: {
      type: String,
      trim: true,
      default: "",
    },

    dosageConfirmed: {
      type: Boolean,
      default: false,
    },

    instructions: {
      type: String,
      trim: true,
      default: "",
    },

    // IANA timezone, e.g. Asia/Kolkata.
    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },

    // Local times selected by the user.
    times: {
      type: [String],
      default: [],
    },

    // Optional date range.
    startDate: {
      type: String,
      default: "",
    },

    endDate: {
      type: String,
      default: "",
    },

    // For one-time appointments.
    appointmentAt: {
      type: Date,
      default: null,
    },

    // Optional link to the uploaded report.
    sourceRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthRecord",
      default: null,
    },

    language: {
      type: String,
      enum: ["en", "te", "hi", "ta"],
      default: "en",
    },

    notificationEnabled: {
      type: Boolean,
      default: false,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

reminderSchema.index({
  userId: 1,
  familyMemberId: 1,
  active: 1,
});

module.exports = mongoose.model("Reminder", reminderSchema);
