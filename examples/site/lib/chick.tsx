import {
  css,
  ease,
  motion,
  Pivot,
  type Color,
  type Motion,
  type PathData,
  type Span,
  type Stack,
  type TagChannels,
} from "svjeez";

// The chick from the site's favicon (site/public/favicon.svg), in the favicon's own coordinates: the body sits on y 162
// and is centered on x 104, the antenna bulb on 104,38. Scenes place it with a transform and bring their own motions,
// written on the clock around the chick, so a scene starts it with <Clip at> and never counts seconds inside it.
// Feet are drawn only when a scene gives them motions.

export const CHICK = {
  yellow: "#FFC21A",
  belly: "#F2A900",
  stem: "#E3A100",
  cheek: "#FF8C6B",
  ink: "#26262A",
  foot: "#F08A00",
} as const;

const EYES = [84, 124] as const;

/** Where the feet meet the ground, so a squash or a pop pivots about them. */
export const GROUND = { x: 104, y: 162 } as const;

/** The width and height of a squash, each on its own, as a motion can only scale both together. Add `SQUASH` to the scene's `css`. */
export const sx = css.property("sx", { syntax: "number", inherits: false, initial: 1 });
export const sy = css.property("sy", { syntax: "number", inherits: false, initial: 1 });

export const SQUASH = css`
  .sq {
    transform-box: view-box;
    transform-origin: 104px 162px;
    scale: ${sx} ${sy};
  }
`;

/** The antenna bulb, at rest. */
export const BULB = { x: 104, y: 38 } as const;

/** The antenna stem runs up under the bulb, so the bulb can travel 6px either way without showing the stem's end. */
const STEM: PathData = "M104 60V36";

type Layers = Stack<TagChannels<"g">>;

export interface ChickMotions {
  /** Times each blink starts, on the clock around the chick. A blink takes a quarter of a second. */
  readonly blinks?: readonly number[];
  /** Moves the whole chick: hops, walks and leans. */
  readonly body?: Layers;
  /** Breathes and crouches, scaling about the feet. */
  readonly squash?: Layers;
  /** Moves the eyes and their glints inside the face: looking around. */
  readonly look?: Motion<"x" | "y">;
  /** Moves the bulb on its stem. Keep it within 6px, or the stem shows its end. */
  readonly bulb?: Motion<"y">;
  /** Squashes and stretches about the feet, each way on its own: `sx` is the width and `sy` the height. */
  readonly stretch?: Motion<typeof sx | typeof sy>;
  /** Recolors the bulb. */
  readonly glow?: Motion<"fill">;
  /** Draws feet under the body. */
  readonly feet?: { readonly left?: Layers; readonly right?: Layers };
  /** The cheeks' color. */
  readonly cheek?: Color;
}

export const chick = ({
  blinks = [],
  body,
  squash,
  stretch,
  look,
  bulb,
  glow,
  feet,
  cheek = CHICK.cheek,
}: ChickMotions = {}) => {
  // A blink swaps the open eye for a shut one, which costs a few bytes of keyframes where a morph costs a kilobyte.
  const open = blinks.reduce(
    (m, at) => m.at(at).to({ opacity: 0 }, 0.04).wait(0.12).to({ opacity: 1 }, 0.08),
    motion({ opacity: 1 }),
  );

  const shut = blinks.reduce(
    (m, at) => m.at(at).to({ opacity: 1 }, 0.04).wait(0.12).to({ opacity: 0 }, 0.08),
    motion({ opacity: 0 }),
  );

  const eye = (cx: number) => (
    <>
      <g animation={blinks.length > 0 ? open : undefined}>
        <ellipse cx={cx} cy={110} rx={7} ry={9} fill={CHICK.ink} />
        <circle cx={cx + 2} cy={106} r={2.4} fill="#FFF" />
      </g>
      {blinks.length > 0 && (
        <ellipse cx={cx} cy={112} rx={7.5} ry={1.6} fill={CHICK.ink} animation={shut} />
      )}
    </>
  );

  const foot = (cx: number, layers?: Layers) => (
    <ellipse cx={cx} cy={162} rx={12} ry={6} fill={CHICK.foot} animation={layers} />
  );

  return (
    <g animation={body}>
      <Pivot origin={GROUND} animation={squash}>
        <g class={stretch ? "sq" : undefined} animation={stretch}>
          {feet && (
            <>
              {foot(84, feet.left)}
              {foot(124, feet.right)}
            </>
          )}
          <path d={STEM} stroke={CHICK.stem} strokeWidth={7} strokeLinecap="round" />
          <circle cx={BULB.x} cy={BULB.y} r={9} fill={CHICK.yellow} animation={[bulb, glow]} />
          <path
            d="M38 150C38 94 68 60 104 60S170 94 170 150C170 158 165 162 157 162H51C43 162 38 158 38 150Z"
            fill={CHICK.yellow}
          />
          <path
            d="M38 150C38 158 43 162 51 162H157C165 162 170 158 170 150C170 146 170 143 169 140C160 148 150 150 104 150S48 148 39 140C38 143 38 146 38 150Z"
            fill={CHICK.belly}
          />
          <ellipse cx={66} cy={124} rx={9} ry={6} fill={cheek} opacity={0.55} />
          <ellipse cx={142} cy={124} rx={9} ry={6} fill={cheek} opacity={0.55} />
          <g animation={look}>{EYES.map(eye)}</g>
          <path
            d="M97 124Q104 131 111 124"
            fill="none"
            stroke={CHICK.ink}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
        </g>
      </Pivot>
    </g>
  );
};

