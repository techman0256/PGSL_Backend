const mongoose = require("mongoose");

const rawMaterialSchema = new mongoose.Schema(
  {
    material: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    availableQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    lastUsed: {
      type: Date,
      default: null,
    },

    lowStockThreshold: {
      type: Number,
      default: 10,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

rawMaterialSchema.virtual("stockLevel").get(function () {
  return this.availableQuantity <= this.lowStockThreshold ? "Low Stock" : "In Stock";
});

module.exports = mongoose.model("RawMaterial", rawMaterialSchema);
