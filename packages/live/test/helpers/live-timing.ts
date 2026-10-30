export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A stand-in worker that answers each compile after `ms`, and never answers a source of `loop`. */
export const fakeWorkers = (ms: number) => {
  const made = { spawned: 0, terminated: 0 };
  const real = globalThis.Worker;

  class Fake {
    onmessage?: (e: { data: unknown }) => void;
    dead = false;

    constructor() {
      made.spawned++;
    }

    postMessage({ id, source }: { id: number; source: string }) {
      if (source === "loop") return;
      setTimeout(
        () => !this.dead && this.onmessage?.({ data: { id, ok: true, svg: source, ms: 0 } }),
        ms,
      );
    }

    terminate() {
      this.dead = true;
      made.terminated++;
    }
  }

  const swap = { configurable: true, writable: true };
  // createCompiler only constructs, posts to, listens on and terminates its worker, which Fake does.
  Object.defineProperty(globalThis, "Worker", { ...swap, value: Fake });

  return {
    made,
    restore: () => void Object.defineProperty(globalThis, "Worker", { ...swap, value: real }),
  };
};
