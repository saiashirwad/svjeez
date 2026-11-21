import { expect, test } from "bun:test";
import { Shape, rect, scene, span, track, type Anim, type Vec } from "svjeez";
import { svg } from "svjeez/tools";

// These are checked by tsc (bun run typecheck): the body must compile, and the ts-expect-error lines must stay errors.
const takesPoint = (_: Anim<Vec>) => undefined;

test("a point track and a mapped point need no annotation", () => {
  const t = track(0).to(1, span(0, 1));
  const zero = [0, 0] as const;

  takesPoint(track([0, 0]).to([10, 20], span(0, 1)));
  takesPoint(track(zero));
  takesPoint(t.map((v) => [v, v * 2]));
  takesPoint(t.with(t).map((a, b) => [a, b]));
  // @ts-expect-error: a point has two numbers.
  takesPoint(t.map((v) => [v, v, v]));
  // @ts-expect-error: a point has two numbers.
  takesPoint([1, 2, 3]);

  const number: Anim<number> = t.map((v) => v * 2);
  const text: Anim<string> = t.map((v) => (v > 0 ? "a" : "b"));

  expect([number, text].length).toBe(2);
});

test("a mapped point is used as an offset", () => {
  const t = track(0).to(1, span(0, 1));
  const out = svg.emit(
    scene({ size: [100, 100], duration: 1, title: "Offset" }, () => (
      <Shape
        key="a"
        geometry={rect(10, 10)}
        fill="#000000"
        offset={track([0, 0]).to([10, 20], span(0, 1))}
      />
    )),
  );
  const mapped = svg.emit(
    scene({ size: [100, 100], duration: 1, title: "Offset" }, () => (
      <Shape key="a" geometry={rect(10, 10)} fill="#000000" offset={t.map((v) => [v, v * 2])} />
    )),
  );

  expect(out).toContain("<svg");
  expect(mapped).toContain("<svg");
});
