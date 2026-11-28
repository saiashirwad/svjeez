import { createRequire } from "node:module";
import { GlobeShape, globe, type LonLat, type Topology } from "@svjeez/geo";
import {
  Group,
  Shape,
  Text,
  alpha,
  circle,
  ease,
  enter,
  radial,
  rect,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Caption, Chapter, H, W, horizon, mono } from "../kit";
import { studio } from "../looks";
import { Pelican } from "../rig";

export const GLOBE = 8;

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const ink = "#3B3226";
const paper = "#EFE8D8";
const sea = "#A9C0C1";
const land = "#EADFBF";
const coast = "#6E5F47";
const route = "#C2492B";

/** The Danube Delta to Lake Chad: a great white pelican's winter crossing of the Sahara. */
const PLACES: readonly { readonly at: LonLat; readonly name: string; readonly label: Vec }[] = [
  { at: [29.6, 45.2], name: "DANUBE DELTA", label: [12, -12] },
  { at: [14.1, 13.0], name: "LAKE CHAD", label: [16, 4] },
];

const [FROM, TO] = [PLACES[0]!.at, PLACES[1]!.at];

/** The globe's rim is the shared horizon: the pelican rides its top while the Earth turns beneath it. */
const rim = horizon(260, 420);
const R = rim.radius;
const SORTIE = span(0.9, GLOBE - 1.8);
const SEAT = rim.at(0.45 * W);

/** North up, looking at the Mediterranean: Europe under the rim, the Sahara at the bottom of the frame. */
const earth = globe(world, {
  radius: R,
  facing: [16, 12],
  turn: { by: 10, over: span(0, GLOBE) },
  canvas: { size: [W, H], center: rim.center },
  simplify: 0.3,
  tolerance: 2,
});

/** Light from the upper left, the limb darkening away from it: one static gradient over the whole disc. */
const shade = radial({
  center: [-0.35 * R, -0.45 * R],
  radius: 1.45 * R,
  stops: [
    [0, alpha("#FFFFFF", 0.22)],
    [0.45, alpha("#FFFFFF", 0)],
    [0.8, alpha(ink, 0.08)],
    [1, alpha(ink, 0.3)],
  ],
});

/** A thin pale atmosphere just outside the limb. */
const air = radial({
  center: [0, 0],
  radius: R + 18,
  stops: [
    [R / (R + 18), alpha(sea, 0.9)],
    [1, alpha(sea, 0)],
  ],
});

const Pin = ({
  name,
  at,
  label,
  when,
}: {
  readonly name: string;
  readonly at: LonLat;
  readonly label: Vec;
  readonly when: number;
}) => (
  <Group {...earth.place(at)}>
    <Group motion={enter(span(when, 0.5), { from: { opacity: 0, scale: 0.6 }, curve: ease.out })}>
      <Shape geometry={circle(4)} fill={route} />
      <Shape geometry={circle(9)} stroke={{ color: route, width: 1.2 }} />
      <Text font={mono} size={11} letterSpacing={2} fill={ink} at={label}>
        {name}
      </Text>
    </Group>
  </Group>
);

export const Globe = (): SceneElement => (
  <Group>
    <Shape geometry={rect(W, H)} fill={paper} />
    <Group offset={rim.center}>
      <Shape geometry={circle(R + 18)} fill={air} />
      <Shape geometry={earth.sphere} fill={sea} />
      <GlobeShape of={earth.graticule(15)} stroke={{ color: alpha(ink, 0.14), width: 0.6 }} />
      <GlobeShape of={earth.land} fill={land} stroke={{ color: coast, width: 0.7 }} />
      <GlobeShape of={earth.borders} stroke={{ color: alpha(coast, 0.35), width: 0.5 }} />
      <Shape geometry={earth.sphere} fill={shade} />
      <GlobeShape
        of={earth.route(FROM, TO)}
        stroke={{ color: route, width: 2.2, dash: [7, 6] }}
        draw={track(0).to(1, SORTIE, ease.inOut)}
      />
      <Pin {...PLACES[0]!} when={0.7} />
      <Pin {...PLACES[1]!} when={1.1} />
      <Group motion={earth.ride(FROM, TO, SORTIE, { ease: ease.inOut })}>
        <Shape
          geometry={circle(6)}
          fill={route}
          stroke={{ color: paper, width: 2 }}
          motion={enter(span(0.9, 0.4), { from: { opacity: 0, scale: 0.4 }, curve: ease.out })}
        />
      </Group>
    </Group>
    <Shape
      key="horizon"
      geometry={rim.visible(rim.reach)}
      offset={rim.center}
      stroke={{ color: ink, width: 1.6 }}
    />
    <Group offset={SEAT.point} rotate={SEAT.angle} scale={0.7} origin="own">
      <Pelican look={studio} />
    </Group>
    <Chapter numeral="X" medium="Cartography" fill={ink} length={GLOBE} />
    <Caption when={[1.4, 5.2]} fill={ink}>
      Some days go the long way round.
    </Caption>
  </Group>
);
