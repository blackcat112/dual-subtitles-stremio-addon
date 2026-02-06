import { Manifest } from "stremio-addon-sdk";

export const manifest: Manifest = {
  id: "org.dualsubtitles.addon",
  version: "3.0.0",
  name: "Dual-Subs",
  description: "Master languages effortlessly with perfectly synchronized dual subtitles. Powered by AI to pair your native language with a target language (e.g., Spanish + English). Note: First-time generation takes 10-15 mins for stability; subsequent loads are instant.",
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
