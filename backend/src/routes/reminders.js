const express = require("express");
const mongoose = require("mongoose");
const { requireAuth } = require("../middleware/auth");
const FamilyMember = require("../models/FamilyMember");
const Reminder = require("../models/Reminder");

const router = express.Router();
router.use(requireAuth);

const allowedLanguages = ["en", "te", "hi", "ta"];

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validTimezone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

async function profileFilter(req, res, familyMemberId) {
  const filter = {
    userId: req.user._id,
    familyMemberId: null,
  };

  if (!familyMemberId) return filter;

  if (!mongoose.isValidObjectId(familyMemberId)) {
    res.status(400).json({
      success: false,
      message: "Invalid family member ID.",
    });
    return null;
  }

  const member = await FamilyMember.findOne({
    _id: familyMemberId,
    userId: req.user._id,
  });

  if (!member) {
    res.status(404).json({
      success: false,
      message: "Family member not found.",
    });
    return null;
  }

  filter.familyMemberId = member._id;
  return filter;
}

function validateReminder(body) {
  const type = body.type;

  if (!["medicine", "appointment"].includes(type)) {
    return "Select medicine or appointment.";
  }

  if (
    typeof body.title !== "string" ||
    !body.title.trim() ||
    body.title.length > 120
  ) {
    return "Enter a valid reminder title.";
  }

  const timezone = body.timezone || "Asia/Kolkata";

  if (!validTimezone(timezone)) {
    return "Select a valid timezone.";
  }

  if (
    body.language &&
    !allowedLanguages.includes(body.language)
  ) {
    return "Unsupported language.";
  }

  if (type === "medicine") {
    if (
      !Array.isArray(body.times) ||
      body.times.length === 0 ||
      body.times.length > 12 ||
      !body.times.every(
        (time) => typeof time === "string" && validTime(time)
      )
    ) {
      return "Choose one or more valid medicine reminder times.";
    }

    if (body.startDate && !validDate(body.startDate)) {
      return "Invalid start date.";
    }

    if (body.endDate && !validDate(body.endDate)) {
      return "Invalid end date.";
    }

    if (
      body.startDate &&
      body.endDate &&
      body.endDate < body.startDate
    ) {
      return "End date cannot be before start date.";
    }
  }

  if (type === "appointment") {
    if (
      !body.appointmentAt ||
      Number.isNaN(new Date(body.appointmentAt).getTime())
    ) {
      return "Choose a valid appointment date and time.";
    }

    if (new Date(body.appointmentAt) <= new Date()) {
      return "Appointment must be in the future.";
    }
  }

  if (
    body.dosageConfirmed === true &&
    !(typeof body.dosage === "string" && body.dosage.trim())
  ) {
    return "Enter the confirmed dosage or leave it unconfirmed.";
  }

  return null;
}

function buildReminder(body) {
  const identification = body.identification || {};

  return {
    type: body.type,
    title: body.title.trim(),
    displayName: String(body.displayName || "").trim(),
    identification: {
      color: String(identification.color || "").trim(),
      shape: String(identification.shape || "").trim(),
      notes: String(identification.notes || "").trim(),
      photoUrl: String(identification.photoUrl || "").trim(),
    },
    dosage: String(body.dosage || "").trim(),
    dosageConfirmed: body.dosageConfirmed === true,
    instructions: String(body.instructions || "").trim(),
    timezone: body.timezone || "Asia/Kolkata",
    times: body.type === "medicine"
      ? [...new Set(body.times)]
      : [],
    startDate: body.startDate || "",
    endDate: body.endDate || "",
    appointmentAt: body.type === "appointment"
      ? new Date(body.appointmentAt)
      : null,
    language: body.language || "en",
    notificationEnabled: body.notificationEnabled === true,
    active: body.active !== false,
  };
}

// GET /api/reminders?familyMemberId=...
router.get("/", async (req, res) => {
  try {
    const filter = await profileFilter(
      req,
      res,
      String(req.query.familyMemberId || "").trim()
    );
    if (!filter) return;

    const reminders = await Reminder.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, reminders });
  } catch (error) {
    console.error("List reminders error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load reminders.",
    });
  }
});

// POST /api/reminders
router.post("/", async (req, res) => {
  try {
    const error = validateReminder(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const filter = await profileFilter(
      req,
      res,
      String(req.body.familyMemberId || "").trim()
    );
    if (!filter) return;

    const reminder = await Reminder.create({
      ...buildReminder(req.body),
      ...filter,
    });

    return res.status(201).json({
      success: true,
      reminder,
    });
  } catch (error) {
    console.error("Create reminder error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to create reminder.",
    });
  }
});

// PUT /api/reminders/:id
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reminder ID.",
      });
    }

    const existing = await Reminder.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found.",
      });
    }

    const merged = {
      ...existing.toObject(),
      ...req.body,
    };

    const error = validateReminder(merged);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    // Do not allow ownership or profile reassignment.
    const updates = buildReminder(merged);

    const reminder = await Reminder.findOneAndUpdate(
      { _id: existing._id, userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    return res.json({ success: true, reminder });
  } catch (error) {
    console.error("Update reminder error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update reminder.",
    });
  }
});

// DELETE /api/reminders/:id
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reminder ID.",
      });
    }

    const reminder = await Reminder.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found.",
      });
    }

    return res.json({
      success: true,
      message: "Reminder deleted.",
    });
  } catch (error) {
    console.error("Delete reminder error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete reminder.",
    });
  }
});

module.exports = router;
