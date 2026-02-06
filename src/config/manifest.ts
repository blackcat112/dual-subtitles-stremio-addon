import { Manifest } from "stremio-addon-sdk";

export const manifest: Manifest = {
  id: "org.dualsubtitles.addon",
  version: "3.0.0",
  name: "Dual-Subs AI (Perfect Sync)",
  description: "Subtítulos duales sincronizados por IA. ⚠️ AVISO: La primera vez que pides una peli, tarda 10-15 mins en generarse por seguridad anti-baneo. Ten paciencia, luego es instantáneo.",
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
