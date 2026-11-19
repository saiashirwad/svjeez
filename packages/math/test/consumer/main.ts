import {
  Axes,
  Tex,
  brace,
  compass,
  crossings,
  plane,
  type Plane,
  type TexProps,
} from "@svjeez/math";
import { Group, Shape, scene, span, track } from "svjeez";
import { jsx } from "svjeez/jsx-runtime";

const graph: Plane = plane({ x: [-2, 2], y: [0, 4], size: [200, 100] });
const props: TexProps = { size: 32, fill: "#000000", children: "x^2", draw: 1 };
const amount = track(0).to(1, span(0, 1));
const [apex] = crossings({ center: [0, 0], radius: 10 }, { center: [10, 0], radius: 10 });

export default scene({ size: [300, 200], duration: 2, title: "Consumer" }, () =>
  jsx(Group, {
    children: [
      jsx(Tex, props),
      jsx(Axes, { plane: graph, stroke: { color: "#000000" } }),
      jsx(Shape, {
        geometry: amount.map((t) =>
          graph
            .transform([
              [1, t],
              [0, 1],
            ])
            .grid(),
        ),
        stroke: { color: "#000000" },
      }),
      jsx(Shape, {
        geometry: brace(Tex.measure("x^2", { size: 32 }).width),
        stroke: { color: "#000000" },
      }),
      jsx(Shape, { geometry: compass([0, 0], apex ?? [1, 0]), stroke: { color: "#000000" } }),
    ],
  }),
);
