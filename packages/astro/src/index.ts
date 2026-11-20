import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import svjeez, { ROUTE, writeScenes } from "@svjeez/vite";
import type { AstroIntegration } from "astro";

// The pages with a fixed address, for the dev gallery at /_og to start from: it finds the rest by following links.
const ROUTES = "virtual:svjeez/routes";

// The route-to-card map the middleware reads: each page's card is a file beside it (`_<page>.og.tsx`), or a
// directory-level fallback (`_default.og.tsx`) in the page's folder or an ancestor inside `src/pages`.
const CARDS = "virtual:svjeez/og";
const EXTENSIONS = ["tsx", "ts", "jsx", "js"];

export const cardBeside = (file: string, pagesDir?: string): string | undefined => {
  const dir = dirname(file);
  const name = basename(file, extname(file));

  const direct = EXTENSIONS.flatMap((extension) => [
    `_${name}.og.${extension}`,
    `${name}.og.${extension}`,
  ])
    .map((candidate) => join(dir, candidate))
    .find((candidate) => existsSync(candidate));

  if (direct || !pagesDir) return direct;

  const stop = resolve(pagesDir);
  let current = resolve(dir);

  while (current === stop || current.startsWith(`${stop}/`) || current.startsWith(`${stop}\\`)) {
    const fallback = EXTENSIONS.map((extension) => join(current, `_default.og.${extension}`)).find(
      (candidate) => existsSync(candidate),
    );

    if (fallback) return fallback;

    if (current === stop) break;
    const parent = dirname(current);

    if (parent === current) break;
    current = parent;
  }

  return undefined;
};

export default function integration(): AstroIntegration {
  let pages: string[] = [];
  let cards: Record<string, string> = {};
  let root = process.cwd();
  let pagesDir = resolve(root, "src/pages");
  let invalidate = () => {};

  return {
    name: "svjeez",
    hooks: {
      "astro:config:setup": ({ addMiddleware, command, config, injectRoute, updateConfig }) => {
        root = fileURLToPath(config.root);
        pagesDir = fileURLToPath(new URL("pages", config.srcDir));

        addMiddleware({
          order: "post",
          entrypoint: fileURLToPath(new URL("./middleware.ts", import.meta.url)),
        });

        if (command === "dev")
          injectRoute({
            pattern: "/_og",
            entrypoint: fileURLToPath(new URL("./dev/Gallery.astro", import.meta.url)),
          });

        updateConfig({
          vite: {
            plugins: [
              {
                name: "svjeez:routes",
                resolveId: (id) => (id === ROUTES ? `\0${ROUTES}` : undefined),
                load: (id) =>
                  id === `\0${ROUTES}` ? `export default ${JSON.stringify(pages)}` : undefined,
              },
              {
                name: "svjeez:cards",
                resolveId: (id) => (id === CARDS ? `\0${CARDS}` : undefined),
                load: (id) =>
                  id === `\0${CARDS}`
                    ? `export default {${Object.entries(cards)
                        .map(
                          ([route, file]) =>
                            `${JSON.stringify(route)}: () => import(${JSON.stringify(file)})`,
                        )
                        .join(",")}}`
                    : undefined,
                configureServer(server) {
                  invalidate = () => {
                    for (const environment of Object.values(server.environments)) {
                      const node = environment.moduleGraph.getModuleById(`\0${CARDS}`);

                      if (node) environment.moduleGraph.invalidateModule(node);
                    }
                  };
                },
              },
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
      "astro:routes:resolved": ({ routes }) => {
        pages = routes
          .filter(
            (route) => route.type === "page" && route.pathname && !route.pathname.startsWith("/_"),
          )
          .map((route) => route.pathname!);

        cards = Object.fromEntries(
          routes.flatMap((route) => {
            const file =
              route.type === "page"
                ? cardBeside(resolve(root, route.entrypoint), pagesDir)
                : undefined;

            return file ? [[route.pattern, file]] : [];
          }),
        );

        invalidate();
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
