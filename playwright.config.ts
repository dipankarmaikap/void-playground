import { defineConfig } from 'playwright/test';

/**
 * The executable settings for the browser tests `remix test` runs. Referenced from the
 * `test.playwright` block in remix.json; chromium only, to keep the browser seam's run
 * time close to the server suite's.
 */
export default defineConfig({
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
