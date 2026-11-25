import { SceneError } from "../model/scene-error";
import { isString } from "../model/guards";

const fnv1a = (text: string): number => {
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);

  return hash >>> 0;
};

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * A seeded random: a function that returns the next number in [0, 1) each call.
 * The same seed (a whole number or a string) gives the same numbers on every build,
 * so scenes using it still emit byte-identical SVGs. Make one per thing you scatter,
 * e.g. `random(\`firefly-\${i}\`)`, and draw from it in a fixed order. Never use Math.random().
 */
export const random = (seed: number | string): (() => number) => {
  if (isString(seed)) return mulberry32(fnv1a(seed));

  if (!Number.isInteger(seed))
    throw new SceneError(`random() needs a whole number or a string seed, got ${seed}.`);

  return mulberry32(seed);
};
