const { connectToDatabase } = require("../lib/db");
const { saveProducts } = require("../lib/products-service");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    await connectToDatabase();
    const { products } = req.body || {};

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "products must be a non-empty array"
      });
    }

    const result = await saveProducts(products);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Failed to save products", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};
