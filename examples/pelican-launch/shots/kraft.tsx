import {
  Group,
  Shape,
  alpha,
  circle,
  ease,
  keyframes,
  moved,
  none,
  noise,
  path,
  random,
  rect,
  span,
  track,
  type Color,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Caption, Chapter, H, W, horizon } from "../kit";
import { Pelican, type Look } from "../rig";

export const KRAFT = 7;

const ink = "#3A2517";
const cream = "#FBF5E6";

/** A flat, screen-printed pelican: solid inks with a little grain, a brown keyline, red-orange bike. */
const grainy = (light: Color, dark: Color, seed: number): Paint =>
  noise({
    frequency: [0.45, 0.9],
    octaves: 2,
    seed,
    rotate: 20,
    ramp: [
      [0.3, dark],
      [0.55, light],
      [0.75, light],
    ],
  });

const print: Look = {
  line: ink,
  width: 0.9,
  body: grainy(cream, "#E2D6BA", 11),
  wing: grainy("#F8F1DF", "#E6DABF", 12),
  primaries: "#1D1916",
  beak: "#F08A24",
  pouch: "#D8481F",
  skin: "#F3A24E",
  leg: "#E8741E",
  frame: "#D9482B",
  metal: "#6B4A33",
  tyre: "#2A211B",
  detail: false,
  far: 0.85,
};

/** The plate that printed slightly off register: an off-white body shape, shifted. */
const underprint: Look = {
  line: "#E9D9AE",
  width: 1.4,
  body: "#EADBB4",
  wing: "#EADBB4",
  primaries: "#EADBB4",
  beak: none,
  frame: none,
  tyre: none,
  detail: false,
};

const ground = horizon(486, 2400);
const [cx, cy] = ground.center;
const R = ground.radius;
const SOIL = 104;

const polar = (deg: number, r: number): Vec => {
  const a = (deg * Math.PI) / 180;

  return [Math.round(r * Math.sin(a) * 10) / 10, Math.round(-r * Math.cos(a) * 10) / 10];
};

const grass = random("kraft-grass");
const rnd = () => grass();

/** One tuft: a fan of blades that lean off the rim. */
const Tuft = ({ deg, size, tone }: { deg: number; size: number; tone: Color }): SceneElement => {
  const blades = 5;
  let p = path();

  for (let i = 0; i < blades; i += 1) {
    const lean = (i - (blades - 1) / 2) * 0.5 + (rnd() - 0.5) * 0.3;
    const h = size * (0.7 + rnd() * 0.5) * (1 - Math.abs(i - 2) * 0.12);
    p = p
      .moveTo([i * 2.2 - 4.4 - 1.4, 2])
      .quadTo([i * 2.2 - 4.4 + lean * 5, -h * 0.55], [i * 2.2 - 4.4 + lean * h * 0.5, -h]);
    p = p.quadTo([i * 2.2 - 4.4 + lean * 3 + 1.2, -h * 0.5], [i * 2.2 - 4.4 + 1.4, 2]);
  }

  return (
    <Group offset={[...polar(deg, R + 2)]} rotate={deg}>
      <Shape geometry={p} fill={tone} />
    </Group>
  );
};

const tufts = (() => {
  const out: SceneElement[] = [];
  const tones: Color[] = ["#3F6B2F", "#4F7C38", "#2F5527", "#648F43"];

  for (let deg = -26, i = 0; deg <= 26; deg += 0.55 + rnd() * 0.7, i += 1) {
    out.push(
      <Tuft key={i} deg={deg} size={9 + rnd() * 16} tone={tones[i % tones.length] ?? tones[0]!} />,
    );
  }

  return out;
})();

/** Flecks of darker pigment stippled along the edge of the grass and the soil line. */
const Stipple = ({ r, tone, width }: { r: number; tone: Color; width: number }): SceneElement => (
  <Shape geometry={circle(r)} stroke={{ color: tone, width, dash: [1.2, 5.5], cap: "round" }} />
);

/** The hill: flat grass and soil circles that turn slowly about their center, so tufts slide under the riders. */
const Hill = (): SceneElement => (
  <Group offset={[cx, cy]}>
    <Group rotate={track(0).to(-4.2, span(0, KRAFT), ease.linear)} origin="own">
      <Shape geometry={circle(R)} fill="#7DA14E" />
      <Stipple r={R - 3} tone="#3C6A2C" width={7} />
      <Stipple r={R - 10} tone="#4A7A34" width={5} />
      <Stipple r={R - 22} tone="#4C7C36" width={4} />
      <Shape geometry={circle(R - SOIL)} fill="#9A6A42" />
      <Stipple r={R - SOIL + 4} tone="#5A3A20" width={8} />
      <Stipple r={R - SOIL - 8} tone="#6E4527" width={6} />
      <Stipple r={R - SOIL + 14} tone="#3C6A2C" width={4} />
      {tufts}
    </Group>
  </Group>
);

