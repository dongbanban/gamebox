/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ASSET_CDN_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
