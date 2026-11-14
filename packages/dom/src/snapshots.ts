import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  browserOf,
  chromiumPages,
  type Browser,
  type BrowserOptions,
  type Io,
  type Pages,
} from "./browser.ts";
import type { Snapshot } from "./tree.ts";

/** Bump when the shape of the file changes, so stale files are read again. */
const FORMAT = 3;

export interface SnapshotsOptions extends BrowserOptions {
  /**
   * What the pages depend on that `run` doesn't show as data: `act()` functions, the app behind `open()`, CSS
   * built by a function. A new value reads the pages again.
   */
  readonly inputs?: unknown;
}

/** One card: how it was opened, what it was told as data, and what it read. */
interface Tape {
  readonly opened: string;
  readonly trace: string[];
  readonly snaps: Snapshot[];
}

/** A trace keeps a digest of each entry, not the markup and CSS themselves, so the file stays small. */
const digest = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(value) ?? "")
    .digest("hex")
    .slice(0, 16);

/** A function isn't data, so the trace says only that one ran. */
const entry = (action: Parameters<Io["act"]>[0]) =>
  digest(typeof action === "function" ? "act" : action);

const record = (pages: Pages, tapes: Tape[]): Pages => {
  const tape = async (opened: string, io: () => Promise<Io>): Promise<Io> => {
    // Pushed before the page opens, so cards opened together keep the order they were asked for in.
    const t: Tape = { opened, trace: [], snaps: [] };

    tapes.push(t);
    const inner = await io();

    return {
      read: async () => {
        const snapshot = await inner.read();

        t.trace.push(SNAP);
        t.snaps.push(snapshot);

        return snapshot;
      },
      act: (action) => {
        t.trace.push(entry(action));

        return inner.act(action);
      },
      close: inner.close,
    };
  };

  return {
    mount: (html, options) =>
      tape(digest(["mount", html, options]), () => pages.mount(html, options)),
    open: (url, options) => tape(digest(["open", url, options]), () => pages.open(url, options)),
    close: pages.close,
  };
};

class Stale extends Error {}

const SNAP = digest("snap");

/** Cards that give back what the tapes read, as long as `run` asks for the same things in the same order. */
const replay = (tapes: readonly Tape[]) => {
  const played: number[] = [];

  const card = async (opened: string): Promise<Io> => {
    const i = played.push(0) - 1;
    const tape = tapes[i];

    if (tape?.opened !== opened) throw new Stale();

    let snaps = 0;

    const step = (said: string) => {
      if (tape.trace[played[i]!] !== said) throw new Stale();
      played[i]!++;
    };

    return {
      read: async () => {
        step(SNAP);

        return tape.snaps[snaps++]!;
      },
      act: async (action) => step(entry(action)),
      close: async () => {},
    };
  };

  const pages: Pages = {
    mount: (html, options) => card(digest(["mount", html, options])),
    open: (url, options) => card(digest(["open", url, options])),
    close: async () => {},
  };

  return {
    dom: browserOf(pages),
    whole: () =>
      played.length === tapes.length && played.every((n, i) => n === tapes[i]!.trace.length),
  };
};

const version = async (): Promise<string> =>
  (
    JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    }
  ).version;

/**
 * Runs `run` against snapshots kept in `file`, so a build without changes never starts Chromium. The file records
 * what each card was opened with, every data instruction and every snapshot. While `run` asks for the same, the
 * cards give the saved snapshots back; when it asks for something else, or `inputs` (or this package) changed, it
 * runs again in Chromium. `run` itself always runs, so timing on a snap is never stale.
 * `SVJEEZ_DOM_REFRESH=1` reads again anyway.
 */
export const snapshots = async <T>(
  file: string,
  { inputs, ...options }: SnapshotsOptions,
  run: (dom: Browser) => Promise<T>,
): Promise<T> => {
  const hash = createHash("sha256")
    .update(JSON.stringify([inputs, await version(), FORMAT]))
    .digest("hex");

  if (!process.env.SVJEEZ_DOM_REFRESH) {
    const saved = await readFile(file, "utf8").then(
      (text) => JSON.parse(text) as { hash?: string; tapes?: Tape[] },
      () => undefined,
    );

    if (saved?.hash === hash && saved.tapes) {
      const { dom, whole } = replay(saved.tapes);
      const out = await run(dom).then(
        (value) => ({ value }),
        (error: unknown) => {
          if (error instanceof Stale) return undefined;
          throw error;
        },
      );

      if (out && whole()) return out.value;
    }
  }

  const tapes: Tape[] = [];
  const pages = await chromiumPages(options);

  try {
    const value = await run(browserOf(record(pages, tapes)));

    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ hash, tapes }));

    return value;
  } finally {
    await pages.close();
  }
};
