import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { brotliCompressSync, brotliDecompressSync } from "node:zlib";
import {
  browserOf,
  isCssText,
  type Browser,
  type BrowserOptions,
  type Io,
  type MountOptions,
  type OpenOptions,
  type Pages,
} from "./browser.ts";
import { chromiumPages } from "./chromium.ts";
import type { Action } from "./flow.ts";
import type { Step } from "./timeline.ts";
import type { Snapshot } from "./tree.ts";

/** Bump when the shape of the file changes, so stale files are read again. */
const FORMAT = 6;

export interface SnapshotsOptions extends Omit<BrowserOptions, "screenshots"> {
  /**
   * What the pages depend on that `run` doesn't show as data: `act()` functions, the app behind `open()`, CSS
   * built by a function. A new value reads the pages again.
   */
  readonly inputs?: unknown;
  /**
   * A folder to also write what the fidelity check needs into: a PNG of the card per snapshot and scheme, and the
   * steps and fonts as `run` gave them, in a subfolder named after `file`. Reads Chromium again, and nothing here
   * goes in `file`. Defaults to `SVJEEZ_DOM_SHOTS`.
   */
  readonly screenshots?: string;
}

/** What the fidelity check reads, in `recording.json` next to the PNGs. */
export interface Recording {
  readonly fonts: readonly { family: string; weight: number; style: "normal" | "italic"; href: string }[];
  readonly cards: readonly { readonly steps: Step[]; readonly snaps: number }[];
}

/** The subfolder of `root` a recording's screenshots go in. */
export const shotsDir = (root: string, file: string) =>
  join(root, `${basename(dirname(resolve(file)))}-${basename(file, ".json")}`);

/** The PNG of one card's `snap`th snapshot in a scheme. */
export const shotName = (card: number, snap: number, scheme: string) => `${card}-${snap}-${scheme}.png`;

