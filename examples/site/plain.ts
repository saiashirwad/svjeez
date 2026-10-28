import { draw, ease, el, enter, render } from "svjeez";

const { circle, g, path } = el;

export default () =>
  render(
    { width: 120, height: 80, duration: 3, title: "Dot", prefix: "kit" },
    g({}, [
      path({
        d: "M20 66Q60 -6 100 66",
        fill: "none",
        stroke: "#34C759",
        strokeWidth: 4,
        animation: draw({ at: 0.2, over: 1 }),
      }),
      circle({
        cx: 60,
        cy: 30,
        r: 6,
        fill: "#0A6CFF",
        animation: enter({ at: 1, over: 0.4 }, { scale: 0 }, ease.pop),
      }),
    ]),
  );
