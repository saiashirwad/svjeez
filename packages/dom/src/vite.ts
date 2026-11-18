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

export interface RecordingsOptions extends Omit<BrowserOptions, "base" | "screenshots"> {
  readonly cache: string;
  readonly vite?: InlineConfig;
  readonly inputs?: unknown;
}

const ROUTE = "/__svjeez/demo";

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
  const width =
    demo.layout.width === undefined ? "display:inline-block" : `width:${demo.layout.width}px`;

  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:none">
<div id="svjeez-demo" style="${width}"></div>
<script type="module">
import { mount } from "/@fs${FRAMEWORKS[demo.framework].mount}";
import * as demos from "/@fs${file}";
mount(demos[${JSON.stringify(name)}], document.getElementById("svjeez-demo"));
</script></body></html>`;
};

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

const sources = async (server: ViteDevServer, file: string, root: string): Promise<string> => {
  const bundled = server.config.cacheDir;

  const graph = server.environments.ssr.moduleGraph;
  const seen = new Set<string>();
  const paths = new Set<string>();

  const visit = async (id: string | null | undefined) => {
    if (
      !id ||
      seen.has(id) ||
      id.includes("/node_modules/") ||
      id.startsWith(bundled) ||
      id.startsWith("\0")
    )
      return;
    seen.add(id);

    const mod = (await graph.getModuleByUrl(id).catch(() => undefined)) ?? graph.getModuleById(id);

    paths.add(mod?.file ?? id);

    for (const dep of mod?.importedModules ?? []) await visit(dep.id);
  };

  await visit(file);

  const sorted = [...paths].sort();
  const texts = await Promise.all(sorted.map((path) => readFile(path, "utf8").catch(() => "")));

  return sha256(sorted.map((path, i) => relative(root, path) + texts[i]).join(""));
};

type Recordings<M> = {
  [K in keyof M as M[K] extends { readonly kind: "svjeez-demo" } ? K : never]: Step[];
};

export const recordings = async <M extends Record<string, unknown>>(
  file: string,
  { cache, vite: config = {}, inputs, ...options }: RecordingsOptions,
): Promise<Recordings<M>> => {
  const { createServer, mergeConfig } = await import("vite");
  const source = await readFile(file, "utf8");

  const frameworks = (["react", "svelte"] as const).filter((f) =>
    source.includes(`@svjeez/dom/${f}`),
  );

  const root = config.root ?? dirname(file);
  let demos: Record<string, Demo> = {};
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
    await server.listen();
    const mod = await server.ssrLoadModule(file);

    demos = Object.fromEntries(
      Object.entries<unknown>(mod).filter((e): e is [string, Demo] => isDemo(e[1])),
    );

    // SAFETY: the server listens on a port, so its address is an AddressInfo and not a pipe name.
    const { port } = server.httpServer!.address() as AddressInfo;
    const made = await sources(server, file, root);

    // SAFETY: the steps are recorded for every exported demo, by name, which is the type `recordings` gives M's demos.
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
    )) as Recordings<M>;
  } finally {
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
};
