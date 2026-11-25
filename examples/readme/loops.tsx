import { Group, Shape, arc, circle, ease, enter, exit, scene, span, track, wiggle } from "svjeez";
import { theme } from "../theme";

export default scene(
  {
    size: [200, 120],
    duration: 4,
    title: "Loops and stacking",
    desc: "A ring spins on a two second loop beside a dot that fades in and then wanders.",
    theme,
    still: 1,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={arc({ radius: 24, sweep: 120 })}
        at={[60, 60]}
        anchor="center"
        stroke={{ color: theme.cyan, width: 5, cap: "round" }}
        rotate={track(0).to(360, span(0, 2), ease.linear).loop(2)}
      />
      <Shape
        geometry={circle(10)}
        offset={[140, 60]}
        fill={theme.magenta}
        motion={[
          enter(span(0, 0.6)),
          exit(span(3.4, 0.6)),
          wiggle({ offset: [4, 4] }, { seed: "dot" }),
        ]}
      />
    </Group>
  ),
);
