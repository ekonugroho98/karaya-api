// GET /api/stock/BBCA → harga live saham IDX dari Yahoo Finance
module.exports = async function handler(req, res) {
  // ── CORS headers ──
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: "Ticker diperlukan" });

  // Auto-append .JK jika belum ada (IDX = Jakarta Stock Exchange)
  const symbol = ticker.toUpperCase().endsWith(".JK")
    ? ticker.toUpperCase()
    : `${ticker.toUpperCase()}.JK`;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KarayaBot/1.0)",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return res.status(404).json({ error: `Ticker "${ticker}" tidak ditemukan di Yahoo Finance` });
    }

    const json = await response.json();
    const meta = json?.chart?.result?.[0]?.meta;

    if (!meta || !meta.regularMarketPrice) {
      return res.status(404).json({ error: `Data harga untuk "${ticker}" tidak tersedia` });
    }

    const price     = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change    = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return res.status(200).json({
      ticker:       ticker.toUpperCase(),
      symbol,
      price,                                        // harga per saham (IDR)
      currency:     meta.currency ?? "IDR",
      change:       parseFloat(change.toFixed(2)),
      change_pct:   parseFloat(changePct.toFixed(2)),
      market_state: meta.marketState ?? "CLOSED",   // "REGULAR" | "PRE" | "POST" | "CLOSED"
      exchange:     meta.exchangeName ?? "IDX",
      timestamp:    new Date().toISOString(),
      source:       "Yahoo Finance",
    });
  } catch (err) {
    return res.status(500).json({
      error:  "Gagal mengambil data saham",
      detail: err.message,
    });
  }
};
