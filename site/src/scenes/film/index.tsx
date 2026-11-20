import { Group, Sequence, Shape, ease, rect, scene, span, track, type Vec } from "svjeez";
import { Close, PILL } from "./close";
import { D, H, SHOTS, STAGE, W, theme } from "./kit";
import { Host } from "./host";
import { BasicsSlide } from "./basics";
import { FilmCard } from "./card";
import { ClaudeSlide } from "./claude";
import { DiagramSlide, PipelineSlide } from "./connect";
import { FilmingSlide } from "./filming";
import { Anything, Facts } from "./lines";
import { Montage } from "./montage";
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

const stageAt = track<Vec>(corner(TAG.w, TAG.h, [W / 2, H / 2]))
  .to([STAGE.x, STAGE.y], opened, ease.pop)
  .to(corner(PILL.w, PILL.h, [PILL.x, PILL.y]), folded, ease.pop);

export default scene(
  {
    size: [W, H],
    duration: D,
    title: "svjeez promo film: animated SVGs from TSX, written by coding agents",
    desc: "A film compiled into a single SVG file with no JavaScript, opening from an img tag and closing back into it, with the yellow mascot Blip hopping around it. A coding agent is asked for an animated graphic and reads the svjeez skill, writes the scene, checks it and looks at its frames. A scene file then grows an element at a time, and each element plays beside it as it lands: a circle pops in, a wave draws itself, a square springs across, a number counts up. A script films a web app line by line, a montage shows a Mermaid flowchart, a world map, an equation and a chart, the words anything you can describe are handwritten, and three facts close it: no JavaScript, one file, plays in an img tag.",
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
        opacity={track(0)
          .to(1, span(1.3, 0.25))
          .to(0, span(4.7, 0.4))
          .to(1, span(SHOTS.close.start - 0.35, 0.3))}
      />
      <Sequence when={SHOTS.open}>
        <Open />
      </Sequence>
      <Sequence when={SHOTS.claude}>
        <ClaudeSlide />
      </Sequence>
      <Sequence when={SHOTS.basics}>
        <BasicsSlide />
      </Sequence>
      <Sequence when={SHOTS.pipeline}>
        <PipelineSlide />
      </Sequence>
      <Sequence when={SHOTS.diagram}>
        <DiagramSlide />
      </Sequence>
      <Sequence when={SHOTS.card}>
        <FilmCard />
      </Sequence>
      <Sequence when={SHOTS.filming}>
        <FilmingSlide />
      </Sequence>
      <Sequence when={SHOTS.montage}>
        <Montage />
      </Sequence>
      <Sequence when={SHOTS.anything}>
        <Anything />
      </Sequence>
      <Sequence when={SHOTS.facts}>
        <Facts />
      </Sequence>
      <Sequence when={SHOTS.close}>
        <Close />
      </Sequence>
      <Host />
    </Group>
  ),
);
