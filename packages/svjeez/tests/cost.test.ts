import { describe, expect, test } from "bun:test";
import { costOf } from "../src/svg/cost";

const svg = (body: string, css = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg"><style>${css}</style>${body}</svg>`;

const frames = ".m1{animation-name:k1,k2}.m2{animation-name:k3}";

const blur = (inner = "") =>
  `<defs><filter id="f" filterUnits="userSpaceOnUse" x="0" y="0" width="200" height="100">${inner}<feGaussianBlur stdDeviation="4"/></filter></defs>`;

describe("costOf", () => {
  test("counts running animations: classes, and SMIL by the share of the loop it is open", () => {
    const out = costOf(
      svg(
        `<g class="a m1"/><g class="m2"/><animate dur="1" data-loop="4"/><set repeatCount="indefinite"/>`,
        frames,
      ),
    );

    expect(out).toEqual({ animations: 4.3, repaint: 0 });
  });

  test("a still filter repaints nothing", () => {
    expect(costOf(svg(`${blur()}<g filter="url(#f)"><rect/></g>`)).repaint).toBe(0);
  });

  test("a filter with an animated class repaints its whole area every frame", () => {
    const out = costOf(
      svg(
        `${blur().replace("<feGaussianBlur", '<feGaussianBlur class="m2"')}<g filter="url(#f)"/>`,
        frames,
      ),
    );

    expect(out.repaint).toBe(2);
  });

  test("a filter with a SMIL window repaints for the share of the loop it is open", () => {
    const out = costOf(svg(blur('<animate attributeName="stdDeviation" dur="1" data-loop="4"/>')));

    expect(out.repaint).toBe(0.5);
  });

  test("something animated under a filtered element repaints it every frame", () => {
    const out = costOf(svg(`${blur()}<g filter="url(#f)"><rect class="m2"/></g>`, frames));

    expect(out.repaint).toBe(2);
  });

  test("the filtered element's own animation is free", () => {
    const out = costOf(svg(`${blur()}<g filter="url(#f)" class="m2"><rect/></g>`, frames));

    expect(out.repaint).toBe(0);
  });
});
