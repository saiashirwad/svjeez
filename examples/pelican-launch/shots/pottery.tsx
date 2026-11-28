import {
  Group,
  Shape,
  alpha,
  arc,
  blur,
  circle,
  ease,
  emboss,
  noise,
  path,
  polygon,
  radial,
  random,
  rect,
  span,
  spline,
  track,
  type Geometry,
  type SceneElement,
  type Stops,
  type Vec,
} from "svjeez";
import { Caption, Chapter, H, W, horizon } from "../kit";
import { Pelican, type Look } from "../rig";

export const POTTERY = 7;

/**
 * A museum photograph of an Attic black-figure vase on black. The shoulder of the vessel spans the frame; under its
 * glazed lip runs a meander band, and under that a frieze of black-figure pelicans on bicycles. The vase turns slowly
 * so the frieze carries the riders forward, the lead rider cresting the top of the curve.
 */

const terracotta = "#C8743A";
const glaze = "#120B07";
const paper = "#EFE6D6";

const R = 1050;
const vase = horizon(330, R);
const [cx, cy] = vase.center;

/** Depths in from the lip, in px. */
const LIP = 36;
const KEY_TOP = R - 52;
const KEY = 28;
const GROUND = R - 282;

const look: Look = {
  line: glaze,
  width: 1.3,
  body: glaze,
  wing: glaze,
  primaries: glaze,
  beak: glaze,
  pouch: glaze,
  skin: glaze,
  leg: glaze,
  frame: glaze,
  metal: glaze,
  tyre: glaze,
  detail: true,
  incise: terracotta,
  far: 1,
};

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** A point at `deg` from the top of the vase (clockwise, screen right) and radius `r`, in the vase's own frame. */
const polar = (deg: number, r: number): Vec => [
  Math.round(r * Math.sin(rad(deg)) * 10) / 10,
  Math.round(-r * Math.cos(rad(deg)) * 10) / 10,
];

/** One meander unit, 10 by 10: up from the baseline, over, and spiralling in. x runs along the band, y inward. */
const KEY_UNIT: readonly Vec[] = [
  [0, 10],
  [0, 1],
  [8.5, 1],
  [8.5, 7.5],
  [3.2, 7.5],
  [3.2, 4],
  [5.8, 4],
];

/**
 * The meander bent onto the circle: every unit point is mapped to polar coordinates, so the key truly follows the
 * curve (a `pattern` can't bend). One path for the whole band.
 */
const meander = (): Geometry => {
  const k = KEY / 10;
  const unitDeg = ((10 * k) / KEY_TOP) * (180 / Math.PI);

  const at = (deg: number, x: number, y: number): Vec =>
    polar(deg + ((x * k) / KEY_TOP) * (180 / Math.PI), KEY_TOP - y * k);

  let p = path();

  for (let deg = -62; deg < 62; deg += unitDeg) {
    const [first, ...rest] = KEY_UNIT;

    p = p.moveTo(at(deg, first![0], first![1]));

    for (const [x, y] of rest) p = p.lineTo(at(deg, x, y));

    p = p
      .moveTo(at(deg, 0, 10))
      .lineTo(at(deg, 5, 10))
      .lineTo(at(deg, 10, 10));
  }

  return p;
};

/** A hairline crack: a random walk inward from `deg` at radius `r`, wandering a little side to side. */
const crack = (seed: number, deg: number, r: number, steps: number, reach: number): Vec[] => {
  const next = random(seed);
  const points: Vec[] = [polar(deg, r)];
  let d = deg;
  let rr = r;
  let drift = 0;

  for (let i = 0; i < steps; i++) {
    drift = drift * 0.6 + (next() - 0.5) * 1.6;
    d += drift * (60 / rr);
    rr -= reach * (0.6 + next() * 0.8);
    points.push(polar(d, rr));
  }

  return points;
};

const CRACKS: readonly Vec[][] = [
  crack(3, -20.5, R - 2, 14, 16),
  crack(8, 9.5, R - 1, 22, 15),
  crack(14, 24, R - 140, 9, 14),
  crack(21, -4, GROUND - 6, 6, 12),
  crack(30, 34, R - 3, 12, 18),
];

