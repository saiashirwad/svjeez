/** @jsxImportSource svjeez */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { font, render, type FontValue } from "svjeez";
import { renderFrames } from "svjeez/frames";
import { launch } from "./chromium.ts";
import { Dom } from "./draw/dom.tsx";
import { shotName, type Recording } from "./snapshots.ts";
import { duration, size, steady, timeline } from "./timeline.ts";

export interface FidelityOptions {
  /** How far a pixel's channel may be off (0 to 255) before it counts as different. Default 16. */
  readonly tolerance?: number;
  /** A pixel also matches if the other picture has a match within this many px, for text a hair off. Default 1. */
  readonly reach?: number;
  /** The share of painted pixels allowed to differ before a state fails. Default 0.01. */
  readonly threshold?: number;
  /** A folder for a side-by-side and diff image of each state that fails. Nothing is written without it. */
  readonly out?: string;
  readonly executablePath?: string;
}

export interface StateFidelity {
  readonly card: number;
  readonly name: string;
  readonly scheme: "light" | "dark";
  readonly time: number;
  readonly painted: number;
  readonly mismatch: number;
  readonly failed: boolean;
  readonly image?: string;
}

const SCHEMES = ["light", "dark"] as const;

interface Compare {
  readonly a: string;
  readonly b: string;
  readonly tolerance: number;
  readonly reach: number;
  readonly image: boolean;
}

const compare = async ({
  a,
  b,
  tolerance,
  reach,
  image,
}: Compare): Promise<{ painted: number; wrong: number; png?: string }> => {
  const load = (png: string) =>
    createImageBitmap(
      new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: "image/png" }),
    );

  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const w = Math.max(ia.width, ib.width);
  const h = Math.max(ia.height, ib.height);

  const pixels = (bitmap: ImageBitmap, background?: string) => {
    const g = new OffscreenCanvas(w, h).getContext("2d", { willReadFrequently: true })!;

    if (background) {
      g.fillStyle = background;
      g.fillRect(0, 0, w, h);
    }

    g.drawImage(bitmap, 0, 0);

    return g.getImageData(0, 0, w, h).data;
  };

  const alphaA = pixels(ia);
  const alphaB = pixels(ib);
  const layers = ["#fff", "#000"].map((bg) => [pixels(ia, bg), pixels(ib, bg)] as const);

  const off = (side: 0 | 1, x: number, y: number) =>
    Math.max(
      ...layers.map((layer) => {
        const [src, dst] = side === 0 ? layer : [layer[1], layer[0]];
        const i = (y * w + x) * 4;
        let best = 255;

        for (let dy = Math.max(-reach, -y); dy <= Math.min(reach, h - 1 - y); dy++)
          for (let dx = Math.max(-reach, -x); dx <= Math.min(reach, w - 1 - x); dx++) {
            const j = ((y + dy) * w + x + dx) * 4;

            best = Math.min(
              best,
              Math.max(
                Math.abs(src[i]! - dst[j]!),
                Math.abs(src[i + 1]! - dst[j + 1]!),
                Math.abs(src[i + 2]! - dst[j + 2]!),
              ),
            );
          }

        return best;
      }),
    );

  const wrong: number[] = [];
  let painted = 0;

  for (let p = 0; p < w * h; p++) {
    if (alphaA[p * 4 + 3]! < 16 && alphaB[p * 4 + 3]! < 16) continue;
    painted++;

    const [x, y] = [p % w, Math.floor(p / w)];

    if (off(0, x, y) > tolerance && off(1, x, y) > tolerance) wrong.push(p);
  }

  if (!image) return { painted, wrong: wrong.length };

  const gap = 8;
  const canvas = new OffscreenCanvas(w * 3 + gap * 4, h + gap * 2);
  const g = canvas.getContext("2d")!;
  const panel = (i: number) => gap + i * (w + gap);

  g.fillStyle = "#c8c8c8";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#fff";

  for (const i of [0, 1, 2]) g.fillRect(panel(i), gap, w, h);
  g.drawImage(ia, panel(0), gap);
  g.drawImage(ib, panel(1), gap);
  g.globalAlpha = 0.25;
  g.drawImage(ia, panel(2), gap);
  g.globalAlpha = 1;
  g.fillStyle = "#e61414";

  for (const p of wrong) g.fillRect(panel(2) + (p % w), gap + Math.floor(p / w), 1, 1);

  const reader = new FileReader();

  const done = new Promise<string>((resolve) => {
    reader.onload = () => resolve(String(reader.result).split(",")[1]!);
  });

  reader.readAsDataURL(await canvas.convertToBlob({ type: "image/png" }));

  return { painted, wrong: wrong.length, png: await done };
};

const fontOf = ({ href, ...face }: Recording["fonts"][number]): FontValue => {
  const base64 = href.slice(href.indexOf(",") + 1);

  return font(Buffer.from(base64, "base64"), face);
};

export const fidelity = async (
  dir: string,
  { tolerance = 16, reach = 1, threshold = 0.01, out, executablePath }: FidelityOptions = {},
): Promise<StateFidelity[]> => {
  const recording: Recording = JSON.parse(await readFile(join(dir, "recording.json"), "utf8"));
  const fonts = recording.fonts.map(fontOf);
  const browser = await launch(executablePath);
  const results: StateFidelity[] = [];

  try {
    const page = await browser.newPage();

    if (out) await mkdir(out, { recursive: true });

    for (const [card, steps] of recording.cards.entries()) {
      if (steps.length === 0) continue;

      const times = steady(steps);
      const { snaps } = timeline(steps);

      const svg = render(
        { ...size(steps), duration: Math.max(duration(steps), 1), title: "fidelity" },
        <Dom states={steps} fonts={fonts} />,
      );

      for (const scheme of SCHEMES) {
        let shots: Uint8Array[];

        try {
          shots = await Promise.all(
            snaps.map((_, i) => readFile(join(dir, shotName(card, i, scheme)))),
          );
        } catch {
          continue;
        }

        const { frames } = await renderFrames(svg, {
          times,
          colorScheme: scheme,
          background: "transparent",
          executablePath,
        });

        for (const [i, shot] of shots.entries()) {
          const { painted, wrong, png } = await page.evaluate(compare, {
            a: Buffer.from(shot).toString("base64"),
            b: Buffer.from(frames[i]!.png).toString("base64"),
            tolerance,
            reach,
            image: out !== undefined,
          });

          const mismatch = painted === 0 ? 0 : wrong / painted;
          const failed = mismatch > threshold;
          const name = snaps[i]!.name ?? `#${i}`;
          let image: string | undefined;

          if (failed && out && png) {
            image = join(out, `${card}-${i}-${name.replace(/\W+/g, "_")}-${scheme}.png`);
            await writeFile(image, Buffer.from(png, "base64"));
          }

          results.push({
            card,
            name,
            scheme,
            time: times[i]!,
            painted,
            mismatch,
            failed,
            image,
          });
        }
      }
    }
  } finally {
    await browser.close();
  }

  return results;
};
