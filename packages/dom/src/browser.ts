import type { FontValue } from "svjeez";
import { chromiumPages } from "./chromium.ts";
import type { Action, Flow, Instruction, PageAction } from "./flow.ts";
import type { Step } from "./timeline.ts";
import type { Snapshot } from "./tree.ts";

/** CSS for the page: your Tailwind build, a theme, anything. A function gets the markup, for CSS built from it. */
export type Css = string | ((html: string) => string | Promise<string>);

export const isCssText = (css: Css | undefined): css is string => typeof css === "string";

export interface BrowserOptions {
  /** CSS for every mounted card, unless a mount brings its own. */
  readonly css?: Css;
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

export interface PageOptions {
  /** Named elements, by CSS selector. An element also gets a part from its `data-part`, and instructions take either name. */
  readonly parts?: Readonly<Record<string, string>>;
  /** Room around the element for shadows and rings, in px. Default 16. */
  readonly pad?: number;
  /** Width the page lays out at. */
  readonly width?: number;
}

export interface MountOptions extends PageOptions {
  /** Overrides the browser's `css` for this card. */
  readonly css?: Css;
  /** Classes on `<html>`. */
  readonly root?: { readonly class?: string };
}

export interface OpenOptions extends PageOptions {
  /** The element to snapshot. */
  readonly root: string;
  /** Height of the viewport the app lays out in. Default 1000. */
  readonly height?: number;
  /** A selector to wait for before anything runs, for an app that renders after it loads. Default `root`. */
  readonly ready?: string;
}

/** A running app to open, as `open` takes it. */
export interface Url extends OpenOptions {
  readonly url: string;
}

/** One live page, kept open so state (typed text, focus, hover) carries from one snapshot to the next. */
export interface Card {
  /** Run `action` on the page, if given, then read the page into a snapshot. */
  readonly snap: (action?: PageAction) => Promise<Snapshot>;
  /**
   * Runs a flow on this page, so state carries from one instruction to the next, and resolves to a step per snap
   * and wait, in order, ready for `<Dom states>`.
   */
  readonly run: (flow: Flow) => Promise<Step[]>;
  /** Swap the markup of a mounted card, running its `css` again if that is a function. Hover and focus are cleared. */
  readonly html: (markup: string) => Promise<void>;
  readonly close: () => Promise<void>;
}

export interface Browser {
  /** Lay `html` out in a page of its own. The element at its root is what gets snapshotted. */
  readonly mount: (html: string, options?: MountOptions) => Promise<Card>;
  /** Open a running app (a dev server, Storybook) and snapshot the element at `options.root`. */
  readonly open: (url: string, options: OpenOptions) => Promise<Card>;
  /** Mount `html` (or open a `{ url, root }`), run `flow` on it and close it again. */
  readonly run: {
    (html: string, flow: Flow, options?: MountOptions): Promise<Step[]>;
    (app: Url, flow: Flow): Promise<Step[]>;
  };
  readonly close: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}

/** What a card does to its page. A card is built on these, so `snapshots()` can record and replay them. */
export interface Io {
  readonly read: () => Promise<Snapshot>;
  readonly act: (action: Action) => Promise<void>;
  readonly drive: (fn: PageAction) => Promise<void>;
  readonly close: () => Promise<void>;
}

/** Where cards come from: Chromium, or a recording of it. */
export interface Pages {
  readonly mount: (html: string, options?: MountOptions) => Promise<Io>;
  readonly open: (url: string, options: OpenOptions) => Promise<Io>;
  readonly close: () => Promise<void>;
}

/** Checks an instruction's timing where it stands. `first` says no snapshot has been read yet. */
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
    // Checked before anything runs, so a mistake never costs a page's worth of instructions.
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

    return steps;
  },
  html: (markup) => io.act({ html: markup }),
  close: io.close,
});

const isUrl = (page: string | Url): page is Url => typeof page !== "string";

/** A Browser over any pages. */
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
