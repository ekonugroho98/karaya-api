const { scrapeUbs } = require("./lib/sources/ubs");

async function main() {
  console.log("\n[TEST] Scraper UBS - ubslifestyle.com");
  console.log("-".repeat(50));

  const data = await scrapeUbs();

  console.log(`Tanggal  : ${data.tanggal}`);
  console.log(`Total    : ${data.emas_batangan.length} produk\n`);

  data.emas_batangan.forEach((i) => {
    console.log(`  ${i.berat.padEnd(12)} Rp ${i.harga.toLocaleString("id-ID")}`);
  });

  if (!data.emas_batangan.length) {
    console.error("GAGAL: tidak ada produk ditemukan");
    process.exit(1);
  }
  console.log("\nTEST LULUS");
}

main().catch((err) => {
  console.error("TEST GAGAL:", err.message);
  process.exit(1);
});
