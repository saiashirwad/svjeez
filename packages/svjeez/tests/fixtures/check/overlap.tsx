import { Shape, circle, scene, span, track, type Vec } from "svjeez";

export default scene({ size: [100, 60], duration: 4, title: "Overlap" }, () => {
  const dot = track<Vec>([10, 30]);

  dot.to([60, 30], span(0, 1));
  dot.set([10, 10], span(0.5));

  return <Shape geometry={circle(4)} at={dot} fill="#FF0000" />;
});
