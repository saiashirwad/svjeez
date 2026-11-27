import { google } from "@svjeez/fonts";
import {
  Group,
  Sequence,
  Text,
  arc,
  ease,
  enter,
  exit,
  span,
  type Geometry,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";

export const W = 1280;
export const H = 720;

/** Crossfade between shots, in seconds. */
export const FADE = 0.6;

export const serif = await google.family("Source Serif 4", [
  { weight: 400 },
  { weight: 400, italic: true },
  { weight: 600 },
]);

export const sans = await google.family("Instrument Sans", [{ weight: 400 }, { weight: 600 }]);
export const mono = await google("JetBrains Mono", { ligatures: false });

/** Anthropic-ish warm neutrals and the clay accent. */
export const ivory = "#F0EEE6";
export const slate = "#141413";
export const clay = "#D97757";
export const oat = "#E3DACC";

/**
 * A shot: a `Sequence` of `length` seconds whose contents fade in over the first `FADE` and out over the last, so
 * shots in a `<Series gap={-FADE}>` crossfade. `first`/`last` skip the fade at the film's ends.
 */
export const Shot = ({
  length,
  first = false,
  last = false,
  children,
}: {
  readonly length: number;
  readonly first?: boolean;
  readonly last?: boolean;
  readonly children: SceneElement | readonly SceneElement[];
}): SceneElement => (
  <Sequence when={span(0, length)}>
    <Group
      motion={[
        !first && enter(span(0, FADE), { curve: ease.inOut }),
        !last && exit(span(length - FADE, FADE), { curve: ease.inOut }),
      ]}
    >
      {children}
    </Group>
  </Sequence>
);

/**
 * A caption in the launch-film voice: serif, sentence case, centered, rising in and fading out. `when` is the span it
 * is on screen, in the shot's own seconds.
 */
export const Caption = ({
  children,
  when,
  fill,
  y = 112,
  size = 46,
  italic = false,
}: {
  readonly children: string;
  readonly when: readonly [start: number, over: number];
  readonly fill: Paint;
  readonly y?: number;
  readonly size?: number;
  readonly italic?: boolean;
}): SceneElement => (
  <Text
    font={serif}
    italic={italic}
    size={size}
    letterSpacing={-size * 0.012}
    fill={fill}
    at={[W / 2, y]}
    anchor="center"
    motion={[
      enter(span(when[0], 0.8), { from: { opacity: 0, offset: [0, 10] }, curve: ease.out }),
      exit(span(when[0] + when[1] - 0.6, 0.6), { curve: ease.inOut }),
    ]}
  >
    {children}
  </Text>
);

/**
 * The horizon every shot rides on: a circle of `radius` whose top sits at `top`. `at(x)` gives the point on it above
 * screen x and the slope there in degrees, so a rider can sit on it and tilt with it.
 */
export interface Horizon {
  readonly center: Vec;
  readonly radius: number;
  readonly at: (x: number) => { readonly point: Vec; readonly angle: number };
  /** The visible stretch of the circle, centered on its top, in its own frame (center at the origin). */
  readonly visible: (sweep: number) => Geometry;
}

export const horizon = (top: number, radius: number): Horizon => {
  const center: Vec = [W / 2, top + radius];

  return {
    center,
    radius,
    at: (x) => {
      const dx = x - center[0];
      const dy = -Math.sqrt(radius * radius - dx * dx);

      return { point: [x, center[1] + dy], angle: (Math.atan2(dx, -dy) * 180) / Math.PI };
    },
    visible: (sweep) => arc({ radius, start: -90 - sweep / 2, sweep }),
  };
};
