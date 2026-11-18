import type { FontValue } from "../font/font";
import type { Seconds } from "../motion";
import type { Span as TimeSpan } from "../span";
import type { PictureData } from "../picture";
import type { Vec } from "./ir";
import type { Anchor, Ref } from "./refs";
import type { Settle } from "./settle";
import type { MorphElement } from "./morph";
import type { Timeline } from "./timeline";
import type { Anim, Stack } from "./track";
import { rect, type Geometry, type Paint } from "./values";

export { Ref, ref } from "./refs";

/** What every node takes: its identity, where it sits, and how it turns, scales, fades and moves in layers. */
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

/** A shape's outline. It is drawn centered on the edge, after the fill. */
export interface StrokeProps {
  readonly color: Anim<Paint>;
  /** Default 1. */
  readonly width?: Anim<number>;
  readonly cap?: "butt" | "round" | "square";
  readonly join?: "miter" | "round" | "bevel";
  readonly dash?: readonly number[];
  readonly nonScaling?: boolean;
}

/** A geometry, filled, stroked or both. */
export interface ShapeProps extends Common {
  readonly geometry: Anim<Geometry>;
  /** Nothing is inherited: a shape with no fill has none. */
  readonly fill?: Anim<Paint>;
  readonly stroke?: StrokeProps;
  /** The part of the stroke that is drawn, as two fractions of the outline's length, from and to. A fill is never trimmed. */
  readonly trim?: Anim<Vec>;
}

/**
 * What a run of text is drawn in. A `<Span>` takes these from the `<Text>` or `<Span>` around it unless it says
 * otherwise.
 */
export interface RunStyle {
  /**
   * One face, from `font()` or `google()`, or a family of them, from `font.family()` or `google.family()`. Text is
   * measured with the real face when the scene compiles, so the face asked for must be loaded: the browser never
   * makes up a bold or a slant.
   */
  readonly font?: FontValue;
  /** Which face of the family: 400 is regular, 600 semibold. Default 400, or a single face's own weight. */
  readonly weight?: number;
  /** The family's italic face. Default false, or whether a single face is italic. */
  readonly italic?: boolean;
  readonly fill?: Anim<Paint>;
  /** Multiplies the fill's alpha, 0 to 1: how words appear one by one without leaving their line. Default 1. */
  readonly opacity?: Anim<number>;
}

/** What `<Text>` and `<Span>` hold: strings, numbers, spans, and lists of them. Line breaks start new lines. */
export type TextChild =
  | string
  | number
  | SceneElement
  | false
  | null
  | undefined
  | readonly TextChild[];

/** Part of a text in another face or paint. It lays out with the text around it, so a line wraps through it. */
export interface SpanProps extends Omit<RunStyle, "opacity"> {
  /** Multiplies the fill's alpha, 0 to 1, of this span alone: a span in a faded text fades with it. Default 1. */
  readonly opacity?: Anim<number>;
  readonly children?: TextChild;
}

/** Text laid out when the scene compiles, so its box is known and the same in every target. */
export interface TextProps extends Common {
  readonly font: FontValue;
  /** Which face of `font`: 400 is regular, 600 semibold. Default 400, or a single face's own weight. */
  readonly weight?: number;
  /** The italic face of `font`. Default false, or whether a single face is italic. */
  readonly italic?: boolean;
  readonly size: number;
  /** Every run's fill, unless a `<Span>` says otherwise. */
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
  /** Strings and `<Span>`s. Line breaks in them start new lines. */
  readonly children?: TextChild;
}

/** A picture from `picture()`. */
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

/** One placement of a symbol. */
export interface InstanceProps extends Common {
  readonly of: SceneSymbol;
}

/** A local clock: `at` and `over` are seconds on the clock around it, as a span's are. */
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
  | { readonly type: "span"; readonly props: SpanProps }
  | { readonly type: "image"; readonly props: ImageProps }
  | { readonly type: "instance"; readonly props: InstanceProps }
  | {
      readonly type: "sequence";
      readonly at: Seconds;
      readonly over?: Seconds;
      readonly timeline?: Timeline;
      readonly children: readonly SceneElement[];
    }
  | { readonly type: "fragment"; readonly children: readonly SceneElement[] }
  | MorphElement;

