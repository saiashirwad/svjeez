import {
  Group,
  Shape,
  circle,
  ease,
  enter,
  exit,
  path,
  polygon,
  rect,
  span,
  tokens,
  track,
  type Geometry,
  type Paint,
  type Ref,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import type { Anchor, Child, Layers } from "svjeez/tools";
import { BLIP } from "./blip";

// A picture that builds itself: a sky, hills, a sun that is a moon at night, a kite and a cloud. Each piece is drawn
// about its own point `at`, in the sky's frame, and takes its entrance and its life as `motion`.

/** The picture's own colors by day and by night, which a palette leaves be. */
export const scenery = tokens({
  light: {
    sky: "#CFE6EE",
    mist: "#8FB8C7",
    hill: "#7FBF8F",
    far: "#A5D4AD",
    cloud: "#FFFFFF",
    string: "#3B3A45",
    sun: "#FFC21A",
    bite: "#00000000",
    ray: "#FFC21A",
    star: "#00000000",
  },
  dark: {
    sky: "#2C3440",
    mist: "#8FA3B8",
    hill: "#5F9E76",
    far: "#47785A",
    cloud: "#E9E2D4",
    string: "#E9E2D4",
    sun: "#F3ECD2",
    bite: "#2C3440",
    ray: "#00000000",
    star: "#F3ECD2",
  },
});

const skyShape = ([w, h]: Vec): Geometry => rect(w, h, { radius: [0, 0, 11, 11] });

/** The sky the picture is drawn on, `size` big, with its pieces clipped to it. */
export const Sky = ({ handle, size, children }: { handle: Ref; size: Vec; children: Child }) => (
  <Group ref={handle} clip={skyShape(size)}>
    <Shape geometry={skyShape(size)} fill={scenery.sky} />
    {children}
  </Group>
);

interface PieceProps {
  readonly at: Vec;
  readonly motion?: Layers;
}

/** A disc with ten rays that come in over `shine` and turn slowly; at night the rays go dark and a bite makes a moon. */
export const Sun = ({ at, motion, shine, out }: PieceProps & { shine: Span; out: Span }) => (
  <Group offset={at}>
    <Group
      origin="at"
      motion={[enter(shine, { from: { scale: 0.6 }, curve: ease.pop }), exit(out)]}
      rotate={track(0).to(30, span(shine.start, out.end - shine.start), ease.linear)}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <Group rotate={i * 36} origin="at">
          <Shape geometry={rect(14, 8, { radius: 4 })} at={[40, -4]} fill={scenery.ray} />
        </Group>
      ))}
    </Group>
    <Group origin="at" motion={motion}>
      <Shape geometry={circle(30)} fill={scenery.sun} />
      <Shape geometry={circle(25)} offset={[13, -9]} fill={scenery.bite} />
    </Group>
  </Group>
);

/** Stars that only night shows, twinkling in one after another from `when`. */
export const Stars = ({ points, when, out }: { points: readonly Vec[]; when: Span; out: Span }) => (
  <Group motion={exit(out)}>
    {points.map((at, i) => (
      <Shape
        geometry={circle(2.5)}
        offset={at}
        fill={scenery.star}
        motion={enter(when.shift(i * 0.15), { from: { scale: 0 }, curve: ease.pop })}
      />
    ))}
  </Group>
);

interface HillsProps {
  readonly size: Vec;
  /** When the near hill and then the far one rise from below the sky. */
  readonly rise: readonly [Span, Span];
  readonly out: Span;
}

/** Two rolling hills along the bottom of a sky `size` big. */
export const Hills = ({ size: [w, h], rise: [near, far], out }: HillsProps) => {
  const rising = (when: Span, depth: number): Layers => [
    enter(when, { from: { offset: [0, depth], opacity: 1 }, curve: ease.pop }),
    exit(out, { to: { offset: [0, depth], opacity: 1 }, curve: ease.in }),
  ];

  return (
    <Group offset={[0, h]}>
      <Shape
        geometry={path.parse(`M0 -40C120 -70 220 -130 330 -112C380 -104 400 -96 ${w} -92V0H0Z`)}
        fill={scenery.far}
        motion={rising(far, 160)}
      />
      <Shape
        geometry={path.parse(`M0 -58C70 -100 150 -104 230 -70C300 -42 360 -50 ${w} -66V0H0Z`)}
        fill={scenery.hill}
        motion={rising(near, 140)}
      />
    </Group>
  );
};

/** The near hill's top, where Blip stands to fly the kite, in a sky `h` tall. */
export const summit = (h: number): Vec => [150, h - 95];

/** A diamond kite that turns about its tail, on a string from the tail down to `hand`, drawn in over `string`. */
export const Kite = ({
  at: [x, y],
  motion,
  hand,
  string,
  out,
}: PieceProps & { hand: Vec; string: Span; out: Span }) => (
  <Group>
    <Shape
      geometry={path()
        .moveTo([x, y])
        .curveTo([x + 10, y + 56], [x + 50, y + 76], hand)}
      stroke={{ color: scenery.string, width: 2, cap: "round" }}
      draw={track(0).to(1, string)}
      motion={exit(out)}
    />
    <Group offset={[x, y]} origin="at" motion={motion}>
      <Shape geometry={polygon([0, -64], [22, -34], [0, 0], [-22, -34])} fill={BLIP.cheek} />
    </Group>
  </Group>
);

/** A puffy cloud. */
export const Cloud = ({ at, motion }: PieceProps) => (
  <Group offset={at} origin="at" motion={motion}>
    <Shape
      geometry={path.parse(
        "M-46 14C-62 14 -62 -8 -46 -10C-46 -28 -22 -34 -12 -20C-4 -38 26 -36 28 -14C46 -18 56 4 40 14Z",
      )}
      fill={scenery.cloud}
    />
  </Group>
);

interface BurstProps {
  /** Where and when each burst goes off: the dots fly out over its span. */
  readonly bursts: readonly { readonly at: Vec | Anchor; readonly when: Span }[];
  /** The directions the dots fly, in degrees. */
  readonly angles: readonly number[];
  readonly reach: number;
  readonly fill?: Paint;
}

/** Dots flying out and fading, once for each burst: one set of dots, moved to each burst in turn. */
export const Burst = ({ bursts, angles, reach, fill = BLIP.yellow }: BurstProps): SceneElement => {
  const where = bursts.reduce(
    (t, { at, when }) => t.set(at, span(when.start)),
    track<Vec>([0, 0]).set(bursts[0]!.at, span(0)),
  );

  const fly = (deg: number) => {
    const to: Vec = [
      reach * Math.cos((deg * Math.PI) / 180),
      reach * Math.sin((deg * Math.PI) / 180),
    ];

    return bursts.reduce(
      ({ offset, opacity }, { when }) => ({
        offset: offset.set([0, 0], span(when.start)).to(to, when),
        opacity: opacity.set(1, span(when.start)).to(0, when),
      }),
      { offset: track<Vec>([0, 0]), opacity: track(0) },
    );
  };

  return (
    <Group>
      {angles.map((deg) => (
        <Shape geometry={circle(3.5)} offset={where} fill={fill} motion={fly(deg)} />
      ))}
    </Group>
  );
};
