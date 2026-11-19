import { describe, expect, test } from "bun:test";
import { Shape, enter, ease, rect, scene, span, track } from "svjeez";
import { svg } from "svjeez/tools";
import { cssGroups, cssKeyframes } from "../src/svg/css";
import type { Key } from "../src/svg/keys";

const key = (t: number, values: Key["values"], e = ease.linear): Key => ({ t, values, ease: e });

const lane = (keys: Key[], name = "opacity", period = 4) => ({
  key: name,
  emit: "value" as const,
  keys,
  period,
  snapped: period,
});

describe("holds", () => {
  test("a hold is a stop just before the next key, with no steps(1)", () => {
    const { body, timing } = cssKeyframes(
      "opacity",
      "visibility",
      [key(0, { opacity: 0 }, ease.hold), key(1, { opacity: 1 }), key(4, { opacity: 1 })],
      4,
    );

    expect(body).toBe("0%,24.999%{visibility:hidden}25%,100%{visibility:visible}");
    expect(timing).not.toContain("steps");
  });

  test("a hold that would land on another stop keeps steps(1)", () => {
    const { body } = cssKeyframes(
      "opacity",
      "visibility",
      [key(0, { opacity: 0 }, ease.hold), key(1, { opacity: 1 }), key(100000, { opacity: 1 })],
      100000,
    );

    expect(body).toContain("steps(1)");
  });

  test("real steps with more than one jump are untouched", () => {
    const { timing } = cssKeyframes(
      "translate",
      "value",
      [key(0, { x: 0, y: 0 }, ease.steps(3)), key(2, { x: 9, y: 0 }), key(4, { x: 9, y: 0 })],
      4,
    );

    expect(timing).toBe("steps(3)");
  });
});

describe("lanes that share stops", () => {
  const pair = (second: Key[]) => [
    lane([key(0, { x: 0, y: 6 }), key(1, { x: 0, y: 0 }), key(4, { x: 0, y: 0 })], "translate"),
    lane(second),
  ];

  test("write one @keyframes with the declarations side by side", () => {
    const groups = cssGroups(
      pair([key(0, { opacity: 0 }), key(1, { opacity: 1 }), key(4, { opacity: 1 })]),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]!.body).toBe("0%{translate:0 6px;opacity:0}25%,100%{translate:0 0;opacity:1}");
  });

  test("stay apart when their stops, easing or clocks differ", () => {
    const keys = [key(0, { opacity: 0 }), key(2, { opacity: 1 }), key(4, { opacity: 1 })];

    expect(cssGroups(pair(keys))).toHaveLength(2);
    expect(
      cssGroups(
        pair([key(0, { opacity: 0 }, ease.out), key(1, { opacity: 1 }), key(4, { opacity: 1 })]),
      ),
    ).toHaveLength(2);

    const slow = {
      ...pair([key(0, { opacity: 0 }), key(1, { opacity: 1 }), key(4, { opacity: 1 })])[1]!,
      snapped: 2,
    };

    expect(cssGroups([pair([])[0]!, slow])).toHaveLength(2);
  });

  test("an element that fades and moves in is one running animation", () => {
    const out = svg.emit(
      scene({ size: [100, 100], duration: 4, title: "Pop" }, () => (
        <Shape
          geometry={rect(10, 10)}
          fill="#000000"
          motion={enter(span(0.5, 0.4), { from: { offset: [0, 6], opacity: 0 } })}
        />
      )),
    );

    expect(out.match(/@keyframes/g)).toHaveLength(1);
    expect(out).toMatch(/\{translate:0 6px;opacity:0\}/);
    expect(out).toMatch(/\.m1\{animation-name:k1\}/);
    expect(out).not.toContain("0px");
  });
});

test("a track that holds a value writes a hold, not steps(1)", () => {
  const out = svg.emit(
    scene({ size: [100, 100], duration: 4, title: "Hold" }, () => (
      <Shape geometry={rect(10, 10)} fill="#000000" opacity={track(0).set(1, span(1, 0))} />
    )),
  );

  expect(out).not.toContain("steps(1)");
  expect(out).toMatch(/0%,24\.999%\{visibility:hidden\}25%,100%\{visibility:visible\}/);
});
