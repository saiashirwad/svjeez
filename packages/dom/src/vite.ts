import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { InlineConfig, Plugin, ViteDevServer } from "vite";
import type { BrowserOptions } from "./browser.ts";
import { isDemo, PAD, type Demo, type Framework } from "./demo.ts";
import { sha256, snapshots } from "./snapshots.ts";
import type { Step } from "./timeline.ts";

export interface RecordingsOptions extends Omit<BrowserOptions, "base"> {
  /** The file the snapshots are kept in, so a build without changes starts no Chromium (Vite still starts, to hash). */
  readonly cache: string;
  /**
   * Vite config for the app, merged over the one Vite finds from `root`. Default root: the demo file's folder.
   */
  readonly vite?: InlineConfig;
  /** Anything else the demos depend on that the recording can't see. */
  readonly inputs?: unknown;
}

const ROUTE = "/__svjeez/demo";

/**
 * What each framework needs: the module that mounts a demo, the packages bundled up front (so nothing is found late
 * and bundled twice, which would load two copies of the framework), and the ones Vite must resolve to one copy.
 */
const FRAMEWORKS: Record<Framework, { mount: string; deps: string[]; dedupe: string[] }> = {
  react: {
    mount: fileURLToPath(new URL("./react-mount.ts", import.meta.url)),
    deps: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
    dedupe: ["react", "react-dom"],
  },
  svelte: {
    mount: fileURLToPath(new URL("./svelte-mount.svelte.ts", import.meta.url)),
    deps: [],
    dedupe: ["svelte"],
  },
};

const page = (file: string, name: string, demo: Demo) => {
  const width = demo.layout.width === undefined ? "display:inline-block" : `width:${demo.layout.width}px`;

  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:none">
<div id="svjeez-demo" style="${width}"></div>
<script type="module">
import { mount } from "/@fs${FRAMEWORKS[demo.framework].mount}";
import * as demos from "/@fs${file}";
mount(demos[${JSON.stringify(name)}], document.getElementById("svjeez-demo"));
</script></body></html>`;
};

/** Serves one demo at a time on `/__svjeez/demo?name=`. */
const route = (file: string, demos: () => Readonly<Record<string, Demo>>): Plugin => ({
  name: "svjeez-demo",
  configureServer: (server) => {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? "/", "http://x");

      if (url.pathname !== ROUTE) return next();

      const name = url.searchParams.get("name") ?? "";
      const demo = demos()[name];

      if (!demo) return next();

      res.setHeader("content-type", "text/html");
      res.end(await server.transformIndexHtml(req.url ?? ROUTE, page(file, name, demo)));
    });
  },
});

/** Every file of the app the demo module reaches, read, so a change anywhere in it records again. */
const sources = async (server: ViteDevServer, file: string, root: string): Promise<string> => {
  const bundled = server.config.cacheDir;

  const graph = server.environments.ssr.moduleGraph;
  const seen = new Set<string>();
  const paths = new Set<string>();

  const visit = async (id: string | null | undefined) => {
    // Packages and their pre-bundled copies are the lockfile's business, not the app's sources.
    if (!id || seen.has(id) || id.includes("/node_modules/") || id.startsWith(bundled) || id.startsWith("\0")) return;
    seen.add(id);

    const mod = (await graph.getModuleByUrl(id).catch(() => undefined)) ?? graph.getModuleById(id);

    paths.add(mod?.file ?? id);

    for (const dep of mod?.importedModules ?? []) await visit(dep.id);
  };

  await visit(file);

  // In path order, so the hash doesn't depend on the order Vite walked the graph, and by paths from the root, so it
  // doesn't depend on where the checkout is either.
  const sorted = [...paths].sort();
  const texts = await Promise.all(sorted.map((path) => readFile(path, "utf8").catch(() => "")));

  return sha256(sorted.map((path, i) => relative(root, path) + texts[i]).join(""));
};

/**
 * Records every demo a `.demo.tsx` file exports, by name, as steps for `<Dom states>`. The file runs in the app's own
 * Vite dev server, so the component renders as it does in the app. The snapshots are kept in `cache`; a later build
 * records again only when the demo's flow or any file it imports changed.
 */
export const recordings = async <M extends Record<string, unknown>>(
  file: string,
  { cache, vite: config = {}, inputs, ...options }: RecordingsOptions,
): Promise<{ [K in keyof M as M[K] extends { readonly kind: "svjeez-demo" } ? K : never]: Step[] }> => {
  const { createServer, mergeConfig } = await import("vite");
  // Which frameworks the file's demos use, by the entry it imports them from, before Vite starts.
  const source = await readFile(file, "utf8");
  const frameworks = (["react", "svelte"] as const).filter((f) => source.includes(`@svjeez/dom/${f}`));
  const root = config.root ?? dirname(file);
  let demos: Record<string, Demo> = {};
  // A dependency cache of its own: two recordings of one app at once (a build runs scenes together) would otherwise
  // bundle into the same folder, and a page that loads mid-bundle never mounts.
  const cacheDir = await mkdtemp(join(tmpdir(), "svjeez-vite-"));

  const server = await createServer(
    mergeConfig(config, {
      root,
      cacheDir,
      logLevel: "warn",
      appType: "custom",
      plugins: [route(file, () => demos)],
      resolve: { dedupe: frameworks.flatMap((f) => FRAMEWORKS[f].dedupe) },
      optimizeDeps: { entries: [file], include: frameworks.flatMap((f) => FRAMEWORKS[f].deps) },
      server: { port: 0, strictPort: false, hmr: false, fs: { strict: false } },
    } satisfies InlineConfig),
  );

  try {
    // Listening first starts the plugins, which loading a module through them needs.
    await server.listen();
    const mod: Record<string, unknown> = await server.ssrLoadModule(file);

    demos = Object.fromEntries(Object.entries(mod).filter((e): e is [string, Demo] => isDemo(e[1])));

    const { port } = server.httpServer!.address() as AddressInfo;
    const made = await sources(server, file, root);

    return (await snapshots(
      cache,
      { ...options, base: `http://localhost:${port}`, inputs: [made, inputs] },
      async (dom) => {
        const out: Record<string, Step[]> = {};

        for (const [name, demo] of Object.entries(demos)) {
          const pad = demo.layout.pad ?? PAD;

          out[name] = await dom.run(
            {
              url: `${ROUTE}?name=${encodeURIComponent(name)}`,
              root: "#svjeez-demo > *",
              ready: "#svjeez-demo[data-ready] > *",
              width: (demo.layout.width ?? 800) + 2 * pad + 64,
              height: 1000,
              pad,
              parts: demo.layout.parts,
            },
            demo.flow,
          );
        }

        return out;
      },
    )) as never;
  } finally {
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
};
