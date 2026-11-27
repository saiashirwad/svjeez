/** @jsxImportSource svjeez */
import { Group, Shape, circle, ease, enter, path, scene, span, tokens, track } from "svjeez";

const theme = tokens({
  light: { background: "#FFFFFF", line: "#2C3038", accent: "#0A6CFF" },
  dark: { background: "#090A0C", line: "#98A0AD", accent: "#64D2FF" },
});

const curve = path().moveTo([24, 90]).curveTo([80, 16], [160, 16], [216, 90]);
const draw = span(0.2, 1.2);

export default scene(
  {
    size: [240, 120],
    duration: 2.5,
    title: "Basic scene",
    desc: "A curve draws on and a dot pops in at its end.",
    theme,
    still: 2.2,
    loop: false,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={curve}
        stroke={{ color: theme.line, width: 2.5, cap: "round" }}
        draw={track(0).to(1, draw, ease.inOut)}
      />
      <Shape
        geometry={circle(7)}
        offset={[216, 90]}
        fill={theme.accent}
        motion={enter(draw.next(0.4), { from: { scale: 0 }, curve: ease.pop })}
      />
    </Group>
  ),
);
