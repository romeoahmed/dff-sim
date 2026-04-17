import { defineConfig } from "@lingui/cli";

export default defineConfig({
  sourceLocale: "en",
  locales: ["en", "zh-CN"],
  catalogs: [
    {
      path: "src/i18n/locales/{locale}/messages",
      include: ["src"],
    },
  ],
});
