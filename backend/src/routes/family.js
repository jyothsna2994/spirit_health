const express = require("express");
const mongoose = require("mongoose");
const FamilyMember = require("../models/FamilyMember");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// All family routes require login
router.use(requireAuth);

// ==========================================
// GET ALL FAMILY MEMBERS
// ==========================================
router.get("/", async (req, res) => {
  try {
    const members = await FamilyMember.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      members,
    });
  } catch (error) {
    console.error("Get family members error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not load family members.",
    });
  }
});

// ==========================================
// ADD FAMILY MEMBER
// ==========================================
router.post("/", async (req, res) => {
  try {
    const { fullName, relationship, age, gender } = req.body || {};

    const name = String(fullName || "").trim();
    const relation = String(relationship || "").trim();

    if (!name || !relation) {
      return res.status(400).json({
        success: false,
        message: "Name and relationship are required.",
      });
    }

    if (name.length > 100 || relation.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name or relationship is too long.",
      });
    }

    const hasAge = age !== undefined && age !== null &&
      String(age).trim() !== "";

    const parsedAge = hasAge ? Number(age) : null;

    if (
      hasAge &&
      (!Number.isInteger(parsedAge) ||
        parsedAge < 0 ||
        parsedAge > 120)
    ) {
      return res.status(400).json({
        success: false,
        message: "Age must be a whole number between 0 and 120.",
      });
    }

    const member = await FamilyMember.create({
      userId: req.user._id,
      fullName: name,
      relationship: relation,
      age: parsedAge,
      gender: String(gender || "").trim().slice(0, 50),
    });

    return res.status(201).json({
      success: true,
      message: "Family member added successfully.",
      member,
    });
  } catch (error) {
    console.error("Add family member error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not add family member.",
    });
  }
});

// ==========================================
// UPDATE FAMILY MEMBER
// ==========================================
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid family member ID.",
      });
    }

    const { fullName, relationship, age, gender } = req.body || {};
    const updates = {};

    if (fullName !== undefined) {
      const name = String(fullName || "").trim();

      if (!name || name.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid name.",
        });
      }

      updates.fullName = name;
    }

    if (relationship !== undefined) {
      const relation = String(relationship || "").trim();

      if (!relation || relation.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid relationship.",
        });
      }

      updates.relationship = relation;
    }

    if (age !== undefined) {
      const hasAge = age !== null && String(age).trim() !== "";
      const parsedAge = hasAge ? Number(age) : null;

      if (
        hasAge &&
        (!Number.isInteger(parsedAge) ||
          parsedAge < 0 ||
          parsedAge > 120)
      ) {
        return res.status(400).json({
          success: false,
          message: "Age must be between 0 and 120.",
        });
      }

      updates.age = parsedAge;
    }

    if (gender !== undefined) {
      updates.gender = String(gender || "").trim().slice(0, 50);
    }

    const member = await FamilyMember.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
      },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Family member not found.",
      });
    }

    return res.json({
      success: true,
      message: "Family member updated successfully.",
      member,
    });
  } catch (error) {
    console.error("Update family member error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not update family member.",
    });
  }
});

// ==========================================
// DELETE FAMILY MEMBER
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid family member ID.",
      });
    }

    const member = await FamilyMember.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Family member not found.",
      });
    }

    return res.json({
      success: true,
      message: "Family member deleted successfully.",
    });
  } catch (error) {
    console.error("Delete family member error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not delete family member.",
    });
  }
});

module.exports = router;
