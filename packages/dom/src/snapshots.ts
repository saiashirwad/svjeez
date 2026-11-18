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
import { chromiumPages, facesOf } from "./chromium.ts";
import type { Action } from "./flow.ts";
import type { Step } from "./timeline.ts";
import type { Snapshot } from "./tree.ts";

const FORMAT = 6;

export interface SnapshotsOptions extends Omit<BrowserOptions, "screenshots"> {
  readonly inputs?: unknown;
  readonly screenshots?: string;
}

export interface Recording {
  readonly fonts: readonly {
    family: string;
    weight: number;
    style: "normal" | "italic";
    href: string;
  }[];
  readonly cards: readonly (readonly Step[])[];
}

export const shotsDir = (root: string, file: string) =>
  join(root, `${basename(dirname(resolve(file)))}-${basename(file, ".json")}`);

export const shotName = (card: number, snap: number, scheme: string) =>
  `${card}-${snap}-${scheme}.png`;

interface Tape {
  readonly opened: string;
  readonly trace: string[];
  readonly snaps: Snapshot[];
  steps?: Step[];
}

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

type Entry = string | Action | readonly (string | MountOptions | OpenOptions | undefined)[];

const digest = (entry: Entry) => sha256(JSON.stringify(entry)).slice(0, 16);

const SNAP = digest("snap");

const ACT = digest("act");

const record = (pages: Pages, tapes: Tape[], shots?: string): Pages => {
  const tape = async (opened: string, io: () => Promise<Io>): Promise<Io> => {
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

const squeeze = (src: string): string => {
  const comma = src.indexOf(",");

  return `${src.slice(0, comma).replace(";base64", ";br")},${brotliCompressSync(Buffer.from(src.slice(comma + 1), "base64")).toString("base64")}`;
};

const unsqueeze = (kept: string): string => {
  const comma = kept.indexOf(",");

  return `${kept.slice(0, comma).replace(";br", ";base64")},${brotliDecompressSync(Buffer.from(kept.slice(comma + 1), "base64")).toString("base64")}`;
};

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
  for (const path of ["./package.json", "../package.json"]) {
    const manifest: { name: string; version: string } | undefined = await readFile(
      new URL(path, import.meta.url),
      "utf8",
    ).then(JSON.parse, () => undefined);

    if (manifest?.name === "@svjeez/dom") return manifest.version;
  }

  throw new Error("@svjeez/dom cannot find its own package.json.");
};

export const snapshots = async <T>(
  file: string,
  { inputs, screenshots = process.env.SVJEEZ_DOM_SHOTS, ...options }: SnapshotsOptions,
  run: (dom: Browser) => Promise<T>,
): Promise<T> => {
  const hash = sha256(
    JSON.stringify([
      inputs,
      isCssText(options.css) ? options.css : null,
      await version(),
      FORMAT,
      ...(options.palette ? [options.palette] : []),
    ]),
  );

  if (!process.env.SVJEEZ_DOM_REFRESH && !screenshots) {
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
        fonts: (options.fonts ?? [])
          .flatMap(facesOf)
          .map(({ family, weight, style, href }) => ({ family, weight, style, href })),
        cards: tapes.map((t) => t.steps ?? []),
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
