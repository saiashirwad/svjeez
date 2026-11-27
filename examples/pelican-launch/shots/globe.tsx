import { createRequire } from "node:module";
import { GlobeShape, globe, type LonLat, type Topology } from "@svjeez/geo";
import {
  Group,
  Shape,
  alpha,
  circle,
  ease,
  rect,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Caption, Chapter, H, W } from "../kit";
import { studio } from "../looks";
import { Pelican } from "../rig";

export const GLOBE = 8;

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const ink = "#3B3226";
const paper = "#EFE8D8";
const sea = "#C4D3D2";
const land = "#E6DCC1";
const coast = "#7A6A50";
const route = "#C2492B";

/** The Danube Delta to Lake Chad: a great white pelican's winter crossing of the Sahara. */
const FROM: LonLat = [29.6, 45.2];
const TO: LonLat = [14.1, 13.0];

const R = 640;
const CENTER: Vec = [W / 2, 470 + R];
const SORTIE = span(0.7, GLOBE - 1.4);

/** The whole world, a lot of it below the frame: the globe's top is the horizon, and it leans so the crossing reads left to right. */
const earth = globe(world, {
  radius: R,
  facing: [-24, -4],
  lean: -72,
  turn: { by: -24, over: span(0, GLOBE) },
  canvas: { size: [W, H], center: CENTER },
  simplify: 0.3,
  tolerance: 2,
});

export const Globe = (): SceneElement => (
  <Group>
    <Shape geometry={rect(W, H)} fill={paper} />
    <Group offset={CENTER}>
      <Shape geometry={earth.sphere} fill={sea} />
      <GlobeShape of={earth.graticule(15)} stroke={{ color: alpha(ink, 0.22), width: 0.6 }} />
      <GlobeShape of={earth.land} fill={land} stroke={{ color: coast, width: 0.8 }} />
      <GlobeShape
        of={earth.route(FROM, TO)}
        stroke={{ color: route, width: 2.4, dash: [7, 6] }}
        draw={track(0).to(1, SORTIE, ease.linear)}
      />
      {[FROM, TO].map((place) => (
        <Group key={place.join()} {...earth.place(place)}>
          <Shape geometry={circle(5)} fill={route} />
          <Shape geometry={circle(10)} stroke={{ color: route, width: 1.2 }} />
        </Group>
      ))}
      <Shape geometry={earth.sphere} stroke={{ color: ink, width: 1.6 }} />
      <Group motion={earth.ride(FROM, TO, SORTIE, { turn: true })} scale={0.7} origin="own">
        <Pelican look={studio} />
      </Group>
    </Group>
    <Chapter numeral="X" medium="Cartography" fill={ink} length={GLOBE} />
    <Caption when={[1.4, 5.2]} fill={ink}>
      Some days go the long way round.
    </Caption>
  </Group>
);
