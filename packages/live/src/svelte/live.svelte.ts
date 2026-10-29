import type { Point } from "svjeez";
import type { Handles, NumberParam, Schema, Values } from "svjeez/params";
import { createCompiler, latestWins } from "../client";
import { open, type Doc } from "../doc";

/** A picture of the scene compiled at build time, as a `?svjeez` import gives it. */
export interface First {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly title: string;
}

/** What `live` reads from the scene's module: its params, and where each number's handle sits in the picture. */
export interface SceneModule<S extends Schema> {
  readonly params: S;
  readonly handles: Handles<S>;
}

/** A handle on the picture for one number param. */
export interface Grip {
  readonly key: string;
  readonly param: NumberParam;
  readonly value: number;
  /** Where the handle sits now, in scene units, when the scene puts it anywhere. */
  readonly at: Point | undefined;
  /** Where the handle would sit with the value at `v` and every other value as it is. */
  readonly along: (v: number) => Point | undefined;
  /** Writes `v`, fitted to the param, into the source. */
  readonly set: (v: number) => void;
}

/** A scene file being edited: its source and values, the picture of them, and a grip per number param. */
export class Live<S extends Schema> {
  readonly first: First;
  readonly grips: readonly Grip[];
  /** The param whose handle has focus, so the source can mark its literal. */
  active = $state<string | null>(null);

  #doc: Doc<S>;
  /** Where every handle sits for the current values, so a render reads `handles()` once, not once per grip. */
  #points: { readonly [key: string]: Point | undefined };
  #src: string;
  #error = $state<string | null>(null);
  #compile: ReturnType<typeof createCompiler> | undefined;

  constructor(text: string, { params, handles }: SceneModule<S>, first: First) {
    this.first = first;
    this.#doc = $state.raw(open(text, params));
    this.#points = $derived(handles(this.values));
    this.#src = $state(first.src);

    type Key = keyof S & string;

    const placed = (key: Key): Point | undefined => this.#points[key];

    const pointAt = (key: Key, v: number): Point | undefined => {
      const points: { readonly [key: string]: Point | undefined } = handles({
        ...this.values,
        [key]: v,
      });

      return points[key];
    };

    this.grips = Object.entries(params).flatMap(([name, param]): Grip[] => {
      if (param.kind !== "number") return [];
      // SAFETY: Object.entries of the params object lists exactly its keys.
      const key = name as Key;
      const value = () => Number(this.values[key]);

      return [
        {
          key,
          param,
          get value() {
            return value();
          },
          get at() {
            return placed(key);
          },
          along: (v) => pointAt(key, v),
          // SAFETY: `key` names a number param, so a number is its value.
          set: (v) => this.set(key, v as Values<S>[Key]),
        },
      ];
    });
  }

  get values(): Values<S> {
    return this.#doc.values;
  }

  /** The file with every value written in, as the source panel shows it and the worker compiles it. */
  get source(): string {
    return this.#doc.source;
  }

  /** The picture on screen: the build-time file, then each edit once it has compiled and decoded. */
  get src(): string {
    return this.#src;
  }

  /** Why the newest edit did not compile, until one does. */
  get error(): string | null {
    return this.#error;
  }

  /** Writes `value` into the source, fitted if it is a number, and compiles the file unless nothing changed. */
  set = <K extends keyof S & string>(key: K, value: Values<S>[K]) => {
    const next = this.#doc.set(key, value);

    if (next === this.#doc) return;
    this.#doc = next;
    this.#recompile(next.source);
  };

  /** The newest source compiled in the worker, then shown once its picture has decoded. */
  #recompile = latestWins(async (source: string) => {
    const result = await (this.#compile ??= createCompiler())(source);
    this.#error = result.ok ? null : result.error.message;

    if (!result.ok) return;
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([result.svg], { type: "image/svg+xml" }));
    await img.decode();

    if (this.#src !== this.first.src) URL.revokeObjectURL(this.#src);
    this.#src = img.src;
  });
}

/**
 * `text`, the scene file as written, edited through the params and handles its `module` exports. The page shows
 * `first` until the first edit compiles.
 */
export const live = <S extends Schema>(
  text: string,
  module: SceneModule<S>,
  { first }: { first: First },
): Live<S> => new Live(text, module, first);
