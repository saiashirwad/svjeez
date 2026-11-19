import { scene } from "svjeez";
import type { Scene } from "svjeez/tools";
import type { Page } from "playwright-core";
import { inlineAssets } from "./assets.ts";
import { cached } from "./cache.ts";
import { compile, type Diagnostic } from "./compile/index.ts";
import { openPage, record, type OpenPageOptions, type Snap, type State } from "./record.ts";
import type { DomServer } from "./server.ts";

export interface FilmOptions {
  /** Which `prefers-color-scheme` to capture under; `"both"` makes a scene that follows the viewer's. Default: the page as it is. */
  readonly scheme?: "light" | "dark" | "both";
  /** The scene's title. Default "Page". */
  readonly title?: string;
  /** The browser window. Default 1280x720. */
  readonly viewport?: { readonly width: number; readonly height: number };
  /** Keep the recorded states in this JSON file, and reuse them while the server's `sources()` and these options are unchanged. `SVJEEZ_DOM_REFRESH=1` records again. */
  readonly cache?: string;
  /** Called with what the compile could not draw faithfully. Default: one `console.warn` listing them. */
  readonly onDiagnostics?: (diagnostics: readonly Diagnostic[]) => void;
  /** Chromium to use instead of the default. */
  readonly executablePath?: OpenPageOptions["executablePath"];
}

export interface FilmContext {
  /** The page, to drive with Playwright. */
  readonly page: Page;
  /** Waits for the page to settle, then records a state. See `record`. */
  readonly snap: Snap;
}

/** Fonts loaded, running transitions done, and the root's box unchanged for a few frames. */
const settleScript = (selector: string) => `(async () => {
  const root = document.querySelector(${JSON.stringify(selector)});
  const frame = () => new Promise((done) => requestAnimationFrame(() => done()));
  const box = () => { const r = root.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].join(); };
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

const ORIGIN = "http://svjeez-dom.invalid";

const warn = (diagnostics: readonly Diagnostic[]) => {
  if (diagnostics.length > 0)
    console.warn(
      `svjeez/dom: ${diagnostics.length} approximation${diagnostics.length === 1 ? "" : "s"}\n${diagnostics.map(({ path, what }) => `  ${path}: ${what}`).join("\n")}`,
    );
};

/**
 * Films a web app: serves it, opens it, runs your interaction script, and returns the scene that morphs between the states you `snap`.
 *
 *     export default await film(serve(index), "#app", async ({ page, snap }) => {
 *       await snap("start");
 *       await page.getByRole("button").click();
 *       await snap("done", { over: 0.7 });
 *     }, { scheme: "both", title: "Demo" });
 *
 * Throws if the page throws or logs a console error. Everything is closed afterwards, errors included.
 */
export const film = async (
  server: DomServer | Promise<DomServer>,
  selector: string,
  run: (context: FilmContext) => Promise<void>,
  options: FilmOptions = {},
): Promise<Scene> => {
  const { scheme, title = "Page", viewport, cache, onDiagnostics = warn, executablePath } = options;
  const app = await server;

  try {
    const errors: string[] = [];

    const check = () => {
      if (errors.length > 0)
        throw new Error(
          `film: the page reported errors:\n${errors.map((e) => `  ${e}`).join("\n")}`,
        );
    };

    const capture = async (): Promise<State[]> => {
      const { page, close } = await openPage({
        url: app.url,
        ...(viewport && { viewport }),
        ...(executablePath && { executablePath }),
        onError: (message) => errors.push(message),
      });

      try {
        await page.waitForSelector(selector);
        await page.evaluate(settleScript(selector));
        check();

        const recorded = await record(
          page,
          selector,
          (snap) =>
            run({
              page,
              snap: async (name, timing) => {
                await page.evaluate(settleScript(selector));

                return snap(name, timing);
              },
            }),
          { ...(scheme && { scheme }) },
        );

        check();

        return recorded;
      } finally {
        await close();
      }
    };

    // The port changes every run, so the cache keeps asset URLs relative to a placeholder origin.
    const origin = new URL(app.url).origin;

    const swap = (states: State[], from: string, to: string): State[] =>
      JSON.parse(JSON.stringify(states).replaceAll(from, to));

    const states = cache
      ? swap(
          await cached(
            cache,
            {
              sources: await app.sources(),
              selector,
              scheme: scheme ?? null,
              viewport: viewport ?? null,
            },
            async () => swap(await capture(), origin, ORIGIN),
          ),
          ORIGIN,
          origin,
        )
      : await capture();

    // Bundled fonts and images have hashed URLs that only this server knows.
    const { element, size, duration, diagnostics } = compile(await inlineAssets(states));

    onDiagnostics(diagnostics);

    return scene({ size, duration, title }, () => element);
  } finally {
    await app.close();
  }
};
