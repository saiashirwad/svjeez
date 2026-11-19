import type { Font, Hex } from "svjeez/tools";
import type { Color } from "../schema.ts";

/** One place where the scene is not faithful to the page. */
export interface Diagnostic {
  /** The keys from the root to the node, joined by `/`. */
  readonly path: string;
  readonly what: string;
}

export interface Context {
  readonly diagnostics: Diagnostic[];
  readonly fonts: Map<string, Font>;
  note(path: string, what: string): void;
}

export const context = (): Context => {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();

  return {
    diagnostics,
    fonts: new Map(),
    note: (path, what) => {
      const id = `${path}\0${what}`;

      if (seen.has(id)) return;

      seen.add(id);
      diagnostics.push({ path, what });
    },
  };
};

/** The key a node gets next to its siblings: its own name, or the first free one built from it. */
export const keyer = () => {
  const taken = new Set<string>();

  return (name: string): string => {
    let key = name;

    for (let n = 2; taken.has(key); n++) key = `${name}~${n}`;

    taken.add(key);

    return key;
  };
};

export interface Painted {
  readonly hex: Hex;
  /** `hex` carries no alpha; this is it, 0 to 1. */
  readonly alpha: number;
  /** `hex` with the alpha written into it, for a fill or a stop. */
  readonly rgba: Hex;
}

export const byte = (n: number): string =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");

/** A captured `rgb()` / `rgba()` as hex, or undefined when it is not one or draws nothing. */
export const painted = (color: Color | undefined): Painted | undefined => {
  const parts = /^rgba?\((.+)\)$/
    .exec(color?.trim() ?? "")?.[1]
    ?.split(/[\s,/]+/)
    .map(Number);

  const [r, g, b, a = 1] = parts ?? [];

  if (
    r === undefined ||
    g === undefined ||
    b === undefined ||
    [r, g, b, a].some(Number.isNaN) ||
    a <= 0
  )
    return undefined;

  const hex: Hex = `#${byte(r)}${byte(g)}${byte(b)}`;

  return { hex, alpha: a, rgba: a >= 1 ? hex : `${hex}${byte(a * 255)}` };
};

/** The color at `opacity` times its alpha. */
export const fade = ({ hex, alpha }: Painted, opacity: number): Hex => {
  const a = alpha * opacity;

  return a >= 1 ? hex : `${hex}${byte(a * 255)}`;
};
