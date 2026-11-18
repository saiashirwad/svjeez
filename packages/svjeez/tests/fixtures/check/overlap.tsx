import { Shape, circle, ref, scene, span } from "svjeez";

export default scene({ size: [100, 60], duration: 4, title: "Overlap" }, () => {
  const dot = ref("dot");

  dot.move([60, 30], span(0, 1));
  dot.set({ at: [10, 10] }, span(0.5));

  return <Shape ref={dot} geometry={circle(4)} at={[10, 30]} fill="#FF0000" />;
});
