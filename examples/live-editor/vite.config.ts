import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ["@svjeez/source", ...defaultClientConditions] },
});
