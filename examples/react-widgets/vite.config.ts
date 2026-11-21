import svjeez from "@svjeez/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defaultServerConditions, defineConfig } from "vite";

// `@svjeez/source` resolves the workspace's packages to their sources, so no build comes first.
export default defineConfig({
  plugins: [react(), svjeez()],
  resolve: { conditions: ["@svjeez/source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["@svjeez/source", ...defaultServerConditions] } },
  server: { fs: { allow: [".."] } },
});
