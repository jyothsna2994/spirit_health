const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken, publicUser } = require("../middleware/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, gender } = req.body || {};

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required.",
      });
    }

    const cleanName = String(fullName).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: "Please enter your full name.",
      });
    }

    // Correct email validation
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) { 
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters.",
      });
    }

    const existingUser = await User.findOne({
      email: cleanEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists. Please login.",
      });
    }

    // Create bcrypt hash
    const hashedPassword = await bcrypt.hash(cleanPassword,10);

    const user = await User.create({
      fullName: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      gender: gender || "",
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: publicUser(user),
      token: signToken(user),
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      success: false,
      message: "Could not create your account.",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);

    const user = await User.findOne({
      email: cleanEmail,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      cleanPassword,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password.",
      });
    }

    res.json({
      success: true,
      message: "Login successful.",
      user: publicUser(user),
      token: signToken(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
});

// ==========================================
// FORGOT PASSWORD - SEND RESET CODE
// ==========================================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({
      email: cleanEmail,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email.",
      });
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // Code valid for 10 minutes
    const resetCodeExpires = new Date(
      Date.now() + 10 * 60 * 1000
    );

    user.resetCode = resetCode;
    user.resetCodeExpires = resetCodeExpires;

    await user.save();

    console.log(
      `PASSWORD RESET CODE for ${cleanEmail}: ${resetCode}`
    );

    // Demo/local version:
    // The code is returned so we can test without email service.
    res.json({
      success: true,
      message: "Reset code generated successfully.",
      resetCode: resetCode,
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    res.status(500).json({
      success: false,
      message: "Could not generate reset code.",
    });
  }
});


// ==========================================
// RESET PASSWORD
// ==========================================
router.post("/reset-password", async (req, res) => {
  try {
    const {
      email,
      resetCode,
      newPassword,
    } = req.body || {};

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Email, reset code and new password are required.",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(resetCode).trim();
    const cleanPassword = String(newPassword);

    if (cleanPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "New password must contain at least 6 characters.",
      });
    }

    const user = await User.findOne({
      email: cleanEmail,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email.",
      });
    }

    // Check code
    if (
      !user.resetCode ||
      user.resetCode !== cleanCode
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset code.",
      });
    }

    // Check expiry
    if (
      !user.resetCodeExpires ||
      user.resetCodeExpires < new Date()
    ) {
      user.resetCode = null;
      user.resetCodeExpires = null;

      await user.save();

      return res.status(400).json({
        success: false,
        message:
          "Reset code has expired. Please request a new code.",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(
      cleanPassword,
      10
    );

    user.password = hashedPassword;

    // Clear reset code after successful reset
    user.resetCode = null;
    user.resetCodeExpires = null;

    await user.save();

    res.json({
      success: true,
      message:
        "Password reset successfully. Please login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    res.status(500).json({
      success: false,
      message: "Could not reset password.",
    });
  }
});
module.exports = router;