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
    sourceUrl: {
      type: String,
      required: true,
      trim: true
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
