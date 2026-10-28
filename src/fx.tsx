import type { Color } from "./attributes";
import { hexBytes } from "./color";
import { def, type Ref } from "./defs";
import { num } from "./format";
import { ease, motion } from "./motion";

/** Neon bloom: a blurred copy merged under the source. */
const glow = ({ blur = 5 }: { readonly blur?: number } = {}): Ref<"filter"> =>
  def.filter(
    {},
    <>
      <feGaussianBlur stdDeviation={blur} result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </>,
  );

interface Boil {
  /** Displacement in px. */
  readonly strength?: number;
  /** Seed changes per second. */
  readonly rate?: number;
  /** First turbulence seed. Seeds 0 and 1 render the same, so seeds start at 1. */
  readonly seed?: number;
  /** Noise frequency; higher is finer wobble. */
  readonly detail?: number;
}

const BOIL_FRAMES = 4;

/** Hand-drawn boil: turbulence whose seed steps `rate` times a second, displacing the source by `strength` px. */
const boil = ({ strength = 3, rate = 10, seed = 1, detail = 0.04 }: Boil = {}): Ref<"filter"> => {
  const start = Math.max(1, Math.round(seed));
  const period = BOIL_FRAMES / rate;
  return def.filter(
    {},
    <>
      <feTurbulence
        type="fractalNoise"
        baseFrequency={detail}
        numOctaves={2}
        result="noise"
        animation={motion({ seed: start }).to({ seed: start + BOIL_FRAMES }, period, ease.steps(BOIL_FRAMES)).loop(period)}
      />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale={strength * 2} xChannelSelector="R" yChannelSelector="G" />
    </>,
  );
};

/** Desaturate toward gray: 1 is fully gray, 0 leaves the source alone. */
const grayscale = ({ amount = 1 }: { readonly amount?: number } = {}): Ref<"filter"> =>
  def.filter({ colorInterpolationFilters: "sRGB" }, <feColorMatrix type="saturate" values={num(1 - Math.min(1, Math.max(0, amount)))} />);

const channels = (hex: `#${string}`): [number, number, number] => {
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) throw new Error(`duotone takes hex colors like "#1b1f3a", got "${hex}".`);
  const [r, g, b] = hexBytes(hex);
  return [r / 255, g / 255, b / 255];
};

/** Map luminance (Rec. 709) onto a ramp from `dark` to `light`. Hex colors only. */
const duotone = ({ dark, light }: { readonly dark: `#${string}`; readonly light: `#${string}` }): Ref<"filter"> => {
  const [from, to] = [channels(dark), channels(light)];
  const row = (c: 0 | 1 | 2) => [0.2126, 0.7152, 0.0722].map((weight) => num((to[c] - from[c]) * weight, 4)).concat("0", num(from[c], 4));
  const values = [row(0), row(1), row(2), ["0", "0", "0", "1", "0"]].map((cells) => cells.join(" ")).join(" ");
  return def.filter({ colorInterpolationFilters: "sRGB" }, <feColorMatrix type="matrix" values={values} />);
};

const blur = ({ blur: deviation }: { readonly blur: number }): Ref<"filter"> => def.filter({}, <feGaussianBlur stdDeviation={deviation} />);

interface Shadow {
  readonly dx?: number;
  readonly dy?: number;
  readonly blur?: number;
  readonly color?: Color;
  readonly opacity?: number;
}

const shadow = ({ dx = 0, dy = 4, blur: deviation = 6, color = "black", opacity = 0.4 }: Shadow = {}): Ref<"filter"> =>
  def.filter({}, <feDropShadow dx={dx} dy={dy} stdDeviation={deviation} floodColor={color} floodOpacity={opacity} />);

export const fx = { glow, boil, grayscale, duotone, blur, shadow } as const;
