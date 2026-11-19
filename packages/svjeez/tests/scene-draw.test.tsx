import { describe, expect, test } from "bun:test";
import { Shape, circle, scene, span, track, type SceneElement } from "svjeez";
import { svg } from "svjeez/tools";

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
