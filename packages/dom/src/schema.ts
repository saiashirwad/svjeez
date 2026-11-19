/**
 * The Snapshot is what `capture()` sees in the browser: resolved layout and computed style, as plain JSON.
 * It makes no scene decisions. Colors are normalized to `rgb(r, g, b)` / `rgba(r, g, b, a)`, lengths are CSS px,
 * times are milliseconds, and every rect is in page coordinates (viewport plus scroll) before the element's own transform.
 */

export const SNAPSHOT_VERSION = 1;

/** Anything that survives `JSON.stringify`. */
export type Json =
  | string
  | number
  | boolean
  | null
  | readonly Json[]
  | { readonly [key: string]: Json };

/** A color that differs between schemes: what `mergeSchemes` pairs, and compile turns into a theme token. */
export interface Themed {
  readonly light: string;
  readonly dark: string;
}

/** `rgb(...)` / `rgba(...)`, or a `Themed` pair of them. */
export type Color = string | Themed;

export const isThemed = (color: Color | undefined): color is Themed => typeof color === "object";

export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** One corner's elliptical radius, in px. */
export type Corner = readonly [x: number, y: number];

export interface Transform {
  /** The element's own transform (translate, rotate, scale, then transform), as a 2D matrix about `origin`. */
  readonly matrix: Matrix;
  /** The transform origin in page coordinates. */
  readonly origin: readonly [x: number, y: number];
}

export interface Stop {
  readonly offset: number;
  readonly color: Color;
}

export type Background =
  | { readonly kind: "linear"; readonly angle: number; readonly stops: readonly Stop[] }
  | {
      readonly kind: "radial";
      readonly shape: "circle" | "ellipse";
      readonly size: string;
      readonly at: readonly [x: number, y: number];
      readonly stops: readonly Stop[];
    }
  | { readonly kind: "image"; readonly src: string };

export type BorderStyle =
  | "none"
  | "solid"
  | "dashed"
  | "dotted"
  | "double"
  | "groove"
  | "ridge"
  | "inset"
  | "outset"
  | "hidden";

export interface Side {
  readonly width: number;
  readonly style: BorderStyle;
  readonly color: Color;
}

export interface Shadow {
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
  readonly color: Color;
  readonly inset: boolean;
}

export interface Font {
  readonly family: string;
  readonly weight: number;
  readonly italic: boolean;
  readonly stretch: number;
  readonly size: number;
}

export interface Decoration {
  readonly lines: readonly ("underline" | "overline" | "line-through")[];
  readonly color: Color;
  readonly thickness: number;
}

/** One line fragment of text. */
export interface Run {
  /** Left edge of the first character. */
  readonly x: number;
  /** The alphabetic baseline. */
  readonly y: number;
  /** The rendered text (after text-transform). */
  readonly text: string;
  /** One horizontal pitch per code point of `text`, in px, letterSpacing included. */
  readonly advances: readonly number[];
  readonly font: Font;
  readonly letterSpacing: number;
  readonly color: Color;
  readonly decoration?: Decoration;
}

export interface TextNode {
  readonly type: "text";
  readonly runs: readonly Run[];
}

/** An inline `<svg>` subtree: tags, attributes, and the computed paint of each element. */
export interface SvgNode {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  /** Computed paint (fill, stroke, stroke-width, ...). Colors are normalized. */
  readonly style: Readonly<Record<string, string | Themed>>;
  readonly text?: string;
  readonly children: readonly SvgNode[];
}

export interface ImageContent {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly objectFit: string;
  readonly objectPosition: string;
}

export interface Keyframe {
  readonly offset: number;
  readonly easing: string;
  /** Computed property values by their JS name (`backgroundColor`, `transform`, ...). */
  readonly props: Readonly<Record<string, string>>;
}

