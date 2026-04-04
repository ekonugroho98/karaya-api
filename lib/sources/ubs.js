const { load } = require("cheerio");

const BASE_URL = "https://ubslifestyle.com/fine-gold/logam-mulia-ubs";
const PAGES = [BASE_URL + "/", BASE_URL + "/page/2/"];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "id-ID,id;q=0.9",
};

function parseGram(title) {
  // "ubs logam mulia 2 gram classic" → "2 gr"
  const match = title.match(/([\d.]+)\s*gram/i);
  return match ? `${match[1]} gr` : title;
}

async function scrapeUbs() {
  const items = [];

  for (const url of PAGES) {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status} saat fetch ${url}`);

    const html = await res.text();
    const $ = load(html);

    $("div.as-producttile").each((_, el) => {
      const title = $(el).attr("data-product-title") || "";
      const priceAttr = $(el).attr("data-product-price") || "";
      const imgAlt = $("img.as-producttile-image", el).attr("alt") || "";

      if (!title.toLowerCase().includes("ubs") || !priceAttr) return;

      const harga = parseInt(priceAttr, 10);
      const berat = parseGram(title);
      const nama = imgAlt || title;

      if (harga > 0) {
        items.push({ berat, nama, harga_jual: harga, harga_buyback: null });
      }
    });
  }

  // Urutkan dari terkecil ke terbesar
  items.sort((a, b) => parseFloat(a.berat) - parseFloat(b.berat));

  return {
    brand: "ubs",
    source: BASE_URL,
    tanggal: new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Jakarta",
    }),
    updated_at: new Date().toISOString(),
    emas_batangan: items,
  };
}

module.exports = { scrapeUbs };
