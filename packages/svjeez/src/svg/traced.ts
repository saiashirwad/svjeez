import type { JsxSource } from "../author/sources";

export const TRACE: unique symbol = Symbol.for("svjeez.sources");

export interface TimelineTrack {
  readonly label: string;
  readonly source?: string;
  readonly spans: readonly { readonly at: number; readonly over: number }[];
  readonly period?: number;
}

export interface BuildReport {
  readonly warnings: readonly string[];
  readonly duration?: number;
  readonly loop?: boolean;
  readonly timeline: readonly TimelineTrack[];
}

interface Trace {
  readonly within?: string;
  readonly sources?: boolean;
  readonly onRender: (svg: string, report: BuildReport) => void;
}

interface Scope {
  readonly Symbol: SymbolConstructor;
  [TRACE]?: Trace;
}

const scope: Scope = globalThis;

export const startTrace = (trace: Trace): void => {
  scope[TRACE] = trace;
};

export const stopTrace = (): void => {
  delete scope[TRACE];
};

export const traceOf = (): Trace | undefined => scope[TRACE];

const FRAME = /(?:\(|at )((?:file:\/\/)?[^()\s][^()]*?):(\d+):(\d+)\)?\s*$/;

const pathOf = (raw: string): string =>
  raw.startsWith("file://")
    ? decodeURIComponent(raw.slice(7).replace(/^\/([A-Za-z]:)/, "$1"))
    : raw;

const slash = (path: string): string => path.replace(/\\/g, "/");

/** Where the code that called in was written, when a trace inspects files under its `within` directory. */
export const caller = (): JsxSource | undefined => {
  const directory = scope[TRACE]?.within;

  if (!directory) return undefined;
  const within = slash(directory).replace(/\/?$/, "/");
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 80;
  const stack = new Error().stack ?? "";
  Error.stackTraceLimit = limit;

  for (const line of stack.split("\n")) {
    const match = FRAME.exec(line);

    if (!match) continue;
    const fileName = slash(pathOf(match[1] ?? ""));

    if (!fileName.startsWith(within) || fileName.includes("/node_modules/")) continue;

    return { fileName, lineNumber: Number(match[2]), columnNumber: Number(match[3]) };
  }

  return undefined;
};