/** Small flakes where the glaze has chipped off the lip, showing the paler fired clay. */
const CHIPS: readonly Geometry[] = Array.from({ length: 9 }, (_, i) => {
  const next = random(100 + i);
  const deg = -40 + i * 9.5 + (next() - 0.5) * 5;
  const r = R - 4 - next() * 26;
  const size = 2.5 + next() * 5;

  return polygon(
    ...Array.from({ length: 7 }, (_, j): Vec => {
      const a = (j / 7) * Math.PI * 2;
      const s = size * (0.55 + next() * 0.6);
      const [x, y] = polar(deg, r);

      return [
        Math.round((x + s * Math.cos(a) * 1.6) * 10) / 10,
        Math.round((y + s * Math.sin(a)) * 10) / 10,
      ];
    }),
  );
});

/** An elliptical light: a radial gradient rx by ry around `at`, over a rect that covers the vase. */
const Light = ({
  at,
  rx,
  ry,
  stops,
  blend,
}: {
  readonly at: Vec;
  readonly rx: number;
  readonly ry: number;
  readonly stops: Stops;
  readonly blend?: "multiply" | "screen";
}): SceneElement => (
  <Shape
    geometry={circle(R + 2)}
    blend={blend}
    fill={radial({ center: [at[0] - cx, at[1] - cy], radius: [rx, ry], stops })}
  />
);

/** The fired body: terracotta, slow mottling from the kiln, fine grit, and the faint rings of the wheel. */
const Clay = (): SceneElement => (
  <Group>
    <Shape
      geometry={circle(R)}
      fill={[
        terracotta,
        {
          paint: noise({
            frequency: [0.007, 0.012],
            octaves: 4,
            seed: 12,
            ramp: [
              [0.3, "#7A3A18"],
              [0.62, alpha("#7A3A18", 0)],
            ],
          }),
          blend: "multiply",
          opacity: 0.4,
        },
        {
          paint: noise({
            frequency: 0.011,
            octaves: 3,
            seed: 5,
            ramp: [
              [0.55, alpha("#F0B07A", 0)],
              [0.8, "#F0B07A"],
            ],
          }),
          opacity: 0.35,
        },
        {
          paint: noise({
            frequency: 0.85,
            octaves: 2,
            seed: 9,
            ramp: [
              [0, "#3A1A0A"],
              [0.4, alpha("#3A1A0A", 0)],
            ],
          }),
          opacity: 0.35,
        },
        {
          paint: noise({
            frequency: 0.6,
            octaves: 1,
            seed: 2,
            ramp: [
              [0.72, alpha("#FFE2C0", 0)],
              [0.82, "#FFE2C0"],
            ],
          }),
          opacity: 0.25,
        },
      ]}
    />
    {Array.from({ length: 9 }, (_, i) => {
      const next = random(40 + i);
      const r = R - 100 - i * 30 - next() * 12;

      return (
        <Shape
          key={i}
          geometry={circle(r)}
          stroke={{
            color: alpha(i % 2 ? "#5A2A10" : "#F2B581", 0.06 + next() * 0.05),
            width: 1 + next() * 2,
          }}
        />
      );
    })}
  </Group>
);

/** The glazed lip: lustrous black, a little worn through in specks, lit as raised, with one long soft specular. */
const Lip = (): SceneElement => (
  <Group>
    <Shape
      geometry={arc({ radius: R - LIP / 2, start: -90 - 50, sweep: 100 })}
      stroke={{
        color: [
          glaze,
          {
            paint: noise({
              frequency: [0.35, 0.5],
              octaves: 2,
              seed: 17,
              ramp: [
                [0.66, alpha("#8C4A26", 0)],
                [0.74, "#8C4A26"],
              ],
            }),
            opacity: 0.8,
          },
        ],
        width: LIP,
      }}
      effects={[
        emboss({ light: { azimuth: 235, elevation: 38 }, depth: 4, radius: 6, specular: 0.35 }),
      ]}
    />
    <Shape
      geometry={arc({ radius: R - 11, start: -90 - 26, sweep: 24 })}
      stroke={{ color: "#FFF4E6", width: 4, cap: "round" }}
      opacity={0.42}
      effects={[blur(4)]}
    />
    <Shape
      geometry={arc({ radius: R - 11, start: -90 - 19, sweep: 10 })}
      stroke={{ color: "#FFFFFF", width: 1.6, cap: "round" }}
      opacity={0.5}
      effects={[blur(1.6)]}
    />
    <Shape geometry={circle(R)} stroke={{ color: alpha("#000000", 0.6), width: 1.5 }} />
  </Group>
);

