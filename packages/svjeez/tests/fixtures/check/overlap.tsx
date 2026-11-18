import { Shape, circle, par, ref, scene, seq, timeline, wait } from "svjeez";

export default scene({ size: [100, 60], duration: 4, title: "Overlap" }, () => {
  const dot = ref("dot");

  timeline(par(dot.move([60, 30], 1), seq(wait(0.5), dot.set({ at: [10, 10] }))));

  return <Shape ref={dot} geometry={circle(4)} at={[10, 30]} fill="#FF0000" />;
});