export interface Animation {
  readonly kind: "animation" | "transition" | "script";
  /** The @keyframes name, the transitioned property, or the animation id. */
  readonly name: string;
  readonly keyframes: readonly Keyframe[];
  readonly duration: number;
  readonly delay: number;
  readonly endDelay: number;
  readonly iterations: number | "infinite";
  readonly direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  readonly easing: string;
  readonly fill: "none" | "forwards" | "backwards" | "both" | "auto";
  /** Where the animation was when captured. The captured layout already shows this moment. */
  readonly currentTime: number;
  readonly playbackRate: number;
  readonly playState: "running" | "paused" | "finished";
}

/**
 * What a form control draws that is not its text (which is ordinary `TextNode` children).
 * A native checkbox or radio (`appearance` not none) has no border or background of its own in the Snapshot: compile draws the whole control.
 */
export type Control =
  | {
      readonly kind: "checkbox" | "radio";
      readonly checked: boolean;
      readonly indeterminate: boolean;
      /** `accent-color`, or the browser's default blue. */
      readonly accent: Color;
    }
  /** A native `<select>`: its box and selected text are captured as usual, the chevron is drawn in `color`. */
  | { readonly kind: "select"; readonly color: Color };

export interface ElementNode {
  readonly type: "element";
  readonly tag: string;
  readonly id?: string;
  /** `data-key` */
  readonly key?: string;
  /** `data-part` */
  readonly part?: string;
  /** The border box, before this element's own transform (ancestor transforms compose on top). */
  readonly rect: Rect;
  /** Corner radii [top-left, top-right, bottom-right, bottom-left], already clamped to the box. */
  readonly radii?: readonly [Corner, Corner, Corner, Corner];
  readonly transform?: Transform;
  readonly opacity?: number;
  readonly blendMode?: string;
  /** Which axes clip their children to the padding box. */
  readonly clip?: { readonly x: boolean; readonly y: boolean };
  readonly background?: Color;
  /** Gradient and image layers, topmost first. */
  readonly backgrounds?: readonly Background[];
  /** [top, right, bottom, left], present when any side draws. */
  readonly border?: readonly [Side, Side, Side, Side];
  readonly outline?: {
    readonly width: number;
    readonly offset: number;
    readonly color: Color;
    readonly style: BorderStyle;
  };
  readonly shadows?: readonly Shadow[];
  readonly image?: ImageContent;
  readonly svg?: SvgNode;
  readonly control?: Control;
  readonly animations?: readonly Animation[];
  /** CSS on this element that capture could not represent, one short phrase each. Compile forwards them as diagnostics. */
  readonly notes?: readonly string[];
  readonly children: readonly (ElementNode | TextNode)[];
}

export type Node = ElementNode | TextNode;

/** One `@font-face` rule of the page. `src` is the first `url()`, absolute; `inlineAssets` turns it into a `data:` URL. */
export interface WebFont {
  readonly family: string;
  readonly weight: number;
  readonly italic: boolean;
  readonly src: string;
}

export interface Snapshot {
  readonly version: typeof SNAPSHOT_VERSION;
  readonly viewport: { readonly width: number; readonly height: number };
  /** The page's web fonts, whether or not the root uses them. */
  readonly fonts?: readonly WebFont[];
  readonly root: ElementNode;
}

/** What `checkVersion` needs to see of anything loaded from disk. */
export interface Versioned {
  readonly version?: number | string;
}

/** Throws unless `value` is a Snapshot this build understands. Run it on anything loaded from disk. */
export const checkVersion = (value: Versioned): Snapshot => {
  if (value.version !== SNAPSHOT_VERSION)
    throw new Error(
      `This is not a version ${SNAPSHOT_VERSION} Snapshot (found ${value.version === undefined ? "no version" : JSON.stringify(value.version)}). Snapshots are not migrated: capture the page again with this version of @svjeez/dom.`,
    );

  // SAFETY: the version matches, so a well-formed capture() result is all that can carry it.
  return value as Snapshot;
};
