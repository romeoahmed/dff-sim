import { defineConfig, UserConfig } from "vite";

export default defineConfig({
  build: {
    sourcemap: false,
  },
  base: "/",
}) satisfies UserConfig;
