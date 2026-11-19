import { Group, Shape, Text, circle, ease, line, rect, scene, span, track, type Vec } from "svjeez";
import { mono, theme } from "../theme";

const theta = track(0).to(360, span(0.3, 4), ease.inOut).rewind(1.2, ease.inOut);

const CENTER: Vec = [140, 150];
const RADIUS = 90;

const WAVE = { x: 290, y: 150, width: 300, height: 80 } as const;

const DEG = Math.PI / 180;

const onDial = (t: number): Vec => [
  CENTER[0] + RADIUS * Math.cos(t * DEG),
  CENTER[1] - RADIUS * Math.sin(t * DEG),
];

const onWave = (t: number): Vec => [
  WAVE.x + (t / 360) * WAVE.width,
  WAVE.y - WAVE.height * Math.sin(t * DEG),
];

const wave = line(...Array.from({ length: 73 }, (_, i) => onWave(i * 5)));

export default scene(
  {
    size: [640, 300],
    duration: 6,
    title: "Derived tracks",
    desc: "One angle track turns a spoke round a dial, carries a point round its rim and along a sine wave, and fills a bar as it goes, then winds them all back.",
    theme,
    still: 2,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={circle(RADIUS)}
        at={CENTER}
        anchor="center"
        stroke={{ color: theme.border, width: 1.5 }}
      />
      <Shape
        geometry={line([WAVE.x, WAVE.y], [WAVE.x + WAVE.width, WAVE.y])}
        stroke={{ color: theme.border, width: 1 }}
      />
      <Shape geometry={wave} stroke={{ color: theme.raised, width: 2, join: "round" }} />
      <Shape
        geometry={line([0, 0], [RADIUS, 0])}
        at={CENTER}
        anchor="left"
        origin="left"
        rotate={theta.map((t) => -t)}
        stroke={{ color: theme.text, width: 2, cap: "round" }}
      />
      <Shape geometry={circle(4)} at={CENTER} anchor="center" fill={theme.text} />
      <Shape geometry={circle(7)} at={theta.map(onDial)} anchor="center" fill={theme.blue} />
      <Shape geometry={circle(7)} at={theta.map(onWave)} anchor="center" fill={theme.orange} />
      <Shape
        geometry={rect(WAVE.width, 10, { radius: 5 })}
        at={[WAVE.x, 262]}
        fill={theme.surface}
      />
      <Shape
        geometry={theta.map((t) => rect(10 + (t / 360) * (WAVE.width - 10), 10, { radius: 5 }))}
        at={[WAVE.x, 262]}
        fill={theme.green}
      />
      <Text font={mono} size={12} at={[WAVE.x, 252]} anchor="baseline-left" fill={theme.muted}>
        {"0°"}
      </Text>
      <Text
        font={mono}
        size={12}
        at={[WAVE.x + WAVE.width, 252]}
        anchor="baseline-right"
        fill={theme.muted}
      >
        {"360°"}
      </Text>
    </Group>
  ),
);
