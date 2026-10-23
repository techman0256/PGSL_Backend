const mongoose = require("mongoose");

const milkStorageRecordSchema = new mongoose.Schema(
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

    milkType: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    siloNumber: {
      type: String,
      required: true,
      trim: true,
    },

    storageTemperature: {
      type: Number,
      required: true,
    },

    storageDate: {
      type: Date,
      required: true,
    },

    storageTime: {
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

module.exports = mongoose.model("MilkStorageRecord", milkStorageRecordSchema);
