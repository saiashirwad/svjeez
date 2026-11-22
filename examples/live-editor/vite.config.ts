import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

// "@svjeez/source" makes the workspace packages resolve to their TypeScript source, with no build step.
export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ["@svjeez/source", ...defaultClientConditions] },
});
