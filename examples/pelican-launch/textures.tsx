import {
  Group,
  Shape,
  alpha,
  emboss,
  linear,
  noise,
  pattern,
  radial,
  rect,
  type Paint,
  type PaintLayer,
  type SceneElement,
  type Stops,
  type Vec,
} from "svjeez";
import { H, W } from "./kit";

/**
 * Paper, walls and plumage grain, all in svjeez terms: `noise()` mapped through a color ramp and layered over flat
 * paint. Noise reads its alpha channel as intensity, so a ramp that runs from a translucent to an opaque color is a
 * threshold, and one that stays translucent is a texture to lay over a fill.
 */
const PANEL = { width: 640, height: 360 } as const;

/** An elliptical glow: a radial gradient `rx` by `ry` around `at`, painted over everything near it. */
const Glow = ({
  at,
  rx,
  ry,
  stops,
}: {
  readonly at: Vec;
  readonly rx: number;
  readonly ry: number;
  readonly stops: Stops;
}): SceneElement => (
  <Shape
    offset={at}
    geometry={rect(8000, 8000, { anchor: "center" })}
    fill={radial({ center: [0, 0], radius: [rx, ry], stops })}
  />
);

/** Cyanotype paper: mottled Prussian blue, fine vertical fibres, chalky bleach stains near the edges, a dark vignette. */
export const BlueprintPaper = (): SceneElement => (
  <Group>
    <Shape
      key="sheet"
      geometry={rect(W, H)}
      fill={[
        "#143F80",
        {
          paint: noise({
            frequency: [0.004, 0.006],
            octaves: 4,
            seed: 7,
            ramp: [
              [0, "#598EC4D0"],
              [0.68, alpha("#598EC4", 0)],
            ],
          }),
        },
        {
          paint: noise({
            frequency: [0.9, 0.06],
            octaves: 2,
            seed: 2,
            ramp: [
              [0, "#E1EDFF"],
              [0.57, alpha("#E1EDFF", 0)],
            ],
          }),
          opacity: 0.18,
        },
      ]}
    />
    <Shape
      key="stain"
      geometry={rect(W, H)}
      opacity={0.8}
      fill={noise({
        frequency: 0.012,
        octaves: 5,
        seed: 11,
        ramp: [
          [0.52, alpha("#EFF6FF", 0)],
          [0.74, "#EFF6FF"],
        ],
      })}
      mask={
        <Glow
          at={[W / 2, H / 2]}
          rx={0.72 * W}
          ry={0.72 * H}
          stops={[
            [0.62, alpha("#000000", 0)],
            [1, "#FFFFFF"],
          ]}
        />
      }
    />
    <Glow
      at={[W / 2, 0.45 * H]}
      rx={0.75 * W}
      ry={0.75 * H}
      stops={[
        [0.55, alpha("#020A1C", 0)],
        [1, "#020A1CA6"],
      ]}
    />
  </Group>
);

/**
 * Feather barbs: noise stretched along x into fine fibres, as a near-white multiply layer (white leaves the paint
 * alone, grey darkens it), with a warm cast in the darks.
 */
export const featherGrain = (rotate = 0): Paint =>
  noise({
    frequency: [0.09, 0.7],
    octaves: 3,
    seed: 5,
    rotate,
    ramp: [
      [0.2, "#ADAAA0"],
      [0.5, "#F0EDE5"],
      [0.62, "#FFFFFF"],
    ],
  });

