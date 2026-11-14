import type { Feel } from "./scene";

/** The scene's landing spring, which the scene and the instruments both draw. */
export const spring = (s: number, f: Feel) => {
  const w = 2 * Math.PI * f.hz;

  return f.squash * Math.exp(-f.damping * w * s) * Math.cos(w * Math.sqrt(1 - f.damping ** 2) * s);
};
