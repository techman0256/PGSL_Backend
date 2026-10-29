const FinishedProduct = require("../models/FinishedProduct");
const RawMaterial = require("../models/RawMaterial");

// GET /api/inventory/summary
// Returns KPI metrics: Total Finished Products, Total Raw Materials, Low Stock Items
const getInventorySummary = async (req, res) => {
  try {
    const [finishedProducts, rawMaterials] = await Promise.all([
      FinishedProduct.find().lean(),
      RawMaterial.find().lean(),
    ]);

    const productTypes = new Set(finishedProducts.map((p) => p.product));
    const mainProductCount = finishedProducts.filter((p) => !p.isByProduct).length;
    const byProductCount = finishedProducts.filter((p) => p.isByProduct).length;

    const lowStockItems = rawMaterials.filter(
      (m) => m.availableQuantity <= (m.lowStockThreshold || 0)
    );

    return res.status(200).json({
      totalFinishedProducts: {
        count: productTypes.size,
        description: `${productTypes.size} product types`,
        details: `${mainProductCount} main products + ${byProductCount} by-product`,
      },
      totalRawMaterials: {
        count: rawMaterials.length,
        description: `${rawMaterials.length} material types`,
        details: "Ingredients and packaging in inventory",
      },
      lowStockItems: {
        count: lowStockItems.length,
        description: `${lowStockItems.length} materials`,
        items: lowStockItems.map((i) => i.material),
        details: lowStockItems.map((i) => i.material).join(" and ") || "None",
      },
    });
  } catch (error) {
    console.error("Get inventory summary error:", error.message);
    return res.status(500).json({ message: "Failed to fetch inventory summary" });
  }
};

// GET /api/inventory/finished-products
const getFinishedProducts = async (req, res) => {
  try {
    const products = await FinishedProduct.aggregate([
      {
        $group: {
          _id: { product: "$product", unit: "$unit", isByProduct: "$isByProduct" },
          quantity: { $sum: "$quantity" },
          snapshotQuantity: { $sum: "$snapshotQuantity" },
          lastUpdated: { $max: "$lastUpdated" },
        },
      },
      { $sort: { lastUpdated: -1 } },
      {
        $project: {
          _id: 0,
          id: {
            $concat: [
              "$_id.product",
              "-",
              "$_id.unit",
              "-",
              { $cond: ["$_id.isByProduct", "by-product", "main-product"] },
            ],
          },
          product: "$_id.product",
          unit: "$_id.unit",
          isByProduct: "$_id.isByProduct",
          quantity: 1,
          snapshotQuantity: 1,
          lastUpdated: 1,
          processingBatch: "AGGREGATED",
        },
      },
    ]);

    return res.status(200).json({
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Get finished products error:", error.message);
    return res.status(500).json({ message: "Failed to fetch finished products" });
  }
};

// GET /api/inventory/raw-materials
const getRawMaterials = async (req, res) => {
  try {
    const materials = await RawMaterial.find()
      .sort({ material: 1 })
      .lean();

    const formatted = materials.map((m) => ({
      _id: m._id,
      material: m.material,
      availableQuantity: m.availableQuantity,
      unit: m.unit,
      lastUsed: m.lastUsed,
      stockLevel: m.availableQuantity <= (m.lowStockThreshold || 0) ? "Low Stock" : "In Stock",
    }));

    return res.status(200).json({
      count: formatted.length,
      materials: formatted,
    });
  } catch (error) {
    console.error("Get raw materials error:", error.message);
    return res.status(500).json({ message: "Failed to fetch raw materials" });
  }
};

// POST /api/inventory/raw-materials
const addRawMaterial = async (req, res) => {
  try {
    const { material, availableQuantity, unit, lowStockThreshold } = req.body;

    if (!material || availableQuantity == null) {
      return res.status(400).json({ message: "Material name and quantity are required" });
    }

    const existing = await RawMaterial.findOne({
      material: new RegExp(`^${material.trim()}$`, "i"),
    });

    if (existing) {
      return res.status(409).json({ message: "Raw material already exists" });
    }

    const rawMaterial = await RawMaterial.create({
      material: material.trim(),
      availableQuantity: Number(availableQuantity),
      unit: unit || "Kg",
      lowStockThreshold: lowStockThreshold != null ? Number(lowStockThreshold) : 10,
    });

    return res.status(201).json({
      message: "Raw material added successfully",
      material: rawMaterial,
    });
  } catch (error) {
    console.error("Add raw material error:", error.message);
    return res.status(500).json({ message: "Failed to add raw material" });
  }
};

// PUT /api/inventory/raw-materials/:id
const updateRawMaterial = async (req, res) => {
  try {
    const { material, availableQuantity, unit, lowStockThreshold, addQuantity } = req.body;

    const rawMaterial = await RawMaterial.findById(req.params.id);
    if (!rawMaterial) {
      return res.status(404).json({ message: "Raw material not found" });
    }

    if (material) rawMaterial.material = material.trim();
    if (unit) rawMaterial.unit = unit;
    if (lowStockThreshold != null) rawMaterial.lowStockThreshold = Number(lowStockThreshold);

    if (addQuantity != null) {
      rawMaterial.availableQuantity += Number(addQuantity);
    } else if (availableQuantity != null) {
      rawMaterial.availableQuantity = Number(availableQuantity);
    }

    await rawMaterial.save();

    return res.status(200).json({
      message: "Raw material updated successfully",
      material: rawMaterial,
    });
  } catch (error) {
    console.error("Update raw material error:", error.message);
    return res.status(500).json({ message: "Failed to update raw material" });
  }
};

// DELETE /api/inventory/raw-materials/:id
const deleteRawMaterial = async (req, res) => {
  try {
    const rawMaterial = await RawMaterial.findById(req.params.id);
    if (!rawMaterial) {
      return res.status(404).json({ message: "Raw material not found" });
    }

    await rawMaterial.deleteOne();

    return res.status(200).json({ message: "Raw material deleted successfully" });
  } catch (error) {
    console.error("Delete raw material error:", error.message);
    return res.status(500).json({ message: "Failed to delete raw material" });
  }
};

module.exports = {
  getInventorySummary,
  getFinishedProducts,
  getRawMaterials,
  addRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
};
