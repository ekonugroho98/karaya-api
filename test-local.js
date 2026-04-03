/**
 * Test scraper secara lokal (tanpa Vercel / Supabase)
 * Jalankan: node test-local.js
 */

// Di local, gunakan puppeteer biasa bukan @sparticuz/chromium
// karena @sparticuz hanya untuk environment serverless Linux
const puppeteer = require("puppeteer-core");
const { execSync } = require("child_process");

const URL = "https://www.logammulia.com/id/harga-emas-hari-ini";

function parseCurrency(str) {
  const cleaned = str.replace(/[^\d]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

function findChrome() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ];
  for (const p of candidates) {
    try {
      execSync(`test -f "${p}"`);
      return p;
    } catch {}
  }
  throw new Error(
    "Chrome/Chromium tidak ditemukan. Install Google Chrome lalu coba lagi."
  );
}

async function scrapeAntamLocal() {
  const executablePath = findChrome();
  console.log(`  Browser: ${executablePath}\n`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "id-ID,id;q=0.9" });

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "font", "media"].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    console.log("  Mengakses logammulia.com...");
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector("table", { timeout: 15000 });
    console.log("  Halaman berhasil dimuat!\n");

    const raw = await page.evaluate(() => {
      const result = {
        tanggal: "",
        emas_batangan: [],
        emas_gift_series: [],
        emas_idul_fitri: [],
        emas_imlek: [],
        emas_batik: [],
        perak_murni: [],
        perak_heritage: [],
        liontin_batik: [],
      };

      const h2 = document.querySelectorAll("h2");
      h2.forEach((el) => {
        if (el.textContent.includes("Harga Emas Hari Ini")) {
          result.tanggal = el.textContent.trim();
        }
      });

      let currentCat = "emas_batangan";
      const tables = document.querySelectorAll("table");

      tables.forEach((table) => {
        table.querySelectorAll("tr").forEach((row) => {
          const text = row.textContent.trim().toLowerCase();
          const cells = row.querySelectorAll("td");

          if (text.includes("gift series")) { currentCat = "emas_gift_series"; return; }
          if (text.includes("idul fitri")) { currentCat = "emas_idul_fitri"; return; }
          if (text.includes("imlek")) { currentCat = "emas_imlek"; return; }
          if (text.includes("liontin") && text.includes("batik")) { currentCat = "liontin_batik"; return; }
          if (text.includes("batik")) { currentCat = "emas_batik"; return; }
          if (text.includes("perak") && text.includes("heritage")) { currentCat = "perak_heritage"; return; }
          if (text.includes("perak murni")) { currentCat = "perak_murni"; return; }
          if (text.includes("emas batangan") && !text.includes("gift") && !text.includes("batik")) {
            currentCat = "emas_batangan"; return;
          }

          if (text.includes("harga dasar") || text.includes("berat")) return;

          if (cells.length >= 2) {
            const berat = cells[0]?.textContent?.trim() || "";
            const hargaDasar = cells[1]?.textContent?.trim() || "";
            const hargaPajak = cells[2]?.textContent?.trim() || "";
            if (!berat || !berat.match(/\d/) || !hargaDasar.match(/\d/)) return;
            const item = { berat, harga_dasar_raw: hargaDasar };
            if (hargaPajak) item.harga_pajak_raw = hargaPajak;
            if (result[currentCat]) result[currentCat].push(item);
          }
        });
      });

      return result;
    });

    // Post-process
    const cats = Object.keys(raw).filter((k) => Array.isArray(raw[k]));
    cats.forEach((cat) => {
      raw[cat].forEach((item) => {
        item.harga_dasar = parseCurrency(item.harga_dasar_raw);
        if (item.harga_pajak_raw) item.harga_pajak = parseCurrency(item.harga_pajak_raw);
      });
    });

    raw.updated_at = new Date().toISOString();
    raw.brand = "antam";
    return raw;
  } finally {
    await browser.close();
  }
}

function printResult(data) {
  const labels = {
    emas_batangan:   "EMAS BATANGAN",
    emas_gift_series:"GIFT SERIES",
    emas_idul_fitri: "IDUL FITRI",
    emas_imlek:      "IMLEK",
    emas_batik:      "BATIK SERI III",
    perak_murni:     "PERAK MURNI",
    perak_heritage:  "PERAK HERITAGE",
    liontin_batik:   "LIONTIN BATIK",
  };

  console.log("=".repeat(64));
  console.log(`  ${data.tanggal}`);
  console.log("=".repeat(64));

  Object.entries(labels).forEach(([key, label]) => {
    if (!data[key]?.length) return;
    console.log(`\n-- ${label} --`);
    data[key].forEach((i) => {
      const hd = `Rp ${i.harga_dasar.toLocaleString("id-ID")}`;
      const hp = i.harga_pajak ? `Rp ${i.harga_pajak.toLocaleString("id-ID")}` : "";
      console.log(`  ${i.berat.padEnd(10)} ${hd.padStart(22)} ${hp.padStart(22)}`);
    });
  });

  console.log(`\n  Scraped at: ${data.updated_at}`);
}

async function main() {
  console.log("\n[TEST LOCAL] Scraper Antam - logammulia.com");
  console.log("-".repeat(64));
  const data = await scrapeAntamLocal();

  printResult(data);

  // Validasi dasar
  console.log("\n[VALIDASI]");
  const eb = data.emas_batangan;
  if (!eb.length) {
    console.error("  GAGAL: emas_batangan kosong!");
    process.exit(1);
  }
  console.log(`  emas_batangan: ${eb.length} item`);
  console.log(`  Harga 1gr   : Rp ${(eb.find(i => i.berat.includes("1 gr") || i.berat === "1 gr")?.harga_dasar ?? 0).toLocaleString("id-ID")}`);
  console.log(`  Semua harga > 0: ${eb.every(i => i.harga_dasar > 0) ? "OK" : "GAGAL - ada harga 0"}`);
  console.log("\nTEST LULUS");
}

main().catch((err) => {
  console.error("\nTEST GAGAL:", err.message);
  process.exit(1);
});
