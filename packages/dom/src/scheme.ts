import type { Json, Snapshot } from "./schema.ts";

/** Keys that say what a node is. If they differ, the two captures are not of the same page. */
const toJson = (snapshot: Snapshot): Json => JSON.parse(JSON.stringify(snapshot));

const IDENTITY = new Set(["type", "tag", "kind", "text"]);

const COLOR = /^rgba?\(/;
const CLEAR = "rgba(0, 0, 0, 0)";

const isColor = (value: Json): value is string => typeof value === "string" && COLOR.test(value);

type Fields = { readonly [key: string]: Json };

const isList = (value: Json): value is readonly Json[] => Array.isArray(value);

const isFields = (value: Json): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const mismatch = (path: string, what: string): never => {
  throw new Error(
    `mergeSchemes: the light and dark captures differ in structure at ${path}: ${what}. Capture both with the same page state, so only colors change.`,
  );
};

const merge = (light: Json, dark: Json, path: string): Json => {
  if (isList(light) || isList(dark)) {
    if (!isList(light) || !isList(dark)) {
      return mismatch(
        path,
        `${isList(light) ? light.length : "no"} entries in light, ${isList(dark) ? dark.length : "no"} in dark`,
      );
    }

    // Children are the page's structure and must match; any other list (shadows, gradient layers) keeps light's.
    if (light.length !== dark.length)
      return path.endsWith(".children")
        ? mismatch(path, `${light.length} entries in light, ${dark.length} in dark`)
        : light;

    return light.map((one, i) => merge(one, dark[i] ?? null, `${path}[${i}]`));
  }

  if (isFields(light) && isFields(dark)) {
    const out: { [key: string]: Json } = {};

    for (const key of new Set([...Object.keys(light), ...Object.keys(dark)])) {
      const a = light[key];
      const b = dark[key];
      const at = `${path}.${key}`;

      // A color that is only set in one scheme (a transparent background in the other) pairs with clear.
      if (a === undefined && b !== undefined && isColor(b)) out[key] = merge(CLEAR, b, at);
      else if (b === undefined && a !== undefined && isColor(a)) out[key] = merge(a, CLEAR, at);
      else if (a === undefined || b === undefined) {
        // Anything else set in one scheme only comes from light, and is dropped when only dark has it.
        if (IDENTITY.has(key) || key === "children")
          mismatch(at, `it is set in ${a === undefined ? "dark" : "light"} only`);
        else if (a !== undefined) out[key] = a;
      } else out[key] = merge(a, b, at);
    }

    // Running animations were captured at different instants in the two schemes, so what they drive differs by phase,
    // not by scheme: the animations and what they return to come from light, and so does the fill they animate.
    const { animations, base } = light;

    if (animations !== undefined && isList(animations) && animations.length > 0) {
      out.animations = animations;

      if (base !== undefined) out.base = base;

      if (base !== undefined && isFields(base) && "backgroundColor" in base) {
        if (light.background !== undefined) out.background = light.background;
        else delete out.background;
      }
    }

    return out;
  }

  if (light === dark) return light;

  if (isColor(light) && isColor(dark)) return { light, dark };

  const key = path.slice(path.lastIndexOf(".") + 1);

  if (IDENTITY.has(key))
    return mismatch(path, `${JSON.stringify(light)} in light, ${JSON.stringify(dark)} in dark`);

  // Anything else (a sub-pixel of layout, an animation's time) keeps its light value.
  return light;
};

/**
 * One Snapshot from the same page captured under light and dark `prefers-color-scheme`:
 * every color that differs becomes `{ light, dark }`, which `compile` draws as a theme token.
 * The trees must match node for node (tags, text, children); everything else comes from `light`.
 */
export const mergeSchemes = (light: Snapshot, dark: Snapshot): Snapshot =>
  JSON.parse(JSON.stringify(merge(toJson(light), toJson(dark), "snapshot")));
