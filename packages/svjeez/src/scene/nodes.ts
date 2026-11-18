import type { FontValue } from "../font/font";
import type { Seconds } from "../motion";
import type { Vec } from "./ir";
import type { Anchor, Ref } from "./refs";
import type { Settle } from "./settle";
import type { Anim, Stack } from "./track";
import { rect, type Geometry, type Paint } from "./values";

export { Ref, ref } from "./refs";

export interface Common {
  /** The node's stable name among its siblings. Defaults to its ref's key, then to its place in the tree. */
  readonly key?: string;
  readonly ref?: Ref;
  /**
   * Where the node's own origin goes in its parent: a point, a track, or an anchor on another node, which it follows
   * when that node moves. Inside a layout container there is none: the container places the node.
   */
  readonly at?: Anim<Vec> | Anchor;
  /** What `rotate` and `scale` turn around, in the node's own frame: the center of its box unless you say. */
  readonly origin?: "center" | "top-left" | Vec;
  /** Degrees, clockwise. */
  readonly rotate?: Anim<number>;
  readonly scale?: Anim<number> | Anim<Vec>;
  readonly opacity?: Anim<number>;
  /** Layers of motion around the node, the first outermost. */
  readonly motion?: Stack;
}

export interface StrokeProps {
  readonly color: Anim<Paint>;
  /** Default 1. */
  readonly width?: number;
  readonly cap?: "butt" | "round" | "square";
  readonly join?: "miter" | "round" | "bevel";
  readonly dash?: readonly number[];
  readonly nonScaling?: boolean;
}

export interface ShapeProps extends Common {
  readonly geometry: Anim<Geometry>;
  /** Nothing is inherited: a shape with no fill has none. */
  readonly fill?: Anim<Paint>;
  readonly stroke?: StrokeProps;
  /** The part of the outline that is drawn, as two fractions of its length. */
  readonly trim?: Anim<Vec>;
}

export interface TextProps extends Common {
  readonly font: FontValue;
  readonly size: number;
  readonly fill: Anim<Paint>;
  /**
   * How lines sit in their column, and so which point of the first baseline `at` names: its start, middle or end.
   * Default `start`.
   */
  readonly align?: "start" | "center" | "end";
  /** Wrap to this many px: the column is this wide. Without it lines break only at line breaks. */
  readonly width?: number;
  /** Baseline to baseline, in multiples of `size`. Default: the font's own line height. */
  readonly lineHeight?: number;
  /** Line breaks in it start new lines. */
  readonly children: string;
}

export interface SequenceProps {
  readonly at: Seconds;
  readonly over?: Seconds;
  readonly children?: Child;
}

/** What a component returns and JSX builds. `scene()` lowers a tree of these into the scene model. */
export type SceneElement =
  | {
      readonly type: "group";
      readonly props: Common;
      readonly children: readonly SceneElement[];
      /** What a layout container or a connector asks of the second pass of lowering. */
      readonly settle?: Settle;
    }
  | { readonly type: "shape"; readonly props: ShapeProps }
  | { readonly type: "text"; readonly props: TextProps }
  | {
      readonly type: "sequence";
      readonly at: Seconds;
      readonly over?: Seconds;
      readonly children: readonly SceneElement[];
    }
  | { readonly type: "fragment"; readonly children: readonly SceneElement[] };

export type Child = SceneElement | false | null | undefined | readonly Child[];

const isList = (child: Child): child is readonly Child[] => Array.isArray(child);

export const flat = (child: Child): SceneElement[] => {
  if (!child) return [];

  return isList(child) ? child.flatMap(flat) : [child];
};

export const Group = ({
  children,
  ...props
}: Common & { readonly children?: Child }): SceneElement => ({
  type: "group",
  props,
  children: flat(children),
});

export const Shape = (props: ShapeProps): SceneElement => ({ type: "shape", props });

export const Text = (props: TextProps): SceneElement => ({ type: "text", props });

/**
 * A clock of its own: every track inside counts from `at`, so a component is written from 0 and placed anywhere, and
 * sequences inside sequences add up. With `over` the tracks inside must end by then. It draws nothing.
 */
export const Sequence = ({ at, over, children }: SequenceProps): SceneElement =>
  over === undefined
    ? { type: "sequence", at, children: flat(children) }
    : { type: "sequence", at, over, children: flat(children) };

let building: Vec | undefined;

const size = (): Vec => {
  if (!building) throw new Error("canvas is only known inside scene()'s callback.");

  return building;
};

/** The scene being built. Read it inside `scene()`'s callback. */
export const canvas = {
  get size(): Vec {
    return size();
  },
  get center(): Vec {
    const [width, height] = size();

    return [width / 2, height / 2];
  },
  /** A rect that covers the scene. */
  get rect(): Geometry {
    const [width, height] = size();

    return rect(width, height);
  },
};

export const within = <T>(canvasSize: Vec, build: () => T): T => {
  const outer = building;

  building = canvasSize;

  try {
    return build();
  } finally {
    building = outer;
  }
};
