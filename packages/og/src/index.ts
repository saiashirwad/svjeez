import { scene, type SceneElement } from "svjeez";
import type { Scene } from "svjeez/tools";

/** The size a link preview (`og:image`) is drawn at, which Facebook, X, Slack and Discord share. */
export const OG_SIZE = [1200, 630] as const;

type Options = Parameters<typeof scene>[0];

export interface OgOptions extends Omit<Options, "size" | "duration"> {
  /** A card is one picture, but its motion may play when the SVG is shown as an image. Defaults to 4 seconds. */
  readonly duration?: number;
}

/**
 * A scene for a link preview: `OG_SIZE`, and frame 0 as the held still, so a card that moves a little (a mascot that
 * bobs) is complete before anything plays. Render it with `renderOg` or `ogResponse` from `@svjeez/og/render`.
 */
export const ogScene = (
  { duration = 4, still = 0, ...options }: OgOptions,
  build: (canvas: Parameters<Parameters<typeof scene>[1]>[0]) => SceneElement,
): Scene => scene({ ...options, size: [...OG_SIZE], duration, still }, build);
