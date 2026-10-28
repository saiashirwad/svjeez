import { describe, expect, test } from "bun:test";
import { rect, render } from "svjeez";
import { Camera, Steady, travel, type CameraStop } from "svjeez/extras";

const scene = (...children: unknown[]) =>
  render({ width: 400, height: 300, duration: 10, title: "Test" }, <>{children as never}</>);

/** Every `rotate:` value in the stylesheet, in degrees. */
const rotations = (svg: string) =>
  [...svg.matchAll(/rotate:(-?[\d.]+)deg/g)].map((m) => Number(m[1]));

describe("travel with heading", () => {
  test("turns to face each leg and keeps turning the short way", () => {
    const south = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
    ];

    const svg = scene(
      <circle r={3} animation={travel(south, { at: 1, over: 2, heading: true })} />,
    );
    expect(rotations(svg)).toContain(90);
  });

  test("never spins through a full turn when the path crosses the -x direction", () => {
    const bend = [
      { x: 100, y: 0 },
      { x: 0, y: -2 },
      { x: -100, y: 2 },
      { x: -200, y: -2 },
    ];

    const svg = scene(<circle r={3} animation={travel(bend, { at: 0, over: 3, heading: true })} />);
    const turns = rotations(svg);

    expect(turns.length).toBeGreaterThan(1);
    for (const [i, turn] of turns.entries())
      if (i > 0) expect(Math.abs(turn - turns[i - 1]!)).toBeLessThan(180);
  });

  test("adds a number as an offset in degrees", () => {
    const east = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];

    const svg = scene(<circle r={3} animation={travel(east, { at: 0, over: 1, heading: 90 })} />);
    expect(rotations(svg)).toContain(90);
  });

  test("leaves a motion without heading as it was", () => {
    const east = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];

    expect(rotations(scene(<circle r={3} animation={travel(east, { at: 0, over: 1 })} />))).toEqual(
      [],
    );
  });
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