/** What a node takes as children: elements, lists of them, and `false`, `null` or `undefined` for nothing. */
export type Child = SceneElement | false | null | undefined | readonly Child[];

const TYPES: ReadonlySet<string> = new Set([
  "group",
  "shape",
  "text",
  "image",
  "instance",
  "sequence",
  "fragment",
  "morph",
]);

/** Whether a value JSX handed over as a scene element is an object at all: text children are strings. */
const isObject = (value: SceneElement): value is SceneElement =>
  typeof value === "object" && value !== null;

/** Whether JSX handed over text, which a scene draws only through <Text>. */
const isText = (value: SceneElement | string | number): value is string | number =>
  typeof value === "string" || typeof value === "number";

/** What a lowercase tag that svjeez's SVG runtime built is called, as JSX writes it. */
const svgTag = (value: SceneElement): string | undefined =>
  isObject(value) && "kind" in value && value.kind === "element" && "tag" in value
    ? `<${String(value.tag)}>`
    : undefined;

/**
 * The element as lowering takes it, or the error a newcomer needs: a lowercase SVG tag, or JSX that svjeez's SVG
 * runtime built because the file doesn't say `@jsxImportSource svjeez/scene`.
 */
/** Whether a value is an element lowering places: any but a span, which only a text holds. */
const isPlaceable = (
  value: SceneElement,
): value is Exclude<SceneElement, { readonly type: "span" }> =>
  isObject(value) && value.type !== "span" && TYPES.has(value.type);

export const sceneElement = (
  value: SceneElement,
  where: string,
): Exclude<SceneElement, { readonly type: "span" }> => {
  if (isObject(value) && value.type === "span")
    throw new Error(
      `${where} holds a <Span>, which draws only inside a <Text>. Put it in one, as in <Text font={…} size={…} fill={…}>a <Span weight={600}>bold</Span> word</Text>.`,
    );

  if (isPlaceable(value)) return value;
  const tag = svgTag(value);

  throw new Error(
    tag
      ? `${where} holds ${tag}, an SVG tag, which a scene doesn't draw: every node is a component, such as <Shape geometry={rect(w, h)} />. If the file has no \`/** @jsxImportSource svjeez/scene */\` at its top, add it.`
      : isText(value)
        ? `${where} holds the bare text "${String(value)}". Write text in a <Text font={…} size={…} fill={…}>.`
        : `${where} holds ${isObject(value) ? "JSX that svjeez's SVG runtime built" : String(value)}, not a scene node. Put \`/** @jsxImportSource svjeez/scene */\` at the top of the file, so its JSX builds scene nodes.`,
  );
};

const isList = (child: Child): child is readonly Child[] => Array.isArray(child);

export const flat = (child: Child): SceneElement[] => {
  if (!child) return [];

  return isList(child) ? child.flatMap(flat) : [child];
};

/** Nodes that move together. Its box holds its children where they rest. It draws nothing itself. */
export const Group = ({
  children,
  ...props
}: Common & { readonly children?: Child }): SceneElement => ({
  type: "group",
  props,
  children: flat(children),
});

/** A geometry in a frame of its own: where that frame starts depends on the geometry (see `rect`, `circle`). */
export const Shape = (props: ShapeProps): SceneElement => ({ type: "shape", props });

/** Text whose frame starts on its first baseline, at the point `align` names. */
export const Text = (props: TextProps): SceneElement => ({ type: "text", props });

/**
 * A stretch of time, as `span()` makes one. It shares its name with the `<Span>` component below, which is a value:
 * one import brings both.
 */
export type Span = TimeSpan;

/**
 * Part of a `<Text>` in another weight, style, font or fill, laid out with the text around it. It is not a node of
 * its own: it has no key, place or motion, only what it is drawn in.
 */
export const Span = (props: SpanProps): SceneElement => ({ type: "span", props });

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
