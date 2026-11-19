import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { InlineConfig, Plugin, RunnableDevEnvironment, ViteDevServer } from "vite";
import {
  entryModule,
  exportNameOf,
  notFound,
  nameOf,
  pageHtml,
  pickFramework,
  SELECTOR,
  type ComponentOptions,
  type Located,
} from "./component.ts";
import { serializeProps, type Bag, type Fn, type Prop, type PropsFor } from "./props.ts";
import type { Scene } from "svjeez/tools";
import type { Target } from "./target.ts";

export type { ComponentOptions } from "./component.ts";

export interface ServeOptions {
  /** The element to capture, as a CSS selector. */
  readonly selector: string;
  /** The Vite project: where `index.html` and the config live. */
  readonly root: string;
  /** Extra Vite config, merged over the project's own. */
  readonly config?: InlineConfig;
  /** The HTML entry, relative to `root`. Default `index.html`. */
  readonly entry?: string;
}

const REFERENCE = /\b(?:src|href)="(\/?[^":#]+\.(?:[mc]?[jt]sx?|css))"/g;

const ATTRIBUTE = /\b(src|href)="(\.\.?\/[^":#?]+)"/g;

/**
 * The entry HTML's relative `src`/`href` that point outside the Vite root. A browser resolves `../theme.css` against the
 * page URL, which cannot climb above `/`, so Vite answers `/theme.css` with its HTML fallback. Vite serves such files
 * under `/@fs/<absolute path>` (if `server.fs.allow` lets it); the entry HTML is rewritten to say so.
 */
export const outsideRoot = (html: string, entryDir: string, root: string): Map<string, string> => {
  const found = new Map<string, string>();

  for (const [, , reference] of html.matchAll(ATTRIBUTE)) {
    const file = resolve(entryDir, reference!);
    const out = relative(root, file);

    if (out.startsWith("..") || isAbsolute(out)) found.set(reference!, file);
  }

  return found;
};

const inProject = (file: string | null | undefined): file is string =>
  Boolean(file) && !file!.includes("/node_modules/");

/** Vite's optimized copies of dependencies live in the dependency cache: crawled (so they are settled), but never hashed, as their path and bundle names differ per run. */
const isCached = (server: ViteDevServer, file: string): boolean =>
  file.startsWith(`${server.config.cacheDir}/`);

/**
 * Each server gets its own dependency cache. Vite's default one is shared per project, and servers that optimize into it
 * at the same time invalidate each other's bundles (the page then gets `504 Outdated Optimize Dep`).
 */
const privateCache = (config: InlineConfig | undefined): Promise<string | undefined> =>
  config?.cacheDir ? Promise.resolve(undefined) : mkdtemp(join(tmpdir(), "svjeez-dom-vite-"));

const closeServer = async (server: ViteDevServer, cacheDir: string | undefined): Promise<void> => {
  await server.close();

  if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
};

const listen = async (server: ViteDevServer): Promise<string> => {
  if (!server.resolvedUrls) await server.listen();

  const origin = server.resolvedUrls?.local[0];

  if (!origin) throw new Error("svjeez/dom: Vite did not report a local URL.");

  return origin;
};

const crawlOnce = async (server: ViteDevServer, urls: readonly string[]): Promise<Set<string>> => {
  const files = new Set<string>();
  const queue = [...urls];
  const seen = new Set(queue);

  for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
    await server.transformRequest(url);

    const module = await server.moduleGraph.getModuleByUrl(url);

    if (inProject(module?.file) && !isCached(server, module.file)) files.add(module.file);

    for (const next of module?.importedModules ?? [])
      if (inProject(next.file) && !seen.has(next.url)) {
        seen.add(next.url);
        queue.push(next.url);
      }
  }

  return files;
};

/**
 * Loads each url through the dev server, and every project module it imports (node_modules excluded), wherever they live.
 * Transforming the whole graph also settles dependency optimization before the browser loads.
 *
 * Vite re-optimizes a dependency it finds late, and the requests caught in the middle fail with `ERR_OUTDATED_OPTIMIZED_DEP`
 * (a page would reload and ask again). So do we: start the crawl over once the optimizer has settled.
 */
