import type { Page } from "playwright-core";

const pasteAt = async ([png, width, height, dx, dy]: readonly [
  string,
  number,
  number,
  number,
  number,
]) => {
  const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  const canvas = new OffscreenCanvas(width, height);

  canvas.getContext("2d")!.drawImage(bitmap, dx, dy);

  const reader = new FileReader();

  const done = new Promise<string>((resolve) => {
    reader.onload = () => resolve(String(reader.result).split(",")[1]!);
  });

  reader.readAsDataURL(await canvas.convertToBlob({ type: "image/png" }));

  return done;
};

export const shoot = async (
  page: Page,
  selector: string,
  size: { readonly width: number; readonly height: number },
  pad: number,
): Promise<Uint8Array> => {
  const at = await page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();

    return { x: r.left, y: r.top };
  }, selector);

  const frame = {
    x: at.x - pad,
    y: at.y - pad,
    width: Math.ceil(size.width + 2 * pad),
    height: Math.ceil(size.height + 2 * pad),
  };

  // Chromium can't shoot left of or above the page, where a card at the corner has its padding.
  const x = Math.max(0, frame.x);
  const y = Math.max(0, frame.y);

  const png = await page.screenshot({
    clip: { x, y, width: frame.width - (x - frame.x), height: frame.height - (y - frame.y) },
    omitBackground: true,
    caret: "hide",
  });

  if (x === frame.x && y === frame.y) return new Uint8Array(png);

  const padded = await page.evaluate(pasteAt, [
    png.toString("base64"),
    frame.width,
    frame.height,
    x - frame.x,
    y - frame.y,
  ] as const);

  return Buffer.from(padded, "base64");
};
