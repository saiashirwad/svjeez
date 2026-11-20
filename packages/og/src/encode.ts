import { openScene, type SceneOptions } from "svjeez/frames";

export type Format = "png" | "webp" | "jpeg";

export interface SnapshotOptions extends SceneOptions {
  /** When to take the picture, given the scene's loop length in seconds. */
  readonly at: (duration: number) => number;
  readonly format: Format;
  readonly quality?: number;
}

/**
 * One picture of SVG markup in its own headless Chromium: captured as a PNG, then encoded in the same page, so a render
 * opens one browser and closes it when done.
 */
export const snapshot = async (
  svg: string,
  { at, format, quality = 0.8, ...options }: SnapshotOptions,
  caller = "snapshot()",
): Promise<Uint8Array> => {
  const scene = await openScene(svg, options, caller);

  try {
    const png = await scene.capture(at(scene.duration));

    if (format === "png") return png;

    const base64 = await scene.evaluate(
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
  } finally {
    await scene.close();
  }
};
