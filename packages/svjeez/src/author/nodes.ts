import { SceneError } from "../model/scene-error";
import type { FontValue } from "../font/font";
import type { Seconds } from "../model/time";
import type { PictureData } from "./picture";
import type { Authored, Blend, Box, Scheme, Vec } from "../model/ir";
import type { Anchor, Ref } from "./refs";
import type { AnchorPlace, TextAnchorPlace } from "./pin";
import type { Origin, Settle } from "./settle";
import type { MorphElement } from "./morph";
import { isClock, type Clock } from "./clock";
import { isWhen, type When } from "./span";
import type { Anim, Layers } from "./track";
import type { Effect } from "./effects";
import type { TextContent } from "./count";
import type { Geometry, Paint } from "./values";

export { Ref, ref } from "./refs";

export interface Common {
  readonly key?: string;
  /**
   * A name for this node that a ref("id") finds it by, and that `svg.emit(scene, { ids: true })` writes as `data-svz-id`.
   * Inside a component that has an id it is scoped by it: `card1/note`. Unique in its scope.
   */
  readonly id?: string;
  readonly ref?: Ref;
  readonly at?: Anim<Vec> | Anchor;
  readonly anchor?: AnchorPlace;
  readonly origin?: Origin;
  readonly rotate?: Anim<number>;
  readonly scale?: Anim<number> | Anim<Vec>;
  /** Degrees of shear along x, in the node's own frame: the box leans right for a positive angle, before it is scaled and rotated. */
  readonly skew?: Anim<number>;
  readonly opacity?: Anim<number>;
  readonly motion?: Layers;
  readonly clip?: Anim<Geometry> | ((own: Bounds) => Anim<Geometry>);
  readonly mask?: Child | ((own: Bounds) => Child);
  readonly effects?: readonly Effect[];
  /** How it composites onto its earlier siblings. A group whose children blend is isolated, so they blend only with each other. */
  readonly blend?: "normal" | Blend;
  /**
   * Shows it only in this color scheme (the viewer's `prefers-color-scheme`); without it, it shows in both. It still
   * takes its space in a layout in either, so light and dark alternatives that should sit in one place go in a Group.
   */
  readonly scheme?: Scheme;
}

export interface StrokeProps {
  readonly color: Anim<Paint>;
  readonly width?: Anim<number>;
  /** How an open end is finished: cut flat at the end point, rounded, or squared off half a width past it. */
  readonly cap?: "flat" | "round" | "square";
  /** How a corner is finished: a sharp point, rounded, or cut flat. */
  readonly join?: "sharp" | "round" | "flat";
  readonly dash?: readonly number[];
  /** Slides the dash pattern along the stroke. Needs `dash`, and can't be combined with `draw` or `trim`. */
  readonly dashOffset?: Anim<number>;
  /** Keep the stroke's width when the node is scaled. */
  readonly fixedWidth?: boolean;
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
  /** Extra space after every glyph, in scene units. */
  readonly letterSpacing?: number;
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
  /** One advance per character, in scene units and including any letter spacing, as a browser measured them. The font is then never read, so it can be a WOFF2 or a `font.system()` family. */
  readonly advances?: readonly number[];
  readonly children?: TextChild;
}

export interface TextProps extends Omit<Common, "anchor"> {
  readonly anchor?: TextAnchorPlace;
  readonly font: FontValue;
  readonly weight?: number;
  readonly italic?: boolean;
  readonly size: number;
  readonly fill?: Anim<Paint>;
  readonly letterSpacing?: number;
  readonly stroke?: StrokeProps;
  readonly align?: "start" | "center" | "end";
  readonly width?: number;
  readonly lineHeight?: number;
  /** Sets the text along this outline, on one line: it takes no `width`. */
  readonly along?: Geometry;
  /** Where along the outline the text begins, as a fraction of its length (default 0); `align` is relative to it. */
  readonly start?: Anim<number>;
  readonly children?: TextContent;
}

export interface PictureProps extends Common {
  readonly src: PictureData;
  readonly width?: number;
  readonly height?: number;
}

export interface Framed {
  readonly offset?: Anim<Vec> | Anchor;
}

export interface GroupProps extends Common, Framed, Backdrop {}

/** Plays its children on the scene's clock from `when`, or on a `clock` that page code can drive. Give one of them. */
export type SequenceProps = { readonly children?: Child } & (
  | { readonly when: When; readonly clock?: undefined }
  | { readonly clock: Clock; readonly when?: undefined }
);

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
  | { readonly type: "picture"; readonly props: PictureProps }
  | {
      readonly type: "sequence";
      readonly start: Seconds;
      readonly over?: Seconds;
      readonly clock?: Clock;
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
  "picture",
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

export const Picture = (props: PictureProps): SceneElement => ({ type: "picture", props });

export const Sequence = ({ when, clock, children }: SequenceProps): SceneElement => {
  if (when !== undefined && clock !== undefined)
    throw new SceneError(
      "<Sequence> takes when or clock, not both.",
      "Use when={span(start, over)} to play on the scene's clock, or clock={c} for a clock from clock().",
    );

  if (clock !== undefined) {
    if (!isClock(clock))
      throw new SceneError(
        `<Sequence> takes clock={c} with a c from clock(name, span(start, over)), got ${String(clock)}.`,
      );

    return {
      type: "sequence",
      start: clock.start,
      over: clock.over,
      clock,
      children: flat(children),
    };
  }

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
