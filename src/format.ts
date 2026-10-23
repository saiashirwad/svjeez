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

/** Six significant digits, so a tiny literal never rounds to 0. */
export const significant = (value: number): string => {
  if (!Number.isFinite(value)) throw new Error(`Expected a finite number, received ${value}`);
  return String(Number(value.toPrecision(6)));
};
