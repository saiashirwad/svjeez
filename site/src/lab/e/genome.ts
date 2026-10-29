export const PLANS = ["line", "loop", "spiral", "knot"] as const;
export const ARRANGEMENTS = ["ends", "stack", "orbit"] as const;
export const SIDES = ["belly", "back", "both"] as const;
export const TIPS = ["tuft", "kitten", "fork", "eye"] as const;
export const DIMENSIONS = ["flat", "liquid", "4d"] as const;
export const OIDS = ["cat", "dog", "horse", "loaf", "hat"] as const;
export const FURS = ["ginger", "grey", "cream", "calico", "void", "cosmic"] as const;
export const PATTERNS = ["plain", "tabby", "spots", "socks"] as const;
export const QUIRKS = ["spin", "wrap", "split", "hat", "float", "none"] as const;

export type Plan = (typeof PLANS)[number];
export type Arrangement = (typeof ARRANGEMENTS)[number];
export type Side = (typeof SIDES)[number];
export type Tip = (typeof TIPS)[number];
export type Dimension = (typeof DIMENSIONS)[number];
export type Oid = (typeof OIDS)[number];
export type Fur = (typeof FURS)[number];
export type Pattern = (typeof PATTERNS)[number];
export type Quirk = (typeof QUIRKS)[number];

export interface Genome {
  /** Rerolls every seeded detail: blink times, spot places, which way each head looks. */
  readonly seed: number;
  /** Body length in cats. One cat is a normal cat. */
  readonly length: number;
  readonly girth: number;
  readonly plan: Plan;
  readonly heads: number;
  readonly arrangement: Arrangement;
  readonly ears: number;
  readonly eyes: number;
  readonly bodyEyes: number;
  readonly legs: number;
  readonly legSide: Side;
  readonly legLength: number;
  readonly tails: number;
  readonly tailLength: number;
  /** Where along the body the tails sprout, 0 the rear end and 1 the front. */
  readonly tailAt: number;
  readonly tip: Tip;
  readonly dimension: Dimension;
  /** Where the 3D slice sits in the fourth dimension. */
  readonly slice: number;
  readonly oid: Oid;
  readonly oidness: number;
  readonly fur: Fur;
  readonly pattern: Pattern;
  readonly quirk: Quirk;
  /** How much the line boils, 0 for a steady line. */
  readonly ink: number;
}

type Numeric = { [K in keyof Genome]: Genome[K] extends number ? K : never }[keyof Genome];
type Choice = { [K in keyof Genome]: Genome[K] extends string ? K : never }[keyof Genome];

/** Every number gene's range and step. Clamping and mutation both read it. */
export const RANGES: Record<Exclude<Numeric, "seed">, { min: number; max: number; step: number }> = {
  length: { min: 0.4, max: 12, step: 0.1 },
  girth: { min: 16, max: 72, step: 1 },
  heads: { min: 0, max: 5, step: 1 },
  ears: { min: 0, max: 6, step: 1 },
  eyes: { min: 0, max: 7, step: 1 },
  bodyEyes: { min: 0, max: 9, step: 1 },
  legs: { min: 0, max: 12, step: 1 },
  legLength: { min: 0.3, max: 2.6, step: 0.05 },
  tails: { min: 0, max: 5, step: 1 },
  tailLength: { min: 0.3, max: 3, step: 0.05 },
  tailAt: { min: 0, max: 1, step: 0.01 },
  slice: { min: 0, max: 1, step: 0.01 },
  oidness: { min: 0, max: 1, step: 0.01 },
  ink: { min: 0, max: 3, step: 0.1 },
};

export const CHOICES: { readonly [K in Choice]: readonly Genome[K][] } = {
  plan: PLANS,
  arrangement: ARRANGEMENTS,
  legSide: SIDES,
  tip: TIPS,
  dimension: DIMENSIONS,
  oid: OIDS,
  fur: FURS,
  pattern: PATTERNS,
  quirk: QUIRKS,
};

export const CAT: Genome = {
  seed: 412,
  length: 1,
  girth: 40,
  plan: "line",
  heads: 1,
  arrangement: "ends",
  ears: 2,
  eyes: 2,
  bodyEyes: 0,
  legs: 4,
  legSide: "belly",
  legLength: 1,
  tails: 1,
  tailLength: 1,
  tailAt: 0,
  tip: "tuft",
  dimension: "flat",
  slice: 0.5,
  oid: "cat",
  oidness: 0,
  fur: "ginger",
  pattern: "tabby",
  quirk: "spin",
  ink: 1,
};

