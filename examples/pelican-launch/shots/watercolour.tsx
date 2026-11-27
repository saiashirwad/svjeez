import {
  Group,
  Shape,
  alpha,
  blur,
  circle,
  displace,
  ease,
  ellipse,
  emboss,
  line,
  noise,
  pattern,
  radial,
  random,
  rect,
  span,
  track,
  type Color,
  type Paint,
  type PaintLayer,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Caption, Chapter, H, W, horizon } from "../kit";
import { Pelican } from "../rig";
import { watercolor } from "../looks";

export const WATERCOLOUR = 7;

const warmGrey = "#7A7164";
const PAPER: Color = "#F7F3EA";

/** The painted area, on a sheet with a wide margin: left, top, right, bottom. */
const PAD = { l: 40, t: 150, r: 40, b: 40 } as const;
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;

const ground = horizon(520, 1150);
const [cx, cy] = ground.center;
const R = ground.radius;
const RIDER_X = 0.45 * W;

const tooth: PaintLayer = {
  paint: noise({ frequency: 0.8, octaves: 4, seed: 8, ramp: ["#FFFDF780", "#FFFDF7"] }),
  effects: [
    emboss({
      light: { azimuth: 225, elevation: 52 },
      depth: 1.8,
      radius: 0.5,
      color: "#FFFDF7",
      specular: 0,
    }),
  ],
};

const paper = [PAPER, tooth, { paint: PAPER, opacity: 0.55 }] as const;

const rnd = random("watercolour");

/** A threshold of noise: pigment where the field is high, with a hard edge, as a bloom or backrun dries. */
const bloom = (
  seed: number,
  frequency: number | readonly [number, number],
  from: number,
  color: Color,
  opacity: number,
  rotate = 0,
): PaintLayer => ({
  paint: noise({
    frequency,
    octaves: 3,
    seed,
    rotate,
    ramp: [
      [from, alpha(color, 0)],
      [from + 0.035, alpha(color, 1)],
    ],
  }),
  opacity,
});

const wobble = (scale: number, seed: number) => [
  displace({ scale, frequency: 0.03, seed, octaves: 2 }),
];

const Sky = (): SceneElement => (
  <Group effects={wobble(5, 4)}>
    <Shape
      geometry={rect(W, H)}
      fill={[
        "#A9B7C4",
        { paint: linear90(["#7F93A8", "#B9C6D0", "#D9DFE0"]), opacity: 0.9 },
        bloom(11, 0.0045, 0.5, "#C9D3DB", 0.7),
        bloom(23, [0.006, 0.012], 0.55, "#7A8EA3", 0.38, 20),
        bloom(31, 0.0035, 0.6, "#E6EBEC", 0.6),
        {
          paint: noise({
            frequency: 0.012,
            octaves: 4,
            seed: 5,
            ramp: [
              [0.2, alpha("#6C7F94", 0)],
              [0.9, alpha("#6C7F94", 0.35)],
            ],
          }),
        },
      ]}
    />
  </Group>
);

function linear90(colors: readonly Color[]): Paint {
  return radial({
    center: [W / 2, 220],
    radius: [W * 0.8, 520],
    stops: colors.map((c, i) => [i / (colors.length - 1), c] as const),
  });
}

/** Brush marks on the hill: short flat strokes in greens and ochre that turn with it. */
const dabs = (() => {
  const out: SceneElement[] = [];
  const tones: Color[] = ["#5F8338", "#7FA044", "#C9A24A", "#456B2E", "#B98A3C", "#8FAE55"];

  for (let i = 0; i < 90; i += 1) {
    const deg = -36 + rnd() * 72;
    const depth = 6 + rnd() * rnd() * 230;
    const a = (deg * Math.PI) / 180;
    const r = R - depth;
    const p: Vec = [Math.round(r * Math.sin(a)), Math.round(-r * Math.cos(a))];

    out.push(
      <Shape
        key={i}
        geometry={ellipse(10 + rnd() * 34, 2 + rnd() * 5)}
        offset={p}
        rotate={deg + (rnd() - 0.5) * 24}
        origin="own"
        fill={alpha(tones[i % tones.length]!, 0.2 + rnd() * 0.3)}
      />,
    );
  }

  return out;
})();

/** Paper left unpainted behind the bird, as a painter masks the subject before the sky goes on. */
const Reserve = (): SceneElement => (
  <Group effects={wobble(12, 21)}>
    <Shape
      geometry={ellipse(230, 215)}
      offset={[RIDER_X + 20, 410]}
      fill={radial({
        center: [0, 0],
        radius: 230,
        stops: [
          [0, alpha("#F6F2E8", 0.95)],
          [0.6, alpha("#F1EEE6", 0.7)],
          [1, alpha("#F1EEE6", 0.22)],
        ],
      })}
    />
  </Group>
);

const Hill = (): SceneElement => (
  <Group offset={[cx, cy]}>
    <Group effects={wobble(4, 9)}>
      <Shape
        geometry={circle(R)}
        fill={[
          "#86A247",
          bloom(41, 0.01, 0.5, "#C9A24A", 0.6),
          bloom(43, [0.02, 0.006], 0.6, "#4F7A33", 0.35, -12),
          bloom(47, 0.006, 0.62, "#DDE5A8", 0.4),
        ]}
      />
      <Shape geometry={circle(R - 3)} stroke={{ color: alpha("#3C5F27", 0.55), width: 3 }} />
    </Group>
    <Group clip={circle(R - 8)}>
      <Group rotate={track(0).to(-5, span(0, WATERCOLOUR), ease.linear)} origin="own">
        {dabs}
      </Group>
    </Group>
  </Group>
);

