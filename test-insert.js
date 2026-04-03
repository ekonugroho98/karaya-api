/**
 * Test full flow: scrape → insert ke Supabase
 * Jalankan: node test-insert.js
 *
 * Butuh file .env dengan:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

const fs = require("fs");
const path = require("path");

// Load .env manual (tanpa library dotenv)
const envPath = path.join(__dirname, ".env");
if (!fs.existsSync(envPath)) {
  console.error("ERROR: file .env tidak ditemukan");
  process.exit(1);
}
fs.readFileSync(envPath, "utf-8")
  .split("\n")
  .forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
  });

const { createClient } = require("@supabase/supabase-js");
const puppeteer = require("puppeteer-core");
const { execSync } = require("child_process");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY kosong di .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SCRAPE_URL = "https://www.logammulia.com/id/harga-emas-hari-ini";

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
  throw new Error("Chrome/Chromium tidak ditemukan.");
}

async function scrape() {
  const executablePath = findChrome();
  const browser = await puppeteer.launch({
    executablePath,
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

    console.log("  Scraping logammulia.com...");
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
        item.harga_dasar = parseCurrency(item.harga_dasar_raw);
        if (item.harga_pajak_raw) item.harga_pajak = parseCurrency(item.harga_pajak_raw);
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

async function main() {
  console.log("\n[TEST INSERT] Full flow: scrape → Supabase");
  console.log("-".repeat(50));
  console.log(`  Supabase: ${SUPABASE_URL}`);

  // 1. Scrape
  const data = await scrape();
  console.log(`  Scraped : ${data.tanggal}`);
  console.log(`  Items   : ${data.emas_batangan.length} emas batangan`);

  // 2. Insert ke Supabase
  console.log("\n  Inserting ke gold_prices...");
  const { data: inserted, error } = await supabase
    .from("gold_prices")
    .insert({
      brand: "antam",
      tanggal: data.tanggal,
      data: data,
      scraped_at: data.updated_at,
    })
    .select("id, brand, scraped_at")
    .single();

  if (error) {
    console.error("  ERROR insert:", error.message);
    process.exit(1);
  }

  console.log(`  Berhasil! Row id : ${inserted.id}`);
  console.log(`  Brand            : ${inserted.brand}`);
  console.log(`  Scraped at       : ${inserted.scraped_at}`);

  // 3. Verifikasi baca balik
  console.log("\n  Verifikasi baca balik dari Supabase...");
  const { data: verify, error: verifyErr } = await supabase
    .from("gold_prices")
    .select("id, brand, tanggal, scraped_at")
    .eq("brand", "antam")
    .order("scraped_at", { ascending: false })
    .limit(1)
    .single();

  if (verifyErr) {
    console.error("  ERROR read back:", verifyErr.message);
    process.exit(1);
  }

  console.log(`  Row terbaru id   : ${verify.id}`);
  console.log(`  Tanggal          : ${verify.tanggal}`);
  console.log("\nTEST INSERT LULUS");
}

main().catch((err) => {
  console.error("\nTEST GAGAL:", err.message);
  process.exit(1);
});
