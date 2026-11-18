/** @jsxImportSource svjeez/scene */
import { Group, Shape, rect, scene, span, track } from "svjeez/scene";

// A scene-model scene with one fault for `svjeez check`: a square that never comes onto the canvas.
export default scene({ size: [100, 60], duration: 2, title: "Model" }, () => (
  <Group>
    <Shape geometry={rect(100, 60)} fill="#111111" />
    <Shape key="lost" geometry={rect(10, 10)} fill="#FFFFFF" at={[300, 20]} />
    <Shape
      key="dot"
      geometry={rect(10, 10)}
      fill="#FFFFFF"
      at={track([10, 20]).to([40, 20], span(0, 1)).to([10, 20], span(1, 1))}
    />
  </Group>
));
