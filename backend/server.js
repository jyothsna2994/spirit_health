const config = require("./src/config"); // loads .env first
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");

const { generate } = require("./src/services/gemini");

const app = express();
const corsOrigins = (process.env.CORS_ORIGINS || (config.isProduction ? "" : "*"))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (config.isProduction && corsOrigins.length === 0) {
  throw new Error("CORS_ORIGINS must be configured in production.");
}

app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || corsOrigins.includes("*") || corsOrigins.includes(origin));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

/* ---------- public ---------- */

app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    message: "Spirit Health Backend is running",
    database: databaseConnected ? "connected" : "not connected",
    mockAi: config.mockAi,
  });
});

/* Development helper only - it spends Gemini quota, so it is not exposed in production. */
app.get("/api/ai-test", async (req, res) => {
  if (config.isProduction) return res.status(404).json({ success: false, message: "Not found" });
  try {
    if (config.mockAi) return res.json({ success: true, message: "MOCK_AI is on - Gemini is not being called." });
    const { text, model } = await generate({
      contents: "Reply with exactly: Gemini AI connection successful",
      timeoutMs: config.textTimeoutMs,
    });
    res.json({ success: true, message: text, model });
  } catch (error) {
    console.error("Gemini test failed:", error.message);
    res.status(500).json({ success: false, message: "Gemini AI request failed", error: error.message });
  }
});

app.use("/api/auth", require("./src/routes/auth"));

/* ---------- authenticated (JWT) ---------- */

app.use("/api", require("./src/routes/records"));
app.use("/api", require("./src/routes/profile"));

/* ---------- errors ---------- */

app.use((req, res) => res.status(404).json({ success: false, message: "Not found" }));

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const tooBig = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooBig ? 413 : 400).json({ success: false, message: tooBig ? "File is too large. The limit is 10 MB." : error.message });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON in request body." });
  }
  if (error.message === "Only JPG, PNG and PDF files are allowed") {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error("SERVER ERROR:", error);
  res.status(500).json({ success: false, message: "Server error", ...(config.isProduction ? {} : { error: error.message }) });
});

/* ---------- start ---------- */
async function connectMongoDB() {
  if (!config.mongoUri) {
    throw new Error("MONGODB_URI must be configured before starting the API.");
  }

  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log("MongoDB connected:", mongoose.connection.host, "/", mongoose.connection.name);
    console.log("MongoDB readyState:", mongoose.connection.readyState);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.error("MongoDB readyState:", mongoose.connection.readyState);
    throw error;
  }
}

if (require.main === module) {
  connectMongoDB().then(() => {
    app.listen(config.port, "0.0.0.0", () => {
      console.log(`Spirit Health Backend running on http://localhost:${config.port}`);
      console.log(config.mockAi ? "MOCK_AI is ON - Gemini will not be called" : `Gemini API key loaded: ${!!config.geminiApiKey}`);
    });
  }).catch((error) => {
    console.error("Backend startup aborted:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, connectMongoDB };
