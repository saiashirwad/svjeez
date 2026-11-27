import {
  Group,
  Shape,
  alpha,
  arc,
  circle,
  ease,
  ellipse,
  emboss,
  line,
  merge,
  moved,
  noise,
  pattern,
  polygon,
  radial,
  rect,
  rotated,
  shadow,
  subtract,
  span,
  track,
  type Color,
  type Geometry,
  type Paint,
  type Paints,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Caption, Chapter, H, W, horizon } from "../kit";
import { Pelican, type Look } from "../rig";

export const LACE = 7;

/**
 * Antique needle lace on black velvet, shot macro: the top of a round doily with a picot edge, a band of wheels on a
 * hexagonal net, and two lace pelicans facing each other in the open centre.
 */

const cream: Color = "#E9E1CC";
const ecru: Color = "#CFC4A8";
const velvet: Color = "#0A0809";

const doily = horizon(392, 1100);
const [cx, cy] = doily.center;
const R = doily.radius;

/** A point on a circle of radius `r` around the doily centre, `deg` clockwise from +x (top is -90). */
const polar = (r: number, deg: number): Vec => {
  const a = (deg * Math.PI) / 180;

  return [r * Math.cos(a), r * Math.sin(a)];
};

/** Degrees either side of the top that cover the frame, with some spare for the push-in. */
const REACH = 37;

/** Thread: cream with a fibre noise multiplied over it, so twisted thread reads at macro distance. */
const thread = (seed: number): Paints => [
  cream,
  {
    paint: noise({
      frequency: [0.9, 0.35],
      octaves: 2,
      seed,
      rotate: 35,
      ramp: [
        [0.25, "#8F8670"],
        [0.75, "#FFFFFF"],
      ],
    }),
    blend: "multiply",
    opacity: 0.55,
  },
];

/** Pointy-top honeycomb net of cell radius `s` in thread `width`, as one tile. */
const hexNet = (s: number, width: number, color: Color, rotate = 0): Paint => {
  const w = Math.sqrt(3) * s;

  const hex = (c: Vec): Geometry =>
    polygon(
      ...Array.from({ length: 6 }, (_, i): Vec => {
        const a = ((-90 + i * 60) * Math.PI) / 180;

        return [c[0] + s * Math.cos(a), c[1] + s * Math.sin(a)];
      }),
    );

  const cells = merge(
    hex([0, 0]),
    hex([w, 0]),
    hex([w / 2, 1.5 * s]),
    hex([0, 3 * s]),
    hex([w, 3 * s]),
  );

  return pattern({
    size: [w, 3 * s],
    rotate,
    tile: <Shape geometry={cells} stroke={{ color, width, join: "round" }} />,
  });
};

/** Close parallel threads, like cloth stitch. */
const clothStitch = (gap: number, width: number, color: Color, rotate: number): Paint =>
  pattern({
    size: [gap, gap],
    rotate,
    tile: <Shape geometry={line([0, gap / 2], [gap, gap / 2])} stroke={{ color, width }} />,
  });

// ── the doily ───────────────────────────────────────────────────────────────

const SCALLOP = 2.5;

const scallops = Array.from(
  { length: Math.floor(REACH / SCALLOP) * 2 + 1 },
  (_, i) => -90 + (i - Math.floor(REACH / SCALLOP)) * SCALLOP,
);

const bite = (R * SCALLOP * Math.PI) / 180 / 2;

/** The scalloped edge: a buttonholed arc per scallop, a second inner arc, and three picot loops on each. */
const edge = merge(
  ...scallops.map((deg) =>
    moved(arc({ radius: bite, start: deg - 90, sweep: 180 }), polar(R, deg)),
  ),
);

const edgeInner = merge(
  ...scallops.map((deg) =>
    moved(arc({ radius: bite - 5, start: deg - 80, sweep: 160 }), polar(R, deg)),
  ),
);

