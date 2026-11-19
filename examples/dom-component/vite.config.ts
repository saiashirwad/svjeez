import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  ssr: {
    // In this repo svjeez is a linked workspace package, which Vite would load a second time as source.
    external: ["svjeez", "@svjeez/dom"],
    resolve: { externalConditions: ["node", "@svjeez/source"] },
  },
});
