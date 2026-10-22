const round = (n: number, places = 3): number => {
  const factor = 10 ** places;
  const value = Math.round((n + Number.EPSILON) * factor) / factor;
  return Object.is(value, -0) ? 0 : value;
};

/** Compact, deterministic number formatting for SVG and CSS output. */
export const num = (value: number, places = 3): string => {
  if (!Number.isFinite(value)) throw new Error(`Expected a finite number, received ${value}`);
  return String(round(value, places));
};

/** CSS lengths are unitless when passed as strings, pixels when passed as numbers. */
export const length = (value: string | number): string =>
  typeof value === "number" ? `${num(value)}px` : value;

export const pct = (value: number): string => `${num(value, 3)}%`;

const escape = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export const escapeText = (value: string): string => escape(value);

export const escapeAttr = (value: string): string =>
  escape(value).replaceAll('"', "&quot;");

/** CSS property names use kebab-case; preserve custom properties and vendor prefixes. */
export const kebab = (property: string): string => {
  if (property.startsWith("--") || property.includes("-")) return property;
  return property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
};

/** Readable CSS from a frame's declarations. */
export const declarations = (entries: Array<[string, string]>): string =>
  entries.map(([property, value]) => `${property}:${value}`).join(";");
