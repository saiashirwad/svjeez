import type { FontValue } from "svjeez/tools";
import { chromiumPages } from "./chromium.ts";
import type { Palette } from "./palette.ts";
import type { Action, Flow, Instruction, PageAction } from "./flow.ts";
import type { Step } from "./timeline.ts";
import type { Snapshot } from "./tree.ts";

export type Css = string | ((html: string) => string | Promise<string>);

export const isCssText = (css: Css | undefined): css is string => typeof css === "string";

export interface BrowserOptions {
  readonly css?: Css;
  readonly fonts?: readonly FontValue[];
  readonly palette?: Palette;
  readonly schemes?: "both" | "light" | "dark";
  readonly dark?: { readonly class?: string };
  readonly executablePath?: string;
  readonly screenshots?: boolean;
  readonly base?: string;
}

export interface PageOptions {
  readonly parts?: Readonly<Record<string, string>>;
  readonly pad?: number;
  readonly width?: number;
}

export interface MountOptions extends PageOptions {
  readonly css?: Css;
  readonly root?: { readonly class?: string };
}

export interface OpenOptions extends PageOptions {
  readonly root: string;
  readonly height?: number;
  readonly ready?: string;
}

export interface Url extends OpenOptions {
  readonly url: string;
}

export interface Card {
  readonly snap: (action?: PageAction) => Promise<Snapshot>;
  readonly run: (flow: Flow) => Promise<Step[]>;
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

  if ("snap" in step && first && (step.over !== undefined || step.curve))
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

export const browser = async (options: BrowserOptions = {}): Promise<Browser> =>
  browserOf(await chromiumPages(options));
