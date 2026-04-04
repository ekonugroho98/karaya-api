const { scrapeGaleri24 } = require("./lib/sources/galeri24");

async function main() {
  console.log("\n[TEST] Scraper Galeri24 - galeri24.co.id/harga-emas");
  console.log("-".repeat(55));

  const data = await scrapeGaleri24();

  console.log(`Tanggal  : ${data.tanggal}`);
  console.log(`\nGALERI 24 - Emas Batangan (${data.emas_batangan.length} item):`);
  data.emas_batangan.forEach((i) => {
    console.log(
      `  ${i.berat.padEnd(10)} jual: Rp ${i.harga_jual.toLocaleString("id-ID").padStart(15)} | buyback: Rp ${i.harga_buyback.toLocaleString("id-ID")}`
    );
  });

  const brands = Object.keys(data.produk_lainnya);
  console.log(`\nProduk lainnya: ${brands.length} brand (${brands.join(", ")})`);

  if (!data.emas_batangan.length) {
    console.error("\nGAGAL: emas_batangan kosong!");
    process.exit(1);
  }
  console.log("\nTEST LULUS");
}

main().catch((err) => {
  console.error("TEST GAGAL:", err.message);
  process.exit(1);
});
