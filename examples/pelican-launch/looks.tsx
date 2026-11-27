import {
  Group,
  Shape,
  alpha,
  circle,
  line,
  linear,
  none,
  pattern,
  radial,
  rect,
  type Color,
  type Paint,
} from "svjeez";
import { slate } from "./kit";
import type { Look } from "./rig";
import { featherGrain } from "./textures";

/** Studio: a lit, photographic white pelican. Outlines fade almost into the shading. */
export const studio: Look = {
  line: "#A39887",
  width: 0.3,
  shade: "#5A4E40",
  body: radial.across({ center: [0.55, 0.25], stops: ["#FFFFFF", "#F6F2EA", "#D8D0C2"] }),
  wing: linear.across({ angle: 90, stops: ["#FFFFFF", "#E9E3D8"] }),
  primaries: linear.across({ angle: 0, stops: ["#121110", "#3A3632"] }),
  beak: linear.across({ angle: 0, stops: ["#F2C14E", "#E9963A", "#D9663A"] }),
  pouch: linear.across({ angle: 90, stops: ["#F4B25A", "#E58A3E"] }),
  skin: "#F3C7A1",
  leg: "#EE8F3A",
  frame: "#2F5D62",
  metal: "#8C918F",
  tyre: "#1D1B19",
  detail: true,
  incise: slate,
  finish: {
    grain: featherGrain,
    grainOpacity: 0.22,
    form: "#4A3F33",
    light: "#FFFFFF",
    feather: linear.across({ angle: 90, stops: ["#FFFFFF", "#F1ECE3", "#DCD4C7"] }),
    featherEdge: "#C4BBAE",
    vein: "#B8402C",
  },
};

/** Parallel engraved lines over an optional hand-applied tint, as one pattern paint. */
const hatch = (ink: Color, gap: number, angle: number, weight: number, tint?: Color): Paint =>
  pattern({
    size: [gap, gap],
    rotate: angle,
    tile: (
      <Group>
        {tint && <Shape geometry={rect(gap, gap)} offset={[gap / 2, gap / 2]} fill={tint} />}
        <Shape
          geometry={line([0, gap / 2], [gap, gap / 2])}
          stroke={{ color: ink, width: weight }}
        />
      </Group>
    ),
  });

const crosshatch = (ink: Color, gap: number, weight: number): Paint =>
  pattern({
    size: [gap, gap],
    rotate: 30,
    tile: (
      <Group>
        <Shape
          geometry={line([0, gap / 2], [gap, gap / 2])}
          stroke={{ color: ink, width: weight }}
        />
        <Shape
          geometry={line([gap / 2, 0], [gap / 2, gap])}
          stroke={{ color: ink, width: weight }}
        />
      </Group>
    ),
  });

const sepia: Color = "#3A2A1C";

/** Audubon plate: sepia line engraving on laid paper, hand-tinted where the bird has color. */
export const engraving: Look = {
  line: sepia,
  width: 0.42,
  body: hatch(alpha(sepia, 0.35), 1.5, -28, 0.16, "#F3EAD6"),
  wing: hatch(alpha(sepia, 0.5), 1.2, -40, 0.18, "#EFE4CC"),
  primaries: crosshatch(sepia, 1, 0.42),
  beak: hatch(alpha(sepia, 0.55), 1.1, 18, 0.2, "#E8B25E"),
  pouch: hatch(alpha(sepia, 0.45), 1.3, 80, 0.18, "#E3925A"),
  skin: "#E9B48A",
  leg: "#D98A4A",
  frame: sepia,
  metal: sepia,
  tyre: sepia,
  detail: true,
  far: 0.8,
};

/** Watercolor: transparent washes, no hard line, pooled pigment at the edges. */
export const watercolor: Look = {
  line: alpha("#5B4A3B", 0.45),
  width: 0.3,
  body: radial.across({
    center: [0.5, 0.25],
    stops: [alpha("#FFFFFF", 0), alpha("#C9D3DC", 0.55), alpha("#8E9EAE", 0.75)],
  }),
  wing: radial.across({
    center: [0.4, 0.2],
    stops: [alpha("#E4E9EE", 0.2), alpha("#A6B3C1", 0.7)],
  }),
  primaries: alpha("#2D2A35", 0.88),
  beak: linear.across({ angle: 0, stops: [alpha("#F5C04A", 0.9), alpha("#E8742E", 0.9)] }),
  pouch: linear.across({ angle: 90, stops: [alpha("#F5A04A", 0.75), alpha("#D9552C", 0.85)] }),
  skin: alpha("#F0A882", 0.8),
  leg: alpha("#E8792E", 0.9),
  frame: alpha("#2E6F8E", 0.85),
  metal: alpha("#6E7B85", 0.7),
  tyre: alpha("#2B2A30", 0.85),
  detail: true,
  far: 0.8,
};

const riso = { pink: "#FF48B0", blue: "#0078BF" } as const;

const halftone = (ink: Color, dot: number): Paint =>
  pattern({
    size: [1.8, 1.8],
    rotate: 15,
    tile: <Shape geometry={circle(dot)} offset={[0.9, 0.9]} fill={ink} />,
  });

/** Risograph, pink drum: the warm parts only, in fluorescent pink and its halftones. */
export const risoPink: Look = {
  line: none,
  width: 0.4,
  body: halftone(riso.pink, 0.22),
  wing: halftone(riso.pink, 0.3),
  primaries: halftone(riso.pink, 0.5),
  beak: riso.pink,
  pouch: halftone(riso.pink, 0.75),
  skin: riso.pink,
  leg: riso.pink,
  frame: riso.pink,
  metal: none,
  tyre: none,
  detail: false,
  far: 1,
};

/** Risograph, blue drum: line work and the cool shadows. */
export const risoBlue: Look = {
  line: riso.blue,
  width: 0.45,
  wing: halftone(riso.blue, 0.28),
  primaries: riso.blue,
  beak: halftone(riso.blue, 0.2),
  frame: riso.blue,
  tyre: riso.blue,
  metal: riso.blue,
  leg: halftone(riso.blue, 0.35),
  detail: true,
  far: 1,
};