/** Thin glaze rules that frame the bands. Circles, so they need not turn. */
const Rules = (): SceneElement => (
  <Group>
    {[
      [KEY_TOP + 5, 2.2],
      [KEY_TOP - KEY - 5, 2.2],
      [GROUND - 2, 4.5],
      [GROUND - 12, 2],
      [GROUND - 20, 2],
    ].map(([r, w]) => (
      <Shape key={r} geometry={circle(r!)} stroke={{ color: alpha(glaze, 0.92), width: w! }} />
    ))}
  </Group>
);

/** The lead rider sits near 0.45 W at the top of the curve; followers trail behind, lower on the shoulder. */
const RIDERS: readonly { readonly deg: number; readonly scale: number }[] = [
  { deg: -8.3, scale: 1.08 },
  { deg: -21, scale: 0.94 },
  { deg: -32.5, scale: 0.94 },
  { deg: -44, scale: 0.94 },
  { deg: -55.5, scale: 0.94 },
];

const TURN = 7;

/** Everything painted on the vase, turning with it about its axis. */
const Painted = (): SceneElement => (
  <Group rotate={track(0).to(TURN, span(0, POTTERY), ease.linear)} origin="own">
    <Shape
      geometry={meander()}
      stroke={{ color: glaze, width: 2.6, join: "sharp", cap: "square" }}
    />
    {RIDERS.map(({ deg, scale }, i) => (
      <Group key={i} rotate={deg} origin={{ frame: [0, 0] }}>
        <Group offset={[0, -GROUND]} scale={scale} origin="own">
          <Pelican look={look} phase={i * 1.9} />
        </Group>
      </Group>
    ))}
    {CHIPS.map((chip, i) => (
      <Group key={`chip-${i}`}>
        <Shape
          geometry={chip}
          fill="#B8693A"
          stroke={{ color: alpha("#3A1A0A", 0.6), width: 0.6 }}
        />
      </Group>
    ))}
    {CRACKS.map((points, i) => (
      <Group key={`crack-${i}`}>
        <Shape
          geometry={spline(points)}
          offset={[0.8, 0.9]}
          stroke={{ color: alpha("#F7C79A", 0.35), width: 0.7, cap: "round" }}
        />
        <Shape geometry={spline(points)} stroke={{ color: "#2A1208", width: 1.1, cap: "round" }} />
      </Group>
    ))}
  </Group>
);

/** The black of the museum: a faint warm bloom behind the shoulder, nothing else. */
const Backdrop = (): SceneElement => (
  <Group>
    <Shape geometry={rect(W, H)} fill="#060403" />
    <Shape
      geometry={rect(W, H)}
      fill={radial({
        center: [0.42 * W, 0.5 * H],
        radius: [0.5 * W, 0.42 * H],
        stops: [alpha("#3A2416", 0.55), alpha("#3A2416", 0)],
      })}
    />
  </Group>
);

export const Pottery = (): SceneElement => (
  <Group>
    <Backdrop />
    <Group offset={[cx, cy]}>
      <Clay />
      <Rules />
      <Painted />
      <Lip />
      {/* Key light from the upper left: falloff over the shoulder, then a warm sheen where it lands. */}
      <Light
        at={[0.36 * W, 0.42 * H]}
        rx={0.62 * W}
        ry={0.75 * H}
        blend="multiply"
        stops={[
          [0, "#FFFFFF"],
          [0.45, "#E9CDB2"],
          [0.8, "#6A4430"],
          [1, "#140C08"],
        ]}
      />
      <Light
        at={[0.33 * W, 0.5 * H]}
        rx={0.26 * W}
        ry={0.2 * H}
        blend="screen"
        stops={[alpha("#FFD9B0", 0.32), alpha("#FFD9B0", 0)]}
      />
    </Group>
    {/* The shared horizon: a catch-light on the rim of the vase. */}
    <Shape
      key="horizon"
      geometry={vase.visible(vase.reach)}
      offset={vase.center}
      stroke={{ color: "#E8B98A", width: 1.6 }}
    />
    <Shape
      geometry={rect(W, H)}
      fill={radial.across({
        shape: "ellipse",
        center: [0.44, 0.5],
        stops: [
          [0.55, alpha("#000000", 0)],
          [1, alpha("#000000", 0.85)],
        ],
      })}
    />
    <Chapter numeral="IV" medium="Black-figure" fill={paper} length={POTTERY} />
    <Caption when={[1.4, 4.2]} fill={paper} y={170}>
      Some days feel very old.
    </Caption>
  </Group>
);
