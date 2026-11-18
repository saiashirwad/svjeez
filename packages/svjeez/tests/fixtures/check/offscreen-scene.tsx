/** @jsxImportSource svjeez/scene */
import { Group, Shape, circle, rect, scene, span, track } from "svjeez/scene";

// A scene with one fault for `svjeez check`: a dot placed where the canvas never shows it.
export default scene({ size: [100, 60], duration: 1, title: "Off canvas" }, () => (
  <Group>
    <Shape geometry={rect(100, 60)} fill="#111111" />
    <Shape key="dot" geometry={circle(6)} fill="#FFFFFF" at={[300, 30]} />
    <Shape
      key="bar"
      geometry={rect(10, 4)}
      fill="#FFFFFF"
      at={track([10, 50]).to([80, 50], span(0, 0.5)).rewind(0.5)}
    />
  </Group>
));