/** One card: how it was opened, what it was told as data, and what it read. */
interface Tape {
  readonly opened: string;
  readonly trace: string[];
  readonly snaps: Snapshot[];
  /** What `run` gave back, when the screenshots are being kept. */
  steps?: Step[];
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** What a trace records: how a card was opened, or an instruction. */
type Entry = string | Action | readonly (string | MountOptions | OpenOptions | undefined)[];

/** A trace keeps a digest of each entry, not the markup and CSS themselves, so the file stays small. */
const digest = (entry: Entry) => sha256(JSON.stringify(entry)).slice(0, 16);

const SNAP = digest("snap");

/** A function isn't data, so the trace says only that one ran. */
const ACT = digest("act");

const record = (pages: Pages, tapes: Tape[], shots?: string): Pages => {
  const tape = async (opened: string, io: () => Promise<Io>): Promise<Io> => {
    // Pushed before the page opens, so cards opened together keep the order they were asked for in.
    const t: Tape = { opened, trace: [], snaps: [] };

    const card = tapes.push(t) - 1;
    const inner = await io();

    return {
      read: async () => {
        const snapshot = await inner.read();

        t.trace.push(SNAP);

        if (shots)
          for (const [scheme, png] of Object.entries(inner.shots?.() ?? {}))
            await writeFile(join(shots, shotName(card, t.snaps.length, scheme)), png);

        t.snaps.push(snapshot);

        return snapshot;
      },
      act: (action) => {
        t.trace.push(digest(action));

        return inner.act(action);
      },
      drive: (fn) => {
        t.trace.push(ACT);

        return inner.drive(fn);
      },
      ran: (steps) => {
        t.steps = steps;
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

/**
 * A font as the file keeps it: brotli over the bytes, behind the data URI's type. A font comes out of a page as a
 * plain TTF, several times the WOFF2 it was served as.
 */
const squeeze = (src: string): string => {
  const comma = src.indexOf(",");

  return `${src.slice(0, comma).replace(";base64", ";br")},${brotliCompressSync(Buffer.from(src.slice(comma + 1), "base64")).toString("base64")}`;
};

const unsqueeze = (kept: string): string => {
  const comma = kept.indexOf(",");

  return `${kept.slice(0, comma).replace(";br", ";base64")},${brotliDecompressSync(Buffer.from(kept.slice(comma + 1), "base64")).toString("base64")}`;
};

/** The file as written: each font once, by digest, however many snapshots use it. */
interface Saved {
  readonly hash?: string;
  readonly fonts?: Readonly<Record<string, string>>;
  readonly tapes?: Tape[];
}

const pack = (tapes: readonly Tape[]): Pick<Saved, "fonts" | "tapes"> => {
  const fonts: Record<string, string> = {};

  const snaps = (snap: Snapshot): Snapshot =>
    snap.fonts
      ? {
          ...snap,
          fonts: snap.fonts.map((face) => {
            const key = digest(face.src);
            fonts[key] ??= squeeze(face.src);

            return { ...face, src: key };
          }),
        }
      : snap;

  return { fonts, tapes: tapes.map((t) => ({ ...t, snaps: t.snaps.map(snaps) })) };
};

const unpack = (tapes: readonly Tape[], fonts: Readonly<Record<string, string>> = {}): Tape[] => {
  const opened = new Map<string, string>();

  const open = (key: string): string => {
    if (!opened.has(key)) opened.set(key, unsqueeze(fonts[key]!));

    return opened.get(key)!;
  };

  return tapes.map((t) => ({
    ...t,
    snaps: t.snaps.map((snap) =>
      snap.fonts
        ? { ...snap, fonts: snap.fonts.map((face) => ({ ...face, src: open(face.src) })) }
        : snap,
    ),
  }));
};

class Stale extends Error {}

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
      act: async (action) => step(digest(action)),
      drive: async () => step(ACT),
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

const version = async (): Promise<string> => {
  const manifest: { version: string } = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );

  return manifest.version;
};

/**
 * Runs `run` against snapshots kept in `file`, so a build without changes never starts Chromium. The file records
 * what each card was opened with, every data instruction and every snapshot. While `run` asks for the same, the
 * cards give the saved snapshots back; when it asks for something else, or `inputs` (or this package) changed, it
 * runs again in Chromium. `run` itself always runs, so timing on a snap is never stale.
 * `SVJEEZ_DOM_REFRESH=1` reads again anyway.
 */
export const snapshots = async <T>(
  file: string,
  { inputs, screenshots = process.env.SVJEEZ_DOM_SHOTS, ...options }: SnapshotsOptions,
  run: (dom: Browser) => Promise<T>,
): Promise<T> => {
  // CSS given once as a string is data, so it counts like a mount's own; built by a function, it goes in `inputs`.
  const hash = sha256(
    JSON.stringify([inputs, isCssText(options.css) ? options.css : null, await version(), FORMAT]),
  );

  if (!process.env.SVJEEZ_DOM_REFRESH && !screenshots) {
    // The file is our own, and its hash says the format that wrote it.
    const saved: Saved | undefined = await readFile(file, "utf8").then(JSON.parse, () => undefined);

    if (saved?.hash === hash && saved.tapes) {
      const { dom, whole } = replay(unpack(saved.tapes, saved.fonts));

      try {
        const value = await run(dom);

        if (whole()) return value;
      } catch (error) {
        if (!(error instanceof Stale)) throw error;
      }
    }
  }

  const tapes: Tape[] = [];
  const shots = screenshots ? shotsDir(screenshots, file) : undefined;

  if (shots) {
    await rm(shots, { recursive: true, force: true });
    await mkdir(shots, { recursive: true });
  }

  const pages = await chromiumPages({ ...options, screenshots: shots !== undefined });

  try {
    const value = await run(browserOf(record(pages, tapes, shots)));

    if (shots) {
      const recording: Recording = {
        fonts: (options.fonts ?? []).flatMap((value) =>
          ("faces" in value ? value.faces : [value]).map(
            ({ family, weight, style, href }) => ({ family, weight, style, href }),
          ),
        ),
        cards: tapes.map((t) => ({ steps: t.steps ?? [], snaps: t.snaps.length })),
      };

      await writeFile(join(shots, "recording.json"), JSON.stringify(recording));
    }

    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ hash, ...pack(tapes) }));

    return value;
  } finally {
    await pages.close();
  }
};
