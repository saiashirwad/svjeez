import { describe, expect, test } from "bun:test";
import { openScene } from "svjeez/frames";
import { svg } from "svjeez/tools";
import { film, openPage } from "../src/index.ts";
import { serve } from "../src/bun.ts";
import background from "./app/background.html";
import form from "./app/form.html";
import index from "./app/index.html";
import pseudo from "./app/pseudo.html";

/** Mean absolute difference over the page's box (the scene may be larger, sized for its biggest state), RGB, 0 to 255, measured in Chromium. */
const difference = async (
  a: Uint8Array,
  b: Uint8Array,
  /** Compare `a` with this part of `b` (in `b`'s px) rather than all of it. */
  region?: { x: number; y: number; width: number; height: number },
): Promise<number> => {
  const { page, close } = await openPage({ url: "about:blank" });

  try {
    const urls = [a, b].map(
      (png) => `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
    );

    return await page.evaluate(
      async ([first, second, part]) => {
        const load = (src: string) =>
          new Promise<HTMLImageElement>((done, fail) => {
            const image = new Image();

            image.onload = () => done(image);
            image.onerror = () => fail(new Error("image did not load"));
            image.src = src;
          });

        const [x, y] = await Promise.all([load(first!), load(second!)]);
        const [width, height] = part ? [part.width, part.height] : [x.width, x.height];
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        context.drawImage(x, 0, 0);
        const before = context.getImageData(0, 0, width, height).data;
        context.clearRect(0, 0, width, height);
        context.drawImage(y, -(part?.x ?? 0), -(part?.y ?? 0));
        const after = context.getImageData(0, 0, width, height).data;
        let total = 0;

        for (let i = 0; i < before.length; i += 4)
          total +=
            Math.abs(before[i]! - after[i]!) +
            Math.abs(before[i + 1]! - after[i + 1]!) +
            Math.abs(before[i + 2]! - after[i + 2]!);

        return total / (before.length / 4) / 3;
      },
      // SAFETY: `urls` is mapped from the two-element list above.
      [...(urls as [string, string]), region] as const,
    );
  } finally {
    await close();
  }
};

describe("film", () => {
  test("the SVG opens cleanly and matches the page at the end of each state", async () => {
    const shots: Uint8Array[] = [];
    const timings = [{}, { over: 0.5, hold: 0.6 }, { over: 0.5 }];

    const board = await film(
      serve(index, { selector: "#app" }),
      async ({ page, snap }) => {
        const shot = async () => shots.push(await page.locator("#app").screenshot());

        await snap("start", timings[0]);
        await shot();
        await page.click("#add");
        await snap("two", timings[1]);
        await shot();
        await page.click("#add");
        await snap("three", timings[2]);
        await shot();
      },
      { scheme: "both", viewport: { width: 400, height: 400 }, onDiagnostics: () => {} },
    );

    const markup = svg.emit(board);

    const errors: string[] = [];

    const checker = await openPage({
      url: "about:blank",
      onError: (message) => errors.push(message),
    });

    await checker.page.goto(`data:image/svg+xml;base64,${Buffer.from(markup).toString("base64")}`);
    await checker.close();
    expect(errors).toEqual([]);

    const view = await openScene(markup, { colorScheme: "light" });
    let at = 0;

    try {
      for (const [index, timing] of timings.entries()) {
        at += (index === 0 ? 0 : (timing.over ?? 0.6)) + (timing.hold ?? 0.8);

        const gap = await difference(shots[index]!, await view.capture(at - 0.05));

        expect(gap).toBeLessThan(4);
      }
    } finally {
      await view.close();
    }
  }, 60_000);

  test("a login form with values, a placeholder and a checkbox matches the page in both schemes", async () => {
    const shots: Record<"light" | "dark", Uint8Array> = {
      light: new Uint8Array(),
      dark: new Uint8Array(),
    };

    const scene = await film(
      serve(form, { selector: "#app" }),
      async ({ page, snap }) => {
        await snap("form");

        for (const scheme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme: scheme });
          shots[scheme] = await page.locator("#app").screenshot();
        }
      },
      { scheme: "both", viewport: { width: 400, height: 400 }, onDiagnostics: () => {} },
    );

    const markup = svg.emit(scene);

    for (const scheme of ["light", "dark"] as const) {
      const view = await openScene(markup, { colorScheme: scheme });

      try {
        expect(await difference(shots[scheme], await view.capture(0.1))).toBeLessThan(4);
      } finally {
        await view.close();
      }
    }
  }, 60_000);

  test("badge, status dot, divider and custom checkbox pseudo-elements match the page in both schemes", async () => {
    const shots: Record<"light" | "dark", Uint8Array> = {
      light: new Uint8Array(),
      dark: new Uint8Array(),
    };

    const scene = await film(
      serve(pseudo, { selector: "#app" }),
      async ({ page, snap }) => {
        await snap("pseudo");

        for (const scheme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme: scheme });
          shots[scheme] = await page.locator("#app").screenshot();
        }
      },
      { scheme: "both", viewport: { width: 400, height: 400 }, onDiagnostics: () => {} },
    );

    const markup = svg.emit(scene);

    for (const scheme of ["light", "dark"] as const) {
      const view = await openScene(markup, { colorScheme: scheme });

      try {
        expect(await difference(shots[scheme], await view.capture(0.1))).toBeLessThan(4);
      } finally {
        await view.close();
      }
    }
  }, 60_000);

  test("background images, tiles, elliptical glows and repeating gradients match the page in both schemes", async () => {
    const IDS = [
      "cover",
      "contain",
      "dots",
      "select",
      "check",
      "glow",
      "stripes",
      "rings",
      "tiles",
      "space",
      "round",
      "boxes",
    ] as const;

    const shots: Record<"light" | "dark", Uint8Array> = {
      light: new Uint8Array(),
      dark: new Uint8Array(),
    };

    // Where each part sits in #app, to compare it alone: a mean over the whole page would hide a small box going wrong.
    let parts: Record<string, { x: number; y: number; width: number; height: number }> = {};
    const shotsOf: Record<string, Record<"light" | "dark", Uint8Array>> = {};

    const diagnostics: string[] = [];

    const scene = await film(
      serve(background, { selector: "#app" }),
      async ({ page, snap }) => {
        await snap("backgrounds");
        const app = (await page.locator("#app").boundingBox())!;

        parts = Object.fromEntries(
          await Promise.all(
            IDS.map(async (id) => {
              const found = (await page.locator(`#${id}`).boundingBox())!;

              return [id, { ...found, x: found.x - app.x, y: found.y - app.y }] as const;
            }),
          ),
        );

        for (const scheme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme: scheme });
          shots[scheme] = await page.locator("#app").screenshot();

          for (const id of IDS)
            (shotsOf[id] ??= { light: new Uint8Array(), dark: new Uint8Array() })[scheme] =
              await page.locator(`#${id}`).screenshot();
        }
      },
      {
        scheme: "both",
        viewport: { width: 400, height: 1100 },
        onDiagnostics: (found) => diagnostics.push(...found.map(({ what }) => what)),
      },
    );

    // Everything on the page is drawn.
    expect(diagnostics).toEqual([]);

    const markup = svg.emit(scene);

    for (const scheme of ["light", "dark"] as const) {
      const view = await openScene(markup, { colorScheme: scheme });

      try {
        const drawn = await view.capture(0.1);

        const gaps = [{ id: "page", gap: await difference(shots[scheme], drawn) }];

        for (const id of IDS)
          gaps.push({ id, gap: await difference(shotsOf[id]![scheme], drawn, parts[id]) });

        expect(gaps.filter(({ gap }) => gap >= 4)).toEqual([]);
      } finally {
        await view.close();
      }
    }
  }, 90_000);

  test("fails loudly when the page throws", async () => {
    await expect(
      film(serve(index, { selector: "#app" }), async ({ page }) => {
        await page.evaluate(() =>
          setTimeout(() => {
            throw new Error("boom");
          }),
        );
        await page.waitForTimeout(100);
      }),
    ).rejects.toThrow("boom");
  }, 30_000);
});
