import { Group, Text, ease, enter, exit, span, tokens, type SceneElement } from "svjeez";
import { google } from "@svjeez/fonts";
import { geist } from "../../../../examples/fonts/faces";

export { geist };

/** Geist Mono, for code, terminals and labels: the sans's own mono, with no slab serifs on its i, l and r. */
export const mono = await google("Geist Mono", {
  fallback: ["ui-monospace", "Menlo", "monospace"],
  ligatures: false,
});

/** Geist's grays, hairlines and a few accents, used sparingly: black and white do most of the work. */
export const theme = tokens({
  light: {
    background: "#FFFFFF",
    surface: "#FAFAFA",
    line: "#EBEBEB",
    strong: "#D4D4D4",
    faint: "#8F8F8F",
    muted: "#666666",
    text: "#171717",
    blue: "#0070F3",
    purple: "#8E4EC6",
    pink: "#E93D82",
    teal: "#0F9F8D",
    green: "#1F9D4A",
    clay: "#C96442",
  },
  dark: {
    background: "#000000",
    surface: "#0A0A0A",
    line: "#242424",
    strong: "#333333",
    faint: "#6E6E6E",
    muted: "#A1A1A1",
    text: "#EDEDED",
    blue: "#3291FF",
    purple: "#A475F9",
    pink: "#F75F8F",
    teal: "#0AC5B3",
    green: "#3DD68C",
    clay: "#D97757",
  },
});

export const W = 1280;
export const H = 720;

/** The stage every shot plays on, between the tag opening and the tag closing. */
export const STAGE = { x: 80, y: 140, w: 1120, h: 500, radius: 12 } as const;

/** The four colors that carry from shot to shot, so the film reads as one object changing. */
export const ACCENTS = [theme.blue, theme.purple, theme.pink, theme.teal] as const;

export const spring = ease.spring({ stiffness: 170, damping: 17 });

/** When each shot plays, in the film's seconds. */
export const SHOTS = {
  open: span(0, 5),
  claude: span(5, 9),
  morph: span(14, 10),
  arrows: span(24, 9),
  filming: span(33, 8),
  montage: span(41, 5.5),
  anything: span(46.5, 3.5),
  facts: span(50, 4),
  close: span(54, 5.5),
} as const;

export const D = SHOTS.close.end;

interface HeaderProps {
  readonly title: string;
  readonly from: string;
  /** How long the shot is, so the header can leave before the next one comes in. */
  readonly over: number;
}

/** A shot's headline on the left and the packages it uses on the right, over the stage. */
export const Header = ({ title, from, over }: HeaderProps): SceneElement => (
  <Group
    motion={[
      enter(span(0.15, 0.4), { from: { opacity: 0, offset: [0, 8] } }),
      exit(span(over - 0.4, 0.3)),
    ]}
  >
    <Text
      font={geist}
      weight={600}
      size={40}
      letterSpacing={-1.6}
      at={[STAGE.x, 98]}
      anchor="baseline-left"
      fill={theme.text}
    >
      {title}
    </Text>
    <Text
      font={mono}
      size={16}
      at={[STAGE.x + STAGE.w, 96]}
      anchor="baseline-right"
      fill={theme.muted}
    >
      {from}
    </Text>
  </Group>
);

/** In then out over a shot's own time: the shot's content fades and lifts in, and fades out at its end. */
export const shown = (over: number, after = 0.3) => [
  enter(span(after, 0.45), { from: { opacity: 0, offset: [0, 12] }, curve: ease.out }),
  exit(span(over - 0.45, 0.35), { curve: ease.in }),
];
