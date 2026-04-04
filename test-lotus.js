const { scrapeLotus } = require("./lib/sources/lotus");

async function main() {
  console.log("\n[TEST] Scraper Lotus - lotusarchi.com/pricing");
  console.log("-".repeat(50));

  const data = await scrapeLotus();

  console.log(`Tanggal        : ${data.tanggal}`);
  console.log(`Harga/gram     : Rp ${data.harga_per_gram.toLocaleString("id-ID")}`);
  console.log(`Buyback emas   : Rp ${data.buyback_emas.toLocaleString("id-ID")}`);
  console.log(`Buyback perak  : Rp ${data.buyback_perak.toLocaleString("id-ID")}/gram`);

  console.log(`\nEmas batangan (${data.emas_batangan.length} item):`);
  data.emas_batangan.forEach((i) => {
    console.log(`  ${i.berat.padEnd(15)} Rp ${i.harga.toLocaleString("id-ID")}`);
  });

  console.log(`\nPaper Gold (${data.paper_gold.length} item):`);
  data.paper_gold.forEach((i) => {
    console.log(`  ${i.berat.padEnd(20)} Rp ${i.harga.toLocaleString("id-ID")}`);
  });

  console.log(`\nPerak (${data.perak.length} item):`);
  data.perak.forEach((i) => {
    console.log(`  ${i.nama.padEnd(40)} ${i.harga_raw}`);
  });

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
