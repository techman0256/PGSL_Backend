const mongoose = require("mongoose");

const milkQualityTestSchema = new mongoose.Schema(
  {
    milkBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MilkBatch",
      required: true,
      unique: true,
    },

    batchId: {
      type: String,
      required: true,
      trim: true,
    },

    fat: {
      type: Number,
      required: true,
    },

    snf: {
      type: Number,
      required: true,
    },

    temperature: {
      type: Number,
      required: true,
    },

    testDate: {
      type: Date,
      required: true,
    },

    testTime: {
      type: String,
      required: true,
      trim: true,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("MilkQualityTest", milkQualityTestSchema);
