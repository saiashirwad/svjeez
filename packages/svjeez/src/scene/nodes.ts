import type { FontValue } from "../font/font";
import type { Seconds } from "../motion";
import type { PictureData } from "../picture";
import type { Vec } from "./ir";
import type { Anchor, Ref } from "./refs";
import type { Settle } from "./settle";
import type { Timeline } from "./timeline";
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
  readonly width?: Anim<number>;
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
  /** The part of the stroke that is drawn, as two fractions of the outline's length, from and to. A fill is never trimmed. */
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

export interface ImageProps extends Common {
  /** The picture, from `picture()`. */
  readonly src: PictureData;
  /**
   * The frame the picture fills, from its top-left corner, stretched to it. With only one of width and height the other
   * follows the picture's aspect ratio; with neither it is the picture's own size.
   */
  readonly width?: number;
  readonly height?: number;
}

/**
 * Content drawn once and placed many times with `<Instance of={…} />`. Build it with `symbol()`: its content is
 * lowered once, the first time an instance needs it, and every instance shows that one drawing.
 */
export interface SceneSymbol {
  readonly kind: "symbol";
  readonly name: string;
  readonly build: () => Child;
}

/**
 * A symbol named `name`, unique in the scene. Its tracks run on the scene's clock and are shared by every instance, so
 * every instance moves in step; move the instances themselves (`at`, `opacity`, `motion`) to set them apart. An
 * instance of a symbol that moves can't sit inside a `<Sequence>` that starts later, since its clock would not apply.
 */
export const symbol = (name: string, build: () => Child): SceneSymbol => {
  if (!/^[A-Za-z_][\w-]*$/.test(name))
    throw new Error(`symbol() needs a name made of letters, digits, _ and -, got "${name}".`);

  return { kind: "symbol", name, build };
};

export interface InstanceProps extends Common {
  readonly of: SceneSymbol;
}

export interface SequenceProps {
  readonly at: Seconds;
  readonly over?: Seconds;
  /** A timeline that runs on this sequence's clock, so the nodes inside it are choreographed from its start. */
  readonly timeline?: Timeline;
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
  | { readonly type: "image"; readonly props: ImageProps }
  | { readonly type: "instance"; readonly props: InstanceProps }
  | {
      readonly type: "sequence";
      readonly at: Seconds;
      readonly over?: Seconds;
      readonly timeline?: Timeline;
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

/** A picture in a frame of its own size, from its top-left corner. */
export const Image = (props: ImageProps): SceneElement => ({ type: "image", props });

/** One placement of a symbol. Its box is the symbol's, so it turns around the symbol's center. */
export const Instance = (props: InstanceProps): SceneElement => ({ type: "instance", props });

/**
 * A clock of its own: every track inside counts from `at`, so a component is written from 0 and placed anywhere, and
 * sequences inside sequences add up. With `over` the tracks inside must end by then. It draws nothing.
 */
export const Sequence = ({ at, over, timeline, children }: SequenceProps): SceneElement => ({
  type: "sequence",
  at,
  ...(over !== undefined && { over }),
  ...(timeline && { timeline }),
  children: flat(children),
});

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
