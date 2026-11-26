/** @jsxImportSource svjeez */
import {
  Group,
  Sequence,
  Series,
  Shape,
  circle,
  ease,
  enter,
  exit,
  keyframes,
  path,
  rect,
  ride,
  scene,
  span,
  timeAt,
  tokens,
  track,
  wiggle,
} from "svjeez";

const theme = tokens({
  light: {
    background: "#FFFFFF",
    border: "#6B7280",
    blue: "#0A6CFF",
    green: "#1A7F37",
    orange: "#D95D00",
    magenta: "#C2185B",
    cyan: "#007A87",
  },
  dark: {
    background: "#090A0C",
    border: "#8B949E",
    blue: "#64D2FF",
    green: "#3FB950",
    orange: "#FF9F43",
    magenta: "#FF5CA8",
    cyan: "#5CE1E6",
  },
});

const route = path().moveTo([20, 90]).curveTo([60, 10], [140, 10], [180, 90]);
const run = track(0).to(1, span(0.3, 1.5), ease.inOut);
const [a, b, c] = span(0.2, 0.4).cascade(3, 0.15);
const landed = timeAt(run, 1) ?? 1.8;

export default scene(
  {
    size: [200, 120],
    duration: 4,
    title: "Timing patterns",
    desc: "A dot rides a curve while bars cascade in, followed by a sequence and series.",
    theme,
    still: 3.5,
    loop: false,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape geometry={route} stroke={{ color: theme.border, width: 2 }} draw={run} />
      <Shape
        geometry={circle(5)}
        fill={theme.blue}
        motion={[ride(route, run, { turn: true }), enter(span(0, 0.2))]}
      />
      {[a, b, c].map((when, i) => (
        <Shape
          key={`bar${i}`}
          geometry={rect(20, 8, { radius: 3 })}
          at={[20 + i * 26, 100]}
          fill={theme.green}
          motion={enter(when, { from: { offset: [0, 8] } })}
        />
      ))}
      <Shape
        key="pulse"
        geometry={circle(4)}
        offset={[100, 60]}
        fill={theme.orange}
        scale={keyframes([
          [0, 0],
          [landed, 0],
          [landed + 0.3, 1.6, ease.pop],
          [landed + 0.7, 1],
        ])}
        motion={wiggle({ offset: [2, 2] }, { seed: "pulse" })}
      />
      <Sequence when={span(2, 1.5)}>
        <Shape
          geometry={rect(30, 6, { radius: 2 })}
          at={[130, 100]}
          fill={theme.magenta}
          opacity={track(0).to(1, span(0, 0.3)).to(0, span(1, 0.4))}
        />
      </Sequence>
      <Series gap={0.2}>
        <Sequence when={span(0, 1)}>
          <Shape
            key="s1"
            geometry={circle(3)}
            offset={[150, 26]}
            fill={theme.cyan}
            motion={exit(span(0.5, 0.3))}
          />
        </Sequence>
        <Sequence when={span(0, 1.2)}>
          <Shape
            key="s2"
            geometry={circle(3)}
            offset={[165, 26]}
            fill={theme.cyan}
            motion={enter(span(0, 0.3))}
          />
        </Sequence>
      </Series>
    </Group>
  ),
);
