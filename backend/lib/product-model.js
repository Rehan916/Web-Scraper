const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: String,
      default: "N/A",
      trim: true
    },
    imageUrl: {
      type: String,
      default: "",
      trim: true
    },
    imageUrls: {
      type: [String],
      default: []
    },
    category: {
      type: String,
      default: "",
      trim: true
    },
    categoryPath: {
      type: String,
      default: "",
      trim: true
    },
    sourceUrl: {
      type: String,
      required: true,
      trim: true
    },
    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    dimensions: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    scrapedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false,
    timestamps: true
  }
);

productSchema.index({ title: 1, sourceUrl: 1 }, { unique: true });

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema);
