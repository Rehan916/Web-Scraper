const Product = require("./product-model");

function normalizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((acc, [key, rawValue]) => {
    const normalizedKey = String(key || "").trim();
    const normalizedValue = String(rawValue || "").trim();

    if (normalizedKey && normalizedValue) {
      acc[normalizedKey] = normalizedValue;
    }

    return acc;
  }, {});
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce((acc, item) => {
    const normalizedItem = String(item || "").trim();

    if (normalizedItem && !acc.includes(normalizedItem)) {
      acc.push(normalizedItem);
    }

    return acc;
  }, []);
}

function normalizeProducts(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  return products
    .map((product) => ({
      title: String(product.title || "").trim(),
      price: String(product.price || "N/A").trim(),
      imageUrl: String(product.imageUrl || "").trim(),
      imageUrls: normalizeStringArray(product.imageUrls),
      category: String(product.category || "").trim(),
      categoryPath: String(product.categoryPath || "").trim(),
      sourceUrl: String(product.sourceUrl || "").trim(),
      specifications: normalizeObject(product.specifications),
      dimensions: normalizeObject(product.dimensions),
      scrapedAt: product.scrapedAt ? new Date(product.scrapedAt) : new Date()
    }))
    .filter((product) => product.title && product.sourceUrl && !Number.isNaN(product.scrapedAt.valueOf()));
}

async function saveProducts(products) {
  const normalizedProducts = normalizeProducts(products);

  if (normalizedProducts.length === 0) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        message: "No valid products found in payload"
      }
    };
  }

  const operations = normalizedProducts.map((product) => ({
    updateOne: {
      filter: {
        title: product.title,
        sourceUrl: product.sourceUrl
      },
      update: {
        $set: product
      },
      upsert: true
    }
  }));

  const result = await Product.bulkWrite(operations, { ordered: false });

  return {
    ok: true,
    status: 200,
    body: {
      success: true,
      received: normalizedProducts.length,
      inserted: result.upsertedCount || 0,
      updated: result.modifiedCount || 0
    }
  };
}

module.exports = {
  normalizeProducts,
  saveProducts
};
