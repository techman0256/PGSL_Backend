const mongoose = require("mongoose");

const finishedProductSchema = new mongoose.Schema(
  {
    product: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    snapshotQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    processingBatch: {
      type: String,
      required: true,
      trim: true,
    },

    processingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Processing",
    },

    isByProduct: {
      type: Boolean,
      default: false,
    },

    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("FinishedProduct", finishedProductSchema);
