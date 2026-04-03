const { scrapeAntam } = require("./antam");

// Registry brand → scraper function
// Tambah brand baru di sini, misal: const { scrapePegadaian } = require("./pegadaian")
const SOURCES = {
  antam: scrapeAntam,
  // pegadaian: scrapePegadaian,
};

module.exports = { SOURCES };
