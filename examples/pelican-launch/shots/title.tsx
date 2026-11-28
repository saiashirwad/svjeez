import {
  Group,
  Shape,
  Text,
  alpha,
  ease,
  emboss,
  enter,
  line,
  noise,
  radial,
  rect,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { H, W, clay, ivory, mono, serif, slate } from "../kit";
import { studio } from "../looks";
import { Pelican } from "../rig";

export const TITLE = 7;

const muted = alpha(slate, 0.62);
const GROUND_Y = 560;
const REST_X = 470;

/** Ivory stock with the faintest paper tooth and a soft vignette. */
const Paper = (): SceneElement => (
  <Group>
    <Shape
      geometry={rect(W, H)}
      fill={[
        ivory,
        {
          paint: noise({
            frequency: 0.7,
            octaves: 2,
            seed: 11,
            ramp: [
              [0, "#FFFFFF"],
              [1, "#9A9282"],
            ],
          }),
          blend: "overlay",
          opacity: 0.22,
          effects: [emboss({ light: { azimuth: 315, elevation: 45 }, depth: 0.6 })],
        },
      ]}
    />
    <Shape
      geometry={rect(W, H)}
      fill={radial({
        center: [W / 2, H * 0.46],
        radius: [0.75 * W, 0.8 * H],
        stops: [
          [0.55, alpha("#6B5F4A", 0)],
          [1, alpha("#6B5F4A", 0.16)],
        ],
      })}
    />
  </Group>
);

const ride = track<Vec>([-140, 0]).to([REST_X, 0], span(2.6, 2.4), ease.out);

export const Title = (): SceneElement => (
  <Group>
    <Paper />
    <Text
      font={serif}
      size={96}
      letterSpacing={-2.6}
      fill={slate}
      at={[W / 2, 292]}
      anchor="baseline"
      motion={enter(span(1.0, 1.2), { from: { opacity: 0, offset: [0, 14] }, curve: ease.out })}
    >
      Claude Pelican 1
    </Text>
    <Text
      font={serif}
      italic
      size={30}
      letterSpacing={-0.2}
      fill={muted}
      at={[W / 2, 352]}
      anchor="baseline"
      motion={enter(span(2.0, 1.0), { from: { opacity: 0, offset: [0, 8] }, curve: ease.out })}
    >
      One pelican. Every style.
    </Text>
    <Shape
      geometry={line([W / 2 - 420, GROUND_Y], [W / 2 + 420, GROUND_Y])}
      stroke={{ color: alpha(slate, 0.28), width: 0.8 }}
      motion={enter(span(2.2, 1.2), { curve: ease.out })}
    />
    <Group offset={[0, GROUND_Y]} motion={{ offset: ride }}>
      <Group scale={0.55} origin="own">
        <Pelican look={studio} />
      </Group>
    </Group>
    <Text
      font={mono}
      size={13}
      letterSpacing={2.6}
      fill={clay}
      at={[W / 2, 636]}
      anchor="baseline"
      motion={enter(span(3.6, 1.0), { from: { opacity: 0, offset: [0, 6] }, curve: ease.out })}
    >
      AVAILABLE TODAY IN THE API · claude-pelican-1
    </Text>
  </Group>
);
