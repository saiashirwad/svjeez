import type { Page } from "playwright-core";
import type { Font, FontValue } from "svjeez";
import { merge } from "./scheme.ts";
import type { Step } from "./draw.tsx";
import type { Action, Flow, Instruction } from "./flow.ts";
import type { Snapshot } from "./tree.ts";
import { walk } from "./walk.ts";

/** CSS for the page: your Tailwind build, a theme, anything. A function gets the markup, for CSS built from it. */
type Css = string | ((html: string) => string | Promise<string>);

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

interface PageOptions {
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

type PageAction = (page: Page) => unknown;

export interface OpenOptions extends PageOptions {
  /** The element to snapshot. */
  readonly root: string;
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
  readonly act: (action: Action | PageAction) => Promise<unknown>;
  readonly close: () => Promise<void>;
}

/** Where cards come from: Chromium, or a recording of it. */
export interface Pages {
  readonly mount: (html: string, options?: MountOptions) => Promise<Io>;
  readonly open: (url: string, options: OpenOptions) => Promise<Io>;
  readonly close: () => Promise<void>;
}

/**
 * Checks an instruction's timing where it stands, so a mistake shows before a page's worth of instructions runs.
 * `first` says no snapshot has been read yet.
 */
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
    if (action) await io.act(action);

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

      if (!("snap" in step)) {
        await io.act("act" in step ? step.act : step);
        continue;
      }

      const read = await io.read();
      const state = step.snap === true ? read : { name: step.snap, ...read };
      const { snap: _, ...timing } = step;

      steps.push(Object.keys(timing).length > 0 ? [state, timing] : state);
    }

    return steps;
  },
  html: async (markup) => {
    await io.act({ html: markup });
  },
  close: io.close,
});

/** A Browser over any pages. */
export const browserOf = (pages: Pages): Browser => {
  const mount = async (html: string, options?: MountOptions) =>
    cardOf(await pages.mount(html, options));
  const open = async (url: string, options: OpenOptions) => cardOf(await pages.open(url, options));

  return {
    mount,
    open,
    run: async (page: string | Url, flow: Flow, options?: MountOptions) => {
      const card =
        typeof page === "string" ? await mount(page, options) : await open(page.url, page);

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

/** Pages in one Chromium. */
export const chromiumPages = async (options: BrowserOptions = {}): Promise<Pages> => {
  const chromium = await launch(options.executablePath);
  const faces = fontFaces(options.fonts ?? []);
  const schemes = options.schemes ?? "both";
  const darkClass = options.dark?.class ?? "dark";
  // The scheme a card rests in between snapshots, so actions run in the scheme the page was written for.
  const resting = schemes === "dark" ? "dark" : "light";

  const io = async (
    page: Page,
    selector: string,
    { parts = {}, pad = 16 }: PageOptions,
    render: (html: string) => Promise<void>,
  ): Promise<Io> => {
    // tsx and esbuild's keepNames wrap named functions in __name(), which the page doesn't have.
    const shim = () => page.evaluate("globalThis.__name ??= (fn) => fn");

    /** A part name, by the `parts` option or `data-part`, found in the page under the root; else a CSS selector. */
    const target = async (name: string) => {
      await shim();

      const handle = await page.evaluateHandle(
        ([name, root, css]) => {
          const top = document.querySelector(root);
          const pick = (s: string) => (top?.matches(s) ? top : top?.querySelector(s));

          return (css ? pick(css) : undefined) ?? pick(`[data-part="${CSS.escape(name)}"]`) ?? null;
        },
        [name, selector, parts[name]] as const,
      );

      return handle.asElement() ?? undefined;
    };
    const scheme = async (value: "light" | "dark") => {
      await page.emulateMedia({ colorScheme: value });
      await page.evaluate(([name, on]) => document.documentElement.classList.toggle(name, on), [
        darkClass,
        value === "dark",
      ] as const);
    };

    const pass = async (value: "light" | "dark") => {
      await scheme(value);

      return page.evaluate(walk, { selector, pad, parts });
    };

    await scheme(resting);

    const read = async (): Promise<Snapshot> => {
      await shim();
      // Transitions and finite animations that an action started must land before the page is read.
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
      const dark = schemes === "light" ? undefined : await pass("dark");
      const light = schemes === "dark" ? undefined : await pass("light");
      const root = dark && light ? merge(light, dark) : (light ?? dark)!;

      return {
        width: Math.ceil(root.box.width + 2 * pad),
        height: Math.ceil(root.box.height + 2 * pad),
        pad,
        box: root.box,
        root,
      };
    };

    const act = async (action: Action | PageAction): Promise<unknown> => {
      if (typeof action === "function") return action(page);
      if ("click" in action) {
        const el = await target(action.click);

        return el ? el.click() : page.click(action.click);
      }

      if ("fill" in action) {
        const [name, text] = action.fill;
        const el = await target(name);

        return el ? el.fill(text) : page.fill(name, text);
      }

      if ("hover" in action) {
        const el = await target(action.hover);

        return el ? el.hover() : page.hover(action.hover);
      }

      if ("press" in action) return page.keyboard.press(action.press);
      if ("move" in action) return page.mouse.move(...action.move);
      if ("html" in action) return render(action.html);

      throw new Error(`run() doesn't know the instruction ${JSON.stringify(action)}.`);
    };

    return { read, act, close: () => page.close() };
  };

  return {
    mount: async (html, { css = options.css ?? "", width, root, ...rest } = {}) => {
      const page = await chromium.newPage({
        viewport: { width: Math.ceil(width ?? 1600), height: 1000 },
      });

      const sheet = async (markup: string) => (typeof css === "function" ? css(markup) : css);
      const wrap = width === undefined ? "display:inline-block" : `width:${width}px`;

      await page.setContent(
        `<!doctype html><html class="${root?.class ?? ""}"><head><meta charset="utf-8"><style>${faces}</style><style id="svjeez-css">${await sheet(html)}</style></head><body style="margin:0;background:none"><div id="svjeez-dom" style="${wrap}">${html}</div></body></html>`,
      );

      return io(page, `${ROOT} > *`, rest, async (next) => {
        const css = await sheet(next);

        await page.evaluate(
          ([markup, rules]) => {
            document.getElementById("svjeez-css")!.textContent = rules;
            document.getElementById("svjeez-dom")!.innerHTML = markup;
            (document.activeElement as HTMLElement | null)?.blur();
          },
          [next, css] as const,
        );
        // New markup starts as a fresh render would: nothing under the pointer.
        await page.mouse.move(-1, -1);
      });
    },
    open: async (url, { root, width, ...rest }) => {
      const page = await chromium.newPage({
        viewport: { width: Math.ceil(width ?? 1280), height: 1000 },
      });

      await page.goto(url);

      if (faces) await page.addStyleTag({ content: faces });
      await page.waitForSelector(root);

      return io(page, root, rest, async () => {
        throw new Error(
          "html() swaps markup in a mounted card. A card from open() is the app's own page.",
        );
      });
    },
    close: () => chromium.close(),
  };
};

/** One browser for many cards. Close it when done, or `await using` it. */
export const browser = async (options: BrowserOptions = {}): Promise<Browser> =>
  browserOf(await chromiumPages(options));
