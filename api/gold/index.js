const { createClient } = require("@supabase/supabase-js");
const { BRANDS } = require("../../lib/sources");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /api/gold → return harga terakhir semua brand
module.exports = async function handler(req, res) {
  // ── CORS headers ──
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const brands = BRANDS;

  const results = await Promise.all(
    brands.map(async (brand) => {
      const { data, error } = await supabase
        .from("gold_prices")
        .select("brand, tanggal, data, scraped_at")
        .eq("brand", brand)
        .order("scraped_at", { ascending: false })
        .limit(1)
        .single();

      if (error) return { brand, error: error.message };
      return data;
    })
  );

  return res.status(200).json(results);
};
