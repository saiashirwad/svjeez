import {
  SPEC,
  type Arrangement,
  type ChoiceKey,
  type Fur,
  type Genome,
  type NumericKey,
  type Plan,
  type Quirk,
  type Tip,
} from "./genome";
import type { Part } from "./edit";
import { PALETTES } from "./palette";

/** Each part's icon in the bin, drawn in a 32×32 box. The carried copy uses the same path. */
export const PART_ICONS: Record<Part, string> = {
  heads: "M7 20a9 8 0 1 0 18 0a9 8 0 1 0-18 0M8 15l1-9 6 5M24 15l-1-9-6 5",
  ears: "M9 24l7-16 7 16z",
  eyes: "M6 16a10 7 0 1 0 20 0a10 7 0 1 0-20 0M14 16a2 5 0 1 0 4 0a2 5 0 1 0-4 0",
  legs: "M16 4v20M11 26a5 3 0 1 0 10 0a5 3 0 1 0-10 0",
  tails: "M10 28C14 20 6 14 13 8S22 6 22 4",
};

const plan: Record<Plan, string> = {
  line: "M3 12h18",
  loop: "M8 4a8 8 0 1 0 8 0",
  spiral: "M12 12a2 2 0 1 1 2 2a4 4 0 1 1-5-5a6.5 6.5 0 1 1-6 7",
  knot: "M8 19C2 14 8 4 12 6s6 10 4 13-10 0-11-4 9-9 13-5",
};

const arrangement: Record<Arrangement, string> = {
  ends: "M3 12h18M3 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M21 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
  stack:
    "M3 18h12M17 18m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M17 11.5m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M17 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  orbit:
    "M7 12h10M12 12m-10 0a10 7 0 1 0 20 0a10 7 0 1 0-20 0M22 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M2 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
};

const tip: Record<Tip, string> = {
  tuft: "M8 22C12 16 4 10 12 6M12 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  kitten:
    "M6 22C10 16 4 12 10 9M14 7m-4 0a4 3.5 0 1 0 8 0a4 3.5 0 1 0-8 0M10.5 4.5l0.5-3 2 2M17.5 4.5l-.5-3-2 2",
  fork: "M8 22C12 16 6 12 12 9M12 9l-5-6M12 9l6-5",
  eye: "M8 22C12 16 4 11 11 8M13 6m-5 0a5 3.5 0 1 0 10 0a5 3.5 0 1 0-10 0M13 6m-1 0a1 2.5 0 1 0 2 0a1 2.5 0 1 0-2 0",
};

const quirk: Record<Quirk, string> = {
  spin: "M12 4a8 8 0 1 1-7.5 5.2M4 4v5h5",
  wrap: "M2 12h20M18 8l4 4-4 4M2 6v12M22 6v12",
  split: "M10 4v16M14 4v16M6 8l-3 4 3 4M18 8l3 4-3 4",
  hat: "M5 18h14M8 18V6h8v12M4 18a8 2 0 0 0 16 0",
  float: "M12 20V6M8 10l4-4 4 4M7 22h10",
  none: "M6 12h12",
};

const swatch = (fur: Fur) => {
  const { base, dark, light } = PALETTES[fur];

  if (fur === "calico") return `conic-gradient(${base} 0 50%, ${light} 0 75%, ${dark} 0)`;

  if (fur === "cosmic") return `radial-gradient(circle at 30% 30%, ${light} 0 8%, ${base} 9%)`;

  return base;
};

/** How an option button shows its value: the word, an icon path in a 24×24 box, or a fur swatch's background. */
export type Face =
  | { readonly kind: "word" }
  | { readonly kind: "icon"; readonly d: string }
  | { readonly kind: "swatch"; readonly background: string };

export interface Option {
  readonly value: string;
  readonly face: Face;
}

export interface Row {
  readonly gene: ChoiceKey;
  readonly label: string;
  readonly options: readonly Option[];
  /** The number genes scrubbed beside the row's buttons. */
  readonly scrub: readonly NumericKey[];
}

const words = (options: readonly string[]): Option[] =>
  options.map((value) => ({ value, face: { kind: "word" } }));

const icons = <T extends string>(options: readonly T[], paths: Record<T, string>): Option[] =>
  options.map((value) => ({ value, face: { kind: "icon", d: paths[value] } }));

const swatches: Option[] = SPEC.fur.options.map((value) => ({
  value,
  face: { kind: "swatch", background: swatch(value) },
}));

/** One row per choice gene. */
export const ROWS: readonly Row[] = [
  {
    gene: "plan",
    label: "plan",
    options: icons(SPEC.plan.options, plan),
    scrub: ["length", "girth"],
  },
  {
    gene: "arrangement",
    label: "heads",
    options: icons(SPEC.arrangement.options, arrangement),
    scrub: [],
  },
  { gene: "legSide", label: "legs", options: words(SPEC.legSide.options), scrub: ["legLength"] },
  { gene: "tip", label: "tail", options: icons(SPEC.tip.options, tip), scrub: ["tailLength"] },
  {
    gene: "dimension",
    label: "dimension",
    options: words(SPEC.dimension.options),
    scrub: ["slice"],
  },
  { gene: "oid", label: "-oid", options: words(SPEC.oid.options), scrub: ["oidness"] },
  { gene: "fur", label: "fur", options: swatches, scrub: [] },
  { gene: "pattern", label: "pattern", options: words(SPEC.pattern.options), scrub: [] },
  { gene: "quirk", label: "quirk", options: icons(SPEC.quirk.options, quirk), scrub: ["ink"] },
];

const UNITS: Partial<Record<NumericKey, (v: number, g: Genome) => string>> = {
  length: (v) => `${v.toFixed(1)} cats`,
  girth: (v) => `${v} px girth`,
  legLength: (v) => `${v.toFixed(2)}× legs`,
  tailLength: (v) => `${v.toFixed(2)}× tail`,
  slice: (v) => `w ${(v * 2 - 1).toFixed(2)}`,
  oidness: (v, g) => `${Math.round(v * 100)}% ${g.oid}`,
  ink: (v) => (v < 0.05 ? "steady line" : `${v.toFixed(1)} boil`),
};

/** A scrub's readout. */
export const readout = (key: NumericKey, g: Genome) => UNITS[key]?.(g[key], g) ?? String(g[key]);

/** A scrub that means nothing for this genome is off: the w slice outside 4D, oidness on a plain cat. */
export const scrubOff = (key: NumericKey, g: Genome) =>
  (key === "slice" && g.dimension !== "4d") || (key === "oidness" && g.oid === "cat");
