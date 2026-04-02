const API_BASE_URL = "http://localhost:3000";

const scrapeButton = document.getElementById("scrapeBtn");
const statusEl = document.getElementById("status");

scrapeButton.addEventListener("click", async () => {
  const originalText = scrapeButton.innerText;

  try {
    setStatus("Scraping page data...");
    scrapeButton.innerText = "Scraping...";
    scrapeButton.disabled = true;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      throw new Error("No active tab found.");
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: autoScrollAndScrape
    });

    const products = results?.[0]?.result;

    if (!Array.isArray(products) || products.length === 0) {
      throw new Error("No products detected on this page.");
    }

    const payload = {
      products: products.map((product) => ({
        title: product.title,
        price: product.price,
        imageUrl: product.imageUrl || "",
        imageUrls: Array.isArray(product.imageUrls) ? product.imageUrls : [],
        category: product.category || "",
        categoryPath: product.categoryPath || "",
        sourceUrl: product.sourceUrl || tab.url || "",
        scrapedAt: product.scrapedAt || new Date().toISOString(),
        specifications: product.specifications || {},
        dimensions: product.dimensions || {}
      }))
    };

    setStatus(`Saving ${payload.products.length} products to MongoDB...`);

    const response = await fetch(`${API_BASE_URL}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Failed to save products.");
    }

    setStatus(`Saved ${data.inserted || payload.products.length} products successfully.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Something went wrong.");
  } finally {
    scrapeButton.innerText = originalText;
    scrapeButton.disabled = false;
  }
});

function setStatus(message) {
  statusEl.textContent = message;
}

