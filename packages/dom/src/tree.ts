/** Plain data read off the page. Every position is in px from the snapshot's top-left corner. */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Top-left, top-right, bottom-right, bottom-left. */
export type Radii = readonly [number, number, number, number];

export interface Shadow {
  readonly color: string;
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
  readonly color: string;
  readonly letterSpacing: number;
}

/** A shape inside an inline `<svg>`, with fill and stroke resolved from the page's CSS. */
export interface Vector {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: readonly Vector[];
}

export interface Graphic {
  readonly kind: "graphic";
  readonly box: Rect;
  readonly viewBox: readonly [number, number, number, number];
  readonly children: readonly Vector[];
}

export interface Picture {
  readonly kind: "image";
  readonly box: Rect;
  readonly radii: Radii;
  readonly href: string;
}

export interface Box {
  readonly kind: "box";
  readonly tag: string;
  /** The element's `data-part`, which `<Dom parts>` animates by. */
  readonly part?: string;
  /** The class attribute, which `Morph` pairs elements by. */
  readonly classes: string;
  readonly box: Rect;
  readonly radii: Radii;
  readonly background?: string;
  readonly border?: {
    readonly widths: readonly [number, number, number, number];
    readonly color: string;
  };
  readonly shadows: readonly Shadow[];
  readonly opacity: number;
  readonly clip: boolean;
  readonly children: readonly Item[];
}

export type Item = Box | TextRun | Graphic | Picture;
