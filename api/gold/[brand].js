const { createClient } = require("@supabase/supabase-js");
const { SOURCES } = require("../../lib/sources");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vercel Cron memanggil endpoint ini dengan header x-vercel-cron
// React app juga bisa fetch endpoint ini langsung untuk data terkini
module.exports = async function handler(req, res) {
  const { brand } = req.query;

  const scraper = SOURCES[brand];
  if (!scraper) {
    return res.status(404).json({ error: `Brand "${brand}" tidak ditemukan` });
  }

  // GET tanpa trigger scrape → ambil data terakhir dari Supabase
  if (req.method === "GET" && !req.headers["x-vercel-cron"]) {
    const { data, error } = await supabase
      .from("gold_prices")
      .select("*")
      .eq("brand", brand)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // Cron / trigger manual → scrape lalu simpan
  try {
    const result = await scraper();

    const { error } = await supabase.from("gold_prices").insert({
      brand,
      tanggal: result.tanggal,
      data: result,
      scraped_at: result.updated_at,
    });

    if (error) throw new Error(error.message);

    return res.status(200).json({
      ok: true,
      brand,
      scraped_at: result.updated_at,
      items: result.emas_batangan?.length ?? 0,
    });
  } catch (err) {
    console.error(`[${brand}] scrape error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};
