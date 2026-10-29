import type { Compiled } from "@svjeez/live/compile";

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

/** Scene source in, compiled file out, on the playground's worker. */
export const createCompiler = () =>
  compilerFor<string>(
    new Worker(new URL("../playground/worker.ts", import.meta.url), { type: "module" }),
    (source) => ({ source }),
  );

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
