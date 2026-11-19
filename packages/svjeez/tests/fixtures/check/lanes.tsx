import { Group, Shape, blur, circle, morph, rect, scene, span, track } from "svjeez";

export default scene({ size: [200, 100], duration: 4, title: "Lanes" }, () => (
  <Group>
    <Shape geometry={rect(200, 100)} fill="#111111" />
    <Shape
      key="fade"
      geometry={rect(20, 20)}
      fill="#FFFFFF"
      opacity={track(0).to(1, span(0.5, 1))}
    />
    {morph(
      <Shape key="blob" geometry={rect(40, 20)} fill="#FF0000" at={[60, 20]} />,
      <Shape key="blob" geometry={circle(12)} fill="#FF0000" at={[60, 20]} />,
      span(1, 1),
    )}
    <Shape
      key="glow"
      geometry={rect(20, 20)}
      fill="#00FF00"
      at={[140, 20]}
      effects={[blur(track(8).to(2, span(0, 2)))]}
    />
  </Group>
));
