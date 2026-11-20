import type { Font, Hex, Theme, Token } from "svjeez/tools";
import { isThemed, type Color, type WebFont } from "../schema.ts";
import { fromTheme } from "./theme.ts";
import type { Typing } from "./typing.ts";
import type { Motion } from "./waapi.ts";

/** One place where the scene is not faithful to the page. */
export interface Diagnostic {
  /** The keys from the root to the node, joined by `/`. */
  readonly path: string;
  readonly what: string;
}

export interface Context {
  readonly diagnostics: Diagnostic[];
  readonly fonts: Map<string, Font>;
  /** The page's web fonts, with their files embedded. */
  readonly faces: readonly WebFont[];
  /** The paths of elements that clip in some state: in every state they get a clip, a no-op one where the page has none, so a clip is never added or removed mid-morph. */
  readonly clips: ReadonlySet<string>;
  /** What the animations on each element drive, by the element's path. */
  readonly motions: Map<string, Motion>;
  /** The text nodes typed from state to state, by their path. */
  readonly typings: Map<string, Typing>;
  note(path: string, what: string): void;
}

export const context = (
  faces: readonly WebFont[] = [],
  clips: ReadonlySet<string> = new Set(),
): Context => {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();

  return {
    diagnostics,
    fonts: new Map(),
    faces,
    clips,
    motions: new Map(),
    typings: new Map(),
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

/** A solid color: one hex, or a theme token that is one hex in each scheme. */
export type Solid = Hex | Token;

interface Plain {
  readonly hex: Hex;
  /** `hex` carries no alpha; this is it, 0 to 1. */
  readonly alpha: number;
}

export interface Painted {
  /** The color without its alpha, for use with `alpha`. A themed color carries its alpha in each scheme, so this is `rgba` and `alpha` is 1. */
  readonly hex: Solid;
  readonly alpha: number;
  /** The color with its alpha written into it, for a fill or a stop. */
  readonly rgba: Solid;
  /** The two schemes of a themed color. */
  readonly pair?: readonly [Plain, Plain];
}

export const byte = (n: number): string =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");

const withAlpha = ({ hex, alpha }: Plain): Hex => (alpha >= 1 ? hex : `${hex}${byte(alpha * 255)}`);

// The theme the compile in progress paints with (`compile(states, { theme })`). Compiling is synchronous, so it is set
// and cleared around one compile.
let theme: Theme | undefined;

/** Runs `run` with `colors` as the theme the scheme pairs are read back into. */
export const withTheme = <T>(colors: Theme | undefined, run: () => T): T => {
  const before = theme;
  theme = colors;

  try {
    return run();
  } finally {
    theme = before;
  }
};

/**
 * The token for a color that is `light` in one scheme and `dark` in the other: the theme's, when it makes the pair,
 * else one of the pair's own. Equal pairs share a name.
 */
const tokenOf = (light: Hex, dark: Hex): Token =>
  (theme && fromTheme(light, dark, theme)) ?? {
    kind: "token",
    name: `c-${light.slice(1)}-${dark.slice(1)}`,
    light,
    dark,
  };

const isHex = (color: Solid): color is Hex => typeof color === "string";

/** A key that is equal for equal colors, themed or not. */
export const colorKey = (color: Solid): string => (isHex(color) ? color : color.name);

const plain = (color: string | undefined): Plain | undefined => {
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

  return { hex: `#${byte(r)}${byte(g)}${byte(b)}`, alpha: a };
};

const CLEAR: Plain = { hex: "#000000", alpha: 0 };

/** A captured `rgb()` / `rgba()` (or a light/dark pair of them) as hex or a theme token, or undefined when it draws nothing. */
export const painted = (color: Color | undefined): Painted | undefined => {
  if (isThemed(color)) {
    const light = plain(color.light);
    const dark = plain(color.dark);

    if (!light && !dark) return undefined;

    const pair = [light ?? CLEAR, dark ?? CLEAR] as const;
    const token = tokenOf(withAlpha(pair[0]), withAlpha(pair[1]));

    return { hex: token, alpha: 1, rgba: token, pair };
  }

  const one = plain(color);

  return one && { ...one, rgba: withAlpha(one) };
};

/** The color at `opacity` times its alpha. */
export const fade = (color: Painted, opacity: number): Solid => {
  const scaled = ({ hex, alpha }: Plain): Plain => ({ hex, alpha: alpha * opacity });

  if (color.pair)
    return tokenOf(withAlpha(scaled(color.pair[0])), withAlpha(scaled(color.pair[1])));

  return isHex(color.hex) ? withAlpha(scaled({ hex: color.hex, alpha: color.alpha })) : color.hex;
};
