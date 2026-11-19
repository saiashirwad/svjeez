import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { scene } from "svjeez";
import type { Scene } from "svjeez/tools";
import type { Page } from "playwright-core";
import { inlineAssets } from "./assets.ts";
import { cached, cachePath } from "./cache.ts";
import { callerFile } from "./component.ts";
import { reactIdentifyScript } from "./frameworks/react.identify.ts";
import { compile, type Diagnostic } from "./compile/index.ts";
import { fromPortable, toPortable } from "./portable.ts";
import { openPage, record, type OpenPageOptions, type Snap, type State } from "./record.ts";
import { serializeProps, type Bag } from "./props.ts";
import type { Target } from "./target.ts";

export interface FilmOptions {
  /** Which `prefers-color-scheme` to capture under; `"both"` makes a scene that follows the viewer's. Default: the page as it is. */
  readonly scheme?: "light" | "dark" | "both";
  /** The scene's title (the SVG's `<title>`, which assistive tech reads). Default: the component's name (`Card`), else the page's `<title>` (Vite `serve`), else the film file's name (`board.film.tsx` -> "board"; `index.tsx` -> its folder's name). */
  readonly title?: string;
  /**
   * Draw the mouse: wherever the script moves it (`page.mouse`, `locator.click()`, `hover()`, `dragTo()`), an arrow follows it
   * from snap to snap above the page, dipping and ringing where a button goes down. Nothing is added to the app. Default false.
   */
  readonly cursor?: boolean;
  /** The browser window. Default 1280x720. */
  readonly viewport?: { readonly width: number; readonly height: number };
  /**
   * Keep the recorded states in a JSON file, and reuse them while the server's `sources()` and these options are unchanged.
   * `true` is `<film file>.states.json` next to the film file (`card.film.tsx` -> `card.film.states.json`); a relative path is
   * relative to the film file, not the working directory; an absolute path is used as is. `SVJEEZ_DOM_REFRESH=1` records again.
   */
  readonly cache?: boolean | string;
  /** Called with what the compile could not draw faithfully. Default: one `console.warn` listing them. */
  readonly onDiagnostics?: (diagnostics: readonly Diagnostic[]) => void;
  /**
   * Decides when the page is ready for a `snap` (and after every `update`). Default: `settleScript`, which waits for
   * the framework adapter's idle signal if it has one, then fonts, transitions and a stable layout.
   */
  readonly settle?: (page: Page, selector: string) => Promise<void>;
  /** Chromium to use instead of the default. */
  readonly executablePath?: OpenPageOptions["executablePath"];
}

export interface FilmContext<Props = never> {
  /** The page, to drive with Playwright. */
  readonly page: Page;
  /** Waits for the page to settle, then records a state. See `record`. */
  readonly snap: Snap;
  /** Component targets only: merges `props` into the mounted component's props, re-renders and waits for the page to settle. */
  readonly update: (props: Props) => Promise<void>;
}

/**
 * The default readiness check, as a page script: the framework adapter's `settled()` (component targets) if it has one,
 * fonts loaded, running transitions done, and the root's box unchanged for a few frames.
 */
export const settleScript = (selector: string) => `(async () => {
  const root = document.querySelector(${JSON.stringify(selector)});
  const frame = () => new Promise((done) => requestAnimationFrame(() => done()));
  const box = () => { const r = root.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].join(); };
  await window.__svjeez?.settled?.();
  await document.fonts.ready;
  let last = "", still = 0;
  for (let i = 0; i < 120 && still < 3; i++) {
    await frame();
    await Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => {})));
    const now = box();
    still = now === last ? still + 1 : 0;
    last = now;
  }
})()`;

/**
 * Where capture gets framework identities: the mounted adapter's `identify` (component targets), else React's, which finds
 * its fibers on any page (app targets) and says nothing on a page without React.
 */
const IDENTIFY = `(window.__svjeez?.identify ?? ${reactIdentifyScript})`;

/** A title from the film file's path: `board.film.tsx` is "board", `index.tsx` is the folder it is in. */
export const titleFromFile = (file: string | undefined): string => {
  if (!file) return "Untitled";

  const name = basename(file).split(".")[0]!;

  return name === "index" ? basename(dirname(file)) : name;
};

const warn = (diagnostics: readonly Diagnostic[]) => {
  if (diagnostics.length > 0)
    console.warn(
      `svjeez/dom: ${diagnostics.length} approximation${diagnostics.length === 1 ? "" : "s"}\n${diagnostics.map(({ path, what }) => `  ${path}: ${what}`).join("\n")}`,
    );
};

