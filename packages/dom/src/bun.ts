import type { HTMLBundle } from "bun";
import { createHash } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
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
    // Development mode breaks CSS modules in Bun 1.4.3 (`import_X_module is not defined`).
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

  // A barrel that re-exports the component matches too; prefer the shortest path of re-exports: the file it is written in.
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
 * React only: Bun cannot bundle Svelte yet, so use `@svjeez/dom/vite` for `.svelte` components.
 */
export const component = async <C extends Fn>(
  Component: C,
  props: PropsFor<C>,
  options: ComponentOptions = {},
): Promise<Target<Partial<PropsFor<C>>>> => {
  // SAFETY: `PropsFor` is a plain object type; the runtime check in `serializeProps` is what holds it to JSON.
  const wire = serializeProps(props as Bag, "component");
  const located = locate(Component);
  const framework = pickFramework(located, Component, options.framework);

  if (framework.name === "svelte")
    throw new Error(
      "component: Bun cannot bundle Svelte yet. Film .svelte components with component() from @svjeez/dom/vite.",
    );

  const dir = await realpath(await mkdtemp(join(tmpdir(), "svjeez-dom-")));

  try {
    // Stylesheets from `with { type: "file" }` are absolute paths; the bundler wants them relative to the page.
    const css = (options.css ?? []).map((href) => (isAbsolute(href) ? relative(dir, href) : href));

    await Bun.write(join(dir, "entry.ts"), entryModule(located, framework, wire));
    await Bun.write(join(dir, "index.html"), pageHtml(css, "./entry.ts"));

    // The HTML bundler answers a broken build with an empty 500, so build once here to say what is wrong.
    const built = await Bun.build({ entrypoints: [join(dir, "index.html")], throw: false });

    if (!built.success)
      throw new Error(
        `component: Bun could not bundle ${located.file}:\n${built.logs.map((log) => `  ${log.message}`).join("\n")}`,
      );

    // SAFETY: Bun gives an HTML import as an `HTMLBundle`.
    const { default: html } = (await import(join(dir, "index.html"))) as { default: HTMLBundle };
    const app = serve(html, { selector: options.selector ?? SELECTOR });

    return {
      ...app,
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
