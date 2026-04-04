const { load } = require("cheerio");

const URL = "https://lotusarchi.com/pricing/";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "id-ID,id;q=0.9",
};

function parseCurrency(str) {
  const cleaned = str.replace(/[^\d]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

function parseDate(heading) {
  // "02 April 2026 || Gold Price /gram : Rp 2.793.000 || Buyback Price : Rp 2.577.000"
  const match = heading.match(/(\d{1,2}\s+\w+\s+\d{4})/);
  return match ? match[1] : "";
}

async function scrapeLotus() {
  const res = await fetch(URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} saat fetch ${URL}`);

  const html = await res.text();
  const $ = load(html);

  const result = {
    brand: "lotus",
    source: URL,
    tanggal: "",
    updated_at: new Date().toISOString(),
    emas_batangan: [],
    paper_gold: [],
    perak: [],
    buyback_emas: 0,
    buyback_perak: 0,
    harga_per_gram: 0,
  };

  // Ambil tanggal & harga/gram dari heading h4
  $("h4").each((_, el) => {
    const text = $(el).text();
    if (text.includes("Gold Price")) {
      result.tanggal = parseDate(text);
      const matchHarga = text.match(/Gold Price\s*\/gram\s*:\s*Rp\s*([\d.,]+)/i);
      if (matchHarga) result.harga_per_gram = parseCurrency(matchHarga[1]);
      const matchBuyback = text.match(/Buyback Price\s*:\s*Rp\s*([\d.,]+)/i);
      if (matchBuyback) result.buyback_emas = parseCurrency(matchBuyback[1]);
    }
  });

  // Parse semua tabel
  $("table").each((_, table) => {
    const rows = $("tr", table).toArray();

    // Deteksi tipe tabel dari header baris pertama
    const headerText = $(rows[0]).text().toLowerCase();

    if (headerText.includes("buyback")) {
      // Tabel buyback perak
      rows.slice(1).forEach((row) => {
        const cells = $("td", row).toArray();
        if (cells.length < 2) return;
        const nama = $(cells[0]).text().trim();
        const hargaRaw = $(cells[1]).text().trim();
        if (nama.toLowerCase().includes("perak") && hargaRaw.match(/\d/)) {
          result.buyback_perak = parseCurrency(hargaRaw);
        }
      });
    } else if (headerText.includes("produk") && headerText.includes("harga")) {
      // Tabel perak (produk + harga/gram)
      rows.slice(1).forEach((row) => {
        const cells = $("td", row).toArray();
        if (cells.length < 2) return;
        const nama = $(cells[0]).text().trim();
        const hargaRaw = $(cells[1]).text().trim();
        if (!nama || !hargaRaw.match(/\d/)) return;
        result.perak.push({
          nama,
          harga_raw: hargaRaw,
          harga: parseCurrency(hargaRaw),
        });
      });
    } else if (headerText.includes("qty") || headerText.includes("harga jual")) {
      // Tabel emas batangan & paper gold
      rows.slice(1).forEach((row) => {
        const cells = $("td", row).toArray();
        if (cells.length < 2) return;
        const berat = $(cells[0]).text().trim();
        const hargaRaw = $(cells[1]).text().trim();
        if (!berat || !hargaRaw.match(/\d/)) return;

        const harga = parseCurrency(hargaRaw);
        if (harga === 0) return;

        if (berat.toLowerCase().includes("paper gold")) {
          result.paper_gold.push({ berat, harga_jual: harga, harga_buyback: null });
        } else {
          result.emas_batangan.push({ berat, harga_jual: harga, harga_buyback: null });
        }
      });
    }
  });

  // Fallback tanggal jika tidak ada di h4
  if (!result.tanggal) {
    result.tanggal = new Date().toLocaleDateString("id-ID", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: "Asia/Jakarta",
    });
  }

  return result;
}

module.exports = { scrapeLotus };
