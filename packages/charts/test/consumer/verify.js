import assert from "node:assert/strict";
import { Group, font, scene, span, track } from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import { svg as backend } from "svjeez/tools";
import { Chart, bars, line } from "@svjeez/charts";

const face = await font.load("ABeeZee-Regular.ttf");

const out = backend.emit(
  scene({ size: [360, 260], duration: 3, title: "Sales by quarter" }, () =>
    jsx(Group, {
      children: jsx(Chart, {
        at: [50, 20],
        size: [280, 200],
        x: { kind: "band", domain: ["Q1", "Q2", "Q3"] },
        font: face,
        axis: "#8E8E93",
        label: "#6E6E73",
        series: [
          bars(
            { Q1: 12, Q2: 48, Q3: 31 },
            { color: "#0A6CFF", draw: track(0).to(1, span(0.2, 1)) },
          ),
          line(
            [
              ["Q1", 12],
              ["Q2", 48],
              ["Q3", 31],
            ],
            { color: "#E5453B", draw: track(0).to(1, span(1, 1)), dots: true },
          ),
        ],
      }),
    }),
  ),
);

assert.match(out, /@keyframes/);

assert.match(out, /@font-face/);

console.log(`drew a chart in ${out.length} bytes`);