const crawl = async (server: ViteDevServer, urls: readonly string[]): Promise<Set<string>> => {
  for (let attempt = 1; ; attempt++)
    try {
      return await crawlOnce(server, urls);
    } catch (error) {
      // SAFETY: only reading `code`, which Vite sets on this error and which is absent otherwise.
      const outdated = (error as { code?: string } | null)?.code === "ERR_OUTDATED_OPTIMIZED_DEP";

      if (!outdated || attempt >= 10) throw error;

      // The optimizer's rerun has no promise to wait on.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
};

/** Paths are hashed relative to `base`, so the same project hashes the same in any checkout. */
const hashFiles = async (
  base: string,
  files: Iterable<string>,
  ...extra: string[]
): Promise<string> => {
  const hash = createHash("sha256");

  for (const file of [...files].sort())
    hash.update(relative(base, file)).update(await readFile(file));

  for (const text of extra) hash.update(text.replaceAll(base, ""));

  return hash.digest("hex");
};

/**
 * Starts a Vite dev server and makes it a `film` target.
 * `sources()` hashes the entry HTML and every project module it imports (node_modules excluded), wherever they live.
 */
export const serve = async ({
  selector,
  root,
  config,
  entry = "index.html",
}: ServeOptions): Promise<Target> => {
  const { createServer, searchForWorkspaceRoot } = await import("vite").catch(() => {
    throw new Error("serve from @svjeez/dom/vite needs vite. Install it with `npm i -D vite`.");
  });

  const film = hosts.getStore()?.film;
  const cacheDir = await privateCache(config);
  const html = await readFile(join(root, entry), "utf8");
  const outside = outsideRoot(html, dirname(join(root, entry)), root);
  const fsUrl = (file: string) => `/@fs${file}`;

  // Files the entry HTML links from outside the root must be servable: keep Vite's own allow-list and add their folders.
  const allow = [
    ...(config?.server?.fs?.allow ?? [searchForWorkspaceRoot(root)]),
    ...[...outside.values()].map((file) => dirname(file)),
  ];

  const links: Plugin = {
    name: "svjeez-dom-links",
    transformIndexHtml: {
      order: "pre",
      handler: (page) =>
        page.replace(ATTRIBUTE, (all, attribute: string, reference: string) => {
          const file = outside.get(reference);

          return file ? `${attribute}="${fsUrl(file)}"` : all;
        }),
    },
  };

  const server: ViteDevServer = await createServer({
    root,
    logLevel: "warn",
    ...(cacheDir && { cacheDir }),
    ...config,
    plugins: [...(config?.plugins ?? []), links],
    server: {
      ...config?.server,
      port: 0,
      strictPort: true,
      hmr: false,
      watch: null,
      fs: { ...config?.server?.fs, allow },
    },
  });

  try {
    const origin = await listen(server);
    const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();

    const references = [...html.matchAll(REFERENCE)].map(([, reference]) => {
      const file = outside.get(reference!);

      return file ? fsUrl(file) : reference!;
    });

    const files = await crawl(server, references);

    files.add(join(root, entry));

    return {
      url: new URL(entry === "index.html" ? "/" : entry, origin).href,
      selector,
      ...(film && { film }),
      ...(title && { title }),
      base: searchForWorkspaceRoot(root),
      sources: () => hashFiles(root, files),
      close: () => closeServer(server, cacheDir),
    };
  } catch (error) {
    await closeServer(server, cacheDir);

    throw error;
  }
};

interface Page {
  readonly html: string;
  readonly entry: string;
}

/** What `component()` needs from the `runFilm` that is loading its film file. */
interface Bridge {
  readonly server: ViteDevServer;
  readonly film: string;
  readonly base: string;
  readonly pages: Map<string, Page>;
}

declare global {
  /** The film file's modules may hold a second copy of this package, so the storage lives on `globalThis`; each `runFilm` runs its film file inside its own bridge. */
  var svjeezDomVite: AsyncLocalStorage<Bridge> | undefined;
}

const hosts = (globalThis.svjeezDomVite ??= new AsyncLocalStorage<Bridge>());

const PREFIX = "virtual:svjeez-dom/";

const pages = (pagesById: Map<string, Page>): Plugin => ({
  name: "svjeez-dom",
  // The film file and this package must share one copy of `svjeez` and `@svjeez/dom`, so Vite leaves them to the runtime's own loader. Vite merges this with the project's `ssr.external`.
  config: () => ({ ssr: { external: ["svjeez", "@svjeez/dom"] } }),
  resolveId: (id) => (id.startsWith(PREFIX) ? id : undefined),
  load: (id) => (id.startsWith(PREFIX) ? pagesById.get(id.slice(PREFIX.length))?.entry : undefined),
  configureServer: (server) => {
    server.middlewares.use(async (request, response, next) => {
      const match = /^\/__svjeez-dom\/([\w-]+)\.html/.exec(request.url ?? "");
      const page = match && pagesById.get(match[1]!);

      if (!page) return next();

      response.setHeader("content-type", "text/html");
      response.end(await server.transformIndexHtml(request.url!, page.html));
    });
  },
});

export interface RunFilmOptions {
  /** The Vite project: where its config lives. Default: the film file's directory. */
  readonly root?: string;
  /** Extra Vite config, merged over the project's own. */
  readonly config?: InlineConfig;
}

/**
 * Runs a film file through Vite's SSR loader and returns what it default-exports (a `Scene`).
 * `component()` needs this: Vite loads the film file's `.svelte` and `.tsx` imports, so it can tell which module exports
 * the component you passed, and serve that module to the browser.
 *
 *     const scene = await runFilm("./card.film.tsx");
 */
export const runFilm = (file: string, options: RunFilmOptions = {}): Promise<Scene> =>
  load(file, options);

const load = async (
  file: string,
  { root = dirname(resolve(file)), config }: RunFilmOptions,
): Promise<Scene> => {
  const { createServer, isRunnableDevEnvironment, searchForWorkspaceRoot } =
    await import("vite").catch(() => {
      throw new Error("runFilm from @svjeez/dom/vite needs vite. Install it with `npm i -D vite`.");
    });

  const film = resolve(file);
  const byId = new Map<string, Page>();

  const cacheDir = await privateCache(config);

  const server = await createServer({
    root,
    logLevel: "warn",
    appType: "custom",
    ...(cacheDir && { cacheDir }),
    ...config,
    plugins: [...(config?.plugins ?? []), pages(byId)],
    server: { ...config?.server, port: 0, strictPort: true, hmr: false, watch: null },
  });

  try {
    const environment = server.environments.ssr;

    if (!isRunnableDevEnvironment(environment))
      throw new Error("runFilm: this Vite setup has no runnable SSR environment.");

    // Starting the server also starts the plugins; the SSR loader needs them started.
    await listen(server);

    // `component()` reads the bridge from the async context of the film file's evaluation, so films can run in parallel.
    const bridge: Bridge = { server, film, base: searchForWorkspaceRoot(root), pages: byId };

    return (await hosts.run(bridge, () => environment.runner.import<{ default: Scene }>(film)))
      .default;
  } finally {
    await closeServer(server, cacheDir);
  }
};

const locate = (host: Bridge, component: Prop): Located => {
  // SAFETY: `runFilm` checked that the SSR environment is runnable before it made the bridge.
  const { runner } = host.server.environments.ssr as RunnableDevEnvironment;
  const found: { file: string; name: string; imports: Set<string> }[] = [];

  for (const node of runner.evaluatedModules.idToModuleMap.values()) {
    if (!node.exports) continue;

    const name = exportNameOf(node.exports, component);

    if (name)
      found.push({ file: node.file ?? node.id.split("?")[0]!, name, imports: node.imports });
  }

  // A barrel that re-exports the component matches too; the module that imports no other match defines it.
  const ids = new Set(found.map((module) => module.file));

  const [defining] = found.filter(
    (module) =>
      ![...module.imports].some(
        (id) => ids.has(id.split("?")[0]!) && id.split("?")[0] !== module.file,
      ),
  );

  if (!defining)
    throw notFound(
      component,
      "Is its module loaded? Import the component from its own file, and run this film file with runFilm() from @svjeez/dom/vite.",
    );

  if (defining.file === host.film)
    throw new Error(
      `component: ${nameOf(component)} is defined in the film file itself (${defining.file}). Move it to its own module and import it, so the browser can load it.`,
    );

  return { file: defining.file, name: defining.name };
};

/**
 * Films one component, mounted alone in a page, with typed props:
 *
 *     import Card from "./Card.tsx";
 *     import theme from "./theme.css?url";
 *
 *     export default await film(component(Card, { task }, { css: [theme] }), async ({ snap, update }) => {
 *       await snap("todo");
 *       await update({ task: { ...task, done: true } });
 *       await snap("done");
 *     });
 *
 * The film file must be loaded through Vite (see `runFilm`). Props are JSON: data props are required and plain,
 * function props are optional and become no-ops in the browser. `update` merges new props in.
 */
export const component = async <C extends Fn>(
  Component: C,
  props: PropsFor<C>,
  options: ComponentOptions = {},
): Promise<Target<Partial<PropsFor<C>>>> => {
  // SAFETY: `PropsFor` is a plain object type; the runtime check in `serializeProps` is what holds it to JSON.
  const wire = serializeProps(props as Bag, "component");
  const host = hosts.getStore();

  if (!host)
    throw new Error(
      "component() from @svjeez/dom/vite needs the film file to be loaded through Vite, which is how it finds the component's module. Run the film file with runFilm(file) from @svjeez/dom/vite.",
    );

  const located = locate(host, Component);
  const framework = pickFramework(located, Component, options.framework);
  const id = randomUUID();
  const entry = entryModule(located, framework, wire);
  const virtual = `${PREFIX}${id}`;

  host.pages.set(id, {
    entry,
    html: pageHtml(options.css ?? [], `/@id/${virtual}`),
  });

  const origin = await listen(host.server);
  const files = await crawl(host.server, [virtual]);

  await host.server.environments.client.depsOptimizer?.scanProcessing;
  await host.server.waitForRequestsIdle();

  return {
    url: new URL(`__svjeez-dom/${id}.html`, origin).href,
    selector: options.selector ?? SELECTOR,
    film: host.film,
    base: host.base,
    ...(Component.name && { title: Component.name }),
    sources: async () => {
      const styles = await Promise.all(
        (options.css ?? []).map(async (href) =>
          (await fetch(new URL(href, origin), { headers: { accept: "text/css" } })).text(),
        ),
      );

      return hashFiles(
        host.server.config.root,
        files,
        JSON.stringify(wire),
        framework.name,
        ...styles,
      );
    },
    close: async () => void host.pages.delete(id),
  };
};
