import type { Browser as Chromium, CDPSession, Page } from "playwright-core";
import type { Font, FontValue } from "svjeez";
import {
  isCssText,
  type Io,
  type PageOptions,
  type Pages,
  type BrowserOptions,
} from "./browser.ts";
import type { Action } from "./flow.ts";
import { dataUri, families, fontFace, formatOf, sources, unwrap } from "./fonts.ts";
import { Differ, merge } from "./scheme.ts";
import type { Box, Face, Snapshot } from "./tree.ts";
import { walk, type Marks } from "./walk.ts";

type Scheme = "light" | "dark";

const facesOf = (value: FontValue): readonly Font[] => ("faces" in value ? value.faces : [value]);

const launch = async (executablePath?: string): Promise<Chromium> => {
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

/** tsx and esbuild's keepNames wrap named functions in __name(), which the page doesn't have. */
const shim = (page: Page) => page.evaluate("globalThis.__name ??= (fn) => fn");

/**
 * Transitions and finite animations that an action or a scheme change started must land before the page is read.
 * An app that answers an action from script (search results arriving) changes the DOM a little later, so before a
 * read the page must go `quiet` for a moment, or a few seconds pass. A scheme change only needs two frames.
 */
const settle = (page: Page, quiet: boolean) =>
  page.evaluate(async (quiet) => {
    const frames = () =>
      new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));

    if (!quiet) await frames();
    else
      await new Promise<void>((done) => {
        // Two frames with no change and the page is done. A page that changes is live, so it must then stay
        // still for a longer moment, which lets a script's answer land.
        let timer: ReturnType<typeof setTimeout> | undefined;

        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(() => finish(), 150);
        });

        const limit = setTimeout(() => finish(), 3000);

        const finish = () => {
          observer.disconnect();
          clearTimeout(timer);
          clearTimeout(limit);
          done();
        };

        observer.observe(document, { subtree: true, childList: true, characterData: true });
        void frames().then(() => timer === undefined && finish());
      });

    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    );
  }, quiet);

/**
 * Chromium knows where it laid out each ::before and ::after, but the page has no node to ask. The DevTools protocol
 * does: their border quads are handed to the page by element, in a map `walk` reads.
 */
const markPseudos = async (session: CDPSession, page: Page) => {
  const { root } = await session.send("DOM.getDocument", { depth: -1, pierce: true });
  const owners: { id: number; pseudos: { id: number; type: "before" | "after" }[] }[] = [];

  const visit = (node: typeof root) => {
    const own = (node.pseudoElements ?? []).flatMap((p) =>
      p.pseudoType === "before" || p.pseudoType === "after"
        ? [{ id: p.nodeId, type: p.pseudoType }]
        : [],
    );

    if (own.length > 0) owners.push({ id: node.nodeId, pseudos: own });

    for (const child of node.children ?? []) visit(child);

    if (node.contentDocument) visit(node.contentDocument);
  };

  visit(root);
  await page.evaluate("globalThis.__svjeezPseudo = new WeakMap()");

  const quad = (nodeId: number) =>
    session.send("DOM.getBoxModel", { nodeId }).then(
      (r) => r.model.border,
      () => undefined,
    );

  await Promise.all(
    owners.map(async ({ id, pseudos }) => {
      const [own, ...quads] = await Promise.all([id, ...pseudos.map((p) => p.id)].map(quad));

      if (!own || quads.every((q) => !q)) return;

      const marks: Marks = {
        own,
        ...Object.fromEntries(pseudos.flatMap((p, i) => (quads[i] ? [[p.type, quads[i]]] : []))),
      };

      const { object } = await session.send("DOM.resolveNode", { nodeId: id });

      if (!object.objectId) return;

      await session.send("Runtime.callFunctionOn", {
        objectId: object.objectId,
        functionDeclaration: "function (marks) { globalThis.__svjeezPseudo?.set(this, marks); }",
        arguments: [{ value: marks }],
      });
      await session.send("Runtime.releaseObject", { objectId: object.objectId });
    }),
  );
};

/** A part name, by the `parts` option or `data-part`, found in the page under the root; else a CSS selector. */
const target = async (
  page: Page,
  root: string,
  parts: Readonly<Record<string, string>>,
  name: string,
) => {
  await shim(page);

  const handle = await page.evaluateHandle(
    ([name, root, css]) => {
      const top = document.querySelector(root);
      const pick = (s: string) => (top?.matches(s) ? top : top?.querySelector(s));

      return (css ? pick(css) : undefined) ?? pick(`[data-part="${CSS.escape(name)}"]`) ?? null;
    },
    [name, root, parts[name]] as const,
  );

  return handle.asElement() ?? undefined;
};