/** What the interaction script is, for the cache: the `run` function's source (whitespace-normalized) and the film file's text. */
export const scriptInputs = (run: Function, film: string | undefined): string => {
  let file = "";

  try {
    if (film) file = readFileSync(film, "utf8");
  } catch {
    // Not a readable file: the function source alone stands in.
  }

  return `${run.toString().replace(/\s+/g, " ")}\n${file}`;
};

/**
 * Films a target: opens it, runs your interaction script, and returns the scene that morphs between the states you `snap`.
 *
 *     export default await film(serve(index, { selector: "#app" }), async ({ page, snap }) => {
 *       await snap("start");
 *       await page.getByRole("button").click();
 *       await snap("done", { over: 0.7 });
 *     }, { scheme: "both", title: "Demo" });
 *
 * A target is an app (`serve`) or one mounted component (`component`, whose script can also `update` its props).
 * Throws if the page throws or logs a console error. Everything is closed afterwards, errors included.
 */
export const film = async <Props = never>(
  target: Target<Props> | Promise<Target<Props>>,
  run: (context: FilmContext<Props>) => Promise<void>,
  options: FilmOptions = {},
): Promise<Scene> => {
  const { scheme, cursor, viewport, cache, onDiagnostics = warn, executablePath } = options;
  // Before the first await, while the film file is still on the stack.
  const caller = callerFile();
  const app = await target;
  const { selector } = app;
  const settle = options.settle ?? ((page: Page) => page.evaluate(settleScript(selector)));

  try {
    const errors: string[] = [];

    const report = () =>
      new Error(`film: the page reported errors:\n${errors.map((e) => `  ${e}`).join("\n")}`);

    const check = () => {
      if (errors.length > 0) throw report();
    };

    // A page that fails while it starts (a component that throws) never gets its selector: stop waiting for it.
    let fail: (error: Error) => void = () => {};

    const failed = new Promise<never>((_, reject) => {
      fail = reject;
    });

    failed.catch(() => {});

    const capture = async (): Promise<State[]> => {
      const { page, close } = await openPage({
        url: app.url,
        ...(viewport && { viewport }),
        ...(executablePath && { executablePath }),
        onError: (message) => {
          errors.push(message);
          fail(report());
        },
      });

      try {
        await Promise.race([page.waitForSelector(selector), failed]);
        await settle(page, selector);
        check();

        const recorded = await record(
          page,
          selector,
          (snap) =>
            run({
              page,
              snap: async (name, timing) => {
                await settle(page, selector);

                return snap(name, timing);
              },
              update: async (props) => {
                // SAFETY: `Props` is a plain object type; the runtime check in `serializeProps` is what holds it to JSON.
                const wire = serializeProps(props as Bag, "update");

                if (!(await page.evaluate("Boolean(window.__svjeez)")))
                  throw new Error(
                    "film: update() needs a component target. Make one with component() from @svjeez/dom/vite or @svjeez/dom/bun.",
                  );

                await page.evaluate(`window.__svjeez.update(${JSON.stringify(wire)})`);
                await settle(page, selector);
                check();
              },
            }),
          { ...(scheme && { scheme }), ...(cursor && { cursor }), identify: IDENTIFY },
        );

        check();

        return recorded;
      } finally {
        await close();
      }
    };

    // The port and the checkout's location change, so the cache keeps asset URLs relative to a placeholder origin and `base`.
    const origin = new URL(app.url).origin;
    const base = app.base ?? process.cwd();

    const file = cache ? cachePath(cache, app.film ?? caller) : undefined;

    const states = file
      ? fromPortable(
          await cached(
            file,
            {
              sources: await app.sources(),
              selector,
              scheme: scheme ?? null,
              viewport: viewport ?? null,
              ...(cursor && { cursor }),
              script: scriptInputs(run, app.film ?? caller),
            },
            async () => toPortable(await capture(), origin, base),
          ),
          origin,
          base,
        )
      : await capture();

    // Bundled fonts and images have hashed URLs that only this server knows.
    const { element, size, duration, diagnostics } = compile(await inlineAssets(states));

    onDiagnostics(diagnostics);

    const title = options.title ?? app.title ?? titleFromFile(app.film ?? caller);

    return scene({ size, duration, title }, () => element);
  } finally {
    await app.close();
  }
};
