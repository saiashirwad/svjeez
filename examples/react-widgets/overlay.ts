import type { SceneArt } from "@svjeez/react";
import type { CSSProperties } from "react";

/** Puts a box over the scene where the scene draws one, in the scene's own units; it scales with the scene. */
export const over = (
  art: SceneArt,
  x: number,
  y: number,
  width: number,
  height: number,
): CSSProperties => ({
  position: "absolute",
  left: `${(x / art.width) * 100}%`,
  top: `${(y / art.height) * 100}%`,
  width: `${(width / art.width) * 100}%`,
  height: `${(height / art.height) * 100}%`,
});
