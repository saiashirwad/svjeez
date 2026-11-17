import {
  chain,
  css,
  ease,
  motion,
  Pivot,
  span,
  type Color,
  type Ease,
  type Motion,
  type PathData,
  type Span,
  type Spanned,
  type Stack,
  type TagChannels,
} from "svjeez";

export const BLIP = {
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

export interface BlipMotions {
  /** Times each blink starts, on the clock around Blip. A blink takes a quarter of a second. */
  readonly blinks?: readonly number[];
  /** Moves the whole blip: hops, walks and leans. */
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

export const blip = ({
  blinks = [],
  body,
  squash,
  stretch,
  look,
  bulb,
  glow,
  feet,
  cheek = BLIP.cheek,
}: BlipMotions = {}) => {
  const open = blinks.reduce(
    (m, at) =>
      m.to({ opacity: 0 }, span(at, 0.04)).to({ opacity: 1 }, span(at, 0.04).next(0.08, 0.12)),
    motion({ opacity: 1 }),
  );

  const shut = blinks.reduce(
    (m, at) =>
      m.to({ opacity: 1 }, span(at, 0.04)).to({ opacity: 0 }, span(at, 0.04).next(0.08, 0.12)),
    motion({ opacity: 0 }),
  );

  const eye = (cx: number) => (
    <>
      <g animation={blinks.length > 0 ? open : undefined}>
        <ellipse cx={cx} cy={110} rx={7} ry={9} fill={BLIP.ink} />
        <circle cx={cx + 2} cy={106} r={2.4} fill="#FFF" />
      </g>
      {blinks.length > 0 && (
        <ellipse cx={cx} cy={112} rx={7.5} ry={1.6} fill={BLIP.ink} animation={shut} />
      )}
    </>
  );

  const foot = (cx: number, layers?: Layers) => (
    <ellipse cx={cx} cy={162} rx={12} ry={6} fill={BLIP.foot} animation={layers} />
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
          <path d={STEM} stroke={BLIP.stem} strokeWidth={7} strokeLinecap="round" />
          <circle cx={BULB.x} cy={BULB.y} r={9} fill={BLIP.yellow} animation={[bulb, glow]} />
          <path
            d="M38 150C38 94 68 60 104 60S170 94 170 150C170 158 165 162 157 162H51C43 162 38 158 38 150Z"
            fill={BLIP.yellow}
          />
          <path
            d="M38 150C38 158 43 162 51 162H157C165 162 170 158 170 150C170 146 170 143 169 140C160 148 150 150 104 150S48 148 39 140C38 143 38 146 38 150Z"
            fill={BLIP.belly}
          />
          <ellipse cx={66} cy={124} rx={9} ry={6} fill={cheek} opacity={0.55} />
          <ellipse cx={142} cy={124} rx={9} ry={6} fill={cheek} opacity={0.55} />
          <g animation={look}>{EYES.map(eye)}</g>
          <path
            d="M97 124Q104 131 111 124"
            fill="none"
            stroke={BLIP.ink}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
        </g>
      </Pivot>
    </g>
  );
};

export interface Hop {
  /** When the feet land, in seconds on the clock around Blip. */
  readonly land: number;
  /** How high Blip rises, in its own units. */
  readonly height: number;
}

export interface Jumps {
  /** Blip's rise and fall. */
  readonly body: Motion<"y">;
  /** The squash before the leap, the stretch in the air, and the squash on landing. */
  readonly stretch: Motion<typeof sx | typeof sy>;
  /** The bulb lags the body on its stem, then wobbles to rest after the landing. */
  readonly bulb: Motion<"y">;
  /** The pad under Blip pressing down and springing back. */
  readonly press: Motion<"y">;
}

/** How long a hop of `height` takes from the start of the crouch to the landing. */
export const hopTime = (height: number) =>
  0.3 + 0.4 * Math.sqrt(Math.min(1, Math.max(0.25, height / 64)));

/** When a hop is in the air: from leaving the ground, after the crouch, to the landing. */
export const flight = ({ land, height }: Hop): Spanned =>
  span(land - hopTime(height) + 0.3).until(land);

/**
 * Hops, each landing at its own time: a crouch, a launch, a little air and a squashy landing with a rebound. A hop
 * starts and ends at rest, so Blip standing still can hand over to one that hops, and the hops must be at least
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

    const rise = span(start + 0.3, air);
    const crouch = span(start, 0.22);
    const push = crouch.next(0.08);

    body = body.to({ y: -height }, rise, ease.out).to({ y: 0 }, rise.next(air), ease.in);

    const [, up, top] = chain(push, air / 2, air / 2);
    const [brace, squash, rebound, settle] = chain(span(land - 0.08, 0.08), 0.06, 0.12, 0.14);

    stretch = stretch
      .to({ [sx]: 1.14, [sy]: 0.8 }, crouch, ease.out)
      .to({ [sx]: 0.86, [sy]: 1.22 }, push, ease.out)
      .to({ [sx]: 0.96, [sy]: 1.06 }, up)
      .to({ [sx]: 1, [sy]: 1 }, top)
      .to({ [sx]: 0.92, [sy]: 1.1 }, brace)
      .to({ [sx]: 1.26, [sy]: 0.74 }, squash, ease.out)
      .to({ [sx]: 0.95, [sy]: 1.07 }, rebound, ease.out)
      .to({ [sx]: 1, [sy]: 1 }, settle, ease.pop);

    const lag = span(start + 0.22, 0.08);
    const wobble = chain(span(land - 0.06, 0.06), 0.05, 0.08, 0.08, 0.08, 0.08);

    bulb = wobble.reduce(
      (m, beat, i) => m.to({ y: [-2, 6, -4, 2.5, -1, 0][i]! }, beat, i < 2 ? ease.out : ease.inOut),
      bulb.to({ y: 5 }, lag).to({ y: -5 }, lag.next(air), ease.inOut),
    );

    const [hit, recoil, still] = chain(span(land, 0.06), 0.12, 0.1);

    press = press
      .to({ y: 3.5 }, crouch, ease.out)
      .to({ y: -2 }, push, ease.out)
      .to({ y: 0 }, push.next(0.1))
      .to({ y: 7 }, hit, ease.out)
      .to({ y: -1.5 }, recoil, ease.out)
      .to({ y: 0 }, still, ease.inOut);
  }

  return { body, stretch, bulb, press };
};

export interface Walk {
  readonly body: readonly Motion<"x" | "y" | "rotate">[];
  readonly feet: { readonly left: Motion<"y">; readonly right: Motion<"y"> };
}

/** A waddle by (`dx`, `dy`) over `span`: a bob and a rock on each step, and the feet taking turns. */
export const waddle = (span: Span, dx: number, dy: number, steps: number): Walk => {
  const step = span.over / steps;
  const half = step / 2;
  const each = Array.from({ length: steps }, (_, i) => i);

  /** Spans end to end from the start of the walk, one per length. */
  const from = (lengths: readonly number[]) =>
    chain({ at: span.at, over: lengths[0]! }, ...lengths.slice(1));

  const travel = motion({ x: 0, y: 0 }).to({ x: dx, y: dy }, span, ease.linear);

  const halves = from(each.flatMap(() => [half, half]));

  const bob = each.reduce(
    (m, i) => m.to({ y: -5 }, halves[2 * i]!, ease.out).to({ y: 0 }, halves[2 * i + 1]!, ease.in),
    motion({ y: 0 }),
  );

  const strides = from(each.map(() => step));

  const rock = strides
    .reduce(
      (m, stride, i) => m.to({ rotate: i % 2 ? 5 : -5 }, stride, ease.inOut),
      motion({ rotate: 0 }),
    )
    .to({ rotate: 0 }, strides[steps - 1]!.next(0.15));

  const foot = (side: number) => {
    const moves = each.flatMap((i): { over: number; y?: number; curve?: Ease }[] =>
      i % 2 === side
        ? [
            { y: -7, over: half, curve: ease.out },
            { y: 0, over: half, curve: ease.in },
          ]
        : [{ over: step }],
    );

    const beats = from(moves.map((move) => move.over));

    return moves.reduce(
      (m, move, k) => (move.y === undefined ? m : m.to({ y: move.y }, beats[k]!, move.curve)),
      motion({ y: 0 }),
    );
  };

  return { body: [travel, bob, rock], feet: { left: foot(0), right: foot(1) } };
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
    x = x.to({ x: b.x }, span(t, flight), ease.inOut);
    y = y
      .to({ y: apex }, span(t, flight / 2), ease.out)
      .to({ y: b.y }, span(t, flight / 2).next(flight / 2), ease.in);
    t += flight + rest;
  }

  return { animation: [x, y], end: t - rest };
};
