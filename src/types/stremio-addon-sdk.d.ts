// Type definitions for stremio-addon-sdk
// Since the official package doesn't include TypeScript definitions

declare module 'stremio-addon-sdk' {
  export interface Manifest {
    id: string;
    version: string;
    name: string;
    description: string;
    resources: string[];
    types: string[];
    idPrefixes?: string[];
    catalogs?: Catalog[];
    logo?: string;
    background?: string;
    contactEmail?: string;
    behaviorHints?: {
      configurable?: boolean;
      configurationRequired?: boolean;
    };
  }

  export interface Catalog {
    type: string;
    id: string;
    name?: string;
  }

  export interface SubtitlesRequest {
    type: string;
    id: string;
  }

  export interface Subtitle {
    id: string;
    lang: string;
    url: string;
  }

  export interface SubtitlesResponse {
    subtitles: Subtitle[];
  }

  export class addonBuilder {
    constructor(manifest: Manifest);
    defineSubtitlesHandler(
      handler: (args: SubtitlesRequest) => Promise<SubtitlesResponse>
    ): void;
    getInterface(): AddonInterface;
  }

  export interface AddonInterface {
    get: (path: string, handler: any) => void;
    getRouter: () => any;
  }

  export function serveHTTP(
    addonInterface: AddonInterface,
    options: { port: number }
  ): void;

  export function getRouter(addonInterface: AddonInterface): any;
}
