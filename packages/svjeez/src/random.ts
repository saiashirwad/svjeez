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

const isText = (seed: number | string): seed is string => typeof seed === "string";

/**
 * A seeded stream of numbers from 0 up to 1, the same for the same seed on every run and runtime. A whole number
 * seeds it directly and a string is hashed first, so `random("leg-3")` names its own stream. `wiggle` takes its
 * noise from `random(String(seed))`.
 */
export const random = (seed: number | string): (() => number) => {
  if (isText(seed)) return mulberry32(fnv1a(seed));

  if (!Number.isInteger(seed))
    throw new Error(`random() needs a whole number or a string seed, got ${seed}.`);

  return mulberry32(seed);
};
