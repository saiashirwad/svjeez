import type { Font, FontValue } from "svjeez";
import type { Box } from "./tree.ts";
import { merge } from "./scheme.ts";
import { walk } from "./walk.ts";

export interface SnapshotOptions {
  /** CSS for the page: your Tailwind build, a theme, anything. */
  readonly css?: string;
  /** Fonts the page uses, embedded as @font-face so layout and the drawn text match. */
  readonly fonts?: readonly FontValue[];
  /** Width the markup lays out at. Default: as wide as its content. */
  readonly width?: number;
  /** Room around the element for shadows and rings, in px. Default 16. */
  readonly pad?: number;
  /** Classes on `<html>`. */
  readonly htmlClass?: string;
  /**
   * Snapshot in both color schemes and draw colors that follow the viewer's. Default true. The dark pass emulates
   * `prefers-color-scheme: dark` and adds `darkClass` to `<html>`, so media-query and class-based themes both work.
   */
  readonly schemes?: boolean;
  /** Default `"dark"`, as shadcn and Tailwind's class strategy use. */
  readonly darkClass?: string;
  readonly executablePath?: string;
}

export interface Snapshot {
  readonly width: number;
  readonly height: number;
  readonly root: Box;
  readonly fonts: readonly FontValue[];
}

export interface Snapshotter {
  /** Lay out `html` with the session's CSS and fonts and read it into a snapshot. */
  readonly html: (
    html: string,
    options?: Pick<SnapshotOptions, "width" | "pad" | "htmlClass">,
  ) => Promise<Snapshot>;
  /** Open a running app (a dev server, Storybook) and snapshot the element at `selector`. */
  readonly url: (
    url: string,
    selector: string,
    options?: { readonly pad?: number; readonly width?: number },
  ) => Promise<Snapshot>;
  readonly close: () => Promise<void>;
}

const FORMAT = { ttf: "truetype", otf: "opentype", woff: "woff", woff2: "woff2" } as const;

const facesOf = (value: FontValue): readonly Font[] => ("faces" in value ? value.faces : [value]);

const fontFaces = (fonts: readonly FontValue[]): string =>
  fonts
    .flatMap(facesOf)
    .map(
      (face) =>
        `@font-face{font-family:"${face.family}";src:url(${face.href}) format("${FORMAT[face.format]}");font-weight:${face.weight};font-style:${face.style}}`,
    )
    .join("\n");

const launch = async (executablePath?: string) => {
  const { chromium } = await import("playwright-core").catch(() => {
    throw new Error(
      "@svjeez/dom needs playwright-core. Install it with `npm i -D playwright-core`.",
    );
  });

  try {
    return await chromium.launch({ executablePath });
  } catch (error) {
    if (executablePath) throw error;

    return chromium.launch({ channel: "chrome" });
  }
};

/** One browser for many snapshots. Close it when done. */
export const snapshotter = async (options: SnapshotOptions = {}): Promise<Snapshotter> => {
  const browser = await launch(options.executablePath);
  const fonts = options.fonts ?? [];
  const faces = fontFaces(fonts);

  const both = options.schemes ?? true;
  const darkClass = options.darkClass ?? "dark";

  const read = async (
    page: import("playwright-core").Page,
    selector: string,
    pad: number,
  ): Promise<Snapshot> => {
    const pass = async (scheme: "light" | "dark") => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.evaluate(([name, on]) => document.documentElement.classList.toggle(name, on), [
        darkClass,
        scheme === "dark",
      ] as const);
      await page.evaluate(() => document.fonts.ready);
      // tsx and esbuild's keepNames wrap named functions in __name(), which the page doesn't have.
      await page.evaluate("globalThis.__name ??= (fn) => fn");

      return page.evaluate(walk, { selector, pad });
    };

    const light = await pass("light");
    const root = both ? merge(light, await pass("dark")) : light;

    return {
      width: Math.ceil(root.box.width + 2 * pad),
      height: Math.ceil(root.box.height + 2 * pad),
      root,
      fonts,
    };
  };

  return {
    html: async (html, local = {}) => {
      const width = local.width ?? options.width;
      const pad = local.pad ?? options.pad ?? 16;

      const page = await browser.newPage({
        viewport: { width: Math.ceil(width ?? 1600), height: 1000 },
      });

      try {
        const wrap = width === undefined ? "display:inline-block" : `width:${width}px`;
        await page.setContent(
          `<!doctype html><html class="${local.htmlClass ?? options.htmlClass ?? ""}"><head><meta charset="utf-8"><style>${faces}</style><style>${options.css ?? ""}</style></head><body style="margin:0;background:none"><div id="svjeez-dom" style="${wrap}">${html}</div></body></html>`,
        );

        return await read(page, "#svjeez-dom > *", pad);
      } finally {
        await page.close();
      }
    },
    url: async (url, selector, local = {}) => {
      const page = await browser.newPage({
        viewport: { width: Math.ceil(local.width ?? options.width ?? 1280), height: 1000 },
      });

      try {
        await page.goto(url);

        if (faces) await page.addStyleTag({ content: faces });
        await page.waitForSelector(selector);

        return await read(page, selector, local.pad ?? options.pad ?? 16);
      } finally {
        await page.close();
      }
    },
    close: () => browser.close(),
  };
};

/** Snapshot one piece of markup. For several, open a `snapshotter` and reuse its browser. */
export const snapshot = async (html: string, options: SnapshotOptions = {}): Promise<Snapshot> => {
  const session = await snapshotter(options);

  try {
    return await session.html(html);
  } finally {
    await session.close();
  }
};
