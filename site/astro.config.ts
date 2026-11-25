import svjeez from "@svjeez/astro";
import { defineConfig, fontProviders } from "astro/config";
import { defaultClientConditions, defaultServerConditions, type Plugin } from "vite";

const source = "@svjeez/source";
const workspace = ["svjeez", "@svjeez/vite", "@svjeez/astro"];

const workspaceSources: Plugin = {
  name: "workspace-sources",
  configEnvironment: (_, config) =>
    config.consumer === "client"
      ? {
          resolve: {
            conditions: [source, ...(config.resolve?.conditions ?? defaultClientConditions)],
          },
        }
      : {
          resolve: {
            conditions: [source, ...(config.resolve?.conditions ?? defaultServerConditions)],
            noExternal: workspace,
          },
        },
};

export default defineConfig({
  site: "https://svjeez.texoport.in",
  build: { format: "preserve" },
  integrations: [svjeez()],
  prefetch: { defaultStrategy: "hover" },
  fonts: [
    {
      provider: fontProviders.google(),
      name: "JetBrains Mono",
      cssVariable: "--font-mono",
      weights: [400, 500, 600],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-monospace", "monospace"],
    },
  ],
  vite: {
    plugins: [workspaceSources],
    server: { fs: { allow: [".."] } },
  },
});
