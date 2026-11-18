/** @jsxImportSource svjeez/scene */
import { Group, Shape, arc, canvas, circle, enter, scene, span, spin, wiggle } from "svjeez/scene";
import { theme } from "../theme";

export default scene(
  {
    size: [200, 120],
    duration: 4,
    title: "Loops and stacking",
    desc: "A ring spins on a two second loop beside a dot that fades in and then wanders.",
    theme,
    reducedMotion: 1,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={arc({ radius: 24, sweep: 120 })}
        at={[60, 60]}
        anchor="center"
        stroke={{ color: theme.cyan, width: 5, cap: "round" }}
        rotate={spin({ every: 2 })}
      />
      <Shape
        geometry={circle(10)}
        at={[140, 60]}
        anchor="center"
        fill={theme.magenta}
        motion={[enter(span(0, 0.6)), wiggle({ offset: [4, 4] }, { seed: "dot" })]}
      />
    </Group>
  ),
);
