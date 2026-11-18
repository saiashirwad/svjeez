import type { Browser as Chromium, CDPSession, Page } from "playwright-core";
import type { Font, FontValue } from "svjeez/tools";
import {
  isCssText,
  type Io,
  type Shots,
  type PageOptions,
  type Pages,
  type BrowserOptions,
} from "./browser.ts";
import { collect, release } from "./anims.ts";
import { PAD } from "./demo.ts";
import { diagnose } from "./diagnostics.ts";
import type { Action } from "./flow.ts";
import { dataUri, families, fontFace, formatOf, isWholeFile, sources, unwrap } from "./fonts.ts";
import {
  embed,
  preload,
  shrink,
  stills,
  svgUri,
  unpack,
  type Fetched,
  type Size,
} from "./images.ts";
import { paletteCss } from "./palette.ts";
import { merge } from "./scheme.ts";
import type { Box, Face, Snapshot } from "./tree.ts";
import { shoot } from "./shot.ts";
import { walk, type Marks } from "./walk.ts";

type Scheme = "light" | "dark";

export const facesOf = (value: FontValue): readonly Font[] =>
  "faces" in value ? value.faces : [value];

export const launch = async (executablePath?: string): Promise<Chromium> => {
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

const shim = (page: Page) => page.evaluate("globalThis.__name ??= (fn) => fn");

const settle = (page: Page, quiet: boolean) =>
  page.evaluate(async (quiet) => {
    const frames = () =>
      new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));

    if (!quiet) await frames();
    else
      await new Promise<void>((done) => {
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

    const deadline = new Promise((done) => setTimeout(done, 3000));
    const within = (wait: Promise<unknown>) => Promise.race([wait, deadline]);

    await within(document.fonts.ready);
    await within(
      Promise.all(
        document
          .getAnimations()
          .filter(
            (a) =>
              a.timeline === document.timeline &&
              a.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );
  }, quiet);

const pseudoTexts = async (session: CDPSession) => {
  const { documents, strings } = await session.send("DOMSnapshot.captureSnapshot", {
    computedStyles: [],
  });

  const texts = new Map<number, string>();

  for (const { nodes, layout } of documents)
    layout.nodeIndex.forEach((n, i) => {
      const text = layout.text[i] ?? -1;

      if (text < 0 || !nodes.pseudoType?.index.includes(n)) return;
      const id = nodes.backendNodeId![n]!;
      texts.set(id, (texts.get(id) ?? "") + strings[text]);
    });

  return texts;
};

const markPseudos = async (session: CDPSession, page: Page) => {
  const { root } = await session.send("DOM.getDocument", { depth: -1, pierce: true });
  const texts = await pseudoTexts(session);

  const owners: {
    id: number;
    pseudos: { id: number; type: "before" | "after"; text?: string }[];
  }[] = [];

  const visit = (node: typeof root) => {
    const own = (node.pseudoElements ?? []).flatMap((p) =>
      p.pseudoType === "before" || p.pseudoType === "after"
        ? [{ id: p.nodeId, type: p.pseudoType, text: texts.get(p.backendNodeId) }]
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
        text: Object.fromEntries(
          pseudos.flatMap((p) => (p.text === undefined ? [] : [[p.type, p.text]])),
        ),
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

const RANGE_STYLE = new Set([
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "box-shadow",
  "opacity",
  "visibility",
  ...["top-left", "top-right", "bottom-right", "bottom-left"].map(
    (corner) => `border-${corner}-radius`,
  ),
  ...["top", "right", "bottom", "left"].flatMap((side) => [
    `border-${side}-width`,
    `border-${side}-style`,
    `border-${side}-color`,
  ]),
]);

const markRanges = async (session: CDPSession, page: Page) => {
  const { root } = await session.send("DOM.getDocument", { depth: -1, pierce: true });

  type N = typeof root;

  const owners: { id: number; track: N; thumb: N }[] = [];

  const attr = (n: N, name: string) => {
    const i = (n.attributes ?? []).indexOf(name);

    return i < 0 ? undefined : n.attributes![i + 1];
  };

  const within = (n: N, test: (x: N) => boolean): N | undefined => {
    if (test(n)) return n;

    for (const c of [...(n.shadowRoots ?? []), ...(n.children ?? [])]) {
      const found = within(c, test);

      if (found) return found;
    }

    return undefined;
  };

  const visit = (n: N) => {
    if (n.nodeName === "INPUT" && attr(n, "type") === "range") {
      const track = within(n, (x) => attr(x, "pseudo") === "-webkit-slider-runnable-track");
      const thumb = track?.children?.[0];

      if (track && thumb) owners.push({ id: n.nodeId, track, thumb });
    }

    for (const c of n.children ?? []) visit(c);

    if (n.contentDocument) visit(n.contentDocument);
  };

  visit(root);
  await page.evaluate("globalThis.__svjeezRange = new WeakMap()");

  if (owners.length === 0) return;
  await session.send("CSS.enable");

  const part = async (n: N) => {
    const [{ model }, { computedStyle }] = await Promise.all([
      session.send("DOM.getBoxModel", { nodeId: n.nodeId }),
      session.send("CSS.getComputedStyleForNode", { nodeId: n.nodeId }),
    ]);

    const xs = model.border.filter((_, i) => i % 2 === 0);
    const ys = model.border.filter((_, i) => i % 2 === 1);

    return {
      rect: [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      ],
      style: Object.fromEntries(
        computedStyle.filter((p) => RANGE_STYLE.has(p.name)).map((p) => [p.name, p.value]),
      ),
    };
  };

  for (const { id, track, thumb } of owners) {
    const marks = { track: await part(track), thumb: await part(thumb) };
    const { object } = await session.send("DOM.resolveNode", { nodeId: id });

    if (!object.objectId) continue;

    await session.send("Runtime.callFunctionOn", {
      objectId: object.objectId,
      functionDeclaration: "function (marks) { globalThis.__svjeezRange?.set(this, marks); }",
      arguments: [{ value: marks }],
    });
    await session.send("Runtime.releaseObject", { objectId: object.objectId });
  }

  await session.send("CSS.disable");
};

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

  const head = faces + (options.palette ? paletteCss(options.palette) : "");

  const schemes = options.schemes ?? "both";
  const darkClass = options.dark?.class ?? "dark";
  const resting = schemes === "dark" ? "dark" : "light";
  const givenFamilies = new Set(given.map((f) => f.family));
  const files = new Map<string, Promise<string | undefined>>();

  const fetched = new Map<string, Promise<Fetched | undefined>>();
  const pictures = new Map<string, Promise<string | undefined>>();

  const fetchImage = async (page: Page, url: string): Promise<Fetched | undefined> => {
    if (url.startsWith("data:")) return unpack(url);

    const response = await page.request.get(url);

    if (!response.ok()) return undefined;

    const type = (response.headers()["content-type"] ?? "").split(";")[0]!.trim();

    const mime = type.startsWith("image/")
      ? type
      : /\.svg(\?|$)/i.test(url)
        ? "image/svg+xml"
        : undefined;

    return mime ? { mime, bytes: await response.body() } : undefined;
  };

  const picture = (page: Page) => (url: string, size: Size) => {
    const key = `${Math.ceil(size[0])}x${Math.ceil(size[1])} ${url}`;
    let file = pictures.get(key);

    if (!file) {
      let got = fetched.get(url);

      if (!got) {
        got = fetchImage(page, url).catch(() => undefined);
        fetched.set(url, got);
      }

      file = got.then(async (image) => {
        if (!image) return undefined;

        if (image.mime === "image/svg+xml") return svgUri(image.bytes.toString("utf8"));

        const data = image.bytes.toString("base64");

        const small = await page
          .evaluate(shrink, { data, mime: image.mime, width: size[0], height: size[1] })
          .catch(() => undefined);

        return small ?? `data:${image.mime};base64,${data}`;
      });
      pictures.set(key, file);
    }

    return file;
  };

  const canvases = async (page: Page) => {
    const need = await page.evaluate(stills);

    if (need.length === 0) return;

    const list = await page.evaluateHandle(() => globalThis.__svjeezCanvases ?? []);

    for (const i of need) {
      const handle = (await list.evaluateHandle((all, i) => all[i]!, i)).asElement();

      if (!handle) continue;

      const at = await page.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const x = Math.max(r.left, 0);
        const y = Math.max(r.top, 0);

        const style = document.createElement("style");

        style.id = "svjeez-still";
        style.textContent = "*{visibility:hidden!important}";
        document.head.append(style);
        el.style.setProperty("visibility", "visible", "important");

        return {
          x,
          y,
          width: Math.min(r.right, innerWidth) - x,
          height: Math.min(r.bottom, innerHeight) - y,
        };
      }, handle);

      const png =
        at.width >= 1 && at.height >= 1
          ? await page
              .screenshot({ clip: at, omitBackground: true, animations: "allow" })
              .catch(() => undefined)
          : undefined;

      await page.evaluate(
        ([el, uri, at]) => {
          document.getElementById("svjeez-still")?.remove();
          el.style.removeProperty("visibility");

          if (uri) (globalThis.__svjeezStills ??= new WeakMap()).set(el, { href: uri, at });
        },
        [handle, png && `data:image/png;base64,${png.toString("base64")}`, at] as const,
      );
    }
  };

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
          const whole = isWholeFile(face);

          file = download(url).then(
            async (bytes) =>
              bytes && dataUri(whole ? bytes : await unwrap(bytes).catch(() => bytes)),
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
    { parts = {}, pad = PAD }: PageOptions,
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

    let shots: Shots = {};
    let diagnostics: Partial<Record<Scheme, Awaited<ReturnType<typeof diagnose>>>> = {};

    const pass = async (value: Scheme) => {
      await scheme(value);
      await settle(page, false);
      cdp ??= await page.context().newCDPSession(page);
      await markPseudos(cdp, page);
      await markRanges(cdp, page);

      const root = await page.evaluate(walk, { selector, pad, parts });

      if (options.screenshots) {
        shots[value] = await shoot(page, selector, root.box, pad);
        diagnostics[value] = await page.evaluate(diagnose, { selector });
      }

      return root;
    };

    const both = async (tries = 3): Promise<Box> => {
      const dark = schemes === "light" ? undefined : await pass("dark");
      const light = schemes === "dark" ? undefined : await pass("light");

      if (!dark || !light) return (light ?? dark)!;

      let differs = false;

      const root = merge(light, dark, () => {
        differs = true;
      });

      return differs && tries > 1 ? both(tries - 1) : root;
    };

    await scheme(resting);

    const read = async (): Promise<Snapshot> => {
      shots = {};
      diagnostics = {};
      await shim(page);
      await page.evaluate(collect, selector);
      await settle(page, true);
      await canvases(page);
      await page.evaluate(preload);

      const read = await both();

      await page.evaluate(release);

      const root = await embed(read, picture(page));

      const fonts = await capture(
        page,
        [...families(root)].filter((f) => !givenFamilies.has(f)),
      );

      if (options.screenshots) {
        const embedded = new Set(
          [...givenFamilies, ...fonts.map((face) => face.family)].map((f) => f.toLowerCase()),
        );

        for (const scheme of ["light", "dark"] as const) {
          const entries = diagnostics[scheme];

          if (entries)
            diagnostics[scheme] = entries.filter(
              (entry) => !entry.family || !embedded.has(entry.family.toLowerCase()),
            );
        }
      }

      return {
        ...(options.screenshots && { diagnostics }),
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

      if ("pointer" in action) {
        const { to, at = [0.5, 0.5], steps = 1, button } = action.pointer;

        if (to !== undefined) {
          const el = await target(page, selector, parts, to);
          const box = await (el ?? page.locator(to).first()).boundingBox();

          if (!box) throw new Error(`drag(): "${to}" isn't on the page, or isn't drawn.`);

          await page.mouse.move(box.x + box.width * at[0], box.y + box.height * at[1], { steps });
        }

        if (button === "down") await page.mouse.down();

        if (button === "up") await page.mouse.up();

        return;
      }

      if ("html" in action) return render(action.html);

      if ("props" in action)
        return page.evaluate(async (json) => {
          const host = window.__svjeez;

          if (!host?.props)
            throw new Error(
              "props() re-renders a component, but this page has no window.__svjeez.props. Record it with @svjeez/dom/vite.",
            );

          await host.props(JSON.parse(json));
        }, JSON.stringify(action.props));

      throw new Error(`run() doesn't know the instruction ${JSON.stringify(action)}.`);
    };

    return {
      read,
      shots: () => shots,
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
        `<!doctype html><html class="${root?.class ?? ""}"><head><meta charset="utf-8"><style>${head}</style><style id="svjeez-css">${await sheet(html)}</style></head><body style="margin:0;background:none"><div id="svjeez-dom" style="${wrap}">${html}</div></body></html>`,
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
        await page.mouse.move(-1, -1);
      });
    },
    open: async (url, { root, width, height, ready, ...rest }) => {
      const page = await chromium.newPage({
        viewport: { width: Math.ceil(width ?? 1280), height: Math.ceil(height ?? 1000) },
      });

      await page.goto(options.base ? new URL(url, options.base).href : url, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => undefined);

      if (head) await page.addStyleTag({ content: head });

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
