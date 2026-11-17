import type { Rpc, WorkerLoader } from "@cloudflare/workers-types";
import { validateSvg } from "svjeez/frames";

import { at, type CompileError } from "./error";
import { ALLOWED, MAIN, modulesFor, SCENE } from "./modules";
import { transpile } from "./transpile";

export { ALLOWED, FACES_TEXT } from "./modules";

export type { CompileError } from "./error";

/** A sandbox's bounds: CPU per compile, wall time per compile, and the largest scene and SVG it takes. */
export const BOUNDS = { cpuMs: 3_000, wallMs: 15_000, source: 200_000, svg: 1_500_000 } as const;

/** What a compile answers: the SVG with validateSvg's warnings, or where and why it failed. Both say how long it took. */
export type Compiled =
  | {
      readonly ok: true;
      readonly svg: string;
      readonly warnings: readonly string[];
      readonly ms: number;
    }
  | { readonly ok: false; readonly error: CompileError; readonly ms: number };

type Built = { ok: true; svg: string } | { ok: false; message: string; stack?: string };

interface Child extends Rpc.WorkerEntrypointBranded {
  build(): Promise<Built>;
}

/** Matches workerd's own compatibility date in the tests, and the parent's. */
const DATE = "2026-07-30";

const STACK = new RegExp(`${SCENE.replace(".", "\\.")}:(\\d+):(\\d+)`);

/** workerd's words when a scene reaches for the network, at the top level or inside build(). */
const NETWORK =
  /not permitted to access the internet|Disallowed operation called within global scope/;

const reworded = (message: string) =>
  NETWORK.test(message)
    ? `Scenes have no network, so fetch() and other I/O fail here. Load fonts with google() from @svjeez/fonts (the faces are preloaded), maps from the world-atlas JSON imports, and write any other data into the scene. (The runtime said: ${message})`
    : message;

/** Where in the source a thrown error points: the first frame in the scene, or the import that names a missing export. */
const place = (
  source: string,
  js: string,
  built: { message: string; stack?: string },
): CompileError => {
  const message = reworded(built.message);
  const frame = STACK.exec(built.stack ?? "");

  if (frame) {
    const line = Number(frame[1]);
    const same = js.split("\n")[line - 1] === source.split("\n")[line - 1];

    return at(source, "runtime", message, line, same ? Number(frame[2]) : undefined);
  }

  // Imports come first, so the first line naming the export is the import that asks for it.
  const missing = /export named '([^']+)'/.exec(built.message)?.[1];
  const line = missing ? source.split("\n").findIndex((text) => text.includes(missing)) : -1;

  return at(source, "runtime", message, line < 0 ? undefined : line + 1);
};

const sha = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const TIMEOUT = "timeout";

const timeout = (ms: number) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error(TIMEOUT)), ms));

/**
 * Why the call into the sandbox rejected: the runtime ends a scene that passes its CPU limit or memory by rejecting
 * the call, and the wall-time race rejects with TIMEOUT.
 */
export const stopped = (message: string): CompileError => ({
  kind: "limit",
  message:
    message === TIMEOUT
      ? `The scene did not finish within ${BOUNDS.wallMs / 1000} s. Look for an await that never settles.`
      : /hung/.test(message)
        ? `The scene waits on something that never settles, so it never returned. Look for an await on a promise nothing resolves. (The runtime said: ${message})`
        : /cpu|time limit/i.test(message)
          ? `The scene ran past the CPU limit of ${BOUNDS.cpuMs / 1000} s; a real scene takes well under 0.1 s. Look for a loop that never ends, far too many elements, or sampled() with a tiny step. (The runtime said: ${message})`
          : /memory/i.test(message)
            ? `The scene ran out of memory. Look for a loop that keeps growing an array, or far too many elements. (The runtime said: ${message})`
            : `The sandbox stopped the scene. Look for a loop that never ends, or far too much work. (The runtime said: ${message})`,
});

/**
 * Compiles one scene: a TSX module whose default export returns the string from render(). It runs in a Dynamic
 * Worker with no network, only the library modules its imports reach, and a CPU limit; nothing it does reaches this
 * Worker. Answers the SVG with validateSvg's warnings, or a CompileError placed on the source.
 */
export const compile = async (loader: WorkerLoader, source: string): Promise<Compiled> => {
  const started = Date.now();

  const failed = (error: CompileError): Compiled => ({
    ok: false,
    error,
    ms: Date.now() - started,
  });

  if (source.length > BOUNDS.source)
    return failed({
      kind: "limit",
      message: `The scene is ${source.length} characters, and the most this service compiles is ${BOUNDS.source}. Compute repeated parts in code instead of writing them out.`,
    });

  const scene = await transpile(source, ALLOWED);

  if ("kind" in scene) return failed(scene);

  const modules = {
    "main.js": { js: MAIN },
    [SCENE]: { js: scene.js },
    ...modulesFor(scene.imports),
  };

  // The same scene on the same library gets the same id, so the loader may reuse its isolate.
  const id = await sha(JSON.stringify([BUILD, scene.js]));

  const worker = loader.get(id, () => ({
    compatibilityDate: DATE,
    mainModule: "main.js",
    modules,
    globalOutbound: null,
    limits: { cpuMs: BOUNDS.cpuMs },
  }));

  let built: Built;

  try {
    built = await Promise.race([worker.getEntrypoint<Child>().build(), timeout(BOUNDS.wallMs)]);
  } catch (error) {
    return failed(stopped(error instanceof Error ? error.message : String(error)));
  }

  if (!built.ok) return failed(place(source, scene.js, built));

  if (built.svg.length > BOUNDS.svg)
    return failed({
      kind: "limit",
      message: `The SVG is ${Math.round(built.svg.length / 1024)} KB, and the most this service keeps is ${BOUNDS.svg / 1000} KB. Raise tolerances, simplify paths (a map's tolerance, or world-atlas's 110m files instead of 50m), use fewer keyframes, or embed fewer fonts.`,
    });

  return {
    ok: true,
    svg: built.svg,
    warnings: validateSvg(built.svg).warnings,
    ms: Date.now() - started,
  };
};

/** Set at build: a deploy's library differs from the last one's, so its isolates must not be reused. */
declare const BUILD: string;
