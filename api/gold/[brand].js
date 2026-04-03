const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /api/gold/antam → return harga terakhir brand dari Supabase
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { brand } = req.query;

  const { data, error } = await supabase
    .from("gold_prices")
    .select("*")
    .eq("brand", brand)
    .order("scraped_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return res.status(404).json({ error: `Data untuk brand "${brand}" belum tersedia` });
  }

  return res.status(200).json(data);
};
