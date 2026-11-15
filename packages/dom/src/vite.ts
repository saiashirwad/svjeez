import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import type { InlineConfig, Plugin, ViteDevServer } from "vite";
import type { BrowserOptions } from "./browser.ts";
import { isDemo, type Demo, type Framework } from "./demo.ts";
import { snapshots } from "./snapshots.ts";
import type { Step } from "./timeline.ts";

export interface RecordingsOptions extends Omit<BrowserOptions, "base"> {
  /** The file the snapshots are kept in, so a build without changes starts neither Vite's browser nor Chromium. */
  readonly cache: string;
  /**
   * Vite config for the app, merged over the one Vite finds from `root`. Default root: the demo file's folder.
   */
  readonly vite?: InlineConfig;
  /** Anything else the demos depend on that the recording can't see. */
  readonly inputs?: unknown;
}

const ROUTE = "/__svjeez/demo";
const MOUNTS: Record<Framework, string> = {
  react: fileURLToPath(new URL("./react-mount.ts", import.meta.url)),
  svelte: fileURLToPath(new URL("./svelte-mount.svelte.ts", import.meta.url)),
};

/** Bundled up front, so nothing is found late and bundled twice, which would load two copies of the framework. */
const DEPS: Record<Framework, string[]> = {
  react: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  svelte: [],
};

const page = (file: string, name: string, demo: Demo) => {
  const width = demo.layout.width === undefined ? "display:inline-block" : `width:${demo.layout.width}px`;

  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:none">
<div id="svjeez-demo" style="${width}"></div>
<script type="module">
import { mount } from "/@fs${MOUNTS[demo.framework]}";
import * as demos from "/@fs${file}";
mount(demos[${JSON.stringify(name)}], document.getElementById("svjeez-demo"));
</script></body></html>`;
};

/** Serves one demo at a time on `/__svjeez/demo?name=`. */
const route = (file: string, demos: Readonly<Record<string, Demo>>): Plugin => ({
  name: "svjeez-demo",
  configureServer: (server) => {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? "/", "http://x");

      if (url.pathname !== ROUTE) return next();

      const name = url.searchParams.get("name") ?? "";
      const demo = demos[name];

      if (!demo) return next();

      res.setHeader("content-type", "text/html");
      res.end(await server.transformIndexHtml(req.url ?? ROUTE, page(file, name, demo)));
    });
  },
});

/** Every file of the app the demo module reaches, read, so a change anywhere in it records again. */
const sources = async (server: ViteDevServer, file: string): Promise<string> => {
  const graph = server.environments.ssr.moduleGraph;
  const seen = new Set<string>();
  const hash = createHash("sha256");

  const visit = async (id: string | null | undefined) => {
    if (!id || seen.has(id) || id.includes("/node_modules/") || id.startsWith("\0")) return;
    seen.add(id);

    const mod = await graph.getModuleByUrl(id).catch(() => undefined) ?? graph.getModuleById(id);
    const path = mod?.file ?? id;

    hash.update(path).update(await readFile(path, "utf8").catch(() => ""));

    for (const dep of mod?.importedModules ?? []) await visit(dep.id);
  };

  await visit(file);

  return hash.digest("hex");
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
  const root = config.root ?? fileURLToPath(new URL(".", `file://${file}`));
  let demos: Record<string, Demo> = {};

  const server = await createServer(
    mergeConfig(config, {
      root,
      logLevel: "warn",
      appType: "custom",
      plugins: [route(file, new Proxy({}, { get: (_, name: string) => demos[name] }))],
      resolve: { dedupe: frameworks.flatMap((f) => (f === "react" ? ["react", "react-dom"] : [f])) },
      optimizeDeps: { entries: [file], include: frameworks.flatMap((f) => DEPS[f]) },
      server: { port: 0, strictPort: false, hmr: false, fs: { strict: false } },
    } satisfies InlineConfig),
  );

  try {
    // Listening first starts the plugins, which loading a module through them needs.
    await server.listen();
    const mod: Record<string, unknown> = await server.ssrLoadModule(file);

    demos = Object.fromEntries(Object.entries(mod).filter((e): e is [string, Demo] => isDemo(e[1])));

    const { port } = server.httpServer!.address() as AddressInfo;
    const made = await sources(server, file);

    return (await snapshots(
      cache,
      { ...options, base: `http://localhost:${port}`, inputs: [made, inputs] },
      async (dom) => {
        const out: Record<string, Step[]> = {};

        for (const [name, demo] of Object.entries(demos))
          out[name] = await dom.run(
            {
              url: `${ROUTE}?name=${encodeURIComponent(name)}`,
              root: "#svjeez-demo > *",
              ready: "#svjeez-demo[data-ready] > *",
              width: (demo.layout.width ?? 800) + 2 * (demo.layout.pad ?? 16) + 64,
              height: 1000,
              pad: demo.layout.pad ?? 16,
              parts: demo.layout.parts,
            },
            demo.flow,
          );

        return out;
      },
    )) as never;
  } finally {
    await server.close();
  }
};
