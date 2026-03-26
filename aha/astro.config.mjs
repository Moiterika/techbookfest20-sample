// @ts-check
import bun from "@nurodev/astro-bun";
import icon from "astro-icon";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  adapter: bun(),
  output: "server",
  integrations: [icon()],
  server: {
    host: true,
  },
});
