const mongoose = require("mongoose");

const milkBatchSchema = new mongoose.Schema(
  {
    milkBatchId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    milkType: {
      type: String,
      required: true,
      enum: ["COW", "GOAT", "BUFFALO", "SAHIWAL"],
    },

    quantity: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      validate: {
        validator: (value) => value != null && Number(value.toString()) > 0,
        message: "Quantity must be greater than zero",
      },
    },

    receivedAt: {
      type: Date,
      required: true,
    },

    shift: {
      type: String,
      required: true,
      enum: ["MORNING", "EVENING"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("MilkBatch", milkBatchSchema);
