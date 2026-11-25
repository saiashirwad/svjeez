import type { Source } from "../model/ir";
import { isElement, isWords, type TextContent } from "./count";
import { SceneError, located, type Where } from "../model/scene-error";
import { thrownFrom } from "../svg/traced";
import { sourceFrom } from "./identity";

export interface Named {
  readonly name: string;
  readonly short: string;
  readonly source?: Source;
}

/** What a scene calls its nodes, so an error can name the node and where it was written. One per scene. */
export class Names {
  readonly #open = new Map<string, Named>();

  set(key: string, named: Named): void {
    this.#open.set(key, named);
  }

  entryOf(key: string): Named | undefined {
    return this.#open.get(key);
  }

  named(key: string): string {
    return this.#open.get(key)?.name ?? `"${key}"`;
  }

  whereOf(key: string): Where {
    const known = this.#open.get(key);

    return {
      key,
      node: known?.name ?? `"${key}"`,
      ...(known?.source && { source: known.source }),
    };
  }

  namedAt(key: string): string {
    const known = this.#open.get(key);

    return known?.source ? `${known.name} (line ${known.source.line})` : this.named(key);
  }

  /** Runs build; an error that leaves it gets the location of the node it is about. */
  naming<T>(build: () => T): T {
    try {
      return build();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      const thrown = thrownFrom(error);

      throw this.#resolved(located(error, thrown ? { source: sourceFrom(thrown) } : {}));
    }
  }

  #resolved(error: Error): Error {
    if (!(error instanceof SceneError) || error.key === undefined) return error;

    return this.#open.has(error.key) ? error.at(this.whereOf(error.key)) : error;
  }
}

const SHORT = 24;

export const quoted = (words: string): string => {
  const flat = words.replace(/\s+/g, " ").trim();

  return JSON.stringify(flat.length > SHORT ? `${flat.slice(0, SHORT - 1)}…` : flat);
};

export const wordsOf = (children: TextContent): string => {
  if (isWords(children)) return String(children);

  if (Array.isArray(children)) return children.map(wordsOf).join("");

  if (isElement(children) && children.type === "run") return wordsOf(children.props.children);

  return "";
};

/**
 * Checks a name that page code finds a part of the scene by (a clock, a slot): letters, digits, - and _, starting with a
 * letter, so it is safe in a selector and a data attribute. `what` names the caller in the error; `example` shows one.
 */
export const checkName = (name: string, what: string, example: string): void => {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name))
    throw new SceneError(
      `${what} needs a name of letters, digits, - and _ that starts with a letter, got ${JSON.stringify(name)}.`,
      `Name it as in ${example}.`,
    );
};
