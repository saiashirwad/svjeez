/** Plain data read off the page. Every position is in px from the snapshot's top-left corner. */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Top-left, top-right, bottom-right, bottom-left. */
export type Radii = readonly [number, number, number, number];

/** A color: one string when the light and dark scheme agree, else both. */
export type Paint = string | { readonly light: string; readonly dark: string };

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
  readonly weight: number;
  readonly style: "normal" | "italic";
  readonly size: number;
  readonly color: Paint;
  readonly letterSpacing: number;
  /** Where each character ends, in px from `x`, one per code point. Typing reveals the text up to these. */
  readonly advances: readonly number[];
  /** An empty input's placeholder: typing into the field hides it. */
  readonly placeholder?: boolean;
}

/** A CSS transform other than a plain move, as an SVG matrix about `origin`, in the snapshot's coordinates. */
export interface Transform {
  readonly matrix: readonly [number, number, number, number, number, number];
  readonly origin: readonly [number, number];
}

/** A shape inside an inline `<svg>`, with fill and stroke resolved from the page's CSS. */
export interface Vector {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, Paint>>;
  readonly children: readonly Vector[];
}

export interface Graphic {
  readonly kind: "graphic";
  readonly box: Rect;
  readonly viewBox: readonly [number, number, number, number];
  readonly children: readonly Vector[];
  readonly transform?: Transform;
}

export interface Picture {
  readonly kind: "image";
  readonly box: Rect;
  readonly radii: Radii;
  readonly href: string;
  readonly transform?: Transform;
}

export interface Box {
  readonly kind: "box";
  readonly tag: string;
  /** The element's `data-part`, or the name of the `parts` selector it matched. `<Dom parts>` animates by it. */
  readonly part?: string;
  /** The element's `data-key`. Elements with the same key pair up when a `Dom` turns one state into another. */
  readonly key?: string;
  readonly id?: string;
  readonly box: Rect;
  readonly radii: Radii;
  readonly background?: Paint;
  readonly border?: {
    readonly widths: readonly [number, number, number, number];
    readonly color: Paint;
  };
  readonly shadows: readonly Shadow[];
  /** Inset shadows, drawn inside the padding box over the background. */
  readonly insets?: readonly Shadow[];
  readonly opacity: number;
  readonly clip: boolean;
  readonly transform?: Transform;
  readonly children: readonly Item[];
}

export type Item = Box | TextRun | Graphic | Picture;

/** A web font the page loaded for its text, so the drawing can embed the same one. */
export interface Face {
  readonly family: string;
  /** A CSS weight: one number, or a range for a variable font. */
  readonly weight: string;
  readonly style: "normal" | "italic";
  /** The characters this file covers, when the page split the family across files. */
  readonly unicodeRange?: string;
  /** The file, as a data URI. */
  readonly src: string;
}

/** One state of a component, read from a live page. Plain data: it survives `JSON.stringify`. */
export interface Snapshot {
  /** The name `snap(name)` gave it. */
  readonly name?: string;
  /** Size of the picture: the element plus `pad` on every side. */
  readonly width: number;
  readonly height: number;
  /** Room around the element for shadows and rings, in px. */
  readonly pad: number;
  /** The root's border box, in the snapshot's coordinates. */
  readonly box: Rect;
  readonly root: Box;
  /** The page's own web fonts that its text used. Fonts given to `browser()` aren't repeated here. */
  readonly fonts?: readonly Face[];
}
