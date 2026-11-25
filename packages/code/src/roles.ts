import type { Anim, Paint } from "svjeez";

export const ROLES = [
  "plain",
  "comment",
  "punctuation",
  "keyword",
  "string",
  "number",
  "constant",
  "variable",
  "function",
  "type",
  "attribute",
  "tag",
  "inserted",
  "deleted",
] as const;

export type CodeRole = (typeof ROLES)[number];

export type Palette = { readonly [R in CodeRole]: Anim<Paint> };
