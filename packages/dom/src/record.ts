import type { Page } from "playwright-core";
import type { Curve } from "svjeez";
import { captureScript } from "./capture.ts";
import { mergeSchemes } from "./scheme.ts";
import { checkVersion, type Snapshot } from "./schema.ts";
import type { TextPolicy } from "./compile/typing.ts";

/**
 * How the scene gets from the previous state to this one. States play in the order they were snapped, one after another.
 * All times are seconds. Anything left out is for the compile step to default.
 */
export interface Timing {
  /** How long the move from the previous state into this one takes. Ignored on the first state. */
  readonly over?: number;
  /** How long this state rests before the move to the next one. */
  readonly hold?: number;
  /**
   * The easing of the move into this state: any `Curve` (`ease.out`, `ease.spring()`, ...). A curve is not JSON (a spring is
   * a class), so a cached film can't keep one per snap: it throws. Give a cached film's curve to `film`'s `ease` instead.
   */
  readonly ease?: Curve;
  /**
   * How each text that changes in the move gets there: a policy that sees the change and returns `typing()` (erase back
   * to what the two texts share, then type the rest), `fade`, or undefined to fade. Default: compile's `text`, which
   * defaults to `typeInFields`. A function: a cached film can't keep it, so give a cached film's policy to `film`.
   */
  readonly text?: TextPolicy;
}

/** A point in page px (viewport plus scroll), the frame every Snapshot rect is in. */
export type Point = readonly [x: number, y: number];

/** The mouse at a snap, as the page's pointer events saw it. */
export interface Pointer {
  /** Where it is. */
  readonly at: Point;
  /** Whether a button is held. */
  readonly down: boolean;
  /** Where a button went down since the previous snap, in order. */
  readonly presses: readonly Point[];
}

/** One named moment of the page, as `snap` saw it. */
export interface State extends Timing {
  readonly name: string;
  readonly snapshot: Snapshot;
  /** Where the mouse was (`cursor: true`), unless it had not moved yet. */
  readonly pointer?: Pointer;
}

export type Snap = (name: string, timing?: Timing) => Promise<State>;

export interface RecordOptions {
  /**
   * Which `prefers-color-scheme` to capture under. `"both"` captures every state under light and dark and merges them
   * (see `mergeSchemes`), so the scene follows the viewer's scheme. Default: the page as it is.
   */
  readonly scheme?: "light" | "dark" | "both";
  /**
   * Names an element for `pair`. Before each capture, every element under the root is stamped `data-svjeez-id` with its
   * result (and unstamped when it is undefined), which capture reads as the node's `identity`. `film` uses it to hand the
   * framework's identities (React keys) to `pair`. It runs in the page, serialized with `.toString()`, so it must be
   * self-contained: no closures, no imports, nothing from outside the function.
   */
  readonly identify?: (el: Element) => string | undefined;
  /**
   * Record the mouse into each state's `pointer`: whatever moves it (`page.mouse`, `locator.click()`, `hover()`, `dragTo()`),
   * read from the page's own pointer events, across navigations and reloads. Nothing is added to the page's DOM.
   */
  readonly cursor?: boolean;
}

/** The page function the pointer watcher reports to. */
const BINDING = "__svjeezPointer";

/** Reports the top frame's pointer events, in page px. Runs in every new document (`addInitScript`) and once in the current one. */
const WATCH = `(() => {
  if (window !== window.top || window.__svjeezWatching) return;
  window.__svjeezWatching = true;
  const tell = (kind) => (e) => window.${BINDING}(kind, e.pageX, e.pageY);
  for (const [type, kind] of [["pointermove", "move"], ["pointerdown", "down"], ["pointerup", "up"], ["dragover", "move"], ["drop", "up"]])
    addEventListener(type, tell(kind), true);
})()`;

const round = (n: number) => Math.round(n * 100) / 100;

/** Follows the page's mouse from now on; `take()` is the pointer as it is, and starts a new list of presses. */
const watchPointer = async (page: Page): Promise<{ take: () => Pointer | undefined }> => {
  let at: Point | undefined;
  let down = false;
  let presses: Point[] = [];

  // Bindings and init scripts live on the page, so they survive navigation and reload; the mouse keeps its place in the browser.
  await page.exposeBinding(BINDING, (_, kind: "move" | "down" | "up", x: number, y: number) => {
    at = [round(x), round(y)];

    if (kind === "down") {
      down = true;
      presses.push(at);
    }

    if (kind === "up") down = false;
  });
  await page.addInitScript(WATCH);
  await page.evaluate(WATCH);

  return {
    take: () => {
      const pointer = at && { at, down, presses };

      presses = [];

      return pointer;
    },
  };
};

const grab = async (
  page: Page,
  selector: string,
  identify?: RecordOptions["identify"],
): Promise<Snapshot> =>
  checkVersion(
    await page.evaluate(
      `(() => {
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) throw new Error("record: nothing on the page matches " + ${JSON.stringify(JSON.stringify(selector))});
        const identify = ${identify ? `(${identify.toString()})` : "undefined"};
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
  { scheme, identify, cursor }: RecordOptions = {},
): Promise<State[]> => {
  const states: State[] = [];
  const mouse = cursor ? await watchPointer(page) : undefined;

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

    const pointer = mouse?.take();
    const state: State = { name, snapshot, ...timing, ...(pointer && { pointer }) };

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
  /** CSS every document gets after its own (an adopted stylesheet: in the cascade, not in the DOM), from before it loads. */
  readonly css?: string;
}

const ASSETS = new Set(["stylesheet", "script", "font", "image", "media"]);

/** Headless Chromium on `url`. Call `close()` when you are done. */
export const openPage = async ({
  url,
  viewport = { width: 1280, height: 720 },
  executablePath,
  onError,
  css,
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
    page.on("console", (message) => {
      if (message.type() !== "error") return;

      // The browser's own "Failed to load resource: ... 404" doesn't say which resource; the message's location does.
      const { url: failed } = message.location();

      // Branded Chrome (the fallback when no headless shell is installed) asks every page for a favicon; a film page rarely has one.
      if (failed && new URL(failed).pathname === "/favicon.ico") return;

      onError(
        failed && message.text().startsWith("Failed to load resource")
          ? `${message.text()} (${failed})`
          : message.text(),
      );
    });
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

  if (css)
    await page.addInitScript((text) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }, css);

  try {
    await page.goto(url);
  } catch (error) {
    await browser.close();

    throw error;
  }

  return { page, close: () => browser.close() };
};
