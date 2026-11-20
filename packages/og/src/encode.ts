import type { Browser, Page } from "playwright-core";

export type Format = "png" | "webp" | "jpeg";

type Evaluate = <A, R>(fn: (arg: A) => R | Promise<R>, arg: A) => Promise<R>;

let browser: Promise<Browser> | undefined;
let page: Promise<Page> | undefined;

const open = (): Promise<Page> => {
  browser ??= import("playwright-core").then(async ({ chromium }) => {
    try {
      return await chromium.launch();
    } catch {
      return chromium.launch({ channel: "chrome" }).catch(() => {
        throw new Error(
          "No Chromium to encode posters with. Run `npx playwright-core install chromium-headless-shell`.",
        );
      });
    }
  });
  page ??= browser.then((b) => b.newPage());

  return page;
};

// The browser closes itself a moment after its last picture, so a script that only renders does not hang on it.
const IDLE = 2000;
let busy = 0;
let idle: ReturnType<typeof setTimeout> | undefined;

export const encodeWith = async (
  evaluate: Evaluate,
  png: Uint8Array,
  format: Format,
  quality = 0.8,
): Promise<Uint8Array> => {
  if (format === "png") return png;

  const base64 = await evaluate(
    async ({ data, format, quality }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;

      if (format === "jpeg") {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      context.drawImage(image, 0, 0);

      return canvas.toDataURL(`image/${format}`, quality).split(",")[1]!;
    },
    { data: Buffer.from(png).toString("base64"), format, quality },
  );

  return Buffer.from(base64, "base64");
};

export const encode = async (
  png: Uint8Array,
  format: Format,
  quality = 0.8,
): Promise<Uint8Array> => {
  if (format === "png") return png;
  clearTimeout(idle);
  busy++;

  try {
    const p = await open();

    return await encodeWith(
      // SAFETY: Playwright types the argument as Unboxed<A>, which is A itself for the plain data encodeWith passes.
      <A, R>(fn: (arg: A) => R | Promise<R>, arg: A) =>
        p.evaluate<R, A>(fn as Parameters<typeof p.evaluate<R, A>>[0], arg),
      png,
      format,
      quality,
    );
  } finally {
    if (--busy === 0) idle = setTimeout(closeBrowser, IDLE);
  }
};

export const closeBrowser = async (): Promise<void> => {
  const open = browser;
  browser = page = undefined;

  if (open) await (await open).close();
};
