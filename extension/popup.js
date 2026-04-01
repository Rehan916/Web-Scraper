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
        sourceUrl: product.sourceUrl || tab.url || "",
        scrapedAt: product.scrapedAt || new Date().toISOString()
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

  const addProduct = (title, price) => {
    const normalizedTitle = (title || "").trim();
    const normalizedPrice = (price || "N/A").trim();

    if (!normalizedTitle || normalizedTitle.length <= 2) {
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
      sourceUrl: window.location.href,
      scrapedAt: new Date().toISOString()
    });
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

          if (item.name) {
            addProduct(item.name, price);
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

          if (title.length < 200) {
            addProduct(title, price);
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

        if (title.length < 200) {
          addProduct(title, price);
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
      addProduct(title, price);
    }
  }

  return products;
}
