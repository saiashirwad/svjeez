import { remember } from "./sources";
import type { SvgNode } from "./svg";

/**
 * Turns on `data-source` for a process that cannot choose how a scene's JSX is compiled. `svjeez check` sets it before it
 * imports the scene: Bun's runtime and tsx both compile JSX without positions, and the scene calls `render()` itself, so
 * neither `svjeez/jsx-dev-runtime` nor `render({ sources: true })` is in reach. While it is set, `jsx()` reads where each
 * element was written off the call stack, taking the first frame in a file under `within` and outside `node_modules`,
 * and `render()` writes `data-source` as if `sources` were true. An element made inside a library component therefore
 * points at the scene line that used the component.
 */
export const TRACE: unique symbol = Symbol.for("svjeez.sources");

interface Trace {
  /** An absolute directory. Frames in files under it count as the scene's own code. */
  readonly within: string;
}

interface Scope {
  readonly Symbol: SymbolConstructor;
  [TRACE]?: Trace;
}

const scope: Scope = globalThis;

/** Start reading sources off the stack for every element made from now on, as `svjeez check` does. */
export const startTrace = (within: string): void => {
  scope[TRACE] = { within };
};

export const stopTrace = (): void => {
  delete scope[TRACE];
};

/** Whether a tool has asked `render()` for sources without passing `sources`. */
export const tracing = (): boolean => scope[TRACE] !== undefined;

// V8 and JavaScriptCore under Bun both write "at name (path:line:column)" or "at path:line:column".
const FRAME = /(?:\(|at )((?:file:\/\/)?[^()\s][^()]*?):(\d+):(\d+)\)?\s*$/;

const pathOf = (raw: string): string =>
  raw.startsWith("file://")
    ? decodeURIComponent(raw.slice(7).replace(/^\/([A-Za-z]:)/, "$1"))
    : raw;

const slash = (path: string): string => path.replace(/\\/g, "/");

/** The node, remembered at the first frame of the scene's own code when a trace is on. */
export const traced = (node: SvgNode): SvgNode => {
  const trace = scope[TRACE];

  if (!trace) return node;
  const within = slash(trace.within).replace(/\/?$/, "/");
  const limit = Error.stackTraceLimit;
  // Library components can sit many frames deep before the scene's own call.
  Error.stackTraceLimit = 80;
  const stack = new Error().stack ?? "";
  Error.stackTraceLimit = limit;

  for (const line of stack.split("\n")) {
    const match = FRAME.exec(line);

    if (!match) continue;
    const fileName = slash(pathOf(match[1] ?? ""));

    if (!fileName.startsWith(within) || fileName.includes("/node_modules/")) continue;

    return remember(node, {
      fileName,
      lineNumber: Number(match[2]),
      columnNumber: Number(match[3]),
    });
  }

  return node;
};
