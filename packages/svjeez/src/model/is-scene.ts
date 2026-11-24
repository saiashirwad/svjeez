import type { Scene } from "./ir";
import { isObject } from "./guards";

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
  "root" in value &&
  isObject(value.root) &&
  "kind" in value.root &&
  value.root.kind === "group";
