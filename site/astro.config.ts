import svjeez from "@svjeez/astro";
import { defineConfig } from "astro/config";
import { defaultClientConditions, defaultServerConditions, type Plugin } from "vite";

// The workspace's own packages resolve to their TypeScript sources in every Vite environment, and Vite compiles them
// instead of handing them to Node, so a library edit shows on reload.
const source = "@svjeez/source";
const workspace = ["svjeez", "@svjeez/astro"];
const workspaceSources: Plugin = {
  name: "workspace-sources",
  configEnvironment: (_, config) =>
    config.consumer === "client"
      ? { resolve: { conditions: [source, ...(config.resolve?.conditions ?? defaultClientConditions)] } }
      : { resolve: { conditions: [source, ...(config.resolve?.conditions ?? defaultServerConditions)], noExternal: workspace } },
};

export default defineConfig({
  site: "https://svjeez.texoport.in",
  // /intro and /examples/map are files, as they were before Astro; /examples/ stays a directory index.
  build: { format: "preserve" },
  integrations: [svjeez()],
  vite: {
    plugins: [workspaceSources],
    // The pages import scenes from the svjeez package beside the site.
    server: { fs: { allow: [".."] } },
  },
});
