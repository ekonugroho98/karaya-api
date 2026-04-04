const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "id-ID,id;q=0.9",
};

const URL = "https://galeri24.co.id/harga-emas";

// Vendor yang ditampilkan sebagai emas batangan utama
const MAIN_VENDOR = "GALERI 24";

async function scrapeGaleri24() {
  const res = await fetch(URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} saat fetch ${URL}`);

  const html = await res.text();

  // Extract dan parse __NUXT_DATA__ (Nuxt 3 payload format)
  const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("__NUXT_DATA__ tidak ditemukan di halaman");

  const flat = JSON.parse(match[1]);

  // Resolve flat array reference ke nilai asli
  function resolve(index) {
    const val = flat[index];
    if (typeof val !== "object" || val === null) return val;
    if (Array.isArray(val)) return val.map((v) => (typeof v === "number" ? flat[v] : v));
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = typeof v === "number" ? flat[v] : v;
    }
    return out;
  }

  const goldPriceRef = flat[2]?.goldPrice;
  const productRefs = flat[goldPriceRef];

  const allProducts = productRefs
    .map((ref) => resolve(ref))
    .filter((p) => p && typeof p === "object" && p.vendorName);

  // Ambil hanya GALERI 24 (emas batangan investasi utama)
  const galeri24 = allProducts
    .filter((p) => p.vendorName === MAIN_VENDOR)
    .sort((a, b) => parseFloat(a.denomination) - parseFloat(b.denomination))
    .map((p) => ({
      berat: `${parseFloat(p.denomination)} gr`,
      harga_jual: parseInt(p.sellingPrice, 10),
      harga_buyback: parseInt(p.buybackPrice, 10),
      tanggal_update: p.date,
    }));

  // Ambil semua vendor lain sebagai produk tambahan
  const otherVendors = {};
  allProducts
    .filter((p) => p.vendorName !== MAIN_VENDOR && parseInt(p.sellingPrice, 10) > 0)
    .forEach((p) => {
      if (!otherVendors[p.vendorName]) otherVendors[p.vendorName] = [];
      otherVendors[p.vendorName].push({
        berat: `${parseFloat(p.denomination)} gr`,
        harga_jual: parseInt(p.sellingPrice, 10),
        harga_buyback: parseInt(p.buybackPrice, 10),
      });
    });

  const date = galeri24[0]?.tanggal_update || new Date().toISOString().slice(0, 10);

  return {
    brand: "galeri24",
    source: URL,
    tanggal: date,
    updated_at: new Date().toISOString(),
    emas_batangan: galeri24,
    produk_lainnya: otherVendors,
  };
}

module.exports = { scrapeGaleri24 };
