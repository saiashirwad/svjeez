export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type Radii = readonly [number, number, number, number];

export type Rgb = `rgb(${string})` | `rgba(${string})`;

export interface Pair<C extends string = Rgb> {
  readonly light: C;
  readonly dark: C;
}

export type Paint<C extends string = Rgb> = C | Pair<C>;

export interface Shadow {
  readonly color: Paint;
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
}

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
  readonly stretch?: number;
  readonly decoration?: "underline" | "line-through" | "overline";
  readonly letterSpacing: number;
  readonly advances: readonly number[];
  readonly placeholder?: boolean;
}

export interface Transform {
  readonly matrix: readonly [number, number, number, number, number, number];
  readonly origin: readonly [number, number];
}

export interface Vector {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, Paint<string>>>;
  readonly children: readonly Vector[];
  readonly mask?: readonly Vector[];
  readonly run?: TextRun;
}

export interface Graphic {
  readonly kind: "graphic";
  readonly box: Rect;
  readonly viewBox: readonly [number, number, number, number];
  readonly children: readonly Vector[];
  readonly transform?: Transform;
  readonly anims?: readonly Anim[];
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

export interface Key {
  readonly offset: number;
  readonly easing: string;
  readonly props: Readonly<Record<string, string>>;
}

export interface Anim {
  readonly type: "transition" | "animation" | "script";
  readonly name: string;
  readonly keys: readonly Key[];
  readonly origin: readonly [number, number];
  readonly delay: number;
  readonly duration: number;
  readonly iterations: number | null;
  readonly direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  readonly fill: "none" | "forwards" | "backwards" | "both" | "auto";
  readonly easing: string;
  readonly elapsed: number;
}

export interface Box {
  readonly kind: "box";
  readonly tag: string;
  readonly part?: string;
  readonly key?: string;
  readonly id?: string;
  readonly box: Rect;
  readonly radii: Radii;
  readonly background?: Paint;
  readonly gradients?: readonly Gradient[];
  readonly pictures?: readonly Placement[];
  readonly mask?: readonly Placement[];
  readonly border?: {
    readonly widths: readonly [number, number, number, number];
    readonly color: Paint;
  };
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
  readonly anims?: readonly Anim[];
  readonly transform?: Transform;
  readonly children: readonly Item[];
}

export type Item = Box | TextRun | Graphic | Picture;

export interface Face {
  readonly family: string;
  readonly weight: string;
  readonly stretch?: string;
  readonly style: "normal" | "italic";
  readonly unicodeRange?: string;
  readonly src: string;
}

export interface CaptureDiagnostic {
  readonly code: "background" | "mask" | "backdrop" | "font-features" | "font-fallback";
  readonly element: string;
  readonly message: string;
  readonly family?: string;
}

export interface Snapshot {
  readonly name?: string;
  readonly width: number;
  readonly height: number;
  readonly pad: number;
  readonly box: Rect;
  readonly root: Box;
  readonly fonts?: readonly Face[];
  readonly diagnostics?: Readonly<Partial<Record<"light" | "dark", readonly CaptureDiagnostic[]>>>;
}