const picots = merge(
  ...scallops.flatMap((deg) =>
    [-55, 0, 55].map((turn) => {
      const [px, py] = polar(R, deg);
      const [dx, dy] = polar(bite + 3.6, deg + turn);

      return moved(circle(3.4), [px + dx, py + dy]);
    }),
  ),
);

const ring = (r: number): Geometry => arc({ radius: r, start: -90 - REACH, sweep: REACH * 2 });

const WHEEL = 6;
const BAND = R - 46;

const wheels = Array.from(
  { length: Math.floor(REACH / WHEEL) * 2 + 1 },
  (_, i) => -90 + (i - Math.floor(REACH / WHEEL)) * WHEEL,
);

/** One needle-lace wheel: two rings, sixteen spokes, eight petals and a raised boss, all in its own frame. */
const wheelRings = merge(circle(25), circle(22), circle(8.5));

const wheelSpokes = merge(
  ...Array.from({ length: 16 }, (_, i) => {
    const [ax, ay] = polar(8.5, i * 22.5);
    const [bx, by] = polar(22, i * 22.5);

    return line([ax, ay], [bx, by]);
  }),
);

const wheelPetals = merge(
  ...Array.from({ length: 8 }, (_, i) =>
    moved(rotated(ellipse(6.2, 3), i * 45 + 22.5), polar(15.2, i * 45 + 22.5)),
  ),
);

const placed = (geometry: Geometry): Geometry =>
  merge(...wheels.map((deg) => moved(rotated(geometry, deg + 90), polar(BAND, deg))));

/** Small raised dots (point d'esprit) between the wheels. */
const esprits = merge(
  ...wheels
    .slice(0, -1)
    .flatMap((deg) => [
      moved(circle(2.6), polar(BAND - 15, deg + WHEEL / 2)),
      moved(circle(2.6), polar(BAND + 15, deg + WHEEL / 2)),
      moved(circle(3.2), polar(BAND, deg + WHEEL / 2)),
    ]),
);

const Doily = (): SceneElement => (
  <Group offset={[cx, cy]}>
    {/* Fine net in the band, a very open net in the centre. */}
    <Shape
      geometry={subtract(circle(R - 6), circle(R - 76))}
      fill={hexNet(5.2, 0.8, ecru, 0)}
      opacity={0.9}
    />
    <Shape geometry={circle(R - 80)} fill={hexNet(15, 0.75, ecru, 0)} opacity={0.55} />
    {/* Cordonnet: the raised outline threads. */}
    <Shape geometry={edge} stroke={{ color: thread(3), width: 3.2, cap: "round" }} />
    <Shape geometry={edgeInner} stroke={{ color: thread(4), width: 1.3, cap: "round" }} />
    <Shape geometry={picots} stroke={{ color: cream, width: 1.6 }} />
    <Shape geometry={ring(R - 4)} stroke={{ color: thread(6), width: 4 }} />
    <Shape geometry={ring(R - 11)} stroke={{ color: thread(7), width: 1.4 }} />
    <Shape geometry={ring(R - 74)} stroke={{ color: thread(8), width: 3.4 }} />
    <Shape geometry={ring(R - 81)} stroke={{ color: thread(9), width: 1.3 }} />
    {/* Wheels. */}
    <Shape geometry={placed(circle(25))} fill={velvet} />
    <Shape geometry={placed(wheelRings)} stroke={{ color: thread(10), width: 2.2 }} />
    <Shape geometry={placed(wheelSpokes)} stroke={{ color: thread(11), width: 1.1 }} />
    <Shape
      geometry={placed(wheelPetals)}
      fill={clothStitch(1.6, 0.9, cream, 0)}
      stroke={{ color: cream, width: 1.4 }}
    />
    <Shape geometry={placed(circle(4.2))} fill={thread(13)} />
    <Shape geometry={esprits} fill={cream} />
  </Group>
);

