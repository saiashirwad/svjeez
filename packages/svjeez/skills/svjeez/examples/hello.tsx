/** @jsxImportSource svjeez */
import { Group, Shape, Text, circle, ease, enter, path, scene, span, track } from "svjeez";
import { sans, theme } from "./style";

export default scene(
  {
    size: [240, 140],
    duration: 4,
    loop: false,
    title: "Hello",
    desc: "A curve draws itself, a dot pops in on top of it, and the word hello sits below.",
    theme,
    still: 2.5,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={path().moveTo([20, 110]).curveTo([80, 20], [160, 20], [220, 110])}
        stroke={{ color: theme.blue, width: 4, cap: "round" }}
        draw={track(0).to(1, span(0.2, 1.2))}
      />
      <Shape
        geometry={circle(8)}
        offset={[120, 44]}
        fill={theme.text}
        motion={enter(span(1.2, 0.5), { from: { scale: 0 }, curve: ease.pop })}
      />
      <Text font={sans} size={14} at={[120, 132]} anchor="baseline" fill={theme.text}>
        hello
      </Text>
    </Group>
  ),
);
