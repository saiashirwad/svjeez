// An Astro integration for svjeez scenes. Import a scene's .tsx into a page and hand it to <Scene> or getScene() from
// "svjeez:astro": the dev server compiles it on request and reloads when it changes, and the build writes each SVG and
// its poster stills under /_svjeez/, named by content. Posters need playwright-core and a Chromium build.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import type { AstroIntegration } from "astro";
import { assets, ROUTE } from "./assets";

const MODULE = "svjeez:astro";

export default function svjeez(): AstroIntegration {
  return {
    name: "svjeez",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        const resolved = `\0${MODULE}`;
        updateConfig({
          vite: {
            plugins: [
              {
                name: "svjeez:astro",
                resolveId: (id) => (id === MODULE ? resolved : undefined),
                load: (id) =>
                  id === resolved
                    ? `export { getScene } from ${JSON.stringify(new URL("scene.ts", import.meta.url).pathname)};\nexport { default as Scene } from ${JSON.stringify(new URL("Scene.astro", import.meta.url).pathname)};`
                    : undefined,
              },
              {
                // Scenes load fonts and images beside their own module, so the server build keeps each module's own location.
                name: "svjeez:import-meta",
                apply: "build",
                transform(code, id) {
                  if (this.environment.config.consumer !== "server" || id.includes("/node_modules/") || !/\.[mc]?[jt]sx?$/.test(id) || !code.includes("import.meta.")) return;
                  return code
                    .replaceAll("import.meta.url", JSON.stringify(pathToFileURL(id).href))
                    .replaceAll("import.meta.dirname", JSON.stringify(dirname(id)))
                    .replaceAll("import.meta.filename", JSON.stringify(id));
                },
              },
            ],
          },
        });
      },
      "astro:config:done": ({ config, injectTypes }) => {
        assets.cache = new URL("svjeez/", config.cacheDir);
        injectTypes({ filename: "types.d.ts", content: '/// <reference types="@svjeez/astro/client" />' });
      },
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(ROUTE, async (request, response, next) => {
          const file = decodeURIComponent(new URL(request.url!, "http://dev").pathname.slice(1));
          const asset = assets.files.get(file);
          if (!asset) return next();
          try {
            const bytes = await asset.bytes();
            response.setHeader("Content-Type", asset.type);
            response.setHeader("Cache-Control", "no-store");
            response.end(bytes);
          } catch (error) {
            next(error);
          }
        });
      },
      "astro:build:done": async ({ dir, logger }) => {
        const out = new URL(ROUTE.slice(1), dir);
        await mkdir(out, { recursive: true });
        await Promise.all([...assets.files].map(async ([file, asset]) => writeFile(new URL(file, out), await asset.bytes())));
        await assets.close?.();
        logger.info(`${assets.files.size} scene files in ${ROUTE}`);
      },
    },
  };
}