/** The first specimen: a long tube with a head at both ends and a tail from the middle. */
export const FIRST: Genome = { ...CAT, length: 3.4, heads: 2, tailAt: 0.5, legs: 6 };

const roundTo = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(4));

export const clampGene = <K extends Exclude<Numeric, "seed">>(key: K, v: number): number => {
  const { min, max, step } = RANGES[key];
  return roundTo(Math.min(max, Math.max(min, v)), step);
};

/**
 * A genome read back from storage. Numbers are clamped, choices must be real, and a gene the saved genome lacks takes
 * the first specimen's. Undefined when anything is the wrong type, so the caller drops it.
 */
export const parseGenome = (raw: unknown): Genome | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined;
  const saved = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(FIRST) as (keyof Genome)[]) {
    const v = saved[key] ?? FIRST[key];
    if (key === "seed") {
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 9999) return undefined;
      out[key] = v;
    } else if (key in RANGES) {
      if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
      out[key] = clampGene(key as Exclude<Numeric, "seed">, v);
    } else {
      if (!(CHOICES[key as Choice] as readonly unknown[]).includes(v)) return undefined;
      out[key] = v;
    }
  }
  return out as unknown as Genome;
};

export const withGene = <K extends keyof Genome>(g: Genome, key: K, value: Genome[K]): Genome => ({
  ...g,
  [key]: key in RANGES ? clampGene(key as Exclude<Numeric, "seed">, value as number) : value,
});

const pick = <T>(xs: readonly T[], r = Math.random()) => xs[Math.floor(r * xs.length)]!;
const NUMERIC = Object.keys(RANGES) as Exclude<Numeric, "seed">[];
const CHOICE = Object.keys(CHOICES) as Choice[];
const GENES = [...NUMERIC, ...CHOICE];

const randomValue = (key: (typeof GENES)[number]): number | string => {
  if (key in RANGES) {
    const { min, max } = RANGES[key as Exclude<Numeric, "seed">];
    // Lengths skew short so a tube is a find, not the norm.
    const r = key === "length" ? Math.random() ** 2.2 : Math.random();
    return clampGene(key as Exclude<Numeric, "seed">, min + r * (max - min));
  }
  return pick(CHOICES[key as Choice]);
};

const reseed = () => Math.floor(Math.random() * 9999);

export const random = (): Genome =>
  GENES.reduce<Genome>((g, key) => ({ ...g, [key]: randomValue(key) }), { ...CAT, seed: reseed() });

export interface Mutation {
  readonly genome: Genome;
  /** The mutation went too far: every gene moved, and toward its extreme. */
  readonly tooFar: boolean;
  readonly changed: readonly (keyof Genome)[];
}

/** Nudges one to three genes. One time in seven it pushes every gene to an end of its range. */
export const mutate = (g: Genome): Mutation => {
  if (Math.random() < 1 / 7) {
    const extreme = GENES.reduce<Genome>((out, key) => {
      if (!(key in RANGES)) return { ...out, [key]: randomValue(key) };
      const { min, max } = RANGES[key as Exclude<Numeric, "seed">];
      const end = Math.random() < 0.75 ? max : min;
      return { ...out, [key]: clampGene(key as Exclude<Numeric, "seed">, end + (Math.random() - 0.5) * (max - min) * 0.2) };
    }, g);
    return { genome: { ...extreme, seed: reseed(), length: Math.min(extreme.length, 9) }, tooFar: true, changed: GENES };
  }
  const count = 1 + Math.floor(Math.random() * 3);
  const changed = Array.from({ length: count }, () => pick(GENES));
  const genome = changed.reduce<Genome>((out, key) => {
    if (!(key in RANGES)) return { ...out, [key]: randomValue(key) };
    const { min, max, step } = RANGES[key as Exclude<Numeric, "seed">];
    const span = Math.max((max - min) * 0.35, step * 1.5);
    const v = (out[key] as number) + (Math.random() - 0.4) * span;
    return { ...out, [key]: clampGene(key as Exclude<Numeric, "seed">, v) };
  }, g);
  return { genome: { ...genome, seed: Math.random() < 0.3 ? reseed() : genome.seed }, tooFar: false, changed };
};

