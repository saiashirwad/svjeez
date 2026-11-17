/** Plain data read off the page. Every position is in px from the snapshot's top-left corner. */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Top-left, top-right, bottom-right, bottom-left. */
export type Radii = readonly [number, number, number, number];

export type Rgb = `rgb(${string})` | `rgba(${string})`;

export interface Pair<C extends string = Rgb> {
  readonly light: C;
  readonly dark: C;
}

/** A color: one when the light and dark scheme agree, else both. */
export type Paint<C extends string = Rgb> = C | Pair<C>;

export interface Shadow {
  readonly color: Paint;
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
}

/** One line of one text node, as the browser broke it. `y` is the baseline. */
export interface TextRun {
  readonly kind: "text";
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly family: string;
  readonly fallback?: string;
  readonly weight: number;
  readonly style: "normal" | "italic";
  readonly size: number;
  readonly color: Paint;
  /** `font-stretch` as a percentage, left out at the normal 100. */
  readonly stretch?: number;
  readonly decoration?: "underline" | "line-through" | "overline";
  readonly letterSpacing: number;
  /** Where each character ends, in px from `x`, one per code point. Typing reveals the text up to these. */
  readonly advances: readonly number[];
  readonly placeholder?: boolean;
}

/** A CSS transform other than a plain move, as an SVG matrix about `origin`, in the snapshot's coordinates. */
export interface Transform {
  readonly matrix: readonly [number, number, number, number, number, number];
  readonly origin: readonly [number, number];
}

export interface Vector {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, Paint<string>>>;
  readonly children: readonly Vector[];
  readonly mask?: readonly Vector[];
  /** A `<text>` in a mask, as a run in the page's coordinates (not the drawing's). */
  readonly run?: TextRun;
}

export interface Graphic {
  readonly kind: "graphic";
  readonly box: Rect;
  readonly viewBox: readonly [number, number, number, number];
  readonly children: readonly Vector[];
  readonly transform?: Transform;
}

export interface Placement {
  readonly href: string;
  readonly tiles: readonly Rect[];
}

export interface Picture {
  readonly kind: "image";
  readonly box: Rect;
  readonly radii: Radii;
  readonly href: string;
  readonly fit?: Rect;
  readonly transform?: Transform;
}

export interface Stop {
  readonly offset: number;
  readonly color: Paint;
}

export interface LinearGradient {
  readonly kind: "linear";
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stops: readonly Stop[];
  readonly repeat?: boolean;
}

export interface RadialGradient {
  readonly kind: "radial";
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly stops: readonly Stop[];
  readonly repeat?: boolean;
}

export type Gradient = LinearGradient | RadialGradient;

export interface Box {
  readonly kind: "box";
  /** The tag, or `::before` and `::after` for those pseudo-elements. */
  readonly tag: string;
  /** The element's `data-part`, or the name of the `parts` selector it matched. `<Dom parts>` animates by it. */
  readonly part?: string;
  /** The element's `data-key`. Elements with the same key pair up when a `Dom` turns one state into another. */
  readonly key?: string;
  readonly id?: string;
  readonly box: Rect;
  readonly radii: Radii;
  readonly background?: Paint;
  /** `background-image` gradients, bottom layer first, painted over `background`. */
  readonly gradients?: readonly Gradient[];
  /** `background-image` urls, bottom layer first, painted over the gradients. */
  readonly pictures?: readonly Placement[];
  /** `mask-image` urls: the box and what's in it show only where these are opaque. */
  readonly mask?: readonly Placement[];
  readonly border?: {
    readonly widths: readonly [number, number, number, number];
    readonly color: Paint;
  };
  /** An `outline`, painted over the element's content: `offset` px clear of the border box (negative goes inside). */
  readonly outline?: {
    readonly width: number;
    readonly offset: number;
    readonly color: Paint;
  };
  readonly shadows: readonly Shadow[];
  readonly insets?: readonly Shadow[];
  readonly opacity: number;
  readonly darkOpacity?: number;
  readonly blend?: string;
  readonly isolate?: boolean;
  readonly clip: boolean;
  readonly transform?: Transform;
  readonly children: readonly Item[];
}

export type Item = Box | TextRun | Graphic | Picture;

export interface Face {
  readonly family: string;
  /** A CSS weight: one number, or a range for a variable font. */
  readonly weight: string;
  readonly stretch?: string;
  readonly style: "normal" | "italic";
  readonly unicodeRange?: string;
  readonly src: string;
}

export interface Snapshot {
  readonly name?: string;
  /** Size of the picture: the element plus `pad` on every side. */
  readonly width: number;
  readonly height: number;
  /** Room around the element for shadows and rings, in px. */
  readonly pad: number;
  readonly box: Rect;
  readonly root: Box;
  /** The page's own web fonts that its text used. Fonts given to `browser()` aren't repeated here. */
  readonly fonts?: readonly Face[];
}
