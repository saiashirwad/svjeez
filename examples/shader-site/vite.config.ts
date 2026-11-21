import svjeez from "@svjeez/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defaultServerConditions, defineConfig } from "vite";

// `@svjeez/source` resolves this workspace's packages to their sources, so no build comes first. In your own project
// drop the two `conditions` lines: `svjeez()` alone also compiles the scenes' TypeGPU shaders.
export default defineConfig({
  plugins: [react(), svjeez()],
  resolve: { conditions: ["@svjeez/source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["@svjeez/source", ...defaultServerConditions] } },
  server: { fs: { allow: [".."] } },
});
