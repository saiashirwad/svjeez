import { Shape, rect, scene, Sequence, span } from "svjeez";

export default scene(
  { size: [100, 60], duration: 4, title: "Markers", markers: { handoff: 1.5, outro: 3 } },
  () => (
    <Sequence when={span(0, 4)}>
      <Shape key="dot" geometry={rect(10, 10)} fill="#FFFFFF" />
    </Sequence>
  ),
);
