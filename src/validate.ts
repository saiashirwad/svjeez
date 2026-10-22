export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const collect = (source: string, pattern: RegExp, group = 1): string[] => {
  const values: string[] = [];
  for (const match of source.matchAll(pattern)) {
    const value = match[group];
    if (value) values.push(value);
  }
  return values;
};

/**
 * Structural checks for generated SVG. This is intentionally lightweight; the
 * build script additionally runs xmllint when it is available.
 */
export const validateSvg = (source: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!/^\s*(?:<!--[\s\S]*?-->\s*)*<svg\b/.test(source)) {
    errors.push("The document must start with an <svg> root.");
  }
  if (!/\bviewBox="/.test(source)) warnings.push("The root <svg> has no viewBox.");

  const ids = collect(source, /\bid="([^"]*)"/g);
  const idSet = new Set<string>();
  for (const id of ids) {
    if (idSet.has(id)) errors.push(`Duplicate id "${id}".`);
    idSet.add(id);
  }

  for (const reference of collect(source, /url\(#([^)]+)\)/g)) {
    if (!idSet.has(reference)) errors.push(`url(#${reference}) has no matching id.`);
  }
  for (const list of collect(source, /\baria-labelledby="([^"]+)"/g)) {
    for (const reference of list.split(/\s+/)) {
      if (reference && !idSet.has(reference)) {
        errors.push(`aria-labelledby references missing id "${reference}".`);
      }
    }
  }
  for (const reference of collect(source, /\b(?:xlink:)?href="#([^"]+)"/g)) {
    if (!idSet.has(reference)) errors.push(`href="#${reference}" has no matching id.`);
  }

  const keyframes = collect(source, /@keyframes\s+([A-Za-z0-9_-]+)/g);
  const keyframeSet = new Set<string>();
  for (const name of keyframes) {
    if (keyframeSet.has(name)) errors.push(`Duplicate @keyframes "${name}".`);
    keyframeSet.add(name);
  }

  const animated = new Set<string>();
  for (const list of collect(source, /animation-name:\s*([^;}]+)/g)) {
    for (const name of list.split(",")) animated.add(name.trim());
  }
  for (const name of collect(source, /\banimation:\s*([A-Za-z0-9_-]+)/g)) {
    if (!["none", "initial", "inherit", "unset", "revert"].includes(name)) animated.add(name);
  }
  for (const name of animated) {
    if (!keyframeSet.has(name)) errors.push(`Animation "${name}" has no matching @keyframes.`);
  }
  for (const name of keyframeSet) {
    if (!animated.has(name)) warnings.push(`@keyframes "${name}" is never referenced.`);
  }

  return { errors, warnings };
};

export const assertValidSvg = (source: string): void => {
  const result = validateSvg(source);
  if (result.errors.length > 0) {
    throw new Error(result.errors.map((error) => `- ${error}`).join("\n"));
  }
};
