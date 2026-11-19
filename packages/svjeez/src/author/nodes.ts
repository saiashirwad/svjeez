import { SceneError } from "../model/scene-error";
import type { FontValue } from "../font/font";
import type { Seconds } from "../model/time";
import type { PictureData } from "./picture";
import type { Authored, Blend, Box, Vec } from "../model/ir";
import type { Anchor, Ref } from "./refs";
import type { AnchorPlace, TextAnchorPlace } from "./pin";
import type { Origin, Settle } from "./settle";
import type { MorphElement } from "./morph";
import { isWhen, type When } from "./span";
import type { Anim, Layers } from "./track";
import type { Effect } from "./effects";
import type { TextContent } from "./count";
import { rect, type Geometry, type Paint } from "./values";

export { Ref, ref } from "./refs";

export interface Common {
  readonly key?: string;
  readonly ref?: Ref;
  readonly at?: Anim<Vec> | Anchor;
  readonly anchor?: AnchorPlace;
  readonly origin?: Origin;
  readonly rotate?: Anim<number>;
  readonly scale?: Anim<number> | Anim<Vec>;
  readonly opacity?: Anim<number>;
  readonly motion?: Layers;
  readonly clip?: Anim<Geometry> | ((own: Bounds) => Anim<Geometry>);
  readonly mask?: Child | ((own: Bounds) => Child);
  readonly effects?: readonly Effect[];
  /** How it composites onto its earlier siblings. A group whose children blend is isolated, so they blend only with each other. */
  readonly blend?: "normal" | Blend;
}

export interface StrokeProps {
  readonly color: Anim<Paint>;
  readonly width?: Anim<number>;
  readonly cap?: "butt" | "round" | "square";
  readonly join?: "miter" | "round" | "bevel";
  readonly dash?: readonly number[];
  /** Slides the dash pattern along the stroke. Needs `dash`, and can't be combined with `draw` or `trim`. */
  readonly dashOffset?: Anim<number>;
  readonly nonScaling?: boolean;
  /** Draw the stroke under the fill. */
  readonly under?: boolean;
}

export interface Bounds extends Box {
  readonly size: Vec;
  readonly center: Vec;
  readonly rect: Geometry;
}

export type Radius = number | readonly [number, number, number, number];

export interface Backdrop {
  readonly fill?: Anim<Paint>;
  readonly stroke?: StrokeProps;
  readonly radius?: Radius;
}

export interface ShapeProps extends Common {
  readonly geometry: Anim<Geometry>;
  readonly fill?: Anim<Paint>;
  readonly stroke?: StrokeProps;
  /** How much of the outline is drawn, from 0 to 1: the same as `trim` of [0, draw]. Give draw or trim, not both. */
  readonly draw?: Anim<number>;
  /** The window of the outline that shows, [from, to] from 0 to 1. */
  readonly trim?: Anim<Vec>;
}

export interface RunStyle {
  readonly font?: FontValue;
  readonly weight?: number;
  readonly italic?: boolean;
  readonly fill?: Anim<Paint>;
  readonly opacity?: Anim<number>;
}

export type TextChild =
  | string
  | number
  | SceneElement
  | false
  | null
  | undefined
  | readonly TextChild[];

export interface RunProps extends RunStyle {
  readonly children?: TextChild;
}

export interface TextProps extends Omit<Common, "anchor"> {
  readonly anchor?: TextAnchorPlace;
  readonly font: FontValue;
  readonly weight?: number;
  readonly italic?: boolean;
  readonly size: number;
  readonly fill?: Anim<Paint>;
  readonly stroke?: StrokeProps;
  readonly align?: "start" | "center" | "end";
  readonly width?: number;
  readonly lineHeight?: number;
  /** Sets the text along this outline, on one line: it takes no `width`. */
  readonly path?: Geometry;
  /** Where along `path` the text begins, as a fraction of its length (default 0); `align` is relative to it. */
  readonly start?: Anim<number>;
  readonly children?: TextContent;
}

export interface ImageProps extends Common {
  readonly src: PictureData;
  readonly width?: number;
  readonly height?: number;
}

export interface SceneSymbol {
  readonly kind: "symbol";
  readonly build: () => Child;
}

