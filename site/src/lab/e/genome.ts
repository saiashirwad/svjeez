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

type GeneKey = Exclude<keyof Genome, "seed">;

export interface NumberSpec {
  readonly kind: "number";
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** A random value is drawn toward `min` by this exponent. */
  readonly skew?: number;
  /** The most a mutation that goes too far may push this gene to. */
  readonly extremeCap?: number;
}

export interface ChoiceSpec<T extends string> {
  readonly kind: "choice";
  readonly options: readonly T[];
}

type SpecOf<K extends GeneKey> = [Genome[K]] extends [number]
  ? NumberSpec
  : [Genome[K]] extends [infer V extends string]
    ? ChoiceSpec<V>
    : never;

/**
 * Every gene but the seed: its range and step, or its options. Clamping, mutation, breeding and the controls all read
 * it. Numbers come first, in the order mutation draws them.
 */
export const SPEC = {
  length: { kind: "number", min: 0.4, max: 12, step: 0.1, skew: 2.2, extremeCap: 9 },
  girth: { kind: "number", min: 16, max: 72, step: 1 },
  heads: { kind: "number", min: 0, max: 5, step: 1 },
  ears: { kind: "number", min: 0, max: 6, step: 1 },
  eyes: { kind: "number", min: 0, max: 7, step: 1 },
  bodyEyes: { kind: "number", min: 0, max: 9, step: 1 },
  legs: { kind: "number", min: 0, max: 12, step: 1 },
  legLength: { kind: "number", min: 0.3, max: 2.6, step: 0.05 },
  tails: { kind: "number", min: 0, max: 5, step: 1 },
  tailLength: { kind: "number", min: 0.3, max: 3, step: 0.05 },
  tailAt: { kind: "number", min: 0, max: 1, step: 0.01 },
  slice: { kind: "number", min: 0, max: 1, step: 0.01 },
  oidness: { kind: "number", min: 0, max: 1, step: 0.01 },
  ink: { kind: "number", min: 0, max: 3, step: 0.1 },
  plan: { kind: "choice", options: PLANS },
  arrangement: { kind: "choice", options: ARRANGEMENTS },
  legSide: { kind: "choice", options: SIDES },
  tip: { kind: "choice", options: TIPS },
  dimension: { kind: "choice", options: DIMENSIONS },
  oid: { kind: "choice", options: OIDS },
  fur: { kind: "choice", options: FURS },
  pattern: { kind: "choice", options: PATTERNS },
  quirk: { kind: "choice", options: QUIRKS },
} as const satisfies { readonly [K in GeneKey]: SpecOf<K> };

export type NumericKey = { [K in GeneKey]: Genome[K] extends number ? K : never }[GeneKey];

export type ChoiceKey = Exclude<GeneKey, NumericKey>;

const KEYS = Object.keys(SPEC).filter((key): key is GeneKey => key in SPEC);

export const isNumeric = (key: keyof Genome): key is NumericKey =>
  key !== "seed" && SPEC[key].kind === "number";

export const numberSpec = (key: NumericKey): NumberSpec => SPEC[key];
export const choiceSpec = (key: ChoiceKey): ChoiceSpec<Genome[ChoiceKey]> => SPEC[key];

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

export const clampGene = (key: NumericKey, v: number): number => {
  const { min, max, step } = numberSpec(key);

  return roundTo(Math.min(max, Math.max(min, v)), step);
};

export const withGene = <K extends keyof Genome>(g: Genome, key: K, value: Genome[K]): Genome => ({
  ...g,
  [key]: isNumeric(key) && typeof value === "number" ? clampGene(key, value) : value,
});

const oneOf = <T extends string>(options: readonly T[], v: unknown): v is T =>
  options.some((o) => o === v);

/**
 * A genome read back from storage. Numbers are clamped, choices must be real, and a gene the saved genome lacks takes
 * the first specimen's. Undefined when anything is the wrong type, so the caller drops it.
 */
