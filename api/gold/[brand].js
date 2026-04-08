const { createClient } = require("@supabase/supabase-js");
const { scrapeUbs }     = require("../../lib/sources/ubs");
const { scrapeLotus }   = require("../../lib/sources/lotus");
const { scrapeGaleri24 }= require("../../lib/sources/galeri24");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Brand yang bisa di-scrape live di Vercel (tidak butuh Puppeteer)
const LIVE_SCRAPERS = { ubs: scrapeUbs, lotus: scrapeLotus, galeri24: scrapeGaleri24 };

// Data dianggap stale jika lebih dari 20 jam yang lalu
const STALE_MS = 20 * 60 * 60 * 1000;

function isStale(row) {
  if (!row?.scraped_at) return true;
  return Date.now() - new Date(row.scraped_at).getTime() > STALE_MS;
}

// GET /api/gold/:brand
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { brand } = req.query;

  // 1. Ambil data terakhir dari Supabase
  const { data: cached } = await supabase
    .from("gold_prices")
    .select("*")
    .eq("brand", brand)
    .order("scraped_at", { ascending: false })
    .limit(1)
    .single();

  // 2. Kalau masih fresh → langsung return
  if (!isStale(cached)) return res.status(200).json(cached);

  // 3. Data stale & ada live scraper → coba scrape real-time
  const scrapeFn = LIVE_SCRAPERS[brand];
  if (scrapeFn) {
    try {
      console.log(`[${brand}] Cache stale, scraping live...`);
      const liveData = await scrapeFn();
      liveData.updated_at = new Date().toISOString();

      // Insert ke Supabase supaya request berikutnya pakai cache
      await supabase.from("gold_prices").insert({
        brand,
        tanggal:    liveData.tanggal,
        data:       liveData,
        scraped_at: liveData.updated_at,
      });

      return res.status(200).json({
        brand,
        tanggal:    liveData.tanggal,
        data:       liveData,
        scraped_at: liveData.updated_at,
      });
    } catch (err) {
      console.error(`[${brand}] Live scrape gagal: ${err.message} — pakai cache lama`);
      // Fall through ke cache lama
    }
  }

  // 4. Fallback: return cache lama (meski stale) atau 404
  if (cached) return res.status(200).json(cached);
  return res.status(404).json({ error: `Data untuk brand "${brand}" belum tersedia` });
};
