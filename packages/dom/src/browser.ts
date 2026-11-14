import type { Page } from "playwright-core";
import type { Font, FontValue } from "svjeez";
import { merge } from "./scheme.ts";
import type { Snapshot } from "./tree.ts";
import { walk } from "./walk.ts";

export interface BrowserOptions {
  /** Fonts the page uses, embedded as @font-face so layout and the drawn text match. Pass the same ones to `<Dom fonts>`. */
  readonly fonts?: readonly FontValue[];
  /**
   * Which schemes a snapshot reads. `"both"` reads the page in light and dark, and the drawing's colors follow the
   * viewer's. Default `"both"`.
   */
  readonly schemes?: "both" | "light" | "dark";
  /**
   * The dark pass emulates `prefers-color-scheme: dark` and adds this class to `<html>`, so media-query and class-based
   * themes both work. Default `"dark"`, as shadcn and Tailwind's class strategy use.
   */
  readonly dark?: { readonly class?: string };
  readonly executablePath?: string;
}

interface PageOptions {
  /** Named elements, by CSS selector. An element also gets a part from its `data-part`. */
  readonly parts?: Readonly<Record<string, string>>;
  /** Room around the element for shadows and rings, in px. Default 16. */
  readonly pad?: number;
  /** Width the page lays out at. */
  readonly width?: number;
}

export interface MountOptions extends PageOptions {
  /** CSS for the page: your Tailwind build, a theme, anything. A function gets the markup, for CSS built from it. */
  readonly css?: string | ((html: string) => string | Promise<string>);
  /** Classes on `<html>`. */
  readonly root?: { readonly class?: string };
}

/** One step as plain data, the way Playwright's codegen writes it, so a step list can be part of `snapshots()` inputs. */
export type Action =
  | { readonly click: string }
  | { readonly fill: readonly [selector: string, text: string] }
  | { readonly hover: string }
  | { readonly press: string }
  | { readonly move: readonly [x: number, y: number] }
  /** New markup for a mounted card, as `render`. */
  | { readonly render: string }
  /** Read the page into the snapshot of this name. */
  | { readonly snap: string };

type PageAction = (page: Page) => Promise<unknown>;

/** A named step: `null` just reads the page, a function acts first, `html` renders new markup before `action`. */
export type StepSpec =
  | null
  | undefined
  | PageAction
  | { readonly html?: string; readonly action?: PageAction };

/** The names a list of actions snaps. */
type Snapped<A extends readonly Action[]> = Extract<A[number], { readonly snap: string }>["snap"];

export interface OpenOptions extends PageOptions {
  /** The element to snapshot. */
  readonly root: string;
}

/** One live page, kept open so state (typed text, focus, hover) carries from one snapshot to the next. */
export interface Card {
  /** Run `action` on the page, if given, then read the page into a snapshot. */
  readonly snap: (action?: PageAction) => Promise<Snapshot>;
  /**
   * Runs steps in order on this page and snaps each, so state carries from one to the next. An object names each
   * step; a list of actions snaps where it says `{ snap: name }`. Either way the result keeps the order, so
   * `Object.values` is the timeline.
   */
  readonly steps: {
    <const A extends readonly Action[]>(actions: A): Promise<{ [K in Snapped<A>]: Snapshot }>;
    <const S extends Readonly<Record<string, StepSpec>>>(
      spec: S,
    ): Promise<{ [K in keyof S]: Snapshot }>;
  };
  /** Swap the markup of a mounted card, running its `css` again if that is a function. */
  readonly render: (html: string) => Promise<void>;
  readonly close: () => Promise<void>;
}

