import svjeez from "@svjeez/vite";
import react from "@vitejs/plugin-react";
import typegpu from "unplugin-typegpu/vite";
import { defaultClientConditions, defaultServerConditions, defineConfig } from "vite";

// `@svjeez/source` resolves the workspace's packages to their sources, so no build comes first. TypeGPU's plugin
// turns the 'use gpu' functions in GpuCard.tsx into WGSL.
export default defineConfig({
  plugins: [react(), svjeez(), typegpu()],
  resolve: { conditions: ["@svjeez/source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["@svjeez/source", ...defaultServerConditions] } },
  server: { fs: { allow: [".."] } },
});
