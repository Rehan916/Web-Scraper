require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectToDatabase } = require("./lib/db");
const { saveProducts } = require("./lib/products-service");

const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: true
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (req, res) => {
  try {
    await connectToDatabase();

    return res.json({
      ok: true,
      databaseConnected: true
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      databaseConnected: false,
      message: error.message
    });
  }
});

app.post("/api/products", async (req, res) => {
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
});

async function start() {
  try {
    await connectToDatabase();
    console.log("MongoDB connected");

    app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Startup failed", error);
    process.exit(1);
  }
}

start();