export interface Browser {
  /** Lay `html` out in a page of its own. The element at its root is what gets snapshotted. */
  readonly mount: (html: string, options?: MountOptions) => Promise<Card>;
  /** Open a running app (a dev server, Storybook) and snapshot the element at `options.root`. */
  readonly open: (url: string, options: OpenOptions) => Promise<Card>;
  readonly close: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
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

const ROOT = "#svjeez-dom";

/** One browser for many cards. Close it when done, or `await using` it. */
export const browser = async (options: BrowserOptions = {}): Promise<Browser> => {
  const chromium = await launch(options.executablePath);
  const faces = fontFaces(options.fonts ?? []);
  const schemes = options.schemes ?? "both";
  const darkClass = options.dark?.class ?? "dark";
  // The scheme a card rests in between snapshots, so actions run in the scheme the page was written for.
  const resting = schemes === "dark" ? "dark" : "light";

  const card = async (
    page: Page,
    selector: string,
    { parts = {}, pad = 16 }: PageOptions,
    render: Card["render"],
  ): Promise<Card> => {
    const scheme = async (value: "light" | "dark") => {
      await page.emulateMedia({ colorScheme: value });
      await page.evaluate(([name, on]) => document.documentElement.classList.toggle(name, on), [
        darkClass,
        value === "dark",
      ] as const);
    };

    const read = async (value: "light" | "dark") => {
      await scheme(value);

      return page.evaluate(walk, { selector, pad, parts });
    };

    await scheme(resting);

    const snap: Card["snap"] = async (action) => {
      if (action) await action(page);
      // tsx and esbuild's keepNames wrap named functions in __name(), which the page doesn't have.
      await page.evaluate("globalThis.__name ??= (fn) => fn");
      // Transitions and finite animations that the action started must land before the page is read.
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => undefined)),
        );
      });

      // Light goes last, so the page ends in the scheme it rests in.
      const dark = schemes === "light" ? undefined : await read("dark");
      const light = schemes === "dark" ? undefined : await read("light");
      const root = dark && light ? merge(light, dark) : (light ?? dark)!;

      return {
        width: Math.ceil(root.box.width + 2 * pad),
        height: Math.ceil(root.box.height + 2 * pad),
        pad,
        box: root.box,
        root,
      };
    };

    const act = (action: Action): Promise<unknown> => {
      if ("click" in action) return page.click(action.click);
      if ("fill" in action) return page.fill(...action.fill);
      if ("hover" in action) return page.hover(action.hover);
      if ("press" in action) return page.keyboard.press(action.press);
      if ("move" in action) return page.mouse.move(...action.move);
      if ("render" in action) return render(action.render);

      throw new Error(`steps() doesn't know the action ${JSON.stringify(action)}.`);
    };

    const steps = async (input: readonly Action[] | Readonly<Record<string, StepSpec>>) => {
      const out: Record<string, Snapshot> = {};

      if (Array.isArray(input)) {
        const names = (input as readonly Action[]).flatMap((a) => ("snap" in a ? [a.snap] : []));
        const twice = names.find((name, i) => names.indexOf(name) !== i);

        // Checked before anything runs, so a typo doesn't cost a page's worth of steps.
        if (twice !== undefined) throw new Error(`steps() snaps "${twice}" twice.`);

        for (const action of input as readonly Action[])
          if ("snap" in action) out[action.snap] = await snap();
          else await act(action);

        return out;
      }

      for (const [name, step] of Object.entries(input as Readonly<Record<string, StepSpec>>)) {
        if (typeof step === "function") out[name] = await snap(step);
        else {
          if (step?.html !== undefined) await render(step.html);
          out[name] = await snap(step?.action);
        }
      }

      return out;
    };

    return { snap, steps: steps as Card["steps"], render, close: () => page.close() };
  };

  const close = () => chromium.close();

  return {
    mount: async (html, { css = "", width, root, ...rest } = {}) => {
      const page = await chromium.newPage({
        viewport: { width: Math.ceil(width ?? 1600), height: 1000 },
      });

      const sheet = async (markup: string) => (typeof css === "function" ? css(markup) : css);
      const wrap = width === undefined ? "display:inline-block" : `width:${width}px`;

      await page.setContent(
        `<!doctype html><html class="${root?.class ?? ""}"><head><meta charset="utf-8"><style>${faces}</style><style id="svjeez-css">${await sheet(html)}</style></head><body style="margin:0;background:none"><div id="svjeez-dom" style="${wrap}">${html}</div></body></html>`,
      );

      return card(page, `${ROOT} > *`, rest, async (next) => {
        const css = await sheet(next);

        await page.evaluate(
          ([markup, rules]) => {
            document.getElementById("svjeez-css")!.textContent = rules;
            document.getElementById("svjeez-dom")!.innerHTML = markup;
          },
          [next, css] as const,
        );
      });
    },
    open: async (url, { root, width, ...rest }) => {
      const page = await chromium.newPage({
        viewport: { width: Math.ceil(width ?? 1280), height: 1000 },
      });

      await page.goto(url);

      if (faces) await page.addStyleTag({ content: faces });
      await page.waitForSelector(root);

      return card(page, root, rest, async () => {
        throw new Error(
          "render() swaps markup in a mounted card. A card from open() is the app's own page.",
        );
      });
    },
    close,
    [Symbol.asyncDispose]: close,
  };
};
