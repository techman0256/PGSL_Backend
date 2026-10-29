const mongoose = require("mongoose");

const rawMaterialUsageSchema = new mongoose.Schema(
  {
    material: {
      type: String,
      required: true,
      trim: true,
    },
    quantityUsed: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const byProductSchema = new mongoose.Schema(
  {
    byProduct: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
      enum: ["L", "Kg"],
      default: "L",
    },
  },
  { _id: false }
);

const processingSchema = new mongoose.Schema(
  {
    processingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    milkBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MilkBatch",
    },

    storageRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MilkStorageRecord",
    },

    inputMilkBatch: {
      type: String,
      required: true,
      trim: true,
    },

    milkType: {
      type: String,
      required: true,
      trim: true,
    },

    inputQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    processingDate: {
      type: Date,
      required: true,
    },

    processingTime: {
      type: String,
      required: true,
      trim: true,
    },

    productType: {
      type: String,
      required: true,
      trim: true,
    },

    outputQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    outputUnit: {
      type: String,
      required: true,
      enum: ["L", "Kg"],
      default: "L",
    },

    rawMaterialsUsed: [rawMaterialUsageSchema],

    byProducts: [byProductSchema],

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

module.exports = mongoose.model("Processing", processingSchema);