export const symbol = (build: () => Child): SceneSymbol => ({ kind: "symbol", build });

export interface Framed {
  readonly offset?: Anim<Vec> | Anchor;
}

export interface GroupProps extends Common, Framed, Backdrop {}

export interface InstanceProps extends Common, Framed {
  readonly of: SceneSymbol;
}

export interface SequenceProps {
  readonly when: When;
  readonly children?: Child;
}

export type SceneElement =
  | {
      readonly type: "group";
      readonly props: GroupProps;
      readonly children: readonly SceneElement[];
      readonly settle?: Settle;
      readonly layout?: Authored["layout"];
      readonly paints?: true;
    }
  | { readonly type: "shape"; readonly props: ShapeProps }
  | { readonly type: "text"; readonly props: TextProps }
  | { readonly type: "run"; readonly props: RunProps }
  | { readonly type: "image"; readonly props: ImageProps }
  | { readonly type: "instance"; readonly props: InstanceProps }
  | {
      readonly type: "sequence";
      readonly start: Seconds;
      readonly over?: Seconds;
      readonly children: readonly SceneElement[];
    }
  | { readonly type: "fragment"; readonly children: readonly SceneElement[] }
  | MorphElement;

export type NodeElement = Exclude<
  SceneElement,
  { readonly type: "fragment" | "sequence" | "morph" | "run" }
>;

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

const isObject = (value: SceneElement): value is SceneElement =>
  typeof value === "object" && value !== null;

const isText = (value: SceneElement | string | number): value is string | number =>
  typeof value === "string" || typeof value === "number";

const isPlaceable = (
  value: SceneElement,
): value is Exclude<SceneElement, { readonly type: "run" }> =>
  isObject(value) && value.type !== "run" && TYPES.has(value.type);

export const sceneElement = (
  value: SceneElement,
  where: string,
): Exclude<SceneElement, { readonly type: "run" }> => {
  if (isObject(value) && value.type === "run")
    throw new SceneError(
      `${where} holds a <Run>, which draws only inside a <Text>. Put it in one, as in <Text font={…} size={…} fill={…}>a <Run weight={600}>bold</Run> word</Text>.`,
    );

  if (isPlaceable(value)) return value;

  throw new SceneError(
    isText(value)
      ? `${where} holds the bare text "${String(value)}". Write text in a <Text font={…} size={…} fill={…}>.`
      : `${where} holds ${isObject(value) ? "JSX that another runtime built" : String(value)}, not a scene node. Put \`/** @jsxImportSource svjeez */\` at the top of the file, so its JSX builds scene nodes.`,
  );
};

const isList = (child: Child): child is readonly Child[] => Array.isArray(child);

export const flat = (child: Child): SceneElement[] => {
  if (!child) return [];

  return isList(child) ? child.flatMap(flat) : [child];
};

export const Group = ({
  children,
  ...props
}: Common & Framed & { readonly children?: Child }): SceneElement => ({
  type: "group",
  props,
  children: flat(children),
});

export const Shape = (props: ShapeProps): SceneElement => ({ type: "shape", props });

export const Text = (props: TextProps): SceneElement => ({ type: "text", props });

export const Run = (props: RunProps): SceneElement => ({ type: "run", props });

export const Image = (props: ImageProps): SceneElement => ({ type: "image", props });

export const Instance = (props: InstanceProps): SceneElement => ({ type: "instance", props });

export const Sequence = ({ when, children }: SequenceProps): SceneElement => {
  if (!isWhen(when))
    throw new SceneError(
      `<Sequence> takes when={span(start, over)}, or when={span(start)} to run to the end, got ${String(when)}.`,
    );

  return {
    type: "sequence",
    start: when.start,
    ...(when.over !== undefined && { over: when.over }),
    children: flat(children),
  };
};

let building: Vec | undefined;

const size = (): Vec => {
  if (!building) throw new SceneError("canvas is only known inside scene()'s callback.");

  return building;
};

export const canvas = {
  get size(): Vec {
    return size();
  },
  get center(): Vec {
    const [width, height] = size();

    return [width / 2, height / 2];
  },
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