export const parseGenome = (raw: unknown): Genome | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined;
  const seed = Reflect.get(raw, "seed") ?? FIRST.seed;

  if (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > 9999)
    return undefined;
  let g: Genome = { ...FIRST, seed };

  for (const key of KEYS) {
    const v: unknown = Reflect.get(raw, key);

    if (v === undefined) continue;

    if (isNumeric(key)) {
      if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
      g = withGene(g, key, v);
    } else {
      const options = choiceSpec(key).options;

      if (!oneOf(options, v)) return undefined;
      g = withGene(g, key, v);
    }
  }

  return g;
};

/** The number gene a control names. Throws on a name the page markup should never hold. */
export const numericKey = (name: string | undefined): NumericKey => {
  const key = KEYS.find((k): k is NumericKey => k === name && isNumeric(k));

  if (!key) throw new Error(`No number gene named ${name}`);

  return key;
};

/** Sets the choice gene a control names to one of its options. */
export const withChoice = (
  g: Genome,
  name: string | undefined,
  value: string | undefined,
): Genome => {
  for (const key of KEYS) {
    if (key !== name || isNumeric(key)) continue;
    const options = choiceSpec(key).options;

    if (oneOf(options, value)) return withGene(g, key, value);
  }

  throw new Error(`No option ${value} for gene ${name}`);
};

const pick = <T>(xs: readonly T[], r = Math.random()) => xs[Math.floor(r * xs.length)]!;

const randomValue = (key: GeneKey): number | string => {
  if (!isNumeric(key)) return pick(choiceSpec(key).options);
  const { min, max, skew } = numberSpec(key);
  const r = skew ? Math.random() ** skew : Math.random();

  return clampGene(key, min + r * (max - min));
};

const reseed = () => Math.floor(Math.random() * 9999);

export const random = (): Genome =>
  KEYS.reduce<Genome>((g, key) => ({ ...g, [key]: randomValue(key) }), { ...CAT, seed: reseed() });

export interface Mutation {
  readonly genome: Genome;
  /** The mutation went too far: every gene moved, and toward its extreme. */
  readonly tooFar: boolean;
  readonly changed: readonly (keyof Genome)[];
}

/** Nudges one to three genes. One time in seven it pushes every gene to an end of its range. */
export const mutate = (g: Genome): Mutation => {
  if (Math.random() < 1 / 7) {
    const extreme = KEYS.reduce<Genome>((out, key) => {
      if (!isNumeric(key)) return { ...out, [key]: randomValue(key) };
      const { min, max, extremeCap = Infinity } = numberSpec(key);
      const end = Math.random() < 0.75 ? max : min;

      return {
        ...out,
        [key]: Math.min(
          clampGene(key, end + (Math.random() - 0.5) * (max - min) * 0.2),
          extremeCap,
        ),
      };
    }, g);

    return { genome: { ...extreme, seed: reseed() }, tooFar: true, changed: KEYS };
  }

  const count = 1 + Math.floor(Math.random() * 3);
  const changed = Array.from({ length: count }, () => pick(KEYS));

  const genome = changed.reduce<Genome>((out, key) => {
    if (!isNumeric(key)) return { ...out, [key]: randomValue(key) };
    const { min, max, step } = numberSpec(key);
    const span = Math.max((max - min) * 0.35, step * 1.5);

    return { ...out, [key]: clampGene(key, out[key] + (Math.random() - 0.4) * span) };
  }, g);

  return {
    genome: { ...genome, seed: Math.random() < 0.3 ? reseed() : genome.seed },
    tooFar: false,
    changed,
  };
};

/** Each gene from one parent or the other; numbers sometimes land between them. */
export const breed = (a: Genome, b: Genome): Genome =>
  KEYS.reduce<Genome>(
    (out, key) => {
      const from = Math.random() < 0.5 ? a : b;

      if (isNumeric(key) && Math.random() < 0.4)
        return { ...out, [key]: clampGene(key, (a[key] + b[key]) / 2) };

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

export const certificate = (
  g: Genome,
): { readonly verdict: string; readonly grade: 0 | 1 | 2 | 3 } => {
  const n = oddities(g).length + (g.length > 2 ? 1 : 0) + (g.plan === "line" ? 0 : 1);

  if (n === 0) return { verdict: "Conforms", grade: 0 };

  if (n <= 2) return { verdict: "Provisional", grade: 1 };

  if (n <= 7) return { verdict: "Non-conforming", grade: 2 };

  return { verdict: "Void where prohibited", grade: 3 };
};