/** One tile of slanted streaks that wrap in x, so the rain can slide down one tile height per loop without a seam. */
const rainTile = (w: number, h: number, count: number, tone: Color, width: number): Paint => {
  const streaks: SceneElement[] = [];
  const slant = 0.2;

  for (let i = 0; i < count; i += 1) {
    const x = Math.round(rnd() * w);
    const len = 20 + rnd() * 26;
    const y = Math.round(6 + rnd() * (h - len - 12));
    const op = 0.5 + rnd() * 0.5;

    for (const dx of [-w, 0, w]) {
      streaks.push(
        <Shape
          key={`${i}-${dx}`}
          geometry={line([x + dx, y], [Math.round(x + dx - len * slant), Math.round(y + len)])}
          stroke={{ color: alpha(tone, op), width, cap: "round" }}
        />,
      );
    }
  }

  return pattern({ size: [w, h], tile: <Group>{streaks}</Group> });
};

const Rain = ({
  w,
  h,
  count,
  tone,
  width,
  period,
  opacity,
}: {
  readonly w: number;
  readonly h: number;
  readonly count: number;
  readonly tone: Color;
  readonly width: number;
  readonly period: number;
  readonly opacity: number;
}): SceneElement => (
  <Shape
    geometry={rect(W + 2 * w, H + 2 * h)}
    offset={[-w, -h]}
    fill={rainTile(w, h, count, tone, width)}
    opacity={opacity}
    motion={{
      offset: track<Vec>([0, 0]).to([0, h], span(0, period), ease.linear).loop(period),
    }}
  />
);

const RIPPLES = [
  { x: 150, depth: 40, rx: 34, phase: 0 },
  { x: 380, depth: 78, rx: 44, phase: 0.5 },
  { x: 760, depth: 52, rx: 38, phase: 0.2 },
  { x: 1000, depth: 90, rx: 48, phase: 0.8 },
  { x: 1170, depth: 36, rx: 30, phase: 0.35 },
] as const;

const PERIOD = 1.4;

const Ripples = (): SceneElement => (
  <Group>
    {RIPPLES.map(({ x, depth, rx, phase }, i) => {
      const y = Math.round(ground.at(x).point[1] + depth);

      const grow = track(0.15)
        .to(1, span(0, PERIOD), ease.out)
        .loop(PERIOD, { phase: phase * PERIOD });

      const fade = track(0.95)
        .to(0, span(0, PERIOD), ease.out)
        .loop(PERIOD, { phase: phase * PERIOD });

      return (
        <Shape
          key={i}
          geometry={ellipse(rx, rx * 0.24)}
          offset={[x, y]}
          scale={grow}
          origin="own"
          opacity={fade}
          stroke={{ color: "#EEF3F0", width: 2 }}
        />
      );
    })}
  </Group>
);

const Rider = (): SceneElement => {
  const { point, angle } = ground.at(RIDER_X);
  const s = 1.6;

  return (
    <Group offset={[point[0], point[1] + 3]} rotate={angle} origin="own">
      <Shape
        geometry={ellipse(78, 6)}
        offset={[6, 4]}
        fill={alpha("#2F4A24", 0.4)}
        effects={[blur(6)]}
      />
      <Group blend="multiply" scale={s} origin="own" effects={wobble(0.5, 6)}>
        <Pelican look={watercolor} />
      </Group>
    </Group>
  );
};

/** The sheet's untouched margin, with a ragged inner edge where the washes stop. */
const Margin = (): SceneElement => {
  const m = 120;

  return (
    <Shape
      geometry={rect(PW + 2 * m, PH + 2 * m)}
      offset={[PAD.l - m, PAD.t - m]}
      stroke={{ color: paper, width: 2 * m, join: "sharp" }}
      effects={wobble(5, 17)}
    />
  );
};

/** Paper tooth over everything, so pigment settles into the dips of the sheet. */
const Granulation = (): SceneElement => (
  <Shape
    geometry={rect(W, H)}
    blend="multiply"
    opacity={0.4}
    fill={noise({
      frequency: 0.8,
      octaves: 4,
      seed: 8,
      ramp: [
        [0, "#B9AD97"],
        [0.5, "#F4EFE4"],
        [1, "#FFFFFF"],
      ],
    })}
  />
);

export const Watercolour = (): SceneElement => (
  <Group>
    <Shape geometry={rect(W, H)} fill={paper} />
    <Sky />
    <Reserve />
    <Rain w={190} h={170} count={9} tone="#7389A0" width={1} period={0.5} opacity={0.5} />
    <Hill />
    <Ripples />
    <Rider />
    <Rain w={230} h={210} count={12} tone="#6F849A" width={1.6} period={0.45} opacity={0.6} />
    <Margin />
    <Granulation />
    <Chapter numeral="VII" medium="Watercolour" fill={warmGrey} length={WATERCOLOUR} />
    <Caption when={[1.4, 4.2]} fill="#5E564B">
      Some days, it rains.
    </Caption>
  </Group>
);
