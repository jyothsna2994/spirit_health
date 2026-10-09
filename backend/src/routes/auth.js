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

    console.log("================================");
    console.log("NEW USER REGISTERED");
    console.log("Email:", cleanEmail);
    console.log("Password length:", cleanPassword.length);
    console.log("Hash starts with:", hashedPassword.substring(0, 4));
    console.log("User ID:", user._id.toString());
    console.log("================================");

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
      console.log("LOGIN: user not found:", cleanEmail);

      return res.status(401).json({
        success: false,
        message: "Incorrect email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      cleanPassword,
      user.password
    );

    console.log("================================");
    console.log("LOGIN ATTEMPT");
    console.log("Email:", cleanEmail);
    console.log("Password length:", cleanPassword.length);
    console.log(
      "Stored hash starts with:",
      user.password?.substring(0, 4)
    );
    console.log("Password matches:", passwordMatches);
    console.log("================================");

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

module.exports = router;