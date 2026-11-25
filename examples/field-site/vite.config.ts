import svjeez from "@svjeez/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defaultServerConditions, defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), svjeez()],
  resolve: { conditions: ["@svjeez/source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["@svjeez/source", ...defaultServerConditions] } },
  server: { fs: { allow: [".."] } },
});
