import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type {
  EnvironmentModuleNode,
  InlineConfig,
  Plugin,
  RunnableDevEnvironment,
  ViteDevServer,
} from "vite";
import {
  callerFile,
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
  /** The Vite project: where `index.html` and the config live. Default: the film file's directory. */
  readonly root?: string;
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
  root: given,
  config,
  entry = "index.html",
}: ServeOptions): Promise<Target> => {
  const host = hosts.getStore();
  const film = host?.film ?? callerFile();
  const root = given ?? (film && dirname(film));

  if (!root) throw new Error("serve: could not tell which file called it, so pass { root }.");

  const { createServer, searchForWorkspaceRoot } = await import("vite").catch(() => {
    throw new Error("serve from @svjeez/dom/vite needs vite. Install it with `npm i -D vite`.");
  });

  const cacheDir = await privateCache(config);
  const html = await readFile(join(root, entry), "utf8");
  const outside = outsideRoot(html, dirname(join(root, entry)), root);
  const fsUrl = (file: string) => `/@fs${file}`;

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

    for (const file of files) host?.files.add(file);

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

/** What `serve()` and `component()` need from the `runFilm` that is loading their film file. */
interface Bridge {
  readonly server: ViteDevServer;
  readonly film: string;
  readonly base: string;
  readonly pages: Map<string, Page>;
  /** Every source file the film depends on: its targets add theirs. */
  readonly files: Set<string>;
}

declare global {
  /** The film file's modules may hold a second copy of this package, so the storage lives on `globalThis`; each `runFilm` runs its film file inside its own bridge. */
  var svjeezDomVite: AsyncLocalStorage<Bridge> | undefined;
}

const hosts = (globalThis.svjeezDomVite ??= new AsyncLocalStorage<Bridge>());

const PREFIX = "virtual:svjeez-dom/";

const pages = (pagesById: Map<string, Page>, film: string): Plugin => ({
  name: "svjeez-dom",
  config: () => ({ ssr: { external: ["svjeez", "@svjeez/dom"] } }),
  resolveId: (id) => (id.startsWith(PREFIX) ? id : undefined),
  transform: (code, id) =>
    id === film
      ? code.replace(/\bimport\.meta\.dir\b(?!name)/g, JSON.stringify(dirname(id)))
      : undefined,
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
  /** The Vite project whose config loads the film file. Default: the nearest folder above the film file with a `vite.config.*`, up to its package; else the film file's folder. */
  readonly root?: string;
  /** Extra Vite config, merged over the project's own. */
  readonly config?: InlineConfig;
}

export interface Film {
  /** What the film file default-exports. */
  readonly scene: Scene;
  /** The scene as SVG, emitted by the `svjeez` that made it (another copy of the package may not read its model). */
  readonly svg: string;
  /** The source files it was made from: the film file, what it imports, and its target's app or component. */
  readonly files: readonly string[];
}

const CONFIG = /^vite\.config\.[mc]?[jt]s$/;

/** The nearest folder from `dir` up with a Vite config, stopping at the first `package.json`. */
const projectOf = async (dir: string): Promise<string | undefined> => {
  for (let at = dir; ; at = dirname(at)) {
    const names = await readdir(at).catch((): string[] => []);

    if (names.some((name) => CONFIG.test(name))) return at;

    if (names.includes("package.json") || dirname(at) === at) return;
  }
};

const project = (node: EnvironmentModuleNode, found: Set<string>): void => {
  for (const next of node.importedModules)
    if (inProject(next.file) && !found.has(next.file)) {
      found.add(next.file);
      project(next, found);
    }
};

/**
 * Runs a film file through Vite's SSR loader: `@svjeez/vite` does this for a `?svjeez` import of a file that imports
 * `@svjeez/dom/vite`. `component()` needs it: Vite loads the film file's `.svelte` and `.tsx` imports, so it can tell
 * which module exports the component you passed, and serve that module to the browser.
 *
 *     const { scene } = await runFilm("./card.film.tsx");
 */
export const runFilm = async (file: string, options: RunFilmOptions = {}): Promise<Film> => {
  const { createServer, isRunnableDevEnvironment, searchForWorkspaceRoot } =
    await import("vite").catch(() => {
      throw new Error("runFilm from @svjeez/dom/vite needs vite. Install it with `npm i -D vite`.");
    });

  const film = resolve(file);
  const root = options.root ?? (await projectOf(dirname(film))) ?? dirname(film);
  const { config } = options;
  const byId = new Map<string, Page>();

  const cacheDir = await privateCache(config);

  const server = await createServer({
    root,
    logLevel: "warn",
    appType: "custom",
    ...(cacheDir && { cacheDir }),
    ...config,
    plugins: [...(config?.plugins ?? []), pages(byId, film)],
    server: { ...config?.server, port: 0, strictPort: true, hmr: false, watch: null },
  });

  try {
    const environment = server.environments.ssr;

    if (!isRunnableDevEnvironment(environment))
      throw new Error("runFilm: this Vite setup has no runnable SSR environment.");

    await listen(server);

    const bridge: Bridge = {
      server,
      film,
      base: searchForWorkspaceRoot(root),
      pages: byId,
      files: new Set([film]),
    };

    const { default: scene } = await hosts.run(bridge, () =>
      environment.runner.import<{ default: Scene }>(film),
    );

    for (const node of environment.moduleGraph.getModulesByFile(film) ?? [])
      project(node, bridge.files);

    const { svg } = await import("svjeez/tools");

    return {
      scene,
      svg: svg.emit(scene),
      files: [...bridge.files].filter((file) => isAbsolute(file)),
    };
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
      "Is its module loaded? Import the component from its own file, and load this film file through Vite: a ?svjeez import with @svjeez/vite, or runFilm().",
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
 * The film file must be loaded through Vite: import it with `?svjeez` (`@svjeez/vite`), or call `runFilm`. Props are JSON: data props are required and plain,
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
      "component() from @svjeez/dom/vite needs the film file to be loaded through Vite, which is how it finds the component's module. Import it with ?svjeez through @svjeez/vite, or run it with runFilm(file) from @svjeez/dom/vite.",
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

  for (const file of files) host.files.add(file);

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
