/** @jsxImportSource svjeez/scene */
import { Group, Shape, canvas, ease, rect, scene, span, track } from "svjeez/scene";
import { theme } from "../theme";

const fadeIn = span(1, 0.5);
const shrink = fadeIn.next(0.4, 2);

export default scene(
  {
    size: [200, 120],
    duration: 5,
    title: "Motion",
    desc: "A square fades in, holds, then shrinks away and cuts back to full size.",
    theme,
    reducedMotion: { at: 2 },
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={rect(48, 48, { radius: 8 })}
        at={[76, 36]}
        fill={theme.blue}
        opacity={track(0).to(1, fadeIn).to(0, shrink, ease.in)}
        scale={track(1).to(0.8, shrink, ease.in).set(1, shrink.end)}
      />
    </Group>
  ),
);
