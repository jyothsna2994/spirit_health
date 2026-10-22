
const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const { signToken, publicUser } = require("../middleware/auth");

const router = express.Router();

// ==========================================
// REGISTER
// ==========================================
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
        message: "An account with this email already exists. Please login.",
      });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const user = await User.create({
      fullName: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      gender: gender || "",
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: publicUser(user),
      token: signToken(user),
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not create your account.",
    });
  }
});

// ==========================================
// LOGIN
// ==========================================
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

    return res.json({
      success: true,
      message: "Login successful.",
      user: publicUser(user),
      token: signToken(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
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

    // Do not reveal whether an account exists
    if (!user) {
      return res.json({
        success: true,
        message:
          "If an account exists with this email, a reset code has been sent.",
      });
    }

    // Generate a secure 6-digit reset code
    const resetCode = crypto.randomInt(100000, 1000000).toString();

    // Code valid for 10 minutes
    const resetCodeExpires = new Date(
      Date.now() + 10 * 60 * 1000
    );

    if (!process.env.BREVO_API_KEY) {
      console.error("BREVO_API_KEY is missing");
      return res.status(500).json({
        success: false,
        message: "Could not send reset code. Please try again.",
      });
    }

    // Send reset code using Brevo HTTPS API
    const emailResponse = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "Spirit Health",
            email: "spirithealthteam@gmail.com",
          },
          to: [
            {
              email: user.email,
            },
          ],
          subject: "Spirit Health - Password Reset Code",
          textContent: `Hello ${user.fullName},

Your Spirit Health password reset code is:

${resetCode}

This code is valid for 10 minutes.

If you did not request a password reset, please ignore this email.

Regards,
Spirit Health Team`,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();

      console.error(
        "Brevo email error:",
        emailResponse.status,
        errorText
      );

      throw new Error("Brevo could not send the reset email.");
    }

    // Save the code after Brevo accepts the email
    user.resetCode = resetCode;
    user.resetCodeExpires = resetCodeExpires;
    await user.save();

    console.log("Brevo accepted password reset email request");

    return res.json({
      success: true,
      message:
        "If an account exists with this email, a reset code has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not send reset code. Please try again.",
    });
  }
});

// ==========================================
// RESET PASSWORD
// ==========================================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body || {};

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, reset code and new password are required.",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(resetCode).trim();
    const cleanPassword = String(newPassword);

    if (cleanPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must contain at least 6 characters.",
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

    if (!user.resetCode || user.resetCode !== cleanCode) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset code.",
      });
    }

    if (
      !user.resetCodeExpires ||
      user.resetCodeExpires < new Date()
    ) {
      user.resetCode = null;
      user.resetCodeExpires = null;

      await user.save();

      return res.status(400).json({
        success: false,
        message: "Reset code has expired. Please request a new code.",
      });
    }

    const hashedPassword = await bcrypt.hash(
      cleanPassword,
      10
    );

    user.password = hashedPassword;

    user.resetCode = null;
    user.resetCodeExpires = null;

    await user.save();

    return res.json({
      success: true,
      message:
        "Password reset successfully. Please login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not reset password.",
    });
  }
});

module.exports = router;
