import { def, type Ref } from "./defs";
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

export const fx = { glow, boil } as const;
