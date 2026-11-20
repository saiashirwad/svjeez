import { describe, expect, test } from "bun:test";
import {
  Arrow,
  Group,
  Shape,
  circle,
  ease,
  rect,
  ref,
  scene,
  span,
  track,
  type SceneElement,
} from "svjeez";
import { svg, type Model } from "svjeez/tools";
import { blendNumber, valueAt } from "../src/model/sample";

const emit = (shape: () => SceneElement): string =>
  svg.emit(scene({ size: [100, 100], duration: 2, title: "Test" }, shape));

const stroke = { color: "#FF0000" as const };

describe("Shape draw", () => {
  test("draw is trim [0, draw]", () => {
    const drawn = emit(() => (
      <Shape geometry={circle(10)} stroke={stroke} draw={track(0).to(1, span(0, 1))} />
    ));

    const trimmed = emit(() => (
      <Shape
        geometry={circle(10)}
        stroke={stroke}
        trim={track<[number, number]>([0, 0]).to([0, 1], span(0, 1))}
      />
    ));

    expect(drawn).toBe(trimmed);
  });

  test("draw with trim throws and says to pick one", () => {
    expect(() =>
      emit(() => <Shape geometry={circle(10)} stroke={stroke} draw={1} trim={[0, 1]} />),
    ).toThrow("draw is trim [0, draw]");
  });
});

const headOf = (build: () => SceneElement, duration = 4): Model.SceneNode => {
  const model = scene({ size: [200, 100], duration, title: "Test" }, build);

  const visit = (node: Model.SceneNode): Model.SceneNode | undefined =>
    node.key === "arrow/head"
      ? node
      : node.kind === "group"
        ? node.children.map(visit).find(Boolean)
        : undefined;

  return visit(model.root)!;
};

const shownAt = (head: Model.SceneNode, t: number): number =>
  valueAt(head.layers[0]!.opacity, t, blendNumber);

const arrow = (to: number, draw: Parameters<typeof Arrow>[0]["draw"]): SceneElement => (
  <Arrow key="arrow" from={[0, 50]} to={[to, 50]} draw={draw} stroke={stroke} />
);

