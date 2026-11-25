import type { BunPlugin, HTMLBundle } from "bun";
import { createHash } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  callerFile,
  entryModule,
  exportNameOf,
  nameOf,
  notFound,
  pageHtml,
  pickFramework,
  SELECTOR,
  type ComponentOptions,
  type Located,
} from "./component.ts";
import { hashPage } from "./hash.ts";
import { serializeProps, type Bag, type Fn, type Prop, type PropsFor } from "./props.ts";
import type { Target } from "./target.ts";

export type { ComponentOptions } from "./component.ts";

export interface ServeOptions {
  /** The element to capture, as a CSS selector. */
  readonly selector: string;
  /** The port. Default: any free one. */
  readonly port?: number;
}

/**
 * Serves a Bun HTML import (`import index from "./index.html"`) as a `film` target.
 * `sources()` hashes the page and every asset it references, as Bun bundled them.
 */
export const serve = (html: HTMLBundle, { selector, port = 0 }: ServeOptions): Target => {
  const server = Bun.serve({
    port,
    routes: { "/": html },
    development: false,
  });

  const url = `http://localhost:${server.port}/`;

  return {
    url,
    selector,
    sources: () => hashPage(url),
    close: () => server.stop(true),
  };
};

/** Serves a built directory (a `Bun.build` output with an `index.html`) as a `film` target. */
const serveDirectory = (dir: string, { selector }: Pick<ServeOptions, "selector">): Target => {
  const server = Bun.serve({
    port: 0,
    fetch: async ({ url }) => {
      const { pathname } = new URL(url);
      const file = resolve(dir, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);
      const found = file.startsWith(dir + sep) && Bun.file(file);

      return found && (await found.exists())
        ? new Response(found)
        : new Response("Not found", { status: 404 });
    },
  });

  const url = `http://localhost:${server.port}/`;

  return { url, selector, sources: () => hashPage(url), close: () => server.stop(true) };
};

const sveltePlugin = async (): Promise<BunPlugin> => {
  const { SveltePlugin } = await import("bun-plugin-svelte").catch(() => {
    throw new Error(
      "component: filming .svelte components with @svjeez/dom/bun needs bun-plugin-svelte. Install it with `bun add -D bun-plugin-svelte`.",
    );
  });

  return SveltePlugin({ development: false });
};

const locate = (component: Prop): Located => {
  const registry = globalThis.svjeezDomRegistry;

  if (!registry)
    throw new Error(
      'component() from @svjeez/dom/bun needs the preload that records where components come from. Add `preload = ["@svjeez/dom/bun/preload"]` to bunfig.toml and run the film file with bun.',
    );

  const found = registry.flatMap(({ file, exports }) => {
    const name = exportNameOf(exports, component);

    return name ? [{ file, name }] : [];
  });

  const [defining] = found.toSorted(
    (a, b) => Number(a.name !== "default") - Number(b.name !== "default"),
  );

  if (!defining)
    throw notFound(
      component,
      "Import it from its own module (not one defined in the film file, and not from node_modules), and make sure bunfig.toml preloads @svjeez/dom/bun/preload.",
    );

  if (defining.file === callerFile())
    throw new Error(
      `component: ${nameOf(component)} is defined in the film file itself (${defining.file}). Move it to its own module and import it, so the browser can load it.`,
    );

  return defining;
};

/**
 * Films one component, mounted alone in a page, with typed props. Bun bundles the component's module for the browser:
 *
 *     import Card from "./Card.tsx";
 *     import theme from "./theme.css" with { type: "file" };
 *
 *     export default await film(component(Card, { task }, { css: [theme] }), async ({ snap, update }) => {
 *       await snap("todo");
 *       await update({ task: { ...task, done: true } });
 *       await snap("done");
 *     });
 *
 * Needs `preload = ["@svjeez/dom/bun/preload"]` in bunfig.toml (that is how the component's module is found by identity).
 * Svelte components also need `bun-plugin-svelte` (a dev dependency): the preload loads it so the film file can import `.svelte`, and `component` bundles the page with it.
 */
export const component = async <C extends Fn>(
  Component: C,
  props: PropsFor<C>,
  options: ComponentOptions = {},
): Promise<Target<Partial<PropsFor<C>>>> => {
  // SAFETY: `PropsFor` is a plain object type; the runtime check in `serializeProps` is what holds it to JSON.
  const wire = serializeProps(props as Bag, "component");
  const located = locate(Component);
  const film = callerFile();
  const framework = pickFramework(located, Component, options.framework);

  const dir = await realpath(await mkdtemp(join(tmpdir(), "svjeez-dom-")));

  try {
    const css = (options.css ?? []).map((href) => (isAbsolute(href) ? relative(dir, href) : href));

    await Bun.write(join(dir, "entry.ts"), entryModule(located, framework, wire));
    await Bun.write(join(dir, "index.html"), pageHtml(css, "./entry.ts"));

    const out = join(dir, "dist");

    const built = await Bun.build({
      entrypoints: [join(dir, "index.html")],
      outdir: out,
      plugins: framework.name === "svelte" ? [await sveltePlugin()] : [],
      throw: false,
    });

    if (!built.success)
      throw new Error(
        `component: Bun could not bundle ${located.file}:\n${built.logs.map((log) => `  ${log.message}`).join("\n")}`,
      );

    const app = serveDirectory(out, { selector: options.selector ?? SELECTOR });

    return {
      ...app,
      ...(film && { film }),
      ...(Component.name && { title: Component.name }),
      sources: async () =>
        createHash("sha256")
          .update(await hashPage(app.url))
          .update(JSON.stringify(wire))
          .digest("hex"),
      close: async () => {
        await app.close();
        await rm(dir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(dir, { recursive: true, force: true });

    throw error;
  }
};
