import type { Scene } from "./ir";

const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;

/**
 * Whether `value` is a scene model, as `scene()` returns it. It checks the shape, not a class, so a scene that another
 * copy of svjeez made still counts. Loaders use it to tell `export default scene(...)` from an SVG string.
 */
export const isScene = (value: unknown): value is Scene =>
  isObject(value) &&
  "size" in value &&
  Array.isArray(value.size) &&
  value.size.length === 2 &&
  "duration" in value &&
  typeof value.duration === "number" &&
  "title" in value &&
  typeof value.title === "string" &&
  "loop" in value &&
  typeof value.loop === "boolean" &&
  "tokens" in value &&
  isObject(value.tokens) &&
  "fonts" in value &&
  isObject(value.fonts) &&
  "symbols" in value &&
  isObject(value.symbols) &&
  "root" in value &&
  isObject(value.root) &&
  "kind" in value.root &&
  value.root.kind === "group";
