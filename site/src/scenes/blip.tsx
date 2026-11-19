import {
  Group,
  Shape,
  circle,
  ease,
  ellipse,
  path,
  span,
  track,
  type Curve,
  type Paint,
  type SceneElement,
  type Span,
  type Track,
  type Vec,
} from "svjeez";
import type { Child, Layer, Layers } from "svjeez/tools";

/** Blip's own colors, the same in light and dark. */
export const BLIP = {
  yellow: "#FFC21A",
  belly: "#F2A900",
  stem: "#E3A100",
  cheek: "#FF8C6B",
  ink: "#26262A",
  foot: "#F08A00",
} as const;

/** Where the feet meet the ground, in Blip's own units, so a squash or a pop pivots about them. */
export const GROUND: Vec = [104, 162];

/** The antenna bulb at rest, in Blip's own units. */
export const BULB: Vec = [104, 38];

/** The antenna stem runs up under the bulb, so the bulb can travel 6 units either way without showing the stem's end. */
const stem = path.parse("M104 60V36");

const body = path.parse(
  "M38 150C38 94 68 60 104 60S170 94 170 150C170 158 165 162 157 162H51C43 162 38 158 38 150Z",
);

const belly = path.parse(
  "M38 150C38 158 43 162 51 162H157C165 162 170 158 170 150C170 146 170 143 169 140C160 148 150 150 104 150S48 148 39 140C38 143 38 146 38 150Z",
);

const smile = path.parse("M97 124Q104 131 111 124");

const EYES = [84, 124] as const;

const rest: Vec = [0, 0];

/** A rise of `y` as an offset. */
const up = (y: number): Vec => [0, y];

interface PivotProps {
  /** The point turned and scaled about, in the frame the children are drawn in. */
  readonly around: Vec;
  /** Where that point lands; `around` by default. */
  readonly at?: Vec;
  readonly motion?: Layers;
  readonly children?: Child;
}

/** Turns, scales and moves its children about `around`. */
export const Pivot = ({ around, at = around, motion, children }: PivotProps): SceneElement => (
  <Group offset={at} origin="at" motion={motion}>
    <Group offset={[-around[0], -around[1]]}>{children}</Group>
  </Group>
);

/** An opacity that goes from `from` to `to` for each blink, a quarter of a second each. */
const blinking = (blinks: readonly number[], from: number, to: number): Track<number> =>
  blinks.reduce((t, at) => {
    const shut = span(at, 0.04);

    return t.to(to, shut).to(from, shut.next(0.08, 0.12));
  }, track(from));

export interface BlipProps {
  /** Times each blink starts. A blink takes a quarter of a second. */
  readonly blinks?: readonly number[];
  /** Moves the whole blip about its middle: hops, bobs and rocks. */
  readonly body?: Layers;
  /** Squashes and stretches about the feet: width and height scales. */
  readonly stretch?: Track<Vec>;
  /** Moves the eyes and their glints inside the face: looking around. */
  readonly look?: Track<Vec>;
  /** Moves the bulb up and down its stem. Keep it within 6 units, or the stem shows its end. */
  readonly bulb?: Track<number>;
  /** Recolors the bulb. */
  readonly glow?: Track<Paint>;
  /** Draws feet under the body, each with its own motion. */
  readonly feet?: { readonly left?: Layers; readonly right?: Layers };
}

/** Blip, the svjeez mascot, in its own units: 208 wide, feet on the ground at `GROUND`. */
export const Blip = ({
  blinks = [],
  body: moves,
  stretch,
  look,
  bulb,
  glow,
  feet,
}: BlipProps): SceneElement => {
  const open = blinks.length > 0 ? blinking(blinks, 1, 0) : 1;
  const shut = blinking(blinks, 0, 1);

  return (
    <Group motion={moves}>
      <Pivot around={GROUND} motion={stretch && { scale: stretch }}>
        {feet && (
          <Group>
            {[feet.left, feet.right].map((motion, i) => (
              <Shape
                key={`foot${i}`}
                geometry={ellipse(12, 6)}
                at={[EYES[i]!, 162]}
                anchor="center"
                fill={BLIP.foot}
                motion={motion}
              />
            ))}
          </Group>
        )}
        <Shape geometry={stem} stroke={{ color: BLIP.stem, width: 7, cap: "round" }} />
        <Shape
          geometry={circle(9)}
          at={BULB}
          anchor="center"
          fill={glow ?? BLIP.yellow}
          motion={bulb && { offset: bulb.map(up) }}
        />
        <Shape geometry={body} fill={BLIP.yellow} />
        <Shape geometry={belly} fill={BLIP.belly} />
        {[66, 142].map((x) => (
          <Shape
            key={`cheek${x}`}
            geometry={ellipse(9, 6)}
            at={[x, 124]}
            anchor="center"
            fill={BLIP.cheek}
            opacity={0.55}
          />
        ))}
        <Group motion={look && { offset: look }}>
          {EYES.map((x) => (
            <Group key={`eye${x}`}>
              <Group opacity={open}>
                <Shape geometry={ellipse(7, 9)} at={[x, 110]} anchor="center" fill={BLIP.ink} />
                <Shape geometry={circle(2.4)} at={[x + 2, 106]} anchor="center" fill="#FFFFFF" />
              </Group>
              {blinks.length > 0 && (
                <Shape
                  geometry={ellipse(7.5, 1.6)}
                  at={[x, 112]}
                  anchor="center"
                  fill={BLIP.ink}
                  opacity={shut}
                />
              )}
            </Group>
          ))}
        </Group>
        <Shape geometry={smile} stroke={{ color: BLIP.ink, width: 4.5, cap: "round" }} />
      </Pivot>
    </Group>
  );
};

