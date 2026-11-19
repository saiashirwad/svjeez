import type { JsxSource } from "../author/sources";

export const TRACE: unique symbol = Symbol.for("svjeez.sources");

interface Trace {
  readonly within?: string;
  readonly sources?: boolean;
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

export const caller = (): JsxSource | undefined => {
  if (!scope[TRACE]?.within) return undefined;
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 80;
  const stack = new Error().stack ?? "";
  Error.stackTraceLimit = limit;

  return frameIn(stack);
};

export const thrownFrom = (error: Error): JsxSource | undefined =>
  error.stack ? frameIn(error.stack) : undefined;

const frameIn = (stack: string): JsxSource | undefined => {
  const directory = scope[TRACE]?.within;

  if (!directory) return undefined;
  const within = slash(directory).replace(/\/?$/, "/");

  for (const line of stack.split("\n")) {
    const match = FRAME.exec(line);

    if (!match) continue;
    const fileName = slash(pathOf(match[1] ?? ""));

    if (!fileName.startsWith(within) || fileName.includes("/node_modules/")) continue;

    return { fileName, lineNumber: Number(match[2]), columnNumber: Number(match[3]) };
  }

  return undefined;
};
