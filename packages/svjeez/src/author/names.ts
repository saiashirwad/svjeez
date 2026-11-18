import type { Source } from "../model/ir";
import type { SceneElement, TextChild } from "./nodes";
import { SceneError, located, type Where } from "../model/scene-error";
import { thrownFrom } from "../svg/traced";
import { sourceFrom } from "./identity";

export interface Named {
  readonly name: string;
  readonly short: string;
  readonly source?: Source;
}

let open: Map<string, Named> | undefined;

export const naming = <T>(build: () => T): T => {
  const outer = open;

  open = new Map();

  try {
    return build();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const thrown = thrownFrom(error);

    throw resolved(located(error, thrown ? { source: sourceFrom(thrown) } : {}));
  } finally {
    open = outer;
  }
};

const resolved = (error: Error): Error => {
  if (!(error instanceof SceneError) || error.key === undefined) return error;
  const known = open?.get(error.key);

  return known ? error.at(whereOf(error.key)) : error;
};

export const nameNode = (key: string, named: Named): void => {
  open?.set(key, named);
};

export const named = (key: string): string => open?.get(key)?.name ?? `"${key}"`;

export const whereOf = (key: string): Where => {
  const known = open?.get(key);

  return {
    key,
    node: known?.name ?? `"${key}"`,
    ...(known?.source && { source: known.source }),
  };
};

export const namedAt = (key: string): string => {
  const known = open?.get(key);

  return known?.source ? `${known.name} (line ${known.source.line})` : named(key);
};

export const entryOf = (key: string): Named | undefined => open?.get(key);

const SHORT = 24;

export const quoted = (words: string): string => {
  const flat = words.replace(/\s+/g, " ").trim();

  return JSON.stringify(flat.length > SHORT ? `${flat.slice(0, SHORT - 1)}…` : flat);
};

const isElement = (child: TextChild): child is SceneElement =>
  typeof child === "object" && child !== null && !Array.isArray(child);

const isWords = (child: TextChild): child is string | number =>
  typeof child === "string" || typeof child === "number";

export const wordsOf = (children: TextChild): string => {
  if (isWords(children)) return String(children);

  if (Array.isArray(children)) return children.map(wordsOf).join("");

  if (isElement(children) && children.type === "run") return wordsOf(children.props.children);

  return "";
};