export interface Hop {
  /** When the feet land. */
  readonly land: number;
  /** How high Blip rises, in its own units. */
  readonly height: number;
}

export interface Jumps {
  /** Blip's rise and fall. */
  readonly body: Track<Vec>;
  /** The squash before the leap, the stretch in the air, and the squash on landing. */
  readonly stretch: Track<Vec>;
  /** The bulb lags the body on its stem, then wobbles to rest after the landing. */
  readonly bulb: Track<number>;
}

/** The share of a full hop's air time that a hop of `height` takes. */
const lift = (height: number) => Math.sqrt(Math.min(1, Math.max(0.25, height / 64)));

/** When a hop is off the ground, from the launch to the landing: move Blip across over this span. */
export const flight = ({ land, height }: Hop): Span =>
  span(land - 0.4 * lift(height), 0.4 * lift(height));

/** The bulb lighting up for a moment at each of `times`, for Blip's `glow`. */
export const flashes = (times: readonly number[], lit: Paint = "#FFF3B0"): Track<Paint> =>
  times.reduce((t, at) => {
    const on = span(at, 0.05);

    return t.to(lit, on).to(BLIP.yellow, on.next(0.45));
  }, track<Paint>(BLIP.yellow));

/**
 * Hops, each landing at its own time: a crouch, a launch, a little air and a squashy landing with a rebound. A hop
 * starts and ends at rest, and hops must be at least a second apart.
 */
export const jumps = (hops: readonly Hop[]): Jumps => {
  let body = track(rest);
  let stretch = track<Vec>([1, 1]);
  let bulb = track(0);

  for (const { land, height } of hops) {
    const air = 0.2 * lift(height);
    const start = land - 0.3 - 0.4 * lift(height);

    const rise = span(start + 0.3, air);
    const crouch = span(start, 0.22);
    const push = crouch.next(0.08);

    body = body.to(up(-height), rise, ease.out).to(rest, rise.next(air), ease.in);

    const [, climb, top] = push.chain(air / 2, air / 2);
    const [brace, squash, rebound, settle] = span(land - 0.08, 0.08).chain(0.06, 0.12, 0.14);

    stretch = stretch
      .to([1.14, 0.8], crouch, ease.out)
      .to([0.86, 1.22], push, ease.out)
      .to([0.96, 1.06], climb)
      .to([1, 1], top)
      .to([0.92, 1.1], brace)
      .to([1.26, 0.74], squash, ease.out)
      .to([0.95, 1.07], rebound, ease.out)
      .to([1, 1], settle, ease.pop);

    const lag = span(start + 0.22, 0.08);
    const wobble = span(land - 0.06, 0.06).chain(0.05, 0.08, 0.08, 0.08, 0.08);

    bulb = wobble.reduce(
      (t, beat, i) => t.to([-2, 6, -4, 2.5, -1, 0][i]!, beat, i < 2 ? ease.out : ease.inOut),
      bulb.to(5, lag).to(-5, lag.next(air), ease.inOut),
    );
  }

  return { body, stretch, bulb };
};

export interface Walk {
  /** A bob and a rock on each step, for Blip's `body`. */
  readonly body: readonly Layer[];
  /** The feet taking turns, for Blip's `feet`. */
  readonly feet: { readonly left: Layer; readonly right: Layer };
}

/** A waddle over `when`, in `steps` steps. Move Blip along with it: a linear offset over the same span. */
export const waddle = (when: Span, steps: number): Walk => {
  const step = when.over / steps;
  const half = step / 2;
  const each = Array.from({ length: steps }, (_, i) => i);
  const strides = each.map((i) => span(when.start + i * step, step));

  /** A rise and fall of `height` over each stride in `of`. */
  const bounce = (of: readonly number[], height: number, curve: Curve): Track<Vec> =>
    of.reduce((t, i) => {
      const rising = span(strides[i]!.start, half);

      return t.to(up(height), rising, curve).to(rest, rising.next(half), ease.in);
    }, track(rest));

  const rock = strides
    .reduce((t, stride, i) => t.to(i % 2 ? 5 : -5, stride, ease.inOut), track(0))
    .to(0, strides.at(-1)!.next(0.15));

  const foot = (side: number) => ({
    offset: bounce(
      each.filter((i) => i % 2 === side),
      -7,
      ease.out,
    ),
  });

  return {
    body: [{ offset: bounce(each, -5, ease.out) }, { rotate: rock }],
    feet: { left: foot(0), right: foot(1) },
  };
};
