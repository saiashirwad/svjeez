/** @jsxImportSource svjeez/scene */
import { Group, Shape, canvas, circle, draw, ease, enter, path, scene, span } from "svjeez/scene";
import { theme } from "../theme";

export default scene(
  {
    size: [200, 120],
    duration: 4,
    title: "Hello",
    desc: "A curve draws itself, then a dot pops in above it.",
    theme,
    reducedMotion: 3,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={path().moveTo([20, 100]).curveTo([60, 20], [140, 20], [180, 100])}
        stroke={{ color: "#FF5FA8", width: 4 }}
        trim={draw(span(0.2, 1.2))}
      />
      <Shape
        geometry={circle(8)}
        at={[100, 40]}
        fill="#3EE6D6"
        motion={enter(span(1.2, 0.5), { from: { scale: 0 }, curve: ease.pop })}
      />
    </Group>
  ),
);
