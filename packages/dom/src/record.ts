import type { Page } from "playwright-core";
import { captureScript } from "./capture.ts";
import { mergeSchemes } from "./scheme.ts";
import { checkVersion, type Snapshot } from "./schema.ts";

/** The core easings, by name. */
export type EaseName = "linear" | "in" | "out" | "inOut" | "pop" | "hold";

/**
 * How the scene gets from the previous state to this one. States play in the order they were snapped, one after another.
 * All times are seconds. Anything left out is for the compile step to default.
 */
export interface Timing {
  /** How long the move from the previous state into this one takes. Ignored on the first state. */
  readonly over?: number;
  /** How long this state rests before the move to the next one. */
  readonly hold?: number;
  /** The easing of the move into this state. */
  readonly ease?: EaseName;
}

/** One named moment of the page, as `snap` saw it. */
export interface State extends Timing {
  readonly name: string;
  readonly snapshot: Snapshot;
}

export type Snap = (name: string, timing?: Timing) => Promise<State>;

export interface RecordOptions {
  /**
   * Which `prefers-color-scheme` to capture under. `"both"` captures every state under light and dark and merges them
   * (see `mergeSchemes`), so the scene follows the viewer's scheme. Default: the page as it is.
   */
  readonly scheme?: "light" | "dark" | "both";
  /**
   * A page expression that evaluates to `(el: Element) => string | undefined` (or nothing). Before each capture, every element
   * under the root is stamped `data-svjeez-id` with its result (and unstamped when it is undefined), which capture reads as the
   * node's `identity`. `film` uses it to hand the framework's identities (React keys) to `pair`.
   */
  readonly identify?: string;
}

const grab = async (page: Page, selector: string, identify?: string): Promise<Snapshot> =>
  checkVersion(
    await page.evaluate(
      `(() => {
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) throw new Error("record: nothing on the page matches " + ${JSON.stringify(JSON.stringify(selector))});
        const identify = ${identify ?? "undefined"};
        if (identify)
          for (const el of [root, ...root.querySelectorAll("*")]) {
            const id = identify(el);
            if (id) el.setAttribute("data-svjeez-id", id);
            else el.removeAttribute("data-svjeez-id");
          }
        return (${captureScript})(root);
      })()`,
    ),
  );

/** Switches the page's color scheme without starting the CSS transitions a color change would trigger. */
const emulate = async (page: Page, scheme: "light" | "dark"): Promise<void> => {
  const style = await page.addStyleTag({
    content: "*,*::before,*::after{transition:none!important}",
  });

  await page.emulateMedia({ colorScheme: scheme });
  await page.evaluate(() => getComputedStyle(document.documentElement).color);
  await style.evaluate((el) => el.parentNode?.removeChild(el));
};

/**
 * Runs your Playwright code against `page` and collects a `State` each time it calls `snap`:
 *
 *     const states = await record(page, "#app", async (snap) => {
 *       await snap("empty");
 *       await page.fill("input", "Ada");
 *       await snap("typed", { over: 0.8 });
 *     });
 *
 * `selector` is the element to capture, and `page` is yours: navigate and interact however you like.
 */
export const record = async (
  page: Page,
  selector: string,
  run: (snap: Snap) => Promise<void>,
  { scheme, identify }: RecordOptions = {},
): Promise<State[]> => {
  const states: State[] = [];

  if (scheme === "light" || scheme === "dark") await page.emulateMedia({ colorScheme: scheme });

  if (scheme === "both") await emulate(page, "light");

  await run(async (name, timing = {}) => {
    if (states.some((state) => state.name === name))
      throw new Error(
        `record: there is already a state named "${name}". Name each snap differently.`,
      );

    let snapshot: Snapshot;

    if (scheme === "both") {
      const light = await grab(page, selector, identify);

      await emulate(page, "dark");

      const dark = await grab(page, selector, identify);

      await emulate(page, "light");

      snapshot = mergeSchemes(light, dark);
    } else snapshot = await grab(page, selector, identify);

    const state: State = { name, snapshot, ...timing };

    states.push(state);

    return state;
  });

  return states;
};

export interface OpenPageOptions {
  readonly url: string;
  readonly viewport?: { readonly width: number; readonly height: number };
  readonly executablePath?: string;
  /** Called with every uncaught page exception and every `console.error`, from before the page loads. */
  readonly onError?: (message: string) => void;
}

const ASSETS = new Set(["stylesheet", "script", "font", "image", "media"]);

/** Headless Chromium on `url`. Call `close()` when you are done. */
export const openPage = async ({
  url,
  viewport = { width: 1280, height: 720 },
  executablePath,
  onError,
}: OpenPageOptions): Promise<{ page: Page; close: () => Promise<void> }> => {
  const { chromium } = await import("playwright-core").catch(() => {
    throw new Error(
      "openPage needs playwright-core. Install it with `npm i -D playwright-core`, then `npx playwright-core install chromium-headless-shell`.",
    );
  });

  let browser;

  try {
    browser = await chromium.launch({ executablePath });
  } catch (error) {
    if (executablePath) throw error;

    browser = await chromium.launch({ channel: "chrome" }).catch(() => {
      throw new Error(
        `No Chromium to open the page with. Run \`npx playwright-core install chromium-headless-shell\`, or pass executablePath.\n${error instanceof Error ? error.message : error}`,
      );
    });
  }

  const page = await browser.newPage({ viewport });

  if (onError) {
    page.on("pageerror", (error) => onError(error.message));
    page.on("console", (message) => message.type() === "error" && onError(message.text()));
    // A dev server answers a path it does not serve with its HTML page, status 200: the asset silently never arrives.
    page.on("response", (response) => {
      const kind = response.request().resourceType();
      const type = response.headers()["content-type"] ?? "";

      if (ASSETS.has(kind) && type.includes("text/html"))
        onError(
          `${kind} ${response.url()} came back as ${type.split(";")[0]} instead of a ${kind}: the server has no such file (or does not serve it from there).`,
        );
    });
  }

  try {
    await page.goto(url);
  } catch (error) {
    await browser.close();

    throw error;
  }

  return { page, close: () => browser.close() };
};
