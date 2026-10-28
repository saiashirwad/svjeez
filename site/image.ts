// Re-encode frames as WebP or JPEG in headless Chromium, so the site builds the same on macOS and Linux with no extra tools.
import { chromium, type Browser, type Page } from "playwright-core";

export type Format = "webp" | "jpeg";

let browser: Promise<Browser> | undefined;
let page: Promise<Page> | undefined;

const open = (): Promise<Page> => {
  browser ??= chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
  page ??= browser.then((b) => b.newPage());
  return page;
};

/** Encode a PNG. WebP keeps transparency; JPEG paints it white. */
export const encode = async (png: Uint8Array, format: Format, quality = 0.82): Promise<Uint8Array> => {
  const p = await open();
  const base64 = await p.evaluate(
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

export const close = async (): Promise<void> => {
  if (browser) await (await browser).close();
};
