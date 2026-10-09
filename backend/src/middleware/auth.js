const jwt = require("jsonwebtoken");
const config = require("../config");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/** Every health-data route sits behind this: the user comes from the signed token, never from the request body. */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: "Please log in to continue." });

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ success: false, message: "Account not found. Please log in again." });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Your session has expired. Please log in again." });
  }
}

function publicUser(user) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    preferredLanguage: user.preferredLanguage || "en",
    gender: user.gender || "",
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : "",
    abha: user.abha?.number || user.abha?.address
      ? { number: user.abha.number || "", address: user.abha.address || "", linkedAt: user.abha.linkedAt, mock: Boolean(user.abha.mock) }
      : null,
  };
}

module.exports = { requireAuth, signToken, publicUser };