/** Pages in one Chromium. */
export const chromiumPages = async (options: BrowserOptions = {}): Promise<Pages> => {
  const chromium = await launch(options.executablePath);
  const given = (options.fonts ?? []).flatMap(facesOf);

  const faces = given
    .map((face) =>
      fontFace(
        { family: face.family, weight: String(face.weight), style: face.style },
        face.href,
        formatOf(face.format),
      ),
    )
    .join("\n");

  const schemes = options.schemes ?? "both";
  const darkClass = options.dark?.class ?? "dark";
  // The scheme a card rests in between snapshots, so actions run in the scheme the page was written for.
  const resting = schemes === "dark" ? "dark" : "light";
  const givenFamilies = new Set(given.map((f) => f.family));
  // Font files by URL, fetched once for every card.
  const files = new Map<string, Promise<string | undefined>>();

  /** The page's own web fonts, fetched from Node so a cross-origin file needs no CORS. */
  const capture = async (page: Page, used: string[]): Promise<Face[]> => {
    if (used.length === 0) return [];

    const found = await page.evaluate(sources, used);

    const download = async (url: string) => {
      if (url.startsWith("data:")) return new Uint8Array(await (await fetch(url)).arrayBuffer());

      const response = await page.request.get(url);

      return response.ok() ? new Uint8Array(await response.body()) : undefined;
    };

    const faces = await Promise.all(
      found.map(async ({ url, ...face }) => {
        let file = files.get(url);

        if (!file) {
          // A file that won't download leaves its text to a fallback font, as a page without it would.
          file = download(url).then(
            async (bytes) => bytes && dataUri(await unwrap(bytes).catch(() => bytes)),
            () => undefined,
          );
          files.set(url, file);
        }

        const src = await file;

        return src ? [{ ...face, src }] : [];
      }),
    );

    return faces.flat();
  };

  const io = async (
    page: Page,
    selector: string,
    { parts = {}, pad = 16 }: PageOptions,
    render: (html: string) => Promise<void>,
  ): Promise<Io> => {
    let cdp: CDPSession | undefined;

    const scheme = async (value: Scheme) => {
      await page.emulateMedia({ colorScheme: value });
      await page.evaluate(([name, on]) => document.documentElement.classList.toggle(name, on), [
        darkClass,
        value === "dark",
      ] as const);
    };

    const pass = async (value: Scheme) => {
      await scheme(value);
      await settle(page, false);
      cdp ??= await page.context().newCDPSession(page);
      await markPseudos(cdp, page);

      return page.evaluate(walk, { selector, pad, parts });
    };

    // Light goes last, so the page ends in the scheme it rests in. A live app may still be changing between the two
    // passes (a progress badge, results arriving), so a mismatch reads both again before it counts.
    const both = async (tries: number): Promise<Box> => {
      const dark = schemes === "light" ? undefined : await pass("dark");
      const light = schemes === "dark" ? undefined : await pass("light");

      try {
        return dark && light ? merge(light, dark) : (light ?? dark)!;
      } catch (error) {
        if (!(error instanceof Differ) || tries <= 1) throw error;

        return both(tries - 1);
      }
    };

    await scheme(resting);

    const read = async (): Promise<Snapshot> => {
      await shim(page);
      await settle(page, true);

      const root = await both(3);

      const fonts = await capture(
        page,
        [...families(root)].filter((f) => !givenFamilies.has(f)),
      );

      return {
        width: Math.ceil(root.box.width + 2 * pad),
        height: Math.ceil(root.box.height + 2 * pad),
        pad,
        box: root.box,
        root,
        fonts: fonts.length > 0 ? fonts : undefined,
      };
    };

    const act = async (action: Action): Promise<void> => {
      if ("click" in action) {
        const el = await target(page, selector, parts, action.click);

        return el ? el.click() : page.click(action.click);
      }

      if ("fill" in action) {
        const [name, text] = action.fill;
        const el = await target(page, selector, parts, name);

        return el ? el.fill(text) : page.fill(name, text);
      }

      if ("hover" in action) {
        const el = await target(page, selector, parts, action.hover);

        return el ? el.hover() : page.hover(action.hover);
      }

      if ("press" in action) return page.keyboard.press(action.press);

      if ("move" in action) return page.mouse.move(...action.move);

      if ("html" in action) return render(action.html);

      throw new Error(`run() doesn't know the instruction ${JSON.stringify(action)}.`);
    };

    return {
      read,
      act,
      drive: async (fn) => {
        await fn(page);
      },
      close: () => page.close(),
    };
  };

  return {
    mount: async (html, { css = options.css ?? "", width, root, ...rest } = {}) => {
      const page = await chromium.newPage({
        viewport: { width: Math.ceil(width ?? 1600), height: 1000 },
      });

      const sheet = async (markup: string) => (isCssText(css) ? css : css(markup));
      const wrap = width === undefined ? "display:inline-block" : `width:${width}px`;

      await page.setContent(
        `<!doctype html><html class="${root?.class ?? ""}"><head><meta charset="utf-8"><style>${faces}</style><style id="svjeez-css">${await sheet(html)}</style></head><body style="margin:0;background:none"><div id="svjeez-dom" style="${wrap}">${html}</div></body></html>`,
      );

      return io(page, "#svjeez-dom > *", rest, async (next) => {
        const css = await sheet(next);

        await page.evaluate(
          ([markup, rules]) => {
            document.getElementById("svjeez-css")!.textContent = rules;
            document.getElementById("svjeez-dom")!.innerHTML = markup;

            const active = document.activeElement;

            if (active instanceof HTMLElement || active instanceof SVGElement) active.blur();
          },
          [next, css] as const,
        );
        // New markup starts as a fresh render would: nothing under the pointer.
        await page.mouse.move(-1, -1);
      });
    },
    open: async (url, { root, width, height, ready, ...rest }) => {
      const page = await chromium.newPage({
        viewport: { width: Math.ceil(width ?? 1280), height: Math.ceil(height ?? 1000) },
      });

      await page.goto(url);

      if (faces) await page.addStyleTag({ content: faces });

      await page.waitForSelector(ready ?? root);

      return io(page, root, rest, async () => {
        throw new Error(
          "html() swaps markup in a mounted card. A card from open() is the app's own page.",
        );
      });
    },
    close: () => chromium.close(),
  };
};