/** Each gene from one parent or the other; numbers sometimes land between them. */
export const breed = (a: Genome, b: Genome): Genome =>
  GENES.reduce<Genome>(
    (out, key) => {
      const from = Math.random() < 0.5 ? a : b;
      if (key in RANGES && Math.random() < 0.4) {
        const mid = ((a[key] as number) + (b[key] as number)) / 2;
        return { ...out, [key]: clampGene(key as Exclude<Numeric, "seed">, mid) };
      }
      return { ...out, [key]: from[key] };
    },
    { ...a, seed: reseed() },
  );

/** How far a genome strays from a cat, one point per oddity. */
export const oddities = (g: Genome): string[] => {
  const out: string[] = [];
  if (g.heads === 0) out.push("acephala");
  else if (g.heads === 2 && g.arrangement === "ends") out.push("amphicephala");
  else if (g.heads >= 2) out.push(g.arrangement === "stack" ? "turrita" : "polycephala");
  if (g.heads > 0 && g.arrangement === "orbit") out.push("satellitica");
  if (g.legs === 0) out.push("apoda");
  else if (g.legs >= 11) out.push("centipeda");
  else if (g.legs >= 7) out.push("multipeda");
  if (g.legs > 0 && g.legSide === "back") out.push("dorsipeda");
  if (g.legs > 0 && g.legSide === "both") out.push("ambipeda");
  if (g.tails === 0) out.push("ecaudata");
  else if (g.tails >= 3) out.push("polycauda");
  if (g.tails > 0 && g.tailAt > 0.08 && g.tailAt < 0.92) out.push("mesocauda");
  if (g.tails > 0 && g.tip === "kitten") out.push("recursiva");
  if (g.tails > 0 && g.tip === "eye") out.push("caudoculata");
  if (g.tails > 0 && g.tip === "fork") out.push("furcata");
  if (g.heads > 0 && g.eyes === 1) out.push("cyclops");
  if (g.heads > 0 && g.eyes === 0) out.push("caeca");
  if (g.heads > 0 && g.eyes >= 4) out.push("argus");
  if (g.bodyEyes > 0) out.push("oculifera");
  if (g.heads > 0 && g.ears >= 4) out.push("auriculosa");
  if (g.heads > 0 && g.ears === 0) out.push("inaurita");
  if (g.dimension === "liquid") out.push("liquida");
  if (g.dimension === "4d") out.push("tesseracta");
  if (g.fur === "void") out.push("umbra");
  if (g.fur === "cosmic") out.push("stellata");
  if (g.legLength > 2) out.push("grallator");
  if (g.girth > 60) out.push("obesa");
  return out;
};

const GENERA: Record<Oid, string> = {
  cat: "Felis",
  dog: "Canifelis",
  horse: "Equifelis",
  loaf: "Panifelis",
  hat: "Pileofelis",
};

const species = (g: Genome) => {
  if (g.plan === "loop") return "annularis";
  if (g.plan === "spiral") return "spiralis";
  if (g.plan === "knot") return "nodosa";
  if (g.length < 0.8) return "brevis";
  if (g.length < 1.6) return "vulgaris";
  if (g.length < 4) return "longa";
  if (g.length < 8) return "tubularis";
  return "interminabilis";
};

/** A deadpan binomial that grows clauses as the genome strays further from a cat. */
export const taxon = (g: Genome): string => {
  const genus = g.oidness > 0.35 ? GENERA[g.oid] : "Felis";
  const odd = oddities(g);
  const base = `${genus} ${species(g)}`;
  if (odd.length === 0) return `${base} domestica`;
  if (odd.length === 1) return `${base} ${odd[0]}`;
  if (odd.length <= 3) return `${base} ${odd[0]} var. ${odd.slice(1).join("-")}`;
  const rest = odd.slice(1, 4).join("-");
  return `${base} ${odd[0]} var. ${rest}${odd.length > 6 ? " (incertae sedis)" : odd.length > 4 ? " sensu lato" : ""}`;
};

/** Specimen number, stable for a genome. */
export const specimenNo = (g: Genome): string => {
  const text = JSON.stringify(g);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return String((h >>> 0) % 10000).padStart(4, "0");
};

export const certificate = (g: Genome): { readonly verdict: string; readonly grade: 0 | 1 | 2 | 3 } => {
  const n = oddities(g).length + (g.length > 2 ? 1 : 0) + (g.plan === "line" ? 0 : 1);
  if (n === 0) return { verdict: "Conforms", grade: 0 };
  if (n <= 2) return { verdict: "Provisional", grade: 1 };
  if (n <= 7) return { verdict: "Non-conforming", grade: 2 };
  return { verdict: "Void where prohibited", grade: 3 };
};
