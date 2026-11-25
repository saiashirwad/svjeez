import { fileURLToPath } from "node:url";
import type { Framework } from "./framework.ts";
import { react } from "./frameworks/react.ts";
import { svelte } from "./frameworks/svelte.ts";
import type { Bag, Fn, Prop, Wire } from "./props.ts";

export interface ComponentOptions {
  /** Global stylesheets to load into the page, as the bundler gives them to you: `import theme from "./theme.css?url"` with Vite, `import theme from "./theme.css" with { type: "file" }` with Bun. */
  readonly css?: readonly string[];
  /** The framework, when detection (file extension or component shape) guesses wrong or yours is not built in. */
  readonly framework?: Framework;
  /** The selector `film` captures. Default: the mount point, `#svjeez-root`. */
  readonly selector?: string;
}

/** The frameworks `component()` tries, in order. */
export const frameworks: readonly Framework[] = [svelte, react];

/** Where a component lives: the module's file, and the name it is exported under (`"default"` or a named export). */
export interface Located {
  readonly file: string;
  readonly name: string;
}

/** A module that the Bun preload has seen: its file, and its live exports. */
export interface Registered {
  readonly file: string;
  readonly exports: Bag;
}

declare global {
  /** Where modules register themselves; `component()` from `@svjeez/dom/bun` reads it. */
  var svjeezDomRegistry: Registered[] | undefined;
}

export const SELECTOR = "#svjeez-root";

const BOOT = fileURLToPath(new URL("./boot.ts", import.meta.url));

export const pickFramework = (
  { file }: Located,
  component: Prop,
  given: Framework | undefined,
): Framework => {
  const found = given ?? frameworks.find((framework) => framework.detect(file, component));

  if (!found)
    throw new Error(
      `component: no framework recognises ${file}. Built in: ${frameworks.map((f) => f.name).join(", ")}. Pass { framework } to use another.`,
    );

  return found;
};

/** The module the page runs: imports the component from its file and mounts it through the framework's browser adapter. */
export const entryModule = ({ file, name }: Located, framework: Framework, wire: Wire): string =>
  [
    name === "default"
      ? `import Component from ${JSON.stringify(file)};`
      : `import { ${name} as Component } from ${JSON.stringify(file)};`,
    `import adapter from ${JSON.stringify(framework.client)};`,
    `import { boot } from ${JSON.stringify(BOOT)};`,
    `boot(adapter, Component, ${JSON.stringify(wire)});`,
  ].join("\n");

export const pageHtml = (css: readonly string[], script: string): string =>
  `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
${css.map((href) => `    <link rel="stylesheet" href=${JSON.stringify(href)} />`).join("\n")}
  </head>
  <body>
    <script type="module" src=${JSON.stringify(script)}></script>
  </body>
</html>
`;

/** The name a component goes by in error messages. */
export const nameOf = (component: Prop): string =>
  (isFunction(component) && component.name) || "the component";

const isFunction = (value: Prop): value is Fn => typeof value === "function";

/** The export of `exports` that is `value`, if any. Reading an export can throw (TDZ, getters), which just means "not this one". */
export const exportNameOf = (exports: Bag, value: Prop): string | undefined => {
  for (const key of Object.keys(exports))
    try {
      if (exports[key] === value) return key;
    } catch {}
};

/** The file of the first stack frame that is not in this package: the film file calling `component()`. */
export const callerFile = (): string | undefined => {
  const here = fileURLToPath(new URL(".", import.meta.url));

  for (const line of (new Error().stack ?? "").split("\n").slice(1)) {
    const match = /\(?((?:file:\/\/)?\/[^():]+?):\d+:\d+\)?$/.exec(line.trim());
    const file = match?.[1]?.replace(/^file:\/\//, "");

    if (file && !file.startsWith(here)) return file;
  }
};

export const notFound = (component: Prop, how: string): Error =>
  new Error(`component: could not find the module that exports ${nameOf(component)}. ${how}`);
