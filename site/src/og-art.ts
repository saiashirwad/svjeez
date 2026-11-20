import { renderFrames } from "svjeez/frames";
import { windowed, type WindowOptions } from "./window";
import type { SceneSource } from "@svjeez/astro/scene";

const stills = new Map<string, Promise<Uint8Array>>();

/** A window of the scene at the moment its posters show (72% in), as a PNG a card can draw. */
export const still = (
  key: string,
  scene: SceneSource,
  options: WindowOptions,
): Promise<Uint8Array> => {
  let png = stills.get(key);

  if (!png) {
    const svg = windowed(scene, options);

    png = renderFrames(svg, { times: [0], colorScheme: "light" })
      .then(({ duration }) =>
        renderFrames(svg, {
          times: [duration * 0.72],
          colorScheme: "light",
          scale: 2,
          background: "transparent",
        }),
      )
      .then(({ frames }) => frames[0]!.png);
    stills.set(key, png);
  }

  return png;
};
