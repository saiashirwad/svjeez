import { highlight, type CodeRole } from "@svjeez/code";
import {
  Center,
  Group,
  Run,
  Shape,
  Stack,
  Text,
  circle,
  ease,
  mix,
  path,
  rect,
  track,
  type Anim,
  type Paint,
  type Ref,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import type { Anchor, Child, Layers } from "svjeez/tools";
import { mono, theme } from "../../../examples/theme";
import { CODE } from "../palettes";

// An editor's pieces: a window, a selection frame, and code that arrives a line at a time.

export const BAR = 40;

interface WindowProps {
  readonly handle?: Ref;
  readonly size: Vec;
  readonly title: string;
  readonly children?: Child;
}

/** A window with traffic lights and its file name in the title bar, its page under the bar. The border takes a unit on each side. */
export const Window = ({ handle, size: [w, h], title, children }: WindowProps): SceneElement => (
  <Stack
    ref={handle}
    width={w}
    height={h}
    radius={12}
    fill={theme.background}
    stroke={{ color: theme.raised, width: 1 }}
  >
    <Group>
      <Center width={w - 2} height={BAR}>
        <Text font={mono} size={12} fill={theme.muted}>
          {title}
        </Text>
      </Center>
      <Stack direction="row" gap={7} height={BAR} align="center" padding={[14, 0]}>
        {[theme.red, theme.yellow, theme.green].map((fill) => (
          <Shape geometry={circle(5.5)} fill={fill} />
        ))}
      </Stack>
      <Shape geometry={rect(w - 2, 1)} at={[0, BAR - 1]} fill={theme.surface} />
    </Group>
    {children}
  </Stack>
);

interface SelectionProps {
  readonly size: Vec;
  /** The marching ants' dash offset. */
  readonly march: Anim<number>;
}

/** A dashed selection frame with a handle on each corner. */
export const Selection = ({ size: [w, h], march }: SelectionProps): SceneElement => (
  <Group>
    <Shape
      geometry={rect(w, h, { radius: 4 })}
      stroke={{ color: theme.blue, width: 1.5, dash: [7, 5], dashOffset: march }}
    />
    {[0, w].flatMap((x) =>
      [0, h].map((y) => (
        <Shape
          geometry={rect(8, 8, { radius: 1.5 })}
          at={[x, y]}
          anchor="center"
          fill={theme.background}
          stroke={{ color: theme.blue, width: 1.5 }}
        />
      )),
    )}
  </Group>
);

/** The code's type size, and the distance from one baseline to the next. */
export const SIZE = 18;
export const ROW = SIZE * 2.2;

const { ascent, descent } = mono.metrics;

/** Where a word sits in a listing's line: its baseline's left end, and its width. */
export interface Word {
  readonly baseline: Anchor;
  readonly width: number;
}

/** The first `word` in `source`, found in the listing `code` by its line's key, `line<n>`. */
export const word = (code: Ref, source: string, text: string): Word => {
  const lines = source.split("\n");
  const n = lines.findIndex((l) => l.includes(text));
  const before = mono.measure(lines[n]!.slice(0, lines[n]!.indexOf(text)), SIZE);

  return {
    baseline: code.part(`line${n}`).topLeft.map(([x, y]) => [x + before, y + ascent * SIZE]),
    width: mono.measure(text, SIZE),
  };
};

/**
 * Each code role's color, from the theme's tokens as the site's code blocks use them. Types are deepened toward the
 * text, as the theme's yellow is too light to read on a light background at this size.
 */
const ink = (role: CodeRole): Paint =>
  role === "type" ? mix(theme.yellow, theme.text, 0.55) : theme[CODE[role]];

/** One line of TSX, colored by role from the theme's tokens. */
export const CodeLine = ({
  source,
  key,
  motion,
  scheme,
}: {
  source: string;
  key?: string;
  motion?: Layers;
  /** The one color scheme it shows in. */
  scheme?: "light" | "dark";
}) => (
  <Text key={key} font={mono} size={SIZE} motion={motion} scheme={scheme}>
    {highlight(source, "tsx")[0]!.map(([role, text]) => (
      <Run fill={ink(role)}>{text}</Run>
    ))}
  </Text>
);

/** Lines stacked a `ROW` apart, each keyed `line<n>`, so `word()` can find them. */
export const Listing = ({
  handle,
  motion,
  children,
}: {
  handle: Ref;
  motion?: Layers;
  children: Child;
}) => (
  <Stack ref={handle} motion={motion} gap={ROW - (ascent + descent) * SIZE} padding={[33, 26]}>
    {children}
  </Stack>
);

interface SquiggleProps {
  readonly under: Word;
  readonly color: Paint;
  /** Drawn in over `draw`, faded out over `out`. */
  readonly draw: Span;
  readonly out: Span;
  /** The one color scheme it shows in. */
  readonly scheme?: "light" | "dark";
}

/** A hand-drawn wavy underline under a word. */
export const Squiggle = ({
  under: { baseline, width },
  color,
  draw,
  out,
  scheme,
}: SquiggleProps) => {
  const waves = Math.max(2, Math.round(width / 7));
  const step = (width - 4) / waves;

  const wave = Array.from({ length: waves }, (_, i) => i).reduce(
    (d, i) => d.quadTo([(i + 0.5) * step, i % 2 ? 3 : -3], [(i + 1) * step, 0]),
    path().moveTo([0, 0]),
  );

  return (
    <Group
      offset={baseline.map(([x, y]) => [x + 2, y + 6])}
      opacity={track(1).to(0, out)}
      scheme={scheme}
    >
      <Shape
        geometry={wave}
        stroke={{ color, width: 3, cap: "round" }}
        draw={track(0).to(1, draw, ease.linear)}
      />
    </Group>
  );
};