/** A seamless studio sweep: warm grey wall, a lit patch behind the subject, a floor that falls into shadow. */
export const StudioSweep = ({
  w = W,
  h = H,
}: { readonly w?: number; readonly h?: number } = {}): SceneElement => (
  <Group>
    <Shape
      key="wall"
      geometry={rect(w, h)}
      fill={[
        linear.across({
          angle: 90,
          stops: [
            [0, "#C9C3B8"],
            [0.78, "#E9E5DD"],
            [0.86, "#E4DFD6"],
            [1, "#B9B2A6"],
          ],
        }),
      ]}
    />
    <Glow
      at={[w / 2, 0.52 * h]}
      rx={0.48 * w}
      ry={0.48 * h}
      stops={["#FFFDF8D9", alpha("#FFFDF8", 0)]}
    />
    <Shape
      key="tooth"
      geometry={rect(w, h)}
      opacity={0.35}
      fill={noise({
        frequency: 0.75,
        octaves: 2,
        seed: 4,
        ramp: [
          [0, "#958E818C"],
          [0.61, alpha("#958E81", 0)],
        ],
      })}
    />
    <Glow
      at={[w / 2, h / 2]}
      rx={0.75 * w}
      ry={0.75 * h}
      stops={[
        [0.6, alpha("#1B160F", 0)],
        [1, "#1B160F73"],
      ]}
    />
  </Group>
);

const laid: Paint = pattern({
  size: [4, 3],
  tile: <Shape geometry={rect(4, 0.6)} fill={alpha("#8A6F45", 0.08)} />,
});

const chain: Paint = pattern({
  size: [72, 10],
  tile: <Shape geometry={rect(0.8, 10)} fill={alpha("#8A6F45", 0.1)} />,
});

/** Laid paper: cream stock, faint laid and chain lines, brown foxing, yellowed edges. */
export const LaidPaper = (): SceneElement => (
  <Group>
    <Shape
      key="laid"
      geometry={rect(PANEL.width, PANEL.height)}
      fill={[
        "#EFE5CE",
        {
          paint: noise({
            frequency: 0.5,
            octaves: 2,
            seed: 3,
            ramp: [
              [0, "#BCAA8980"],
              [0.625, alpha("#BCAA89", 0)],
            ],
          }),
          opacity: 0.4,
        },
        laid,
        chain,
        {
          paint: noise({
            frequency: 0.07,
            octaves: 4,
            seed: 21,
            ramp: [
              [0.658, alpha("#C4A26F", 0)],
              [0.742, "#C4A26F"],
            ],
          }),
          opacity: 0.3,
        },
      ]}
    />
    <Glow
      at={[PANEL.width / 2, PANEL.height / 2]}
      rx={0.72 * PANEL.width}
      ry={0.72 * PANEL.height}
      stops={[
        [0.55, alpha("#B08A4A", 0)],
        [1, "#B08A4A59"],
      ]}
    />
  </Group>
);

/**
 * Cold-pressed paper tooth: noise whose own alpha is the height, lit from the top left so it stands up in relief.
 */
const tooth: PaintLayer = {
  paint: noise({
    frequency: 0.08,
    octaves: 4,
    seed: 8,
    ramp: ["#FFFDF780", "#FFFDF7"],
  }),
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

/** Cold-pressed watercolor paper: the tooth lit in relief over warm white, washed back a little. */
export const ColdPress = (): SceneElement => (
  <Shape
    geometry={rect(PANEL.width, PANEL.height)}
    fill={["#F7F3EA", tooth, { paint: "#F7F3EA", opacity: 0.55 }]}
  />
);

/** The same tooth as a multiply layer over the paint, so pigment settles into the paper's dips. */
export const Granulation = (): SceneElement => (
  <Shape geometry={rect(PANEL.width, PANEL.height)} fill={[tooth]} blend="multiply" opacity={0.4} />
);

/** Risograph stock: off-white with stray ink specks. */
export const RisoPaper = (): SceneElement => (
  <Shape
    key="riso"
    geometry={rect(PANEL.width, PANEL.height)}
    fill={[
      "#F4F0E6",
      {
        paint: noise({
          frequency: 0.8,
          octaves: 1,
          seed: 13,
          ramp: [
            [0.657, alpha("#5989C4", 0)],
            [0.729, "#5989C4"],
          ],
        }),
        opacity: 0.7,
      },
    ]}
  />
);
