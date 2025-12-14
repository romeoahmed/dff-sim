import { defineConfig, UserConfig } from "vite";

export default defineConfig({
  build: {
    sourcemap: "hidden",
  },
  base: "/dff-sim/",
}) satisfies UserConfig;
