const mongoose = require("mongoose");

const sourceSchema = new mongoose.Schema(
  {
    recordId: String,
    title: String,
    date: String,
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
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
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    sources: {
      type: [sourceSchema],
      default: [],
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({
  userId: 1,
  familyMemberId: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "ChatMessage",
  chatMessageSchema
);
