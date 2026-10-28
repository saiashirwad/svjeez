import { defineConfig } from "astro/config";
import svjeez from "./integrations/svjeez";

export default defineConfig({
  site: "https://svjeez.texoport.in",
  // /intro and /examples/map are files, as they were before Astro; /examples/ stays a directory index.
  build: { format: "preserve" },
  integrations: [svjeez()],
  // The pages import scenes and the library from the repository around the site.
  vite: { server: { fs: { allow: [".."] } } },
});
