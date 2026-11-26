// readme/basic.tsx written with h() instead of JSX: a plain .ts file, no JSX settings needed.
import { Group, Shape, circle, ease, enter, h, path, scene, span, track } from "svjeez";
import { theme } from "../theme";

export default scene(
  {
    size: [200, 120],
    duration: 4,
    title: "Hello",
    desc: "A curve draws itself, then a dot pops in above it.",
    theme,
    still: 3,
    loop: false,
  },
  (canvas) =>
    h(
      Group,
      null,
      h(Shape, { geometry: canvas.rect, fill: theme.background }),
      h(Shape, {
        geometry: path().moveTo([20, 100]).curveTo([60, 20], [140, 20], [180, 100]),
        stroke: { color: "#FF5FA8", width: 4 },
        draw: track(0).to(1, span(0.2, 1.2)),
      }),
      h(Shape, {
        geometry: circle(8),
        offset: [100, 40],
        fill: "#3EE6D6",
        motion: enter(span(1.2, 0.5), { from: { scale: 0 }, curve: ease.pop }),
      }),
    ),
);
