const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

const URL = "https://www.logammulia.com/id/harga-emas-hari-ini";

function parseCurrency(str) {
  const cleaned = str.replace(/[^\d]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

async function scrapeAntam() {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
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

    await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
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

    // Post-process: parse angka
    const cats = Object.keys(raw).filter((k) => Array.isArray(raw[k]));
    cats.forEach((cat) => {
      raw[cat].forEach((item) => {
        item.harga_dasar = parseCurrency(item.harga_dasar_raw);
        if (item.harga_pajak_raw) item.harga_pajak = parseCurrency(item.harga_pajak_raw);
      });
    });

    raw.updated_at = new Date().toISOString();
    raw.brand = "antam";
    raw.source = URL;

    return raw;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeAntam };
