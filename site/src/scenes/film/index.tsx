import {
  Group,
  Sequence,
  Shape,
  ease,
  line,
  pattern,
  rect,
  scene,
  span,
  track,
  type Vec,
} from "svjeez";
import { Close, PILL } from "./close";
import { D, H, SHOTS, STAGE, W, theme } from "./kit";
import { AgentShot } from "./agent";
import { AppShot, ThemesShot } from "./app";
import { CodeShot } from "./code";
import { DataShot } from "./data";
import { DiagramShot } from "./diagram";
import { Host } from "./host";
import { MathShot } from "./math";
import { Open } from "./open";

// The launch film. It lives in one <img> tag: the tag opens into a stage, the stage plays a shot for each thing svjeez
// does, and folds back into the tag at the end. The stage is one shape for the whole film, so the shots play on it.

// The stage's corner moves with its size, on the same curve, so it grows and shrinks about its middle.
const corner = (w: number, h: number, [x, y]: Vec): Vec => [x - w / 2, y - h / 2];
const TAG = { w: 440, h: 72 } as const;
const opened = span(1.45, 0.75);
const folded = span(SHOTS.close.start, 0.75);

const stageSize = track(rect(TAG.w, TAG.h, { radius: TAG.h / 2 }))
  .to(rect(STAGE.w, STAGE.h, { radius: STAGE.radius }), opened, ease.pop)
  .to(rect(PILL.w, PILL.h, { radius: PILL.h / 2 }), folded, ease.pop);

/** The stage's faint 40px grid and the plus marks at its corners, there only while it is open. */
const GRID = pattern({
  size: [40, 40],
  tile: <Shape geometry={line([0, 0], [40, 0])} stroke={{ color: theme.line, width: 1 }} />,
});

const COLUMNS = pattern({
  size: [40, 40],
  tile: <Shape geometry={line([0, 0], [0, 40])} stroke={{ color: theme.line, width: 1 }} />,
});

const openFor = track(0)
  .to(1, span(2.1, 0.5))
  .to(0, span(SHOTS.close.start - 0.4, 0.3));

const corners: Vec[] = [
  [STAGE.x, STAGE.y],
  [STAGE.x + STAGE.w, STAGE.y],
  [STAGE.x, STAGE.y + STAGE.h],
  [STAGE.x + STAGE.w, STAGE.y + STAGE.h],
];

const Plus = ({ at }: { readonly at: Vec }) => (
  <Group offset={at} opacity={openFor}>
    <Shape geometry={line([-9, 0], [9, 0])} stroke={{ color: theme.faint, width: 1 }} />
    <Shape geometry={line([0, -9], [0, 9])} stroke={{ color: theme.faint, width: 1 }} />
  </Group>
);

const stageAt = track<Vec>(corner(TAG.w, TAG.h, [W / 2, H / 2]))
  .to([STAGE.x, STAGE.y], opened, ease.pop)
  .to(corner(PILL.w, PILL.h, [PILL.x, PILL.y]), folded, ease.pop);

export default scene(
  {
    size: [W, H],
    duration: D,
    title: "svjeez promo film: animated SVGs from TSX, written by coding agents",
    desc: "An animated film compiled into a single SVG file with no JavaScript, opening from an img tag and closing back into it, with the yellow mascot Blip. It shows a coding agent writing a TSX graphic, running svjeez check, looking at stills from svjeez frames, and writing an 18 KB SVG. Then it shows graphics an agent can make with svjeez: a Mermaid flowchart, a weekly request chart beside a world map, a quadratic equation typeset at build time, a code diff, a filmed task app, and a light and dark split with lint checks, before ending with the install commands.",
    theme,
    loop: false,
    still: D - 0.05,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={stageSize}
        at={stageAt}
        fill={theme.background}
        stroke={{ color: theme.line, width: 1 }}
        opacity={track(0).to(1, span(1.3, 0.25))}
      />
      <Group
        clip={rect(STAGE.w - 2, STAGE.h - 2, { radius: STAGE.radius })}
        offset={[STAGE.x + 1, STAGE.y + 1]}
        opacity={openFor}
      >
        <Shape geometry={rect(STAGE.w, STAGE.h)} fill={GRID} opacity={0.7} />
        <Shape geometry={rect(STAGE.w, STAGE.h)} fill={COLUMNS} opacity={0.7} />
      </Group>
      {corners.map((at) => (
        <Plus at={at} />
      ))}
      <Sequence when={SHOTS.open}>
        <Open />
      </Sequence>
      <Sequence when={SHOTS.agent}>
        <AgentShot />
      </Sequence>
      <Sequence when={SHOTS.diagram}>
        <DiagramShot />
      </Sequence>
      <Sequence when={SHOTS.data}>
        <DataShot />
      </Sequence>
      <Sequence when={SHOTS.math}>
        <MathShot />
      </Sequence>
      <Sequence when={SHOTS.code}>
        <CodeShot />
      </Sequence>
      <Sequence when={SHOTS.app}>
        <AppShot />
      </Sequence>
      <Sequence when={SHOTS.themes}>
        <ThemesShot />
      </Sequence>
      <Sequence when={SHOTS.close}>
        <Close />
      </Sequence>
      <Host />
    </Group>
  ),
);