describe("Arrow head", () => {
  const depth = 8 * Math.cos(0.45);

  test("draw from 0 starts without a head; it shows once the shaft reaches its base", () => {
    const head = headOf(() => arrow(100, track(0).to(1, span(0, 1), ease.linear)));
    const flip = depth / 100;

    expect(shownAt(head, 0)).toBe(0);
    expect(shownAt(head, flip - 1 / 60)).toBe(0);
    expect(shownAt(head, flip + 1 / 60)).toBe(1);
    expect(shownAt(head, 2)).toBe(1);
  });

  test("un-drawing loses the head the same way", () => {
    const head = headOf(() => arrow(100, track(1).to(0, span(1, 1), ease.linear)));
    const flip = 2 - depth / 100;

    expect(shownAt(head, 0.5)).toBe(1);
    expect(shownAt(head, flip - 1 / 60)).toBe(1);
    expect(shownAt(head, flip + 1 / 60)).toBe(0);
  });

  test("a static draw shorter than the head's depth hides it", () => {
    expect(headOf(() => arrow(100, 0.02)).layers[0]!.opacity).toBe(0);
    expect(headOf(() => arrow(100, 0.5)).layers.length).toBe(0);
  });

  test("an arrow shorter than its head shows it only at draw 1", () => {
    const head = headOf(() => arrow(5, track(0).to(1, span(0, 1), ease.linear)));

    expect(shownAt(head, 0.9)).toBe(0);
    expect(shownAt(head, 2)).toBe(1);
  });

  test("an arrow with no draw emits the same SVG as before", () => {
    const out = svg.emit(
      scene({ size: [200, 100], duration: 2, title: "Test" }, () => {
        const [a, b] = [ref(), ref()];

        return (
          <Group>
            <Shape
              key="a"
              ref={a}
              fill="#000000"
              geometry={rect(10, 10)}
              at={track<[number, number]>([10, 10]).to([10, 60], span(0, 1))}
            />
            <Shape key="b" ref={b} fill="#000000" geometry={rect(10, 10)} at={[150, 10]} />
            <Arrow
              key="link"
              from={[20, 15]}
              to={[100, 15]}
              bend={0.3}
              stroke={{ color: "#222222" }}
            />
            <Arrow key="move" from={a.right} to={b.left} stroke={{ color: "#222222" }} />
          </Group>
        );
      }),
    );

    expect(out.trimEnd().split("\n")).toEqual([
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100" role="img" aria-labelledby="t">',
      '  <title id="t">Test</title>',
      "  <style><![CDATA[",
      ".a{animation-duration:2s;animation-iteration-count:infinite;animation-fill-mode:both;animation-timing-function:cubic-bezier(.23,1,.32,1);animation-delay:var(--t0,0s)}",
      "@keyframes k1{0%{translate:10px 10px}50%,100%{translate:10px 60px}}",
      ".m1{animation-name:k1}",
      "@keyframes k2{0%{stroke-dashoffset:0.067}1.59%{stroke-dashoffset:0.065;animation-timing-function:cubic-bezier(.341,.352,.673,.685)}3.274%{stroke-dashoffset:0.062;animation-timing-function:cubic-bezier(.339,.358,.67,.691)}5.268%{stroke-dashoffset:0.055;animation-timing-function:cubic-bezier(.334,.366,.665,.698)}7.601%{stroke-dashoffset:0.045;animation-timing-function:cubic-bezier(.324,.379,.654,.711)}10.633%{stroke-dashoffset:0.033;animation-timing-function:cubic-bezier(.307,.413,.634,.74)}15.508%{stroke-dashoffset:0.018;animation-timing-function:cubic-bezier(.199,1,.481,1)}50%,100%{stroke-dashoffset:0}}",
      "@keyframes k3{0%{rotate:0deg}4.527%{rotate:-7.982deg;animation-timing-function:cubic-bezier(.335,.384,.663,.715)}8.173%{rotate:-12.864deg;animation-timing-function:cubic-bezier(.314,.41,.639,.738)}13.03%{rotate:-16.935deg;animation-timing-function:cubic-bezier(.264,.551,.576,.844)}25.512%{rotate:-20.435deg;animation-timing-function:cubic-bezier(.245,1,.563,1)}50%,100%{rotate:-21.038deg}}",
      "@keyframes k4{0%{translate:20px 15px}50%,100%{translate:20px 65px}}",
      ".m2{animation-name:k2,k3,k4;animation-timing-function:cubic-bezier(.342,.35,.675,.683),cubic-bezier(.356,.385,.682,.716),cubic-bezier(.23,1,.32,1)}",
      "@keyframes k5{0%{translate:130px 0}1.59%{translate:130.176px 0;animation-timing-function:cubic-bezier(.341,.352,.673,.685)}3.274%{translate:130.703px 0;animation-timing-function:cubic-bezier(.339,.358,.67,.691)}5.268%{translate:131.659px 0;animation-timing-function:cubic-bezier(.334,.366,.665,.698)}7.601%{translate:133.008px 0;animation-timing-function:cubic-bezier(.324,.379,.654,.711)}10.633%{translate:134.738px 0;animation-timing-function:cubic-bezier(.307,.413,.634,.74)}15.508%{translate:136.836px 0;animation-timing-function:cubic-bezier(.199,1,.481,1)}50%,100%{translate:139.284px 0}}",
      ".m3{animation-name:k5;animation-timing-function:cubic-bezier(.342,.35,.675,.683)}",
      ".m4{animation-name:k3,k4;animation-timing-function:cubic-bezier(.356,.385,.682,.716),cubic-bezier(.23,1,.32,1)}",
      "@media (prefers-reduced-motion:reduce){.a{animation-delay:-1.7s!important;animation-play-state:paused!important}}",
      "]]></style>",
      '  <rect width="10" height="10" fill="#000000" class="a m1"/>',
      '  <rect x="150" y="10" width="10" height="10" fill="#000000"/>',
      '  <path d="M20 15C46.667 31 73.333 31 100 15" fill="none" stroke="#222222" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
      '  <polyline points="92.028 15.667 100 15 95.567 21.66" fill="none" stroke="#222222" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
      '  <line x1="0" y1="0" x2="139.284" y2="0" fill="none" stroke="#222222" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="transform-origin:0 0" pathLength="1" stroke-dasharray="1 2" class="a m2"/>',
      '  <g style="transform-origin:0 0" class="a m4">',
      '    <polyline points="-7.204 -3.48 0 0 -7.204 3.48" fill="none" stroke="#222222" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="a m3"/>',
      "  </g>",
      "</svg>",
    ]);
  });
});

describe("anchor on a shape whose geometry animates", () => {
  test("throws, since the anchor would drift as the box changes", () => {
    const grows = () =>
      emit(() => (
        <Shape
          geometry={track(rect(10, 10)).to(rect(80, 40), span(0, 1))}
          at={[50, 50]}
          anchor="center"
          fill="#FF0000"
        />
      ));

    expect(grows).toThrow(/anchor="center" and a geometry whose box moves/);
  });

  test("a fixed geometry keeps its anchor", () => {
    const still = () =>
      emit(() => <Shape geometry={rect(10, 10)} at={[50, 50]} anchor="center" fill="#FF0000" />);

    expect(still).not.toThrow();
  });
});

test("an animated geometry whose box keeps its anchor point keeps working", () => {
  const swells = () =>
    emit(() => (
      <Shape
        geometry={track(circle(10)).to(circle(30), span(0, 1))}
        at={[50, 50]}
        anchor="center"
        fill="#FF0000"
      />
    ));

  expect(swells).not.toThrow();
});
