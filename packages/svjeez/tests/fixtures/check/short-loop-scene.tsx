import { Group, Shape, circle, ease, scene, span, track } from "svjeez";

export default scene({ size: [100, 50], duration: 8, loop: true, title: "Short loop" }, () => (
  <Group>
    <Shape
      geometry={circle(5)}
      fill="#38BDF8"
      at={track<[number, number]>([10, 25]).to([90, 25], span(0, 3), ease.inOut).loop(4)}
    />
  </Group>
));
