import type { PaintServer, Ref } from "./defs";
import type { PropertyValues } from "./properties";
import type { FontValue } from "./font/font";

export type NamedColor =
  | "black"
  | "white"
  | "red"
  | "green"
  | "blue"
  | "yellow"
  | "orange"
  | "purple"
  | "gray"
  | "transparent";

export type Color =
  | `#${string}`
  | `rgb(${string})`
  | `rgba(${string})`
  | `hsl(${string})`
  | `hsla(${string})`
  | `oklch(${string})`
  | `var(--${string})`
  | "currentColor"
  | NamedColor;

export type Paint = Color | "none" | Ref<PaintServer>;

export type Length = number | `${number}%` | `${number}px` | `${number}em`;

declare const attrValue: unique symbol;

interface Attr<V> {
  readonly name: string;
  readonly [attrValue]?: V;
}

const attr = <V>(name: string): Attr<V> => ({ name });

type Units = "userSpaceOnUse" | "objectBoundingBox";

const PRESENTATION = {
  fill: attr<Paint>("fill"),
  fillOpacity: attr<number>("fill-opacity"),
  fillRule: attr<"nonzero" | "evenodd">("fill-rule"),
  stroke: attr<Paint>("stroke"),
  strokeWidth: attr<number>("stroke-width"),
  strokeLinecap: attr<"butt" | "round" | "square">("stroke-linecap"),
  strokeLinejoin: attr<"miter" | "round" | "bevel">("stroke-linejoin"),
  strokeOpacity: attr<number>("stroke-opacity"),
  strokeDasharray: attr<number | string>("stroke-dasharray"),
  strokeDashoffset: attr<number>("stroke-dashoffset"),
  opacity: attr<number>("opacity"),
  color: attr<Color>("color"),
  transform: attr<string>("transform"),
  filter: attr<Ref<"filter">>("filter"),
  clipPath: attr<Ref<"clipPath">>("clip-path"),
  mask: attr<Ref<"mask">>("mask"),
} as const;

const GEOMETRY = { ...PRESENTATION, pathLength: attr<number>("pathLength") } as const;

const FONT = {
  fontFamily: attr<string | FontValue>("font-family"),
  fontSize: attr<Length>("font-size"),
  fontStyle: attr<"normal" | "italic">("font-style"),
  fontWeight: attr<number | "normal" | "bold">("font-weight"),
} as const;

const TEXT = {
  ...PRESENTATION,
  x: attr<Length>("x"),
  y: attr<Length>("y"),
  dx: attr<Length>("dx"),
  dy: attr<Length>("dy"),
  ...FONT,
  letterSpacing: attr<Length>("letter-spacing"),
  textAnchor: attr<"start" | "middle" | "end">("text-anchor"),
  dominantBaseline: attr<"auto" | "middle" | "central" | "hanging">("dominant-baseline"),
  textLength: attr<Length>("textLength"),
  lengthAdjust: attr<"spacing" | "spacingAndGlyphs">("lengthAdjust"),
} as const;

const PRIMITIVE = {
  result: attr<string>("result"),
  in: attr<"SourceGraphic" | "SourceAlpha" | (string & {})>("in"),
} as const;

const GRADIENT = {
  gradientUnits: attr<Units>("gradientUnits"),
  gradientTransform: attr<string>("gradientTransform"),
} as const;