export interface Hop {
  /** When the feet land, in seconds on the clock around the chick. */
  readonly land: number;
  /** How high the chick rises, in its own units. */
  readonly height: number;
}

export interface Jumps {
  /** The chick's rise and fall. */
  readonly body: Motion<"y">;
  /** The squash before the leap, the stretch in the air, and the squash on landing. */
  readonly stretch: Motion<typeof sx | typeof sy>;
  /** The bulb lags the body on its stem, then wobbles to rest after the landing. */
  readonly bulb: Motion<"y">;
  /** The pad under the chick pressing down and springing back. */
  readonly press: Motion<"y">;
}

/** How long a hop of `height` takes from the start of the crouch to the landing. */
export const hopTime = (height: number) =>
  0.3 + 0.4 * Math.sqrt(Math.min(1, Math.max(0.25, height / 64)));

/**
 * Hops, each landing at its own time: a crouch, a launch, a little air and a squashy landing with a rebound. A hop
 * starts and ends at rest, so a chick standing still can hand over to one that hops, and the hops must be at least
 * a second apart.
 */
export const jumps = (hops: readonly Hop[]): Jumps => {
  let body = motion({ y: 0 });
  let stretch = motion({ [sx]: 1, [sy]: 1 });
  let bulb = motion({ y: 0 });
  let press = motion({ y: 0 });

  for (const { land, height } of hops) {
    const air = 0.2 * Math.sqrt(Math.min(1, Math.max(0.25, height / 64)));
    const start = land - hopTime(height);

    body = body
      .at(start + 0.3)
      .to({ y: -height }, air, ease.out)
      .to({ y: 0 }, air, ease.in);

    stretch = stretch
      .at(start)
      .to({ [sx]: 1.14, [sy]: 0.8 }, 0.22, ease.out)
      .to({ [sx]: 0.86, [sy]: 1.22 }, 0.08, ease.out)
      .to({ [sx]: 0.96, [sy]: 1.06 }, air / 2)
      .to({ [sx]: 1, [sy]: 1 }, air / 2)
      .at(land - 0.08)
      .to({ [sx]: 0.92, [sy]: 1.1 }, 0.08)
      .to({ [sx]: 1.26, [sy]: 0.74 }, 0.06, ease.out)
      .to({ [sx]: 0.95, [sy]: 1.07 }, 0.12, ease.out)
      .to({ [sx]: 1, [sy]: 1 }, 0.14, ease.pop);

    bulb = bulb
      .at(start + 0.22)
      .to({ y: 5 }, 0.08)
      .to({ y: -5 }, air, ease.inOut)
      .at(land - 0.06)
      .to({ y: -2 }, 0.06)
      .to({ y: 6 }, 0.05, ease.out)
      .to({ y: -4 }, 0.08, ease.inOut)
      .to({ y: 2.5 }, 0.08, ease.inOut)
      .to({ y: -1 }, 0.08, ease.inOut)
      .to({ y: 0 }, 0.08, ease.inOut);

    press = press
      .at(start)
      .to({ y: 3.5 }, 0.22, ease.out)
      .to({ y: -2 }, 0.08, ease.out)
      .to({ y: 0 }, 0.1)
      .at(land)
      .to({ y: 7 }, 0.06, ease.out)
      .to({ y: -1.5 }, 0.12, ease.out)
      .to({ y: 0 }, 0.1, ease.inOut);
  }

  return { body, stretch, bulb, press };
};

export interface Walk {
  readonly body: readonly Motion<"x" | "y" | "rotate">[];
  readonly feet: { readonly left: Motion<"y">; readonly right: Motion<"y"> };
}

/** A waddle by (`dx`, `dy`) over `span`: a bob and a rock on each step, and the feet taking turns. */
export const waddle = (span: Span, dx: number, dy: number, steps: number): Walk => {
  const { at, over } = span;
  const step = over / steps;

  const travel = motion({ x: 0, y: 0 }).to({ x: dx, y: dy }, span, ease.linear);

  let bob = motion({ y: 0 }).at(at);
  let rock = motion({ rotate: 0 }).at(at);
  let left = motion({ y: 0 }).at(at);
  let right = motion({ y: 0 }).at(at);

  const lift = (m: Motion<"y">, mine: boolean) =>
    mine ? m.to({ y: -7 }, step / 2, ease.out).to({ y: 0 }, step / 2, ease.in) : m.wait(step);

  for (let i = 0; i < steps; i++) {
    bob = bob.to({ y: -5 }, step / 2, ease.out).to({ y: 0 }, step / 2, ease.in);
    rock = rock.to({ rotate: i % 2 ? 5 : -5 }, step, ease.inOut);

    left = lift(left, i % 2 === 0);
    right = lift(right, i % 2 === 1);
  }

  rock = rock.to({ rotate: 0 }, 0.15);

  return { body: [travel, bob, rock], feet: { left, right } };
};

/** Hops from the top of one box to the top of the next, landing a beat on each: x glides, y arcs over. */
export const hopAcross = (
  tops: readonly { x: number; y: number }[],
  at: number,
  flight = 0.55,
  rest = 0.3,
) => {
  let x = motion({ x: tops[0]!.x });
  let y = motion({ y: tops[0]!.y });
  let t = at;

  for (let i = 1; i < tops.length; i++) {
    const [a, b] = [tops[i - 1]!, tops[i]!];
    const apex = Math.min(a.y, b.y) - 36;
    x = x.at(t).to({ x: b.x }, flight, ease.inOut);
    y = y
      .at(t)
      .to({ y: apex }, flight / 2, ease.out)
      .to({ y: b.y }, flight / 2, ease.in);
    t += flight + rest;
  }

  return { animation: [x, y], end: t - rest };
};
