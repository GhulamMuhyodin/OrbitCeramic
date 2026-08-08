/** Orbit Ceramic API client config (dev uses Angular proxy → localhost:8080). */
export const API_CONFIG = {
  /** Base path; proxied to orbit-api in `ng serve`. */
  apiBase: '/api/v1',
  /** Must match orbit-api/config/config.php `api_key`. */
  apiKey: 'change-me-orbit-media-key',
  defaultSiteId: 'site-orbit',
} as const;
