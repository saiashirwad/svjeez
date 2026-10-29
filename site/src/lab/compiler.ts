import type { Compiled } from "../playground/core";

/** Scene source in, compiled file out, on the playground's worker. A worker that fails to load fails every compile with the reason. */
export const createCompiler = () => {
  const worker = new Worker(new URL("../playground/worker.ts", import.meta.url), { type: "module" });
  const waiting = new Map<number, (r: Compiled) => void>();
  let next = 0;
  let broken: Compiled | undefined;

  const breakWith = (message: string) => {
    broken = { ok: false, error: { kind: "runtime", message }, ms: 0 };
    for (const resolve of waiting.values()) resolve(broken);
    waiting.clear();
  };

  worker.onmessage = ({ data }: MessageEvent<{ id: number } & Compiled>) => {
    waiting.get(data.id)?.(data);
    waiting.delete(data.id);
  };
  worker.onerror = (e) => breakWith(`The compiler failed to start${e.message ? `: ${e.message}` : "."}`);
  worker.onmessageerror = () => breakWith("The compiler sent back something the page could not read.");

  return (source: string) =>
    broken
      ? Promise.resolve(broken)
      : new Promise<Compiled>((resolve) => {
          const id = ++next;
          waiting.set(id, resolve);
          worker.postMessage({ id, source });
        });
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
