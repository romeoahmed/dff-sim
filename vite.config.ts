import { defineConfig, UserConfig } from "vite";

export default defineConfig({
  build: {
    sourcemap: "hidden",
  },
}) satisfies UserConfig;
