/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * HTTPS URL of the TALAS sync endpoint (AWS Lambda `talasFunction` via API
   * Gateway / Function URL). Example:
   *   https://xxxx.lambda-url.ap-southeast-2.on.aws/
   * When unset, the app runs fully offline and sync is skipped.
   */
  readonly VITE_TALAS_SYNC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
