/*
  MOCK ABHA linking. A real integration goes through the ABDM gateway (Aadhaar / mobile OTP, then a
  signed profile fetch). The mock follows the same two-step shape - initiate, then verify with an OTP -
  so the app, the API and the data model do not change when the gateway is plugged in:

    initiate({abhaNumber | abhaAddress}) -> { txnId }        (real: ABDM sends an OTP)
    verify({txnId, otp})                 -> user.abha = { number, address, linkedAt }

  The demo OTP is MOCK_ABHA_OTP (default 123456). Nothing here talks to ABDM.
*/
const crypto = require("crypto");
const config = require("../config");

const TXN_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const transactions = new Map(); // txnId -> { userId, number, address, expiresAt, attempts }

/** "91 1234 5678 9012" / "91-1234-5678-9012" / "91123456789012" -> "91-1234-5678-9012", or null. */
function normalizeAbhaNumber(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.length !== 14) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
}

/** username@abdm (or @sbx for the sandbox). Lenient on purpose - the real rules are enforced by ABDM. */
function normalizeAbhaAddress(input) {
  const v = String(input || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._]{2,31}@(abdm|sbx)$/.test(v) ? v : null;
}

function initiate(userId, { abhaNumber, abhaAddress }) {
  const number = abhaNumber ? normalizeAbhaNumber(abhaNumber) : null;
  const address = abhaAddress ? normalizeAbhaAddress(abhaAddress) : null;

  if (abhaNumber && !number) return { error: "ABHA number must have 14 digits (e.g. 91-1234-5678-9012)." };
  if (abhaAddress && !address) return { error: "ABHA address must look like username@abdm." };
  if (!number && !address) return { error: "Enter your 14-digit ABHA number or your ABHA address." };

  const txnId = crypto.randomUUID();
  transactions.set(txnId, { userId: String(userId), number, address, expiresAt: Date.now() + TXN_TTL_MS, attempts: 0 });
  return {
    txnId,
    mock: true,
    message: `Demo mode: no OTP is actually sent. Enter ${config.mockAbhaOtp} to link.`,
  };
}

function verify(userId, { txnId, otp }) {
  const txn = transactions.get(txnId);
  /* A different user's request must not be able to cancel someone else's pending verification. */
  if (!txn || txn.userId !== String(userId)) return { error: "This verification has expired. Please start again." };
  if (txn.expiresAt < Date.now()) {
    transactions.delete(txnId);
    return { error: "This verification has expired. Please start again." };
  }
  txn.attempts += 1;
  if (txn.attempts > MAX_ATTEMPTS) {
    transactions.delete(txnId);
    return { error: "Too many wrong attempts. Please start again." };
  }
  if (String(otp).trim() !== config.mockAbhaOtp) return { error: "Incorrect OTP." };

  transactions.delete(txnId);
  return { abha: { number: txn.number, address: txn.address, linkedAt: new Date(), mock: true } };
}

module.exports = { initiate, verify, normalizeAbhaNumber, normalizeAbhaAddress };
