import {
  Group,
  Shape,
  Stack,
  Text,
  circle,
  ease,
  line,
  path,
  radial,
  rect,
  shadow,
  span,
  track,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import { OG_SIZE } from "@svjeez/og";
import { geist, mono } from "@examples/fonts/faces";
import { theme } from "@examples/theme";
import { BLIP, Blip, GROUND, Pivot } from "../scenes/blip";

// The parts a link-preview card is built from. A page's own `_*.og.tsx` writes its scene in JSX and takes what it
// wants from here, so no two cards need share a layout.

export const SIZE: Vec = [...OG_SIZE];
export const MARGIN = 80;

type Kids = SceneElement | readonly SceneElement[];

/** The card's plain background. */
export const Backdrop = (): SceneElement => (
  <Shape geometry={rect(...SIZE)} fill={theme.background} />
);

interface TimelineProps {
  y?: number;
  marks?: number;
  /** The mark that is lit. */
  active?: number;
  accent?: Paint;
  /** A mark drawn as an empty outline: a frame that is not on the timeline. */
  missing?: number;
}

/** A track across the card with a diamond at each keyframe. */
export const Timeline = ({
  y = 540,
  marks = 5,
  active = 0,
  accent = theme.yellow,
  missing,
}: TimelineProps): SceneElement => {
  const width = SIZE[0] - 2 * MARGIN;

  return (
    <Group at={[MARGIN, y]}>
      <Shape
        geometry={line([0, 0], [width, 0])}
        stroke={{ color: theme.raised, width: 4, cap: "round" }}
      />
      {Array.from({ length: marks }, (_, i) => (
        <Shape
          key={`k${i}`}
          geometry={rect(14, 14, { radius: 3 })}
          at={[(i / (marks - 1)) * width, 0]}
          anchor="center"
          rotate={45}
          fill={i === missing ? theme.background : i === active ? accent : theme.border}
          stroke={i === missing ? { color: theme.red, width: 2 } : undefined}
        />
      ))}
    </Group>
  );
};

interface CopyProps {
  title: string;
  text?: string;
  note?: string;
  titleSize?: number;
  textSize?: number;
  /** The column the text wraps to. */
  width?: number;
}

/** A title, a line under it and a small mono note, stacked and wrapped to a column. */
export const Copy = ({
  title,
  text,
  note,
  titleSize = 96,
  textSize = 36,
  width = 600,
}: CopyProps): SceneElement => (
  <Stack gap={28} align="start">
    <Text font={geist} weight={600} size={titleSize} width={width} fill={theme.text}>
      {title}
    </Text>
    {text !== undefined && text !== "" && (
      <Text font={geist} size={textSize} width={width} fill={theme.muted}>
        {text}
      </Text>
    )}
    {note !== undefined && note !== "" && (
      <Text font={mono} size={22} fill={theme.border}>
        {note}
      </Text>
    )}
  </Stack>
);

interface WindowProps {
  size: Vec;
  at?: Vec;
  /** The title bar's text. */
  title?: string;
  rotate?: number;
  children?: Kids;
}

const BAR = 30;

/** A little window: traffic lights, a title and a body, whose children are placed from its top-left under the bar. */
export const Window = ({
  size: [w, h],
  at = [0, 0],
  title,
  rotate,
  children,
}: WindowProps): SceneElement => (
  <Group at={at} rotate={rotate} anchor="center" origin="center">
    <Shape
      geometry={rect(w, h, { radius: 12 })}
      fill={theme.surface}
      stroke={{ color: theme.raised, width: 1.5 }}
      effects={[shadow({ color: "#000000", offset: [0, 10], blur: 24, opacity: 0.1 })]}
    />
    {[theme.red, theme.yellow, theme.green].map((color, i) => (
      <Shape
        key={`l${i}`}
        geometry={circle(4)}
        at={[16 + i * 13, BAR / 2]}
        anchor="center"
        fill={color}
      />
    ))}
    {title !== undefined && title !== "" && (
      <Text font={mono} size={12} at={[62, BAR / 2]} anchor="left" fill={theme.muted}>
        {title}
      </Text>
    )}
    {/* The body's own frame, so children are placed from its top-left, not from wherever their bounds start. */}
    <Group at={[0, BAR]}>
      <Shape geometry={rect(w, h - BAR)} fill={theme.surface} opacity={0} />
      {children}
    </Group>
  </Group>
);

interface ChipProps {
  label: string;
  color: Paint;
  size: Vec;
  at?: Vec;
}

/** A pill with a colored dot and a mono label. */
export const Chip = ({ label, color, size: [w, h], at = [0, 0] }: ChipProps): SceneElement => (
  <Group at={at}>
    <Shape
      geometry={rect(w, h, { radius: h / 2 })}
      fill={theme.surface}
      stroke={{ color: theme.raised, width: 1.5 }}
    />
    <Shape geometry={circle(5)} at={[h / 2, h / 2]} anchor="center" fill={color} />
    <Text font={mono} size={18} at={[h / 2 + 14, h / 2]} anchor="left" fill={theme.text}>
      {label}
    </Text>
  </Group>
);

/** A soft radial pool of color. */
export const Glow = ({
  at,
  r = 190,
  color = "#FFC21A",
}: {
  at: Vec;
  r?: number;
  color?: `#${string}`;
}): SceneElement => (
  <Shape
    geometry={circle(r)}
    at={at}
    anchor="center"
    fill={radial.across({
      stops: [
        [0, `${color}59`],
        [1, `${color}00`],
      ],
    })}
  />
);

const bob = span(0, 2);
const bobbing = track(0).to(-8, bob, ease.inOut).to(0, bob.next(2), ease.inOut).loop(4);

/** How Blip holds itself on a card. Every part is optional; Blip's resting pose is the favicon. */
export interface Pose {
  /** Degrees Blip leans about its feet; 180 stands it on its head. */
  readonly tilt?: number;
  /** Width and height scales about its feet: [1.2, 0.8] squashes, [0.85, 1.2] stretches. */
  readonly stretch?: Vec;
  /** Where the eyes look, in Blip's own units, within about 6 either way. */
  readonly look?: Vec;
  /** The antenna bulb lit up. */
  readonly lit?: boolean;
  /** Feet under the body, each moved by its own offset (and turned, for a kick). */
  readonly feet?: { readonly left?: Vec; readonly right?: Vec; readonly kick?: number };
  /** Facing the other way. */
  readonly flip?: boolean;
}

/**
 * Blip, the svjeez mascot, posed. `at` is where its feet touch down and `size` its width; it bobs gently over a card
 * that is already complete at frame 0.
 */
export const Mascot = ({
  at,
  size = 200,
  pose: { tilt = 0, stretch, look, lit, feet, flip } = {},
}: {
  at: Vec;
  size?: number;
  pose?: Pose;
}): SceneElement => {
  const scale = size / 208;

  return (
    <Group motion={{ offset: bobbing.map((y): Vec => [0, y]) }}>
      <Pivot
        around={GROUND}
        at={at}
        motion={{ rotate: tilt, scale: [flip ? -scale : scale, scale] }}
      >
        <Blip
          stretch={stretch && track<Vec>(stretch)}
          look={look && track<Vec>(look)}
          glow={lit ? track<Paint>("#FFF3B0") : undefined}
          feet={
            feet && {
              left: { offset: feet.left ?? [0, 0], rotate: -(feet.kick ?? 0) },
              right: { offset: feet.right ?? [0, 0], rotate: feet.kick ?? 0 },
            }
          }
        />
      </Pivot>
    </Group>
  );
};

/** A four-point sparkle. */
export const Sparkle = ({
  at,
  size = 14,
  color = BLIP.yellow,
}: {
  at: Vec;
  size?: number;
  color?: Paint;
}) => (
  <Shape
    geometry={path.parse("M0 -1L0.25 -0.25L1 0L0.25 0.25L0 1L-0.25 0.25L-1 0L-0.25 -0.25Z")}
    at={at}
    anchor="center"
    scale={size}
    fill={color}
  />
);
