import { Group, Shape, circle, rect, scene, span, track } from "svjeez";

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
