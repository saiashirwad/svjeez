import {
  Group,
  Shape,
  alpha,
  blur,
  displace,
  ease,
  emboss,
  enter,
  exit,
  line,
  noise,
  pattern,
  radial,
  rect,
  spline,
  span,
  track,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Caption, Chapter, H, W, horizon, ivory, slate } from "../kit";
import { Pelican, type Look } from "../rig";

export const OPEN = 5;

const graphite = "#4A4844";
const GROUND_Y = 540;
const SCALE = 1.7;

/** Fine parallel pencil shading, laid very light over the plumage. */
const shading: Paint = pattern({
  size: [2.2, 2.2],
  rotate: -35,
  tile: (
    <Shape
      geometry={line([0, 1.1], [2.2, 1.1])}
      stroke={{ color: alpha(graphite, 0.22), width: 0.28 }}
    />
  ),
});

const look: Look = {
  line: graphite,
  width: 0.55,
  body: shading,
  wing: shading,
  frame: graphite,
  tyre: graphite,
  metal: graphite,
  detail: true,
  far: 0.7,
};

/** Warm ivory drawing paper: tooth, a faint emboss, window light from the upper left and a soft vignette. */
const Paper = (): SceneElement => (
  <Group>
    <Shape
      geometry={rect(W, H)}
      fill={[
        ivory,
        {
          paint: noise({
            frequency: 0.9,
            octaves: 2,
            seed: 3,
            ramp: [
              [0.3, alpha("#B9AF9C", 0)],
              [0.85, alpha("#B9AF9C", 0.55)],
            ],
          }),
          opacity: 0.5,
        },
        {
          paint: noise({
            frequency: 0.55,
            octaves: 2,
            seed: 9,
            ramp: [
              [0, "#FFFFFF"],
              [1, "#8E8676"],
            ],
          }),
          blend: "overlay",
          opacity: 0.35,
          effects: [emboss({ light: { azimuth: 315, elevation: 40 }, depth: 0.8 })],
        },
        {
          paint: noise({
            frequency: 0.004,
            octaves: 3,
            seed: 5,
            ramp: [
              [0.3, alpha("#C9BFA8", 0)],
              [0.9, alpha("#C9BFA8", 0.14)],
            ],
          }),
        },
      ]}
    />
    <Shape
      geometry={rect(W, H)}
      fill={radial({
        center: [0.18 * W, 0.08 * H],
        radius: [0.95 * W, 0.7 * H],
        stops: [
          [0, alpha("#FFFDF4", 0.8)],
          [0.5, alpha("#FFFDF4", 0.22)],
          [1, alpha("#FFFDF4", 0)],
        ],
      })}
      opacity={1}
    />
    <Shape
      geometry={rect(W, H)}
      fill={radial({
        center: [W / 2, H / 2],
        radius: [0.78 * W, 0.8 * H],
        stops: [
          [0.5, alpha("#5E513D", 0)],
          [1, alpha("#5E513D", 0.32)],
        ],
      })}
    />
  </Group>
);

const points: readonly Vec[] = [
  [-60, GROUND_Y + 2],
  [180, GROUND_Y - 1.5],
  [420, GROUND_Y + 2.5],
  [700, GROUND_Y - 1],
  [960, GROUND_Y + 2],
  [1340, GROUND_Y - 2],
];

const wavering = spline(points);

/** The shared horizon: a near-flat arc on the pencil line's base, so it can morph into the next shot's curve. */
const world = horizon(GROUND_Y, 40000);

const pencil = [displace({ scale: 1.6, frequency: 0.9, seed: 12, octaves: 2 })];
const LINE_SPAN = span(0.3, 1.5);
const travel = track<Vec>([0, 0]).to([70, 0], span(1.4, OPEN - 2), ease.linear);

export const Open = (): SceneElement => (
  <Group>
    <Paper />
    <Group motion={enter(span(0.9, 0.9), { curve: ease.inOut })}>
      <Shape
        key="horizon"
        geometry={world.visible(world.reach)}
        offset={world.center}
        stroke={{ color: alpha(graphite, 0.85), width: 1.4 }}
      />
    </Group>
    <Group
      scale={track(1).to(1.05, span(0, OPEN), ease.linear)}
      origin={{ frame: [W / 2, GROUND_Y] }}
    >
      <Group effects={pencil}>
        <Shape
          geometry={wavering}
          stroke={{ color: alpha(graphite, 0.85), width: 1.4 }}
          draw={track(0).to(1, LINE_SPAN, ease.inOut)}
        />
      </Group>
      <Group offset={[W / 2 - 70, GROUND_Y]} motion={{ offset: travel }}>
        <Group scale={SCALE} origin="own" effects={pencil}>
          <Group motion={enter(span(1.0, 1), { from: { opacity: 0 }, curve: ease.out })}>
            <Pelican look={look} />
          </Group>
          <Group
            effects={[blur(3)]}
            motion={[
              enter(span(0.9, 0.4), { from: { opacity: 0 }, curve: ease.out }),
              exit(span(1.3, 0.9), { curve: ease.inOut }),
            ]}
          >
            <Pelican look={look} />
          </Group>
        </Group>
      </Group>
    </Group>
    <Caption when={[1.4, 3.2]} fill={slate}>
      Every morning, the pelican goes for a ride.
    </Caption>
    <Chapter numeral="I" medium="Graphite" fill={slate} length={OPEN} />
  </Group>
);
