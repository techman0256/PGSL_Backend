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

    milkLeft: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      validate: {
        validator: (value) => value != null && Number(value.toString()) >= 0,
        message: "Milk left cannot be negative",
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

milkBatchSchema.pre("validate", function () {
  if (this.isNew && this.milkLeft == null && this.quantity != null) {
    this.milkLeft = this.quantity;
  }
});

module.exports = mongoose.model("MilkBatch", milkBatchSchema);
