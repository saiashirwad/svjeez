import react from "@vitejs/plugin-react";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), svelte()],
  ssr: {
    // In this repo svjeez is a linked workspace package, which Vite would load a second time as source.
    external: ["svjeez", "@svjeez/dom"],
    resolve: { externalConditions: ["node", "@svjeez/source"] },
  },
});
