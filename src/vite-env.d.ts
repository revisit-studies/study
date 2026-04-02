/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MIC_GROUP_SUMMARY_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
