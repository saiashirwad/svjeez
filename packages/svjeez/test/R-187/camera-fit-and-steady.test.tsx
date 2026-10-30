import { describe, expect, test } from "bun:test";
import { rect } from "svjeez";
import { Camera, Steady, type CameraStop } from "svjeez/extras";
import { fit } from "../../src/extras/camera";
import { scene } from "../helpers/heading";

test("camera fits and centers a view in a frame away from the origin", () => {
  const frame = rect(100, 50, 400, 200);
  const { x, y, scale } = fit(frame, rect(10, 10, 100, 100));
  expect(scale).toBe(2);
  expect({ x: x + 60 * scale, y: y + 60 * scale }).toEqual(frame.center);
  expect(y + 10 * scale).toBe(frame.y);
});

describe("Steady", () => {
  const frame = rect(0, 0, 400, 300);

  const stops: CameraStop[] = [
    { during: { at: 0, over: 2 }, target: "all" },
    { during: { at: 3, over: 2 }, target: rect(100, 100, 100, 75) },
  ];

  test("scales by the inverse of the camera's zoom around its anchor", () => {
    const svg = scene(
      <Camera frame={frame} stops={stops}>
        <Steady frame={frame} stops={stops} at={{ x: 150, y: 120 }}>
          <circle r={4} />
        </Steady>
      </Camera>,
    );

    expect(svg).toContain("transform-origin:150px 120px");
    expect(svg).toMatch(/scale:1\b/);
    expect(svg).toMatch(/scale:0\.25\b/);
  });
});
