import { defineConfig } from "@lingui/cli";

export default defineConfig({
  sourceLocale: "en",
  locales: ["en", "zh-CN"],
  format: "po",
  compileNamespace: "es",
  catalogs: [
    {
      path: "src/i18n/locales/{locale}/messages",
      include: ["src"],
      exclude: ["**/*.test.*", "**/*.worker.ts", "src/workers/**"],
    },
  ],
});