// ── the pelicans ────────────────────────────────────────────────────────────

const look: Look = {
  line: cream,
  width: 1.25,
  body: hexNet(2.3, 0.6, cream, 0),
  wing: hexNet(1.3, 0.55, cream, 30),
  primaries: clothStitch(0.9, 0.6, cream, -35),
  beak: cream,
  pouch: clothStitch(1.1, 0.6, cream, 80),
  skin: cream,
  leg: cream,
  frame: cream,
  metal: cream,
  tyre: cream,
  detail: true,
  incise: cream,
  far: 0.7,
};

const SIZE = 1.24;
const GAP = 112;
const FLOOR = 698;

const raised = [
  emboss({ light: { azimuth: 235, elevation: 38 }, depth: 2.2, radius: 0.9, specular: 0.35 }),
  shadow({ color: "#000000", offset: [2.5, 4], blur: 3, opacity: 0.85 }),
];

const Pair = (): SceneElement => (
  <Group>
    <Group offset={[W / 2 - GAP, FLOOR]} scale={SIZE} origin="own" effects={raised}>
      <Pelican look={look} />
    </Group>
    {/* Lit outside the flip: emboss inside a mirrored frame lights from the wrong side. */}
    <Group effects={raised}>
      <Group offset={[W / 2 + GAP, FLOOR]} scale={[-SIZE, SIZE]} origin="own">
        <Pelican look={look} />
      </Group>
    </Group>
    {/* The cord they ride on, with a picot at each end. */}
    <Shape
      geometry={line([W / 2 - 230, FLOOR + 1.6], [W / 2 + 230, FLOOR + 1.6])}
      stroke={{ color: thread(20), width: 2.6, cap: "round" }}
    />
    <Shape
      geometry={merge(
        moved(circle(4), [W / 2 - 236, FLOOR + 1.6]),
        moved(circle(4), [W / 2 + 236, FLOOR + 1.6]),
      )}
      stroke={{ color: thread(21), width: 1.5 }}
    />
  </Group>
);

// ── the velvet ──────────────────────────────────────────────────────────────

const Velvet = (): SceneElement => (
  <Group>
    <Shape
      geometry={rect(W, H)}
      fill={[
        velvet,
        {
          paint: noise({
            frequency: [0.006, 0.009],
            octaves: 3,
            seed: 31,
            ramp: [
              [0.3, alpha("#1C1718", 0)],
              [0.75, alpha("#1C1718", 0.7)],
            ],
          }),
        },
        {
          paint: noise({
            frequency: [1.9, 0.8],
            octaves: 2,
            seed: 32,
            rotate: 70,
            ramp: [
              [0.3, alpha("#2C2829", 0)],
              [0.8, alpha("#2C2829", 0.55)],
            ],
          }),
        },
      ]}
    />
    {/* A soft key light falling across the top of the doily, and a vignette. */}
    <Shape
      geometry={rect(W, H)}
      fill={radial({
        center: [W / 2, 430],
        radius: [760, 420],
        stops: [alpha("#4A4240", 0.22), alpha("#4A4240", 0)],
      })}
    />
    <Shape
      geometry={rect(W, H)}
      fill={radial.across({
        shape: "ellipse",
        stops: [alpha("#000000", 0), alpha("#000000", 0), alpha("#000000", 0.7)],
      })}
    />
  </Group>
);

const push = track(1).to(1.04, span(0, LACE), ease.linear);

export const Lace = (): SceneElement => (
  <Group>
    <Velvet />
    <Group scale={push} origin={{ frame: [W / 2, 470] }}>
      <Group effects={raised}>
        <Doily />
      </Group>
      <Pair />
      <Caption when={[1.2, 4.8]} fill={cream} size={72} y={300}>
        Some days are delicate.
      </Caption>
    </Group>
    <Chapter numeral="VI" medium="Lace" fill={cream} length={LACE} />
  </Group>
);
