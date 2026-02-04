import { Manifest } from "stremio-addon-sdk";

export const manifest: Manifest = {
  id: "org.dualsubtitles.addon",
  version: "1.6.0",
  name: "Dual Subtitles (Learn Languages)",
  description: "Learn languages effortlessly while watching movies & series. Displays two subtitles simultaneously (e.g. Spanish + English). Features Smart Sync & On-Demand loading.",
  resources: ["subtitles"],
  types: ["movie", "series"],
  logo: "https://dual-subtitles-stremio-addon.onrender.com/logo.png",
  catalogs: [],
  idPrefixes: ["tt"],
  behaviorHints: {
    configurable: true,
    configurationRequired: false
  }
};
