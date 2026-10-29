const mongoose = require("mongoose");

const dispatchSchema = new mongoose.Schema(
  {
    dispatchId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    product: {
      type: String,
      required: true,
      trim: true,
    },

    processingBatchId: {
      type: String,
      required: true,
      trim: true,
    },

    finishedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinishedProduct",
    },

    quantity: {
      type: Number,
      required: true,
      min: [0.01, "Quantity must be greater than zero"],
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    customer: {
      type: String,
      required: true,
      trim: true,
    },

    channel: {
      type: String,
      required: true,
      enum: ["Retail", "Wholesale", "Distributor"],
    },

    dispatchDate: {
      type: Date,
      required: true,
    },

    dispatchTime: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Dispatch", dispatchSchema);
