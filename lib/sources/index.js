const { scrapeAntam } = require("./antam");
const { scrapeUbs } = require("./ubs");
const { scrapeLotus } = require("./lotus");

const SOURCES = {
  antam: scrapeAntam,
  ubs: scrapeUbs,
  lotus: scrapeLotus,
};

module.exports = { SOURCES };
