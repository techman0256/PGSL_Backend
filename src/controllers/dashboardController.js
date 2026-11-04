const MilkBatch = require("../models/MilkBatch");
const Processing = require("../models/Processing");
const Dispatch = require("../models/Dispatch");
const FinishedProduct = require("../models/FinishedProduct");
const RawMaterial = require("../models/RawMaterial");

const PLANT_OFFSET_MINUTES = 5 * 60 + 30;

const getDayBounds = (dateValue) => {
  const plantNow = new Date(Date.now() + PLANT_OFFSET_MINUTES * 60 * 1000);
  const value = dateValue || plantNow.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date must use YYYY-MM-DD format");
  }

  const [year, month, day] = value.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new Error("Date is invalid");
  }

  const start = new Date(calendarDate.getTime() - PLANT_OFFSET_MINUTES * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { date: value, start, end };
};

const numberValue = (value) => Number(value?.toString?.() ?? value ?? 0);

const sumBy = (items, key, valueKey, unitKey) => {
  const grouped = new Map();
  for (const item of items) {
    const name = item[key] || "Unknown";
    const unit = unitKey ? item[unitKey] || "" : "";
    const groupKey = `${name}|${unit}`;
    const current = grouped.get(groupKey) || { name, unit, quantity: 0 };
    current.quantity += numberValue(item[valueKey]);
    grouped.set(groupKey, current);
  }
  return [...grouped.values()].map((item) => ({
    ...item,
    quantity: Number(item.quantity.toFixed(2)),
  }));
};

const getDashboardSummary = async (req, res) => {
  try {
    const { date, start, end } = getDayBounds(req.query.date);
    const [receptions, processing, dispatches, finishedProducts, rawMaterials] =
      await Promise.all([
        MilkBatch.find({ receivedAt: { $gte: start, $lt: end } }).sort({ receivedAt: -1 }).lean(),
        Processing.find({
          processingDate: { $gte: start, $lt: end },
          isByProduct: { $ne: true },
        }).sort({ processingDate: -1 }).lean(),
        Dispatch.find({ dispatchDate: { $gte: start, $lt: end } }).sort({ dispatchDate: -1 }).lean(),
        FinishedProduct.aggregate([
          {
            $group: {
              _id: { product: "$product", unit: "$unit", isByProduct: "$isByProduct" },
              quantity: { $sum: "$quantity" },
            },
          },
          { $sort: { "_id.product": 1, "_id.unit": 1 } },
        ]),
        RawMaterial.find().sort({ material: 1 }).lean(),
      ]);

    const milkByType = sumBy(receptions, "milkType", "quantity").map((item) => ({
      ...item,
      name: item.name.charAt(0) + item.name.slice(1).toLowerCase(),
      unit: "L",
    }));
    const processingByProduct = sumBy(processing, "productType", "outputQuantity", "outputUnit");
    const dispatchByProduct = sumBy(dispatches, "product", "quantity", "unit");
    const finished = finishedProducts
      .filter((item) => !item._id.isByProduct)
      .map((item) => ({
        name: item._id.product,
        unit: item._id.unit,
        quantity: Number(numberValue(item.quantity).toFixed(2)),
      }));
    const materials = rawMaterials.map((item) => ({
      name: item.material,
      unit: item.unit,
      quantity: item.availableQuantity,
      low: item.availableQuantity <= (item.lowStockThreshold || 0),
    }));

    const activities = [
      ...receptions.map((item) => ({
        date: item.receivedAt,
        stage: "Milk Reception",
        record: `${item.milkBatchId} · ${item.milkType}`,
        quantity: `${numberValue(item.quantity)} L`,
        status: "Received",
      })),
      ...processing.map((item) => ({
        date: item.processingDate,
        stage: "Processing",
        record: `${item.processingId} · ${item.productType}`,
        quantity: `${item.outputQuantity} ${item.outputUnit}`,
        status: "Processed",
      })),
      ...dispatches.map((item) => ({
        date: item.dispatchDate,
        stage: "Dispatch",
        record: `${item.dispatchId} · ${item.product}`,
        quantity: `${item.quantity} ${item.unit}`,
        status: "Dispatched",
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      date,
      timezone: "Asia/Kolkata",
      milkReceived: {
        total: Number(receptions.reduce((total, item) => total + numberValue(item.quantity), 0).toFixed(2)),
        unit: "L",
        byType: milkByType,
      },
      processing: { products: processingByProduct },
      dispatch: { products: dispatchByProduct },
      inventory: { finishedProducts: finished, rawMaterials: materials },
      activities,
    });
  } catch (error) {
    console.error("Get dashboard summary error:", error.message);
    return res.status(400).json({ message: error.message || "Failed to fetch dashboard summary" });
  }
};

module.exports = { getDashboardSummary };