const ELEMENTS = {
  g: {
    ...PRESENTATION,
    ...FONT,
  },
  path: { ...GEOMETRY, d: attr<string>("d") },
  rect: {
    ...GEOMETRY,
    x: attr<Length>("x"),
    y: attr<Length>("y"),
    width: attr<Length>("width"),
    height: attr<Length>("height"),
    rx: attr<Length>("rx"),
    ry: attr<Length>("ry"),
  },
  circle: { ...GEOMETRY, cx: attr<Length>("cx"), cy: attr<Length>("cy"), r: attr<Length>("r") },
  ellipse: {
    ...GEOMETRY,
    cx: attr<Length>("cx"),
    cy: attr<Length>("cy"),
    rx: attr<Length>("rx"),
    ry: attr<Length>("ry"),
  },
  line: {
    ...GEOMETRY,
    x1: attr<Length>("x1"),
    y1: attr<Length>("y1"),
    x2: attr<Length>("x2"),
    y2: attr<Length>("y2"),
  },
  polyline: { ...GEOMETRY, points: attr<string>("points") },
  polygon: { ...GEOMETRY, points: attr<string>("points") },
  text: TEXT,
  tspan: TEXT,
  use: {
    ...PRESENTATION,
    href: attr<Ref<"symbol">>("href"),
    x: attr<Length>("x"),
    y: attr<Length>("y"),
  },
  image: {
    href: attr<string>("href"),
    x: attr<Length>("x"),
    y: attr<Length>("y"),
    width: attr<Length>("width"),
    height: attr<Length>("height"),
    opacity: attr<number>("opacity"),
    preserveAspectRatio: attr<string>("preserveAspectRatio"),
  },
  stop: {
    offset: attr<number | `${number}%`>("offset"),
    stopColor: attr<Color>("stop-color"),
    stopOpacity: attr<number>("stop-opacity"),
  },
  linearGradient: {
    ...GRADIENT,
    x1: attr<number>("x1"),
    y1: attr<number>("y1"),
    x2: attr<number>("x2"),
    y2: attr<number>("y2"),
  },
  radialGradient: {
    ...GRADIENT,
    cx: attr<number>("cx"),
    cy: attr<number>("cy"),
    r: attr<number>("r"),
    fx: attr<number>("fx"),
    fy: attr<number>("fy"),
  },
  pattern: {
    x: attr<Length>("x"),
    y: attr<Length>("y"),
    width: attr<Length>("width"),
    height: attr<Length>("height"),
    patternUnits: attr<Units>("patternUnits"),
    patternTransform: attr<string>("patternTransform"),
  },
  clipPath: { clipPathUnits: attr<Units>("clipPathUnits") },
  mask: {
    maskUnits: attr<Units>("maskUnits"),
    x: attr<Length>("x"),
    y: attr<Length>("y"),
    width: attr<Length>("width"),
    height: attr<Length>("height"),
  },
  marker: {
    viewBox: attr<string>("viewBox"),
    markerWidth: attr<number>("markerWidth"),
    markerHeight: attr<number>("markerHeight"),
    refX: attr<number>("refX"),
    refY: attr<number>("refY"),
    orient: attr<"auto" | number>("orient"),
  },
  symbol: { viewBox: attr<string>("viewBox") },
  filter: {
    filterUnits: attr<Units>("filterUnits"),
    colorInterpolationFilters: attr<"sRGB" | "linearRGB">("color-interpolation-filters"),
    x: attr<Length>("x"),
    y: attr<Length>("y"),
    width: attr<Length>("width"),
    height: attr<Length>("height"),
  },
  feGaussianBlur: { ...PRIMITIVE, stdDeviation: attr<number>("stdDeviation") },
  feTurbulence: {
    ...PRIMITIVE,
    type: attr<"turbulence" | "fractalNoise">("type"),
    baseFrequency: attr<number>("baseFrequency"),
    numOctaves: attr<number>("numOctaves"),
    seed: attr<number>("seed"),
    stitchTiles: attr<"stitch" | "noStitch">("stitchTiles"),
  },
  feDisplacementMap: {
    ...PRIMITIVE,
    in2: attr<string>("in2"),
    scale: attr<number>("scale"),
    xChannelSelector: attr<"R" | "G" | "B" | "A">("xChannelSelector"),
    yChannelSelector: attr<"R" | "G" | "B" | "A">("yChannelSelector"),
  },
  feColorMatrix: {
    ...PRIMITIVE,
    type: attr<"matrix" | "saturate" | "hueRotate" | "luminanceToAlpha">("type"),
    values: attr<string>("values"),
  },
  feOffset: { ...PRIMITIVE, dx: attr<number>("dx"), dy: attr<number>("dy") },
  feFlood: {
    ...PRIMITIVE,
    floodColor: attr<Color>("flood-color"),
    floodOpacity: attr<number>("flood-opacity"),
  },
  feDropShadow: {
    ...PRIMITIVE,
    dx: attr<number>("dx"),
    dy: attr<number>("dy"),
    stdDeviation: attr<number>("stdDeviation"),
    floodColor: attr<Color>("flood-color"),
    floodOpacity: attr<number>("flood-opacity"),
  },
  feBlend: {
    ...PRIMITIVE,
    in2: attr<string>("in2"),
    mode: attr<"normal" | "screen" | "multiply" | "lighten">("mode"),
  },
  feComposite: {
    ...PRIMITIVE,
    in2: attr<string>("in2"),
    operator: attr<"over" | "in" | "out" | "atop" | "xor" | "arithmetic">("operator"),
  },
  feMerge: {},
  feMergeNode: { in: PRIMITIVE.in },
} as const;

export type Tag = keyof typeof ELEMENTS;

// SAFETY: ELEMENTS has a key for every Tag, and no other.
export const TAGS = Object.keys(ELEMENTS) as Tag[];

type ValueOf<A> = A extends Attr<infer V> ? V : never;

type ClassValue = string | readonly (string | false | null | undefined)[];

type StyleValue =
  | string
  | ({ readonly [property: string]: string | number | undefined } & PropertyValues);

interface Common {
  readonly class?: ClassValue;
  readonly style?: StyleValue;
  readonly id?: string;
  readonly role?: string;
  readonly [aria: `aria-${string}`]: string | undefined;
  readonly [data: `data-${string}`]: string | number | undefined;
}

/** Typed attributes for one tag, for helpers like `ui(size, fill)` that return spreadable props. */
export type Attrs<T extends Tag> = {
  readonly [K in keyof (typeof ELEMENTS)[T]]?: ValueOf<(typeof ELEMENTS)[T][K]>;
} & Common;

const PASSTHROUGH = /^(?:aria-|data-)|^(?:class|style|id|role)$/;

interface AttrSpecs {
  readonly [prop: string]: Attr<unknown> | undefined;
}

interface ElementTable {
  readonly [tag: string]: AttrSpecs | undefined;
}

const ATTRIBUTES: ElementTable = ELEMENTS;

export const attributeName = (tag: string, prop: string): string => {
  if (PASSTHROUGH.test(prop)) return prop;
  const spec = ATTRIBUTES[tag]?.[prop];

  if (!spec) throw new Error(`<${tag}> has no attribute "${prop}".`);

  return spec.name;
};
