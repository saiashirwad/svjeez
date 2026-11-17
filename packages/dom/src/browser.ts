import type { FontValue } from "svjeez";
import { chromiumPages } from "./chromium.ts";
import type { Palette } from "./palette.ts";
import type { Action, Flow, Instruction, PageAction } from "./flow.ts";
import type { Step } from "./timeline.ts";
import type { Snapshot } from "./tree.ts";

/** CSS for the page: your Tailwind build, a theme, anything. A function gets the markup, for CSS built from it. */
export type Css = string | ((html: string) => string | Promise<string>);

export const isCssText = (css: Css | undefined): css is string => typeof css === "string";

export interface BrowserOptions {
  readonly css?: Css;
  /** Fonts the page uses, embedded as @font-face so layout and the drawn text match. Pass the same ones to `<Dom fonts>`. */
  readonly fonts?: readonly FontValue[];
  /**
   * Defines `--base00` to `--base0F` on every page, light and dark, for CSS written against a base16 palette. Pass the
   * same palette to `<Dom palette>` to draw those colors as the variables again.
   */
  readonly palette?: Palette;
  /**
   * Which schemes a snapshot reads: `"both"` reads light and dark, and the drawing's colors follow the viewer's. Default `"both"`.
   */
  readonly schemes?: "both" | "light" | "dark";
  /**
   * Class added to `<html>` in the dark pass, which also emulates `prefers-color-scheme: dark`. Default `"dark"`.
   */
  readonly dark?: { readonly class?: string };
  readonly executablePath?: string;
  /**
   * Also screenshot the card at every read, in each scheme read. The PNGs come from `Io.shots`; `snapshots()` writes them for the fidelity check.
   */
  readonly screenshots?: boolean;
  /**
   * Where a relative `open()` URL points, such as a dev server on a random port. Not part of what `snapshots()` records.
   */
  readonly base?: string;
}

export interface PageOptions {
  /** Named elements, by CSS selector. An element also gets a part from its `data-part`, and instructions take either name. */
  readonly parts?: Readonly<Record<string, string>>;
  /** Room around the element for shadows and rings, in px. Default 16. */
  readonly pad?: number;
  readonly width?: number;
}

export interface MountOptions extends PageOptions {
  readonly css?: Css;
  readonly root?: { readonly class?: string };
}

export interface OpenOptions extends PageOptions {
  readonly root: string;
  /** Height of the viewport the app lays out in. Default 1000. */
  readonly height?: number;
  /** A selector to wait for before anything runs, for an app that renders after it loads. Default `root`. */
  readonly ready?: string;
}

export interface Url extends OpenOptions {
  readonly url: string;
}

/** One live page, kept open so state (typed text, focus, hover) carries from one snapshot to the next. */
export interface Card {
  readonly snap: (action?: PageAction) => Promise<Snapshot>;
  /**
   * Runs a flow on this page, carrying state between instructions. Resolves to a step per snap and wait, for `<Dom states>`.
   */
  readonly run: (flow: Flow) => Promise<Step[]>;
  /** Swap the markup of a mounted card, running its `css` again if that is a function. Hover and focus are cleared. */
  readonly html: (markup: string) => Promise<void>;
  readonly close: () => Promise<void>;
}

export interface Browser {
  readonly mount: (html: string, options?: MountOptions) => Promise<Card>;
  readonly open: (url: string, options: OpenOptions) => Promise<Card>;
  readonly run: {
    (html: string, flow: Flow, options?: MountOptions): Promise<Step[]>;
    (app: Url, flow: Flow): Promise<Step[]>;
  };
  readonly close: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}

export type Shots = Partial<Record<"light" | "dark", Uint8Array>>;

export interface Io {
  readonly read: () => Promise<Snapshot>;
  readonly shots?: () => Shots;
  readonly ran?: (steps: Step[]) => void;
  readonly act: (action: Action) => Promise<void>;
  readonly drive: (fn: PageAction) => Promise<void>;
  readonly close: () => Promise<void>;
}

export interface Pages {
  readonly mount: (html: string, options?: MountOptions) => Promise<Io>;
  readonly open: (url: string, options: OpenOptions) => Promise<Io>;
  readonly close: () => Promise<void>;
}

const check = (step: Instruction, first: boolean) => {
  if ("wait" in step && first)
    throw new Error("run(): a wait comes before the first snap, but nothing is drawn yet.");

  if ("snap" in step && first && (step.over !== undefined || step.ease))
    throw new Error(
      "run(): the first snap has timing, but nothing moves into it. Put it on the next snap.",
    );
};

const cardOf = (io: Io): Card => ({
  snap: async (action) => {
    if (action) await io.drive(action);

    return io.read();
  },
  run: async (flow) => {
    flow.forEach((step, i) => check(step, !flow.slice(0, i).some((s) => "snap" in s)));

    const steps: Step[] = [];

    for (const step of flow) {
      if ("wait" in step) {
        steps.push({ wait: step.wait });
        continue;
      }

      if ("act" in step) {
        await io.drive(step.act);
        continue;
      }

      if (!("snap" in step)) {
        await io.act(step);
        continue;
      }

      const read = await io.read();
      const state = step.snap === true ? read : { name: step.snap, ...read };
      const { snap: _, ...timing } = step;

      steps.push(Object.keys(timing).length > 0 ? [state, timing] : state);
    }

    io.ran?.(steps);

    return steps;
  },
  html: (markup) => io.act({ html: markup }),
  close: io.close,
});

const isUrl = (page: string | Url): page is Url => typeof page !== "string";

export const browserOf = (pages: Pages): Browser => {
  const mount = async (html: string, options?: MountOptions) =>
    cardOf(await pages.mount(html, options));

  const open = async (url: string, options: OpenOptions) => cardOf(await pages.open(url, options));

  return {
    mount,
    open,
    run: async (page: string | Url, flow: Flow, options?: MountOptions) => {
      const card = isUrl(page) ? await open(page.url, page) : await mount(page, options);

      try {
        return await card.run(flow);
      } finally {
        await card.close();
      }
    },
    close: pages.close,
    [Symbol.asyncDispose]: pages.close,
  };
};

/** One browser for many cards. Close it when done, or `await using` it. */
export const browser = async (options: BrowserOptions = {}): Promise<Browser> =>
  browserOf(await chromiumPages(options));
