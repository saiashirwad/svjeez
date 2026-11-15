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
  /**
   * How far a pixel's channel may be off (0 to 255) before it counts as different. Antialiasing and font rasterizing
   * differ a little between an SVG and HTML, so this is generous. Default 16.
   */
  readonly tolerance?: number;
  /** A pixel also matches if the other picture has a match within this many px, for text a hair off. Default 1. */
  readonly reach?: number;
  /** The share of painted pixels allowed to differ before a state fails. Default 0.01. */
  readonly threshold?: number;
  /** A folder for a side-by-side and diff image of each state that fails. Nothing is written without it. */
  readonly out?: string;
  readonly executablePath?: string;
}

/** One state of one card, drawn and photographed at rest. */
export interface StateFidelity {
  readonly card: number;
  readonly name: string;
  /** Which snapshot of the card, from 0. */
  readonly index: number;
  readonly scheme: "light" | "dark";
  /** The moment the drawing was captured, in seconds. */
  readonly time: number;
  /** Pixels either picture paints, and the share of them that differ. */
  readonly painted: number;
  readonly mismatch: number;
  readonly failed: boolean;
  /** The side-by-side image, when `out` was given and the state failed. */
  readonly image?: string;
}

const SCHEMES = ["light", "dark"] as const;

/** Compares two PNGs in the page: over white and black, so see-through differences show too. */
const compare = (args: {
  a: string;
  b: string;
  tolerance: number;
  reach: number;
  image: boolean;
}) =>
  (async ({ a, b, tolerance, reach, image }: typeof args) => {
    const load = async (b64: string) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

      return createImageBitmap(new Blob([bytes], { type: "image/png" }));
    };

    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.max(ia.width, ib.width);
    const h = Math.max(ia.height, ib.height);

    const read = (bitmap: ImageBitmap, bg: string) => {
      const canvas = new OffscreenCanvas(w, h);
      const g = canvas.getContext("2d", { willReadFrequently: true })!;

      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.drawImage(bitmap, 0, 0);

      return g.getImageData(0, 0, w, h).data;
    };

    const alpha = (bitmap: ImageBitmap) => {
      const canvas = new OffscreenCanvas(w, h);
      const g = canvas.getContext("2d", { willReadFrequently: true })!;

      g.drawImage(bitmap, 0, 0);

      return g.getImageData(0, 0, w, h).data;
    };

    const alphaA = alpha(ia);
    const alphaB = alpha(ib);
    const layers = ["#fff", "#000"].map((bg) => [read(ia, bg), read(ib, bg)] as const);

    // How far the pixel at (x, y) of `from` is from the nearest pixel of `to` within reach, worst over the layers.
    const off = (from: number, x: number, y: number) =>
      Math.max(
        ...layers.map(([la, lb]) => {
          const [src, dst] = from === 0 ? [la, lb] : [lb, la];
          const i = (y * w + x) * 4;
          let best = 255;

          for (let dy = -reach; dy <= reach; dy++)
            for (let dx = -reach; dx <= reach; dx++) {
              const nx = x + dx;
              const ny = y + dy;

              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const j = (ny * w + nx) * 4;

              const d = Math.max(
                Math.abs(src[i]! - dst[j]!),
                Math.abs(src[i + 1]! - dst[j + 1]!),
                Math.abs(src[i + 2]! - dst[j + 2]!),
              );

              if (d < best) best = d;
            }

          return best;
        }),
      );

    const diff = new Uint8Array(w * h);
    let painted = 0;
    let wrong = 0;

    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = y * w + x;

        if (alphaA[p * 4 + 3]! < 16 && alphaB[p * 4 + 3]! < 16) continue;
        painted++;

        if (off(0, x, y) > tolerance && off(1, x, y) > tolerance) {
          diff[p] = 1;
          wrong++;
        }
      }

    let png: string | undefined;

    if (image) {
      const gap = 8;
      const canvas = new OffscreenCanvas(w * 3 + gap * 4, h + gap * 2);
      const g = canvas.getContext("2d")!;

      g.fillStyle = "#c8c8c8";
      g.fillRect(0, 0, canvas.width, canvas.height);

      const panel = (i: number) => {
        g.fillStyle = "#fff";
        g.fillRect(gap + i * (w + gap), gap, w, h);
      };

      [0, 1, 2].forEach(panel);
      g.drawImage(ia, gap, gap);
      g.drawImage(ib, gap * 2 + w, gap);

      // The diff: the screenshot, faded, with every pixel that differs in red.
      g.globalAlpha = 0.25;
      g.drawImage(ia, gap * 3 + w * 2, gap);
      g.globalAlpha = 1;

      const marks = g.getImageData(gap * 3 + w * 2, gap, w, h);

      for (let p = 0; p < diff.length; p++)
        if (diff[p]) {
          marks.data[p * 4] = 230;
          marks.data[p * 4 + 1] = 20;
          marks.data[p * 4 + 2] = 20;
          marks.data[p * 4 + 3] = 255;
        }

      g.putImageData(marks, gap * 3 + w * 2, gap);

      const blob = await canvas.convertToBlob({ type: "image/png" });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text = "";

      for (let i = 0; i < bytes.length; i += 0x8000)
        text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));

      png = btoa(text);
    }

    return { painted, wrong, png };
  })(args);

const fontOf = ({ href, ...face }: Recording["fonts"][number]): FontValue => {
  const base64 = href.slice(href.indexOf(",") + 1);

  return font(Buffer.from(base64, "base64"), face);
};

/**
 * Draws each state of a recording the way `<Dom>` does, at the end of its hold, and compares it pixel by pixel with
 * the screenshot Chromium took of the real card then. `dir` is what `snapshots({ screenshots })` (or
 * `SVJEEZ_DOM_SHOTS`) wrote. The card is drawn on its own: its `<Dom>` props and the clip it plays in aren't
 * recorded, but the fonts are.
 */
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

    for (const [card, { steps }] of recording.cards.entries()) {
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
          continue; // a scheme the recording didn't read
        }

        const { frames } = await renderFrames(svg, {
          times,
          colorScheme: scheme,
          background: "transparent",
          executablePath,
        });

        for (const [i, shot] of shots.entries()) {
          const wantImage = out !== undefined;

          const { painted, wrong, png } = await page.evaluate(compare, {
            a: Buffer.from(shot).toString("base64"),
            b: Buffer.from(frames[i]!.png).toString("base64"),
            tolerance,
            reach,
            image: wantImage,
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
            index: i,
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
