const BatchCounter = require("../models/BatchCounter");

/**
 * Generates an auto-incrementing sequential ERP ID formatted as:
 *   [PREFIX]-[YYYYMMDD]-[XXX]
 *
 * For example:
 *   MR-20261007-004  (Milk Reception)
 *   MP-20261007-006  (Milk Processing)
 *   DS-20261007-006  (Dispatch)
 */
const generateSequenceId = async (prefix, date = new Date()) => {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date(date);
  const validDate = Number.isNaN(d.getTime()) ? new Date() : d;

  const datePart = [
    validDate.getFullYear(),
    String(validDate.getMonth() + 1).padStart(2, "0"),
    String(validDate.getDate()).padStart(2, "0"),
  ].join("");

  // To preserve backwards compatibility with existing MR counter records (which used datePart directly):
  const counterId = prefix === "MR" ? datePart : `${prefix}-${datePart}`;

  const counter = await BatchCounter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { sequence: 1 } },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return `${prefix}-${datePart}-${String(counter.sequence).padStart(3, "0")}`;
};

module.exports = { generateSequenceId };