/** Printed grain over the hill: mottled pigment in the grass, gritty soil. Static, clipped to the hill. */
const HillGrain = (): SceneElement => (
  <Group clip={moved(circle(R), [cx, cy])} blend="multiply">
    <Shape
      geometry={rect(W + 160, H - 470)}
      offset={[-80, 470]}
      fill={[
        {
          paint: noise({
            frequency: [0.06, 0.2],
            octaves: 4,
            seed: 31,
            ramp: [
              [0.3, "#7F9A62"],
              [0.6, "#E8EED8"],
              [0.8, "#FFFFFF"],
            ],
          }),
        },
      ]}
      opacity={0.5}
    />
    <Shape
      geometry={rect(W + 160, H - 470)}
      offset={[-80, 470]}
      fill={noise({
        frequency: 0.9,
        octaves: 1,
        seed: 7,
        ramp: [
          [0.45, "#6A5036"],
          [0.62, "#FFFFFF"],
        ],
      })}
      opacity={0.55}
    />
  </Group>
);

/** Tan kraft: fibres running one way, a second coarser set across, pulp mottling and dark flecks. */
const KraftPaper = (): SceneElement => (
  <Group>
    <Shape
      geometry={rect(W + 200, H + 200)}
      offset={[-100, -100]}
      fill={[
        "#CDB98F",
        {
          paint: noise({
            frequency: [0.012, 0.35],
            octaves: 3,
            seed: 3,
            rotate: -8,
            ramp: [
              [0.3, "#B49E70"],
              [0.55, alpha("#CDB98F", 0)],
              [0.75, "#E2D2AC"],
            ],
          }),
          opacity: 0.6,
        },
        {
          paint: noise({
            frequency: [0.02, 0.6],
            octaves: 2,
            seed: 9,
            rotate: 62,
            ramp: [
              [0.35, "#A98F5E"],
              [0.6, alpha("#CDB98F", 0)],
            ],
          }),
          opacity: 0.2,
        },
        {
          paint: noise({
            frequency: 0.004,
            octaves: 3,
            seed: 17,
            ramp: [
              [0.3, "#BBA676"],
              [0.7, alpha("#D8C69C", 0)],
            ],
          }),
          opacity: 0.5,
        },
        {
          paint: noise({
            frequency: 0.55,
            octaves: 1,
            seed: 23,
            ramp: [
              [0.68, alpha("#5B4326", 0)],
              [0.74, "#5B4326"],
            ],
          }),
          opacity: 0.5,
        },
        {
          paint: noise({
            frequency: [0.3, 0.05],
            octaves: 1,
            seed: 41,
            rotate: 35,
            ramp: [
              [0.64, alpha("#F0E4C4", 0)],
              [0.72, "#F0E4C4"],
            ],
          }),
          opacity: 0.22,
        },
      ]}
    />
  </Group>
);

/** Paper tooth over everything, so inks sit in the sheet rather than on it. */
const Tooth = (): SceneElement => (
  <Shape
    geometry={rect(W + 200, H + 200)}
    offset={[-100, -100]}
    blend="multiply"
    opacity={0.5}
    fill={noise({
      frequency: 0.75,
      octaves: 2,
      seed: 52,
      ramp: [
        [0.25, "#BDAE92"],
        [0.55, "#F6F0E2"],
        [0.7, "#FFFFFF"],
      ],
    })}
  />
);

const riders = [
  { x: 206, scale: 1.42, period: 1.3, lift: 1.4, phase: 0 },
  { x: 576, scale: 1.55, period: 1, lift: 1.9, phase: 0.35 },
  { x: 946, scale: 1.34, period: 1.7, lift: 1.1, phase: 0.8 },
] as const;

/** Each rider bobs on their own period, so the identical pedalling does not read as a clone. */
const bob = (period: number, lift: number, phase: number) =>
  keyframes([
    [0, [0, 0]],
    [period * 0.5, [0, -lift], ease.inOut],
    [period, [0, 0], ease.inOut],
  ]).loop(period, { phase });

const Rider = ({ x, scale, period, lift, phase }: (typeof riders)[number]): SceneElement => {
  const { point, angle } = ground.at(x);

  return (
    <Group offset={[point[0], point[1] + 2]} rotate={angle} origin="own">
      <Group scale={scale} origin="own" motion={{ offset: bob(period, lift, phase) }}>
        <Group offset={[2.2, 1.6]} opacity={0.9}>
          <Pelican look={underprint} phase={x / 97} />
        </Group>
        <Pelican look={print} phase={x / 97} />
      </Group>
    </Group>
  );
};

export const Kraft = (): SceneElement => (
  <Group>
    <Group
      motion={{
        offset: track<Vec>([6, 0]).to([-14, 5], span(0, KRAFT), ease.linear),
      }}
    >
      <KraftPaper />
      <Hill />
      <HillGrain />
      {/* The shared horizon: the grass line, drifting with the hill it edges; `share` tweens it in scene space. */}
      <Shape
        key="horizon"
        geometry={ground.visible(ground.reach)}
        offset={ground.center}
        stroke={{ color: "#3C6A2C", width: 4 }}
      />
      {riders.map((r) => (
        <Rider key={r.x} {...r} />
      ))}
    </Group>
    <Tooth />
    <Chapter numeral="V" medium="Screen print" fill={ink} length={KRAFT} />
    <Caption when={[1.4, 4.2]} fill={ink}>
      Some days, friends come along.
    </Caption>
  </Group>
);
