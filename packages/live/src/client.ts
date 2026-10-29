// The page side of a compile worker: one promise per job, and a queue that keeps only the newest job.
import type { Compiled } from "./compile.ts";

/**
 * A client for a worker that answers `{ id, ...Compiled }` to `{ id, ...message(job) }`. A worker that fails to load
 * fails every compile with the reason, so the page can show it.
 */
export const compilerFor = <Job>(worker: Worker, message: (job: Job) => object) => {
  const waiting = new Map<number, (r: Compiled) => void>();
  let next = 0;
  let broken: Compiled | undefined;

  const breakWith = (text: string) => {
    broken = { ok: false, error: { kind: "runtime", message: text }, ms: 0 };

    for (const resolve of waiting.values()) resolve(broken);
    waiting.clear();
  };

  worker.onmessage = ({ data }: MessageEvent<{ id: number } & Compiled>) => {
    waiting.get(data.id)?.(data);
    waiting.delete(data.id);
  };

  worker.onerror = (e) =>
    breakWith(`The compiler failed to start${e.message ? `: ${e.message}` : "."}`);
  worker.onmessageerror = () =>
    breakWith("The compiler sent back something the page could not read.");

  return (job: Job) =>
    broken
      ? Promise.resolve(broken)
      : new Promise<Compiled>((resolve) => {
          const id = ++next;
          waiting.set(id, resolve);
          worker.postMessage({ id, ...message(job) });
        });
};

/** A worker that compiles scene source with `compileScene`. */
export const sceneWorker = () =>
  new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

/**
 * Scene source in, compiled file out, on a worker of its own. `sources` marks every element with the line that made it.
 * A scene that runs past `timeout` milliseconds, an endless loop say, fails with that reason, and a fresh worker takes
 * the next job. `stop` ends the worker for good.
 */
export const createCompiler = ({ sources = false, timeout = 10_000 } = {}) => {
  const start = () => {
    const spawned = sceneWorker();

    return {
      compile: compilerFor<string>(spawned, (source) => ({ source, sources })),
      terminate: () => spawned.terminate(),
    };
  };

  let worker = start();
  let stopped = false;
  const waiting = new Set<(result: Compiled) => void>();

  const compile = (source: string) =>
    new Promise<Compiled>((resolve) => {
      if (stopped) return resolve(STOPPED);
      waiting.add(resolve);

      const timer = setTimeout(() => {
        worker.terminate();
        worker = start();

        const late: Compiled = {
          ok: false,
          error: {
            kind: "runtime",
            message: `The scene ran for over ${timeout / 1000}s without finishing, so it was stopped.`,
          },
          ms: timeout,
        };

        for (const pending of waiting) pending(late);
        waiting.clear();
      }, timeout);

      void worker.compile(source).then((result) => {
        clearTimeout(timer);

        if (waiting.delete(resolve)) resolve(result);
      });
    });

  return Object.assign(compile, {
    stop: () => {
      stopped = true;
      worker.terminate();

      for (const pending of waiting) pending(STOPPED);
      waiting.clear();
    },
  });
};

const STOPPED: Compiled = {
  ok: false,
  error: { kind: "runtime", message: "The compiler was stopped." },
  ms: 0,
};

/**
 * Runs jobs one at a time, and while one runs keeps only the newest of the jobs that arrive, so a drag never builds a
 * backlog.
 */
export const latestWins = <T>(run: (job: T) => Promise<void>) => {
  let busy = false;
  let queued: { readonly job: T } | undefined;

  const pump = async () => {
    if (busy || !queued) return;
    const { job } = queued;
    queued = undefined;
    busy = true;

    try {
      await run(job);
    } finally {
      busy = false;
    }

    void pump();
  };

  return (job: T) => {
    queued = { job };
    void pump();
  };
};