async function autoScrollAndScrape() {
  const MAX_SCROLLS = 8;
  const SCROLL_WAIT_MS = 1200;
  let scrollCount = 0;

  await new Promise((resolve) => {
    function scrollPage() {
      const lastHeight = document.documentElement.scrollHeight;
      window.scrollTo(0, lastHeight);

      setTimeout(() => {
        const newHeight = document.documentElement.scrollHeight;
        let didLoadMore = false;

        const loadMoreStr = /load\s*more|show\s*more|view\s*more/i;
        const buttons = Array.from(document.querySelectorAll("button, a")).filter((button) =>
          loadMoreStr.test(button.innerText || button.textContent || "")
        );

        if (buttons.length > 0 && typeof buttons[0].click === "function") {
          try {
            buttons[0].click();
            didLoadMore = true;
          } catch (error) {
            console.debug("Load more click failed", error);
          }
        }

        if ((newHeight > lastHeight || didLoadMore) && scrollCount < MAX_SCROLLS) {
          scrollCount += 1;
          scrollPage();
          return;
        }

        resolve();
      }, SCROLL_WAIT_MS);
    }

    scrollPage();
  });

  const products = [];
  const seenTitles = new Set();

  const toAbsoluteUrl = (value) => {
    if (!value) {
      return "";
    }

    try {
      return new URL(value, window.location.href).href;
    } catch (error) {
      return "";
    }
  };

  const getImageFromElement = (element) => {
    if (!element || typeof element.querySelectorAll !== "function") {
      return "";
    }

    const img = element.querySelector("img");

    if (!img) {
      return "";
    }

    const candidates = [
      img.currentSrc,
      img.src,
      img.getAttribute("data-src"),
      img.getAttribute("data-lazy-src"),
      img.getAttribute("data-original"),
      img.getAttribute("data-image"),
      img.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0]
    ];

    return toAbsoluteUrl(candidates.find((candidate) => candidate && !candidate.startsWith("data:")));
  };

  const isLikelyProductTitle = (value) => {
    const text = cleanText(value || "");

    if (!text || text.length < 6 || text.length > 220) {
      return false;
    }

    const blockedPatterns = [
      /financing available/i,
      /free shipping/i,
      /recommended/i,
      /sort by/i,
      /grid/i,
      /list view/i,
      /open-box/i,
      /^shop\b/i,
      /^home\b/i
    ];

    return !blockedPatterns.some((pattern) => pattern.test(text));
  };

  const isLikelyProductPrice = (value) => {
    const text = cleanText(value || "");

    if (!text || text.length > 80) {
      return false;
    }

    if (/financing available/i.test(text)) {
      return false;
    }

    return regexPrice.test(text);
  };

  const isLikelyProductImage = (value) => {
    const url = String(value || "").toLowerCase();

    if (!url) {
      return false;
    }

    const blockedPatterns = [/logo/i, /branding/i, /sprite/i, /icon/i, /\.svg(\?|$)/i];

    return !blockedPatterns.some((pattern) => pattern.test(url));
  };

  const uniqueUrls = (values) =>
    values.filter((value, index) => value && values.indexOf(value) === index);

  const normalizeGalleryImageUrl = (value) => {
    const absoluteUrl = toAbsoluteUrl(value);

    if (!absoluteUrl) {
      return "";
    }

    try {
      const url = new URL(absoluteUrl);
      url.search = "";
      return url.href;
    } catch (error) {
      return absoluteUrl.split("?")[0];
    }
  };

  const isProductDetailPage = () => /\/i\/\d+\//i.test(window.location.pathname);

  const getProductImageUrls = (element = document) => {
    const gallerySelectors = [
      "#image-gallery a[href]",
      '[aria-label*="Product image thumbnails" i] a[href]',
      ".image-carousel-container a[href]",
      ".carousel__images a[href]",
      "#selected-image img",
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'meta[property="twitter:image"]',
      'meta[itemprop="image"]'
    ];

    const urls = [];

    gallerySelectors.forEach((selector) => {
      const nodes = Array.from(element.querySelectorAll(selector));

      nodes.forEach((node) => {
        const candidates = [
          node.getAttribute?.("href"),
          node.getAttribute?.("content"),
          node.currentSrc,
          node.src,
          node.getAttribute?.("data-src"),
          node.getAttribute?.("data-lazy-src"),
          node.getAttribute?.("data-original"),
          node.getAttribute?.("data-image"),
          node.getAttribute?.("srcset")?.split(",")[0]?.trim().split(" ")[0]
        ];

        candidates.forEach((candidate) => {
          const normalized = normalizeGalleryImageUrl(candidate);

          if (normalized) {
            urls.push(normalized);
          }
        });
      });
    });

    if (urls.length === 0) {
      const imageUrl = getImageFromElement(element);

      if (imageUrl) {
        urls.push(normalizeGalleryImageUrl(imageUrl));
      }
    }

    return uniqueUrls(urls);
  };

  const getPageImage = () => {
    const metaSelectors = [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'meta[property="twitter:image"]',
      'meta[itemprop="image"]'
    ];

    for (const selector of metaSelectors) {
      const content = document.querySelector(selector)?.getAttribute("content");
      const imageUrl = toAbsoluteUrl(content);

      if (imageUrl) {
        return imageUrl;
      }
    }

    return getImageFromElement(document);
  };

  const addProduct = (title, price, imageUrl = "", element = document) => {
    const normalizedTitle = (title || "").trim();
    const normalizedPrice = (price || "N/A").trim();
    const scopedImageUrls = getProductImageUrls(element);
    const pageGalleryImageUrls = isProductDetailPage() ? getProductImageUrls(document) : [];
    const scrapedImageUrls = uniqueUrls([
      ...scopedImageUrls,
      ...(element === document ? pageGalleryImageUrls : [])
    ]);
    const normalizedImageUrl = normalizeGalleryImageUrl(imageUrl) || scrapedImageUrls[0] || "";
    const categoryPath = extractCategoryPath();
    const category = categoryPath ? categoryPath.split(" > ").pop() || "" : "";
    const specifications = extractSectionData("Specifications");
    const dimensions = extractSectionData("Dimensions");

    if (!isLikelyProductTitle(normalizedTitle)) {
      return;
    }

    if (normalizedPrice !== "N/A" && !isLikelyProductPrice(normalizedPrice)) {
      return;
    }

    if (!isLikelyProductImage(normalizedImageUrl)) {
      return;
    }

    const dedupeKey = normalizedTitle.toLowerCase();

    if (seenTitles.has(dedupeKey)) {
      return;
    }

    seenTitles.add(dedupeKey);
    products.push({
      title: normalizedTitle,
      price: normalizedPrice,
      imageUrl: normalizedImageUrl,
      imageUrls: uniqueUrls([normalizedImageUrl, ...scrapedImageUrls]),
      category,
      categoryPath,
      sourceUrl: window.location.href,
      scrapedAt: new Date().toISOString(),
      specifications,
      dimensions
    });
  };

  const extractCategoryPath = () => {
    const selectors = [
      'nav[aria-label*="breadcrumb" i]',
      '[data-testid*="breadcrumb" i]',
      '[class*="breadcrumb" i]',
      '[class*="crumb" i]',
      'ol[itemscope][itemtype*="BreadcrumbList"]',
      'ul[itemscope][itemtype*="BreadcrumbList"]'
    ];

    for (const selector of selectors) {
      const container = document.querySelector(selector);

      if (!container) {
        continue;
      }

      const parts = Array.from(container.querySelectorAll("a, span, li"))
        .map((node) => cleanText(node.innerText || node.textContent || ""))
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .filter((value) => value.length <= 120);

      if (parts.length >= 2) {
        return parts.join(" > ");
      }
    }

    const jsonLdBreadcrumb = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((script) => {
        try {
          return JSON.parse(script.innerText);
        } catch (error) {
          return null;
        }
      })
      .flatMap((item) => {
        if (!item) {
          return [];
        }

        if (Array.isArray(item)) {
          return item;
        }

        if (item["@graph"]) {
          return item["@graph"];
        }

        return [item];
      })
      .find((item) => item?.["@type"] === "BreadcrumbList" && Array.isArray(item.itemListElement));

    if (jsonLdBreadcrumb) {
      const parts = jsonLdBreadcrumb.itemListElement
        .map((entry) => cleanText(entry?.name || entry?.item?.name || ""))
        .filter(Boolean);

      if (parts.length >= 2) {
        return parts.join(" > ");
      }
    }

    return "";
  };

  const extractSectionData = (sectionTitle) => {
    const normalizedSectionTitle = sectionTitle.toLowerCase();
    const directContainer =
      document.querySelector(`#${normalizedSectionTitle}`) ||
      document.querySelector(`[data-testid='${normalizedSectionTitle}']`) ||
      document.querySelector(`[aria-label='${sectionTitle}']`);

    if (directContainer) {
      const directData = extractKeyValuePairs(directContainer, sectionTitle);

      if (Object.keys(directData).length > 0) {
        return directData;
      }
    }

    const titleNodes = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, h5, h6, span, div, p, strong, [role='heading']")
    ).filter((node) => cleanText(node.innerText || node.textContent || "").toLowerCase() === normalizedSectionTitle);

    for (const titleNode of titleNodes) {
      const candidates = [];
      let current = titleNode.parentElement;
      let depth = 0;

      while (current && depth < 6) {
        candidates.push(current);
        current = current.parentElement;
        depth += 1;
      }

      for (const container of candidates) {
        const sectionData = extractKeyValuePairs(container, sectionTitle);

        if (Object.keys(sectionData).length > 0) {
          return sectionData;
        }
      }
    }

    return {};
  };

  const extractKeyValuePairs = (container, sectionTitle) => {
    const result = {};
    const rows = Array.from(container.querySelectorAll("tr, [role='row']"));

    rows.forEach((row) => {
      const keyCell = row.querySelector("th, dt, [scope='row'], [class*='label']");
      const valueCell = row.querySelector("td, dd, [role='cell'], [class*='value']");
      const key = extractCellText(keyCell);
      const value = extractCellText(valueCell);

      if (isUsefulKeyValue(key, value, sectionTitle)) {
        result[key] = value;
      }
    });

    if (Object.keys(result).length > 0) {
      return result;
    }

    const fallbackRows = Array.from(container.querySelectorAll("li, [class*='row'], [class*='spec'], [class*='dimension']"));

    fallbackRows.forEach((row) => {
      const directChildren = Array.from(row.children)
        .map((child) => cleanText(child.innerText || child.textContent || ""))
        .filter(Boolean);

      if (directChildren.length >= 2) {
        const key = directChildren[0];
        const value = directChildren.slice(1).join(" ").trim();

        if (isUsefulKeyValue(key, value, sectionTitle)) {
          result[key] = value;
        }
      }
    });

    return result;
  };

  const extractCellText = (cell) => {
    if (!cell) {
      return "";
    }

    const clone = cell.cloneNode(true);
    clone.querySelectorAll("button, svg, img, [aria-label*='Learn more']").forEach((node) => node.remove());
    return cleanText(clone.innerText || clone.textContent || "");
  };

  const cleanText = (value) => value.replace(/\s+/g, " ").trim();

  const isUsefulKeyValue = (key, value, sectionTitle) => {
    if (!key || !value) {
      return false;
    }

    const normalizedKey = key.toLowerCase();
    const normalizedValue = value.toLowerCase();
    const normalizedSectionTitle = sectionTitle.toLowerCase();

    if (normalizedKey === normalizedSectionTitle || normalizedValue === normalizedSectionTitle) {
      return false;
    }

    if (normalizedKey.length > 80 || normalizedValue.length > 300) {
      return false;
    }

    return true;
  };

  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  scripts.forEach((script) => {
    try {
      const data = JSON.parse(script.innerText);

      const extractProduct = (item) => {
        if (!item) {
          return;
        }

        if (item["@graph"]) {
          item["@graph"].forEach(extractProduct);
          return;
        }

        if (Array.isArray(item)) {
          item.forEach(extractProduct);
          return;
        }

        if (item["@type"] === "Product") {
          let price = "N/A";

          if (item.offers) {
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;

            if (offer?.price) {
              price = `${offer.priceCurrency || ""} ${offer.price}`.trim();
            } else if (offer?.lowPrice) {
              price = `${offer.priceCurrency || ""} ${offer.lowPrice}`.trim();
            }
          }

          const image = Array.isArray(item.image) ? item.image[0] : item.image;

          if (item.name) {
            addProduct(item.name, price, image, document);
          }

          return;
        }

        if (item["@type"] === "ItemList" && item.itemListElement) {
          item.itemListElement.forEach((element) => {
            if (element.item && element.item["@type"] === "Product") {
              extractProduct(element.item);
            }
          });
        }
      };

      extractProduct(data);
    } catch (error) {
      console.debug("Invalid JSON-LD block skipped", error);
    }
  });

  const regexPrice = /([$€£₹¥]|Rs\.?|PKR|BDT|Rp)\s*[\d,]+(\.\d{1,2})?|[\d,]+(\.\d{1,2})?\s*([$€£₹¥]|Rs\.?|PKR|BDT|Rp)/i;

  if (products.length < 3) {
    const allElements = document.querySelectorAll("body *");
    const priceEls = [];

    for (let i = 0; i < allElements.length; i += 1) {
      const element = allElements[i];
      let text = element.innerText || element.textContent || "";

      if (element.children.length === 0 || (element.children.length === 1 && text.length < 50)) {
        text = text.trim();

        if (text.length > 0 && text.length < 40 && regexPrice.test(text)) {
          priceEls.push(element);
        }
      }
    }

    priceEls.forEach((priceEl) => {
      let current = priceEl;
      let container = null;

      for (let i = 0; i < 7; i += 1) {
        if (!current) {
          break;
        }

        current = current.parentElement;

        if (!current) {
          break;
        }

        if (current.tagName !== "BODY" && current.tagName !== "HTML") {
          const hasImg = current.querySelector("img");
          const hasTitle = current.querySelector("h2, h3, h4");
          const hasLink = current.querySelector("a");

          if (hasImg && (hasLink || hasTitle)) {
            container = current;
            break;
          }
        }
      }

      if (!container) {
        container = priceEl.parentElement?.parentElement?.parentElement || null;
      }

      if (container && container.tagName !== "BODY") {
        let titleEl = container.querySelector('h2, h3, h4, [class*="title" i], [class*="name" i]');

        if (!titleEl) {
          const links = Array.from(container.querySelectorAll("a"))
            .filter((link) => (link.innerText || link.textContent || "").trim().length > 5)
            .sort(
              (a, b) =>
                (b.innerText || b.textContent || "").trim().length -
                (a.innerText || a.textContent || "").trim().length
            );

          if (links.length > 0) {
            titleEl = links[0];
          }
        }

        if (titleEl) {
          const title = (titleEl.innerText || titleEl.textContent || "").trim().replace(/\n/g, " ");
          const price = (priceEl.innerText || priceEl.textContent || "").trim().split("\n")[0];

          if (title.length < 200 && isLikelyProductTitle(title) && isLikelyProductPrice(price)) {
            const imageUrl = getImageFromElement(container);
            addProduct(title, price, imageUrl, container);
          }
        }
      }
    });
  }

  if (products.length < 2) {
    const items = document.querySelectorAll(".product, .item, .product-card, .card");

    items.forEach((item) => {
      const titleEl = item.querySelector("h2, h3, h4, a");
      const priceEl = item.querySelector(".price, span");
      const titleText = (titleEl ? titleEl.innerText || titleEl.textContent || "" : "").trim();

      if (titleText.length > 5) {
        const title = titleText.replace(/\n/g, " ");
        const price = priceEl ? (priceEl.innerText || priceEl.textContent || "").trim() : "N/A";

        if (title.length < 200 && isLikelyProductTitle(title) && (price === "N/A" || isLikelyProductPrice(price))) {
          const imageUrl = getImageFromElement(item);
          addProduct(title, price, imageUrl, item);
        }
      }
    });
  }

  if (products.length === 0) {
    const titleEl = document.querySelector("h1, h2");
    const title = titleEl ? (titleEl.innerText || titleEl.textContent || "").trim() : null;
    const pageText = document.documentElement.innerText || "";
    const priceEls = pageText.match(new RegExp(regexPrice.source, "gi"));
    const price = priceEls && priceEls.length > 0 ? priceEls[0] : "N/A";

    if (title) {
      addProduct(title, price, getPageImage(), document);
    }
  }

  return products;
}
