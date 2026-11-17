import { remember } from "./sources";
import type { SvgNode } from "./svg";

export const TRACE: unique symbol = Symbol.for("svjeez.sources");

interface Trace {
  readonly within: string;
}

interface Scope {
  readonly Symbol: SymbolConstructor;
  [TRACE]?: Trace;
}

const scope: Scope = globalThis;

export const startTrace = (within: string): void => {
  scope[TRACE] = { within };
};

export const stopTrace = (): void => {
  delete scope[TRACE];
};

export const tracing = (): boolean => scope[TRACE] !== undefined;

const FRAME = /(?:\(|at )((?:file:\/\/)?[^()\s][^()]*?):(\d+):(\d+)\)?\s*$/;

const pathOf = (raw: string): string =>
  raw.startsWith("file://")
    ? decodeURIComponent(raw.slice(7).replace(/^\/([A-Za-z]:)/, "$1"))
    : raw;

const slash = (path: string): string => path.replace(/\\/g, "/");

export const traced = (node: SvgNode): SvgNode => {
  const trace = scope[TRACE];

  if (!trace) return node;
  const within = slash(trace.within).replace(/\/?$/, "/");
  const limit = Error.stackTraceLimit;
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
