const { scrapeAntam } = require("./antam");
const { scrapeUbs } = require("./ubs");

const SOURCES = {
  antam: scrapeAntam,
  ubs: scrapeUbs,
};

module.exports = { SOURCES };
