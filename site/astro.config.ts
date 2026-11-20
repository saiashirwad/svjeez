import svjeez from "@svjeez/astro";
import { defineConfig, fontProviders } from "astro/config";
import { defaultClientConditions, defaultServerConditions, type Plugin } from "vite";

// The workspace's own packages resolve to their TypeScript sources in every Vite environment, and Vite compiles them
// instead of handing them to Node, so a library edit shows on reload.
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
  // Links marked data-astro-prefetch fetch their page when the pointer rests on them.
  prefetch: { defaultStrategy: "hover" },
  // The font every code block and scene on the site uses, self-hosted.
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
    // The pages import scenes from the svjeez package beside the site.
    server: { fs: { allow: [".."] } },
  },
});
