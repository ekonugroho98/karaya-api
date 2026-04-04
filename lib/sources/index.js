const { scrapeAntam } = require("./antam");
const { scrapeUbs } = require("./ubs");
const { scrapeLotus } = require("./lotus");
const { scrapeGaleri24 } = require("./galeri24");

const SOURCES = {
  antam: scrapeAntam,
  ubs: scrapeUbs,
  lotus: scrapeLotus,
  galeri24: scrapeGaleri24,
};

module.exports = { SOURCES };
