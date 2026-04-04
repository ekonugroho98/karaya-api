/**
 * Dijalankan oleh GitHub Actions setiap 08:30 WIB
 * Scrape semua brand → insert ke Supabase
 */

const { createClient } = require("@supabase/supabase-js");
const puppeteer = require("puppeteer");
const { scrapeUbs } = require("./lib/sources/ubs");
const { scrapeLotus } = require("./lib/sources/lotus");
const { scrapeGaleri24 } = require("./lib/sources/galeri24");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tidak ada");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const SCRAPE_URL = "https://www.logammulia.com/id/harga-emas-hari-ini";

function parseCurrency(str) {
  const cleaned = str.replace(/[^\d]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

async function scrapeAntam() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
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

    await page.goto(SCRAPE_URL, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector("table", { timeout: 15000 });

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

      document.querySelectorAll("h2").forEach((el) => {
        if (el.textContent.includes("Harga Emas Hari Ini")) {
          result.tanggal = el.textContent.trim();
        }
      });

      let currentCat = "emas_batangan";
      document.querySelectorAll("table").forEach((table) => {
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

    Object.keys(raw).filter((k) => Array.isArray(raw[k])).forEach((cat) => {
      raw[cat].forEach((item) => {
        item.harga_jual = parseCurrency(item.harga_dasar_raw);
        if (item.harga_pajak_raw) item.harga_pajak = parseCurrency(item.harga_pajak_raw);
        item.harga_buyback = null;
        delete item.harga_dasar_raw;
        delete item.harga_pajak_raw;
      });
    });

    raw.updated_at = new Date().toISOString();
    raw.brand = "antam";
    raw.source = SCRAPE_URL;
    return raw;
  } finally {
    await browser.close();
  }
}

async function insertToSupabase(brand, data) {
  const { error } = await supabase.from("gold_prices").insert({
    brand,
    tanggal: data.tanggal,
    data,
    scraped_at: data.updated_at,
  });

  if (error) throw new Error(`Insert ${brand} gagal: ${error.message}`);
  console.log(`[${brand}] berhasil insert ke Supabase`);
}

async function main() {
  console.log(`[${new Date().toISOString()}] Mulai scraping semua brand...`);

  // Antam (Puppeteer)
  console.log("\n[antam] Scraping logammulia.com...");
  const antamData = await scrapeAntam();
  console.log(`[antam] ${antamData.tanggal} — ${antamData.emas_batangan.length} item`);
  await insertToSupabase("antam", antamData);

  // UBS (fetch + cheerio)
  console.log("\n[ubs] Scraping ubslifestyle.com...");
  const ubsData = await scrapeUbs();
  console.log(`[ubs] ${ubsData.tanggal} — ${ubsData.emas_batangan.length} item`);
  await insertToSupabase("ubs", ubsData);

  // Lotus (fetch + cheerio)
  console.log("\n[lotus] Scraping lotusarchi.com...");
  const lotusData = await scrapeLotus();
  console.log(`[lotus] ${lotusData.tanggal} — ${lotusData.emas_batangan.length} item emas, ${lotusData.paper_gold.length} paper gold`);
  await insertToSupabase("lotus", lotusData);

  // Galeri 24 (fetch + __NUXT_DATA__ parse)
  console.log("\n[galeri24] Scraping galeri24.co.id...");
  const galeri24Data = await scrapeGaleri24();
  console.log(`[galeri24] ${galeri24Data.tanggal} — ${galeri24Data.emas_batangan.length} item emas batangan`);
  await insertToSupabase("galeri24", galeri24Data);

  console.log("\nSemua brand selesai.");
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
