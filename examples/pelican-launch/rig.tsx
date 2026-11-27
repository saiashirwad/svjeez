import {
  Group,
  Shape,
  adjust,
  alpha,
  linear,
  none,
  shadow,
  circle,
  ease,
  ellipse,
  line,
  path,
  random,
  sampled,
  span,
  spline,
  track,
  type Geometry,
  type Color,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";

/**
 * One great white pelican on one small road bike, drawn once and dressed per medium. Units are roughly centimetres:
 * the tyres touch y = 0, the rider faces +x, the bike spans about -54..68 and the bird stands about 165 tall.
 */

/**
 * A lit, textured surface over flat paint: fibre grain multiplied over the plumage, shading that gives the body volume,
 * laid feathers, and highlights on the bill and the metal.
 */
export interface Finish {
  /** Fibre noise multiplied over plumage, turned `rotate` degrees from fibres along x. */
  readonly grain: (rotate: number) => Paint;
  readonly grainOpacity: number;
  /** Form-shadow color on the undersides. */
  readonly form: Color;
  /** Rim light and specular color. */
  readonly light: Color;
  /** Feather fill; laid in overlapping rows on the wings. */
  readonly feather: Paint;
  readonly featherEdge: Color;
  /** Thin veins in the pouch membrane. */
  readonly vein: Color;
}

export interface Look {
  /** A lit, textured surface over the flat paint; undefined keeps the drawing flat. */
  readonly finish?: Finish;
  /** Outline of the bird and its details. */
  readonly line: Paint;
  readonly width: number;
  /** Plumage fill; undefined leaves the bird as line art. */
  readonly body?: Paint;
  /** The folded wing; defaults to `body`. */
  readonly wing?: Paint;
  /** Black flight feathers trailing off the wing; defaults to `line`. */
  readonly primaries?: Paint;
  readonly beak?: Paint;
  readonly pouch?: Paint;
  /** Bare skin around the eye. */
  readonly skin?: Paint;
  /** Legs and webbed feet; defaults to `beak`, then `line`. */
  readonly leg?: Paint;
  /** Bike frame, bars and cranks. */
  readonly frame: Paint;
  readonly tyre: Paint;
  /** Rims, spokes, chain. Defaults to `frame`. */
  readonly metal?: Paint;
  /** Feather rows, eye, spokes, chain; off for silhouettes. */
  readonly detail: boolean;
  /** Color of detail lines drawn over a dark body (black-figure pottery). Defaults to `line`. */
  readonly incise?: Paint;
  /** Brightness of the far leg and far crank, 1 unchanged. */
  readonly far?: number;
  /** A fine plumage texture laid over the body and neck. */
  readonly plumage?: Paint;
  /** Soft shadow color the wings cast on the body; none when undefined. */
  readonly shade?: Color;
}

// ── bike ────────────────────────────────────────────────────────────────────

const R = 24.5;
export const REAR: Vec = [-29, -R];
export const FRONT: Vec = [43, -R];
const BB: Vec = [0, -19.5];
const CRANK = 12;
const SEAT_TOP: Vec = [-11, -55.5];
const HEAD_TOP: Vec = [33.5, -54.5];
const HEAD_BOTTOM: Vec = [36.7, -44.6];
const HOOD: Vec = [45, -61];

// ── bird ────────────────────────────────────────────────────────────────────

const HIP: Vec = [-6, -74];
const THIGH = 34;
const SHIN = 34;

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const round = (v: Vec): Vec => [Math.round(v[0] * 10) / 10, Math.round(v[1] * 10) / 10];

const pedalAt = (turn: number): Vec => add(BB, [CRANK * Math.cos(turn), CRANK * Math.sin(turn)]);

/** Two-bone IK from the hip to the pedal; the knee bends forward, toward the bars. */
const kneeFor = (foot: Vec): Vec => {
  const dx = foot[0] - HIP[0];
  const dy = foot[1] - HIP[1];
  const d = Math.min(Math.hypot(dx, dy), THIGH + SHIN - 0.01);
  const toward = Math.atan2(dy, dx);
  const bend = Math.acos((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d));
  const a = toward - bend;
  const b = toward + bend;
  const ka: Vec = [HIP[0] + THIGH * Math.cos(a), HIP[1] + THIGH * Math.sin(a)];
  const kb: Vec = [HIP[0] + THIGH * Math.cos(b), HIP[1] + THIGH * Math.sin(b)];

  return ka[0] > kb[0] ? ka : kb;
};

const ankleAt = (turn: number): Vec => add(pedalAt(turn), [-2, -3.5]);

/** The feathered thigh, from inside the body to the knee. */
const thighAt = (turn: number): Geometry => line(round(HIP), round(kneeFor(ankleAt(turn))));

/** The bare tarsus, knee to ankle. */
const shinAt = (turn: number): Geometry =>
  line(round(kneeFor(ankleAt(turn))), round(ankleAt(turn)));

/** A totipalmate foot: long toes splayed forward along the pedal, webbed between, scalloped at the edge. */
const footAt = (turn: number): Geometry => {
  const ankle = ankleAt(turn);
  const at = (x: number, y: number): Vec => round(add(ankle, [x, y]));

  return path()
    .moveTo(at(-1, -1))
    .lineTo(at(13, 1.5))
    .quadTo(at(11, 3), at(12, 4.5))
    .quadTo(at(9, 4.5), at(9.5, 6))
    .lineTo(at(-1, 3))
    .lineTo(at(-4, 4))
    .close();
};

const crankAt = (turn: number): Geometry => line(BB, round(pedalAt(turn)));

/** The pedal body stays level while the crank turns. */
const pedalBodyAt = (turn: number): Geometry => {
  const [x, y] = pedalAt(turn);

  return path()
    .moveTo(round([x - 4, y - 1]))
    .lineTo(round([x + 4, y - 1]))
    .lineTo(round([x + 4, y + 1]))
    .lineTo(round([x - 4, y + 1]))
    .close();
};

/** One crank turn, in seconds. Scenes should be whole multiples of this so the pedalling loops cleanly. */
export const PEDAL = 1;

const poses = new Map<number, ReturnType<typeof pedalPose>>();

/** One IK solve per time gives every limb at once; the tracks are shared by the leg and crank of a phase. */
const pedalPose = (phase: number) =>
  sampled.all(
    (t) => {
      const turn = phase + (t / PEDAL) * Math.PI * 2;

      return {
        thigh: thighAt(turn),
        shin: shinAt(turn),
        foot: footAt(turn),
        crank: crankAt(turn),
        pedalBody: pedalBodyAt(turn),
      };
    },
    span(0, PEDAL),
    { tolerance: 0.15, step: PEDAL / 48 },
  );

const pedalled = (phase: number) => {
  const cached = poses.get(phase) ?? pedalPose(phase);

  poses.set(phase, cached);

  return {
    thigh: cached.thigh.loop(PEDAL),
    shin: cached.shin.loop(PEDAL),
    foot: cached.foot.loop(PEDAL),
    crank: cached.crank.loop(PEDAL),
    pedalBody: cached.pedalBody.loop(PEDAL),
  };
};

/** One turn per `period`, starting `from` degrees round. */
const spin = (period: number, from = 0) =>
  track(from)
    .to(from + 360, span(0, period), ease.linear)
    .loop(period);

const SPOKES = 24;

const Wheel = ({
  at,
  look,
  phase,
}: {
  readonly at: Vec;
  readonly look: Look;
  readonly phase: number;
}): SceneElement => {
  const metal = look.metal ?? look.frame;

  return (
    <Group offset={at}>
      {look.detail && (
        <Group rotate={spin(PEDAL, (phase * 180) / Math.PI)} origin="own">
          {Array.from({ length: SPOKES }, (_, i) => {
            const a = (i / SPOKES) * Math.PI * 2;
            const hub = (i % 2 === 0 ? 1 : -1) * 0.35;
            const from: Vec = [2.4 * Math.cos(a + hub), 2.4 * Math.sin(a + hub)];
            const to: Vec = [21 * Math.cos(a), 21 * Math.sin(a)];

            return (
              <Shape
                key={i}
                geometry={line(round(from), round(to))}
                stroke={{ color: metal, width: look.width * 0.22 }}
              />
            );
          })}
        </Group>
      )}
      <Shape geometry={circle(21.5)} stroke={{ color: metal, width: look.width * 1.1 }} />
      <Shape geometry={circle(R - 1.2)} stroke={{ color: look.tyre, width: look.width * 2.6 }} />
      {look.finish && (
        <Group>
          <Shape
            geometry={circle(R - 0.3)}
            stroke={{ color: alpha("#000000", 0.55), width: look.width * 0.8, dash: [0.7, 0.6] }}
          />
          <Shape
            geometry={circle(R - 2.2)}
            stroke={{ color: alpha(look.finish.light, 0.18), width: look.width * 0.35 }}
          />
          <Shape
            geometry={circle(21.5)}
            stroke={{
              color: linear.across({
                angle: 45,
                stops: [
                  alpha(look.finish.light, 0.9),
                  alpha(look.finish.light, 0),
                  alpha(look.finish.light, 0.5),
                ],
              }),
              width: look.width * 0.45,
            }}
          />
        </Group>
      )}
      <Shape geometry={circle(2.6)} fill={metal} />
    </Group>
  );
};

const tubes: readonly (readonly [Vec, Vec, number])[] = [
  [BB, SEAT_TOP, 1.5],
  [SEAT_TOP, HEAD_TOP, 1.4],
  [BB, HEAD_BOTTOM, 1.7],
  [BB, REAR, 1.1],
  [add(SEAT_TOP, [0.4, 1.6]), REAR, 1],
  [HEAD_TOP, HEAD_BOTTOM, 2],
];

const Frame = ({ look }: { readonly look: Look }): SceneElement => {
  const metal = look.metal ?? look.frame;

  return (
    <Group>
      {look.detail && (
        <Group>
          <Shape
            geometry={path().moveTo([0, -26.5]).lineTo([-29, -27.6])}
            stroke={{ color: look.tyre, width: look.width * 0.5 }}
          />
          <Shape
            geometry={path().moveTo([0, -12.5]).lineTo([-29, -21.4])}
            stroke={{ color: look.tyre, width: look.width * 0.5 }}
          />
          <Shape
            geometry={circle(3)}
            offset={REAR}
            stroke={{ color: metal, width: look.width * 0.8 }}
          />
        </Group>
      )}
      <Shape
        geometry={circle(7)}
        offset={BB}
        stroke={{
          color: metal,
          width: look.width * 1.2,
          dash: look.detail ? [0.9, 0.5] : undefined,
        }}
      />
      {tubes.map(([a, b, w], i) => (
        <Shape
          key={`tube-${i}`}
          geometry={line(a, b)}
          stroke={{ color: look.frame, width: look.width * w, cap: "round" }}
        />
      ))}
      {look.finish &&
        tubes.map(([a, b, w], i) => (
          <Shape
            key={`glint-${i}`}
            geometry={line(add(a, [0, -w * 0.18]), add(b, [0, -w * 0.18]))}
            stroke={{
              color: alpha(look.finish!.light, 0.55),
              width: look.width * w * 0.28,
              cap: "round",
            }}
          />
        ))}
      <Shape
        geometry={path().moveTo(HEAD_BOTTOM).curveTo([39, -36], [42, -30], FRONT)}
        stroke={{ color: look.frame, width: look.width * 1.3, cap: "round" }}
      />
      <Shape
        geometry={line(SEAT_TOP, [-13.5, -64])}
        stroke={{ color: metal, width: look.width * 1.1 }}
      />
      <Shape
        geometry={path()
          .moveTo(HEAD_TOP)
          .lineTo([34.5, -59.5])
          .lineTo([41, -61])
          .curveTo([48, -62.5], [49, -55], [46, -51])
          .lineTo([42, -50])}
        stroke={{ color: look.frame, width: look.width * 1.2, cap: "round", join: "round" }}
      />
      <Shape
        geometry={path()
          .moveTo([-23, -66.5])
          .curveTo([-18, -69], [-10, -68], [-4, -65.5])
          .lineTo([-12, -63.5])
          .curveTo([-17, -63.5], [-21, -64], [-23, -66.5])
          .close()}
        fill={look.tyre}
      />
    </Group>
  );
};

const Crank = ({ look, phase }: { readonly look: Look; readonly phase: number }): SceneElement => (
  <Group>
    <Shape
      geometry={pedalled(phase).crank}
      stroke={{ color: look.metal ?? look.frame, width: look.width * 1.6, cap: "round" }}
    />
    <Shape geometry={pedalled(phase).pedalBody} fill={look.tyre} />
  </Group>
);

const Leg = ({ look, phase }: { readonly look: Look; readonly phase: number }): SceneElement => {
  const skin = look.leg ?? look.beak ?? look.line;

  return (
    <Group>
      <Shape
        geometry={pedalled(phase).thigh}
        stroke={{ color: skin, width: look.width * 5.6, cap: "round" }}
      />
      <Shape
        geometry={pedalled(phase).shin}
        stroke={{ color: skin, width: look.width * 3.8, cap: "round" }}
      />
      <Shape
        geometry={pedalled(phase).foot}
        fill={skin}
        stroke={{ color: skin, width: look.width * 0.8, join: "round" }}
      />
    </Group>
  );
};

/**
 * A closed outline around a centerline whose width changes along it, as a smooth spline. Line art can outline it
 * without seams where a neck swells into a head.
 */
const tube = (points: readonly Vec[], widths: readonly number[]): Geometry => {
  const side = (sign: number): Vec[] =>
    points.map((p, i) => {
      const a = points[Math.max(0, i - 1)]!;
      const b = points[Math.min(points.length - 1, i + 1)]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n: Vec = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
      const w = (widths[i]! / 2) * sign;

      return round([p[0] + n[0] * w, p[1] + n[1] * w]);
    });

  return spline([...side(1), ...side(-1).reverse()], { closed: true, tension: 0.5 });
};

/** Heavy, keel-chested body sitting on the saddle, back sloping to a short tail. */
const BODY = path()
  .moveTo([-52, -84])
  .curveTo([-42, -98], [-16, -108], [6, -105])
  .curveTo([20, -103], [28, -94], [25, -83])
  .curveTo([22, -72], [8, -66], [-8, -66])
  .curveTo([-26, -66], [-42, -72], [-52, -84])
  .close();

const TAIL = path()
  .moveTo([-48, -86])
  .lineTo([-62, -88])
  .lineTo([-60, -82])
  .lineTo([-48, -80])
  .close();

/** The S of the neck, from deep in the chest, back, up and forward into a flat-crowned head. */
const NECK = tube(
  [
    [12, -98],
    [4, -112],
    [-1, -127],
    [1, -141],
    [9, -153],
    [19, -158],
    [29, -158],
  ],
  [26, 16, 13, 12.5, 15, 19, 15],
);

/** A few loose nape feathers: the white pelican's short, shaggy crest. */
const CREST: readonly Geometry[] = [
  path().moveTo([12, -165]).quadTo([7, -168], [2, -167]),
  path().moveTo([11, -164]).quadTo([6, -166], [1.5, -164.5]),
  path().moveTo([10, -163]).quadTo([6, -164], [3, -162]),
  path().moveTo([13, -166]).quadTo([9, -170], [5, -170]),
];

/**
 * Upper mandible: broad at the forehead, flat along the culmen, narrowing to a hooked nail. The gape runs back under
 * the eye.
 */
const UPPER = path()
  .moveTo([27, -165])
  .curveTo([42, -161], [64, -150], [84, -141])
  .curveTo([87, -140], [88, -136], [85, -134.5])
  .lineTo([84, -136.5])
  .curveTo([64, -142], [44, -149], [27, -153])
  .close();

const CULMEN = path().moveTo([31, -162]).curveTo([46, -156], [64, -147], [83, -139.5]);

/** The gular pouch, hung from the lower mandible and sagging toward the throat. */
const POUCH = path()
  .moveTo([27, -153])
  .lineTo([83, -136])
  .curveTo([72, -133], [58, -130], [44, -132])
  .curveTo([32, -134], [22, -137], [16, -143])
  .close();

/** The thin lower mandible the pouch hangs from. */
const LOWER = path().moveTo([27, -152.5]).lineTo([83, -136]);

const WRINKLES: readonly Geometry[] = [
  path().moveTo([34, -149]).quadTo([35, -142], [35, -135]),
  path().moveTo([46, -145]).quadTo([47, -139], [47, -133]),
  path().moveTo([58, -142]).quadTo([59, -137], [59, -133]),
  path().moveTo([70, -139]).quadTo([70, -137], [71, -134]),
];

/** Folded wing along the flank: coverts in front, black primaries trailing past the tail. */
const WING = path()
  .moveTo([8, -101])
  .curveTo([0, -88], [-20, -80], [-46, -82])
  .curveTo([-36, -90], [-14, -100], [8, -101])
  .close();

const PRIMARIES: readonly Geometry[] = [0, 1, 2, 3].map((i) =>
  path()
    .moveTo([-14 - i * 6, -86 + i * 0.6])
    .curveTo([-32 - i * 5, -88 + i], [-54 - i * 3, -88 + i * 1.4], [-70 - i * 2, -86 + i * 2.2])
    .curveTo([-56 - i * 3, -82 + i * 1.4], [-34 - i * 5, -81 + i], [-14 - i * 6, -86 + i * 0.6])
    .close(),
);

/** The near wing reaching forward: a broad white forearm from the shoulder down to the wrist. */
const WRIST: Vec = [34, -72];

const ARM = path()
  .moveTo([-2, -104])
  .curveTo([14, -104], [28, -92], [WRIST[0] + 3, WRIST[1] - 2])
  .curveTo([WRIST[0] + 2, WRIST[1] + 3], [WRIST[0] - 3, WRIST[1] + 4], [WRIST[0] - 6, WRIST[1] + 3])
  .curveTo([20, -78], [6, -84], [-10, -88])
  .close();

/** Scalloped trailing edge of the secondaries along the forearm's underside. */
const SECONDARIES = path()
  .moveTo([-8, -89])
  .quadTo([-2, -84], [2, -87])
  .quadTo([7, -81], [11, -84])
  .quadTo([16, -78], [19, -81])
  .quadTo([24, -75], [27, -77])
  .quadTo([30, -72], [WRIST[0] - 5, WRIST[1] + 3])
  .lineTo([WRIST[0] - 6, WRIST[1] + 3])
  .curveTo([20, -78], [6, -84], [-10, -88])
  .close();

/** Black primaries, fanned from the wrist and curled around the hoods like fingers. */
const HAND: readonly Geometry[] = [0, 1, 2].map((i) =>
  path()
    .moveTo([WRIST[0] - 2 + i, WRIST[1] - 2 + i * 1.5])
    .curveTo(
      [WRIST[0] + 4, WRIST[1] - 6 + i * 2],
      [HOOD[0] - 2, HOOD[1] - 4 + i * 2],
      [HOOD[0] + 2.5, HOOD[1] - 1 + i * 2],
    )
    .curveTo(
      [HOOD[0] + 1, HOOD[1] + 1 + i * 2],
      [WRIST[0] + 4, WRIST[1] - 1 + i * 2],
      [WRIST[0] - 2 + i, WRIST[1] + 1.5 + i * 1.5],
    )
    .close(),
);

const COVERTS: readonly Geometry[] = [
  path().moveTo([0, -99]).quadTo([14, -96], [26, -84]),
  path().moveTo([-4, -95]).quadTo([10, -92], [22, -82]),
  path().moveTo([-4, -92]).quadTo([-14, -88], [-26, -86]),
  path().moveTo([0, -96]).quadTo([-12, -92], [-30, -89]),
];

/** A contour feather: a teardrop from its base toward `angle` degrees, `length` long and `width` wide. */
const feather = (base: Vec, angle: number, length: number, width: number): Geometry => {
  const a = (angle * Math.PI) / 180;
  const d: Vec = [Math.cos(a), Math.sin(a)];
  const n: Vec = [-d[1], d[0]];

  const at = (along: number, side: number): Vec =>
    round([base[0] + d[0] * along + n[0] * side, base[1] + d[1] * along + n[1] * side]);

  return path()
    .moveTo(at(0, -width * 0.3))
    .curveTo(at(length * 0.3, -width * 0.62), at(length * 0.85, -width * 0.55), at(length, 0))
    .curveTo(at(length * 0.85, width * 0.55), at(length * 0.3, width * 0.62), at(0, width * 0.3))
    .close();
};

interface Row {
  readonly count: number;
  readonly inset: number;
  readonly length: number;
  readonly width: number;
}

/**
 * Feathers laid in rows like roof tiles along an edge from `from` to `to`. Each row sits `inset` further toward the
 * trailing side and points at `angle`; leading rows are drawn last so their tips cover the bases behind them.
 */
const rows = (from: Vec, to: Vec, angle: number, layout: readonly Row[]): Geometry[] => {
  const next = random(`${from}-${angle}`);
  const d: Vec = [to[0] - from[0], to[1] - from[1]];
  const len = Math.hypot(d[0], d[1]);
  const a = (angle * Math.PI) / 180;
  const back: Vec = [Math.cos(a), Math.sin(a)];

  return [...layout].reverse().flatMap(({ count, inset, length, width }, r) =>
    Array.from({ length: count }, (_, i) => {
      const t = (i + 0.5 + (r % 2) * 0.5) / (count + 0.5);

      const base: Vec = [
        from[0] + (d[0] * t * len) / len + back[0] * inset,
        from[1] + (d[1] * t * len) / len + back[1] * inset,
      ];

      const jitter = next();

      return feather(
        [base[0] + (next() - 0.5) * 1.2, base[1] + (next() - 0.5) * 1.2],
        angle + (jitter - 0.5) * 14,
        length * (0.85 + next() * 0.3),
        width * (0.85 + next() * 0.3),
      );
    }),
  );
};

const ARM_FEATHERS = rows([-1, -102], [33, -75], 150, [
  { count: 16, inset: 1, length: 4.2, width: 2.4 },
  { count: 14, inset: 3.4, length: 5.6, width: 2.8 },
  { count: 12, inset: 6.2, length: 7.4, width: 3.2 },
]);

const WING_FEATHERS = rows([6, -100], [-42, -84], 168, [
  { count: 15, inset: 0.8, length: 6, width: 3 },
  { count: 13, inset: 3.6, length: 7.6, width: 3.4 },
  { count: 11, inset: 6.8, length: 9.5, width: 3.8 },
]);

/** The quill down the middle of each black primary. */
const RACHIS: readonly Geometry[] = [0, 1, 2, 3].map((i) =>
  path()
    .moveTo([-14 - i * 6, -86 + i * 0.6])
    .curveTo([-32 - i * 5, -86 + i], [-54 - i * 3, -86 + i * 1.6], [-70 - i * 2, -86 + i * 2.2]),
);

/** Blood vessels branching through the pouch membrane. */
const VEINS: readonly Geometry[] = [
  path().moveTo([30, -150]).curveTo([38, -143], [46, -140], [58, -138]),
  path().moveTo([40, -143]).curveTo([42, -138], [44, -135], [43, -132]),
  path().moveTo([52, -139]).curveTo([60, -137], [68, -137], [76, -136]),
  path().moveTo([62, -138]).curveTo([63, -135], [62, -133], [61, -131.5]),
];

/** A glint along the culmen and the reddish hooked nail at the tip. */
const BILL_GLINT = path().moveTo([33, -161]).curveTo([48, -156.5], [66, -148.5], [80, -142.5]);

const NAIL = path()
  .moveTo([80, -142.5])
  .curveTo([85, -141], [88, -138], [85, -134.5])
  .lineTo([84, -136.5])
  .curveTo([83, -138], [81, -139], [78.5, -139.5])
  .close();

/** Fibre grain multiplied over one part. A rotated grain runs its fibres along the limb. */
const Grain = ({
  finish,
  part,
  rotate = 0,
}: {
  readonly finish: Finish;
  readonly part: Geometry;
  readonly rotate?: number;
}): SceneElement => (
  <Shape
    geometry={part}
    fill={finish.grain(rotate)}
    blend="multiply"
    opacity={finish.grainOpacity}
  />
);

/** Shading that turns flat plumage into a volume: darker toward the underside, lit along the top edge. */
const Form = ({
  finish,
  part,
  top,
  bottom,
}: {
  readonly finish: Finish;
  readonly part: Geometry;
  readonly top: Vec;
  readonly bottom: Vec;
}): SceneElement => (
  <Group>
    <Shape
      geometry={part}
      fill={linear({
        from: top,
        to: bottom,
        stops: [
          [0, alpha(finish.form, 0)],
          [0.5, alpha(finish.form, 0.03)],
          [1, alpha(finish.form, 0.3)],
        ],
      })}
    />
    <Group clip={part}>
      <Shape
        geometry={part}
        stroke={{
          color: linear({
            from: top,
            to: bottom,
            stops: [
              [0, alpha(finish.light, 0.7)],
              [0.35, alpha(finish.light, 0)],
            ],
          }),
          width: 2,
        }}
      />
    </Group>
  </Group>
);

const Feathers = ({
  finish,
  list,
  part,
  prefix,
}: {
  readonly finish: Finish;
  readonly list: readonly Geometry[];
  readonly part: Geometry;
  readonly prefix: string;
}): SceneElement => (
  <Group clip={part}>
    {list.map((each, i) => (
      <Shape
        key={`${prefix}-${i}`}
        geometry={each}
        fill={finish.feather}
        stroke={{ color: alpha(finish.featherEdge, 0.55), width: 0.12 }}
      />
    ))}
  </Group>
);

/**
 * The pelican on its bike. `phase` (radians, default 0) starts the cranks and wheels that far round, so riders in a
 * group don't pedal in lockstep.
 */
export const Pelican = ({
  look,
  phase = 0,
}: {
  readonly look: Look;
  readonly phase?: number;
}): SceneElement => {
  const ink = look.incise ?? look.line;
  const far = look.far ?? 0.72;
  const outline = { color: look.line, width: look.width, join: "round" as const };
  const fin = look.finish;

  const cast = look.shade
    ? [shadow({ color: look.shade, offset: [1.2, 2.4], blur: 2.4, opacity: 0.35 })]
    : undefined;

  return (
    <Group>
      <Group effects={far === 1 ? undefined : [adjust({ brightness: far })]}>
        <Leg look={look} phase={phase + Math.PI} />
        <Crank look={look} phase={phase + Math.PI} />
      </Group>
      <Wheel at={REAR} look={look} phase={phase} />
      <Wheel at={FRONT} look={look} phase={phase} />
      <Frame look={look} />
      <Crank look={look} phase={phase} />
      <Leg look={look} phase={phase} />
      <Shape geometry={TAIL} fill={look.primaries ?? look.body} stroke={outline} />
      {PRIMARIES.map((each, i) => (
        <Shape
          key={`primary-${i}`}
          geometry={each}
          fill={look.primaries ?? look.line}
          stroke={outline}
        />
      ))}
      {fin &&
        RACHIS.map((quill, i) => (
          <Shape
            key={`rachis-${i}`}
            geometry={quill}
            stroke={{ color: alpha(fin.light, 0.35), width: 0.25, cap: "round" }}
          />
        ))}
      <Shape geometry={NECK} fill={look.body} stroke={outline} />
      {look.plumage && <Shape geometry={NECK} fill={look.plumage} />}
      {fin && <Grain finish={fin} part={NECK} rotate={-70} />}
      {fin && <Form finish={fin} part={NECK} top={[-2, -150]} bottom={[16, -110]} />}
      <Shape geometry={BODY} fill={look.body} stroke={outline} />
      {look.plumage && <Shape geometry={BODY} fill={look.plumage} />}
      {fin && <Grain finish={fin} part={BODY} />}
      {fin && <Form finish={fin} part={BODY} top={[-10, -106]} bottom={[-6, -66]} />}
      <Shape geometry={WING} fill={look.wing ?? look.body} stroke={outline} effects={cast} />
      {fin && <Feathers finish={fin} list={WING_FEATHERS} part={WING} prefix="wing" />}
      {fin && <Grain finish={fin} part={WING} />}
      {CREST.map((wisp, i) => (
        <Group key={`crest-${i}`}>
          <Shape
            geometry={wisp}
            stroke={{ color: look.line, width: look.width * 2.6, cap: "round" }}
          />
          <Shape
            geometry={wisp}
            stroke={{ color: look.body ?? look.line, width: look.width * 1.6, cap: "round" }}
          />
        </Group>
      ))}
      <Shape geometry={POUCH} fill={look.pouch ?? look.body} stroke={outline} />
      {fin &&
        VEINS.map((vein, i) => (
          <Shape
            key={`vein-${i}`}
            geometry={vein}
            stroke={{ color: alpha(fin.vein, 0.4), width: 0.22, cap: "round" }}
          />
        ))}
      {fin && <Form finish={fin} part={POUCH} top={[50, -145]} bottom={[50, -128]} />}
      {look.detail &&
        WRINKLES.map((wrinkle, i) => (
          <Shape
            key={`wrinkle-${i}`}
            geometry={wrinkle}
            stroke={{ color: ink, width: look.width * 0.35, cap: "round" }}
            opacity={0.5}
          />
        ))}
      <Shape geometry={LOWER} stroke={{ ...outline, color: look.line, width: look.width * 1.4 }} />
      <Shape geometry={UPPER} fill={look.beak ?? look.body} stroke={outline} />
      {fin && (
        <Group>
          <Shape geometry={NAIL} fill={alpha(fin.vein, 0.75)} />
          <Shape
            geometry={BILL_GLINT}
            stroke={{ color: alpha(fin.light, 0.6), width: 0.7, cap: "round" }}
          />
        </Group>
      )}
      {look.detail && (
        <Shape
          geometry={CULMEN}
          stroke={{ color: ink, width: look.width * 0.4, cap: "round" }}
          opacity={0.45}
        />
      )}
      {look.detail && (
        <Group>
          <Shape
            geometry={ellipse(4.2, 3)}
            offset={[23.5, -159]}
            fill={look.skin ?? look.beak ?? none}
          />
          {fin && <Shape geometry={circle(2.3)} offset={[24, -159]} fill="#EFE3B2" />}
          <Shape geometry={circle(fin ? 1.35 : 1.9)} offset={[24, -159]} fill={ink} />
          <Shape geometry={circle(0.55)} offset={[24.6, -159.7]} fill="#ffffff" />
        </Group>
      )}
      {HAND.map((each, i) => (
        <Shape
          key={`hand-${i}`}
          geometry={each}
          fill={look.primaries ?? look.line}
          stroke={outline}
        />
      ))}
      <Shape geometry={ARM} fill={look.wing ?? look.body} stroke={outline} effects={cast} />
      <Shape
        geometry={SECONDARIES}
        fill={look.primaries ?? look.line}
        stroke={outline}
        opacity={0.85}
      />
      {fin && <Feathers finish={fin} list={ARM_FEATHERS} part={ARM} prefix="arm" />}
      {fin && <Grain finish={fin} part={ARM} rotate={38} />}
      {fin && <Form finish={fin} part={ARM} top={[10, -104]} bottom={[6, -80]} />}
      {look.detail &&
        !fin &&
        COVERTS.map((covert, i) => (
          <Shape
            key={`covert-${i}`}
            geometry={covert}
            stroke={{ color: ink, width: look.width * 0.45, cap: "round" }}
            opacity={0.4}
          />
        ))}
    </Group>
  );
};
