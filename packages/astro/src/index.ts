import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import svjeez, { ROUTE, writeScenes } from "@svjeez/vite";
import type { AstroIntegration } from "astro";

export default function integration(): AstroIntegration {
  return {
    name: "svjeez",
    hooks: {
      "astro:config:setup": ({ config, updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              svjeez({ cacheDir: fileURLToPath(new URL("svjeez", config.cacheDir)) }),
              {
                name: "svjeez:import-meta",
                apply: "build",
                transform(code, id) {
                  if (
                    this.environment.config.consumer !== "server" ||
                    id.includes("/node_modules/") ||
                    !/\.[mc]?[jt]sx?$/.test(id) ||
                    !code.includes("import.meta.")
                  )
                    return;

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
      "astro:config:done": ({ injectTypes }) => {
        injectTypes({
          filename: "types.d.ts",
          content: '/// <reference types="@svjeez/astro/client" />',
        });
      },
      "astro:build:done": async ({ dir, logger }) => {
        logger.info(`${await writeScenes(dir)} scene files in ${ROUTE}`);
      },
    },
  };
}
