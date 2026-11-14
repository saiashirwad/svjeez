import { describe, expect, test } from "bun:test";
import {
  Camera,
  Pivot,
  Steady,
  ease,
  flow,
  motion,
  rect,
  render,
  sample,
  sampled,
  sampledPath,
  valuesAt,
  type CameraStop,
  type Child,
  type ChannelValues,
  type Values,
} from "svjeez";

const scene = (child: Child) =>
  render({ width: 300, height: 200, duration: 4, title: "Aliases", reducedMotion: false }, child);

describe("deprecated names from before 0.7 still work", () => {
  test("sample is valuesAt", () => {
    const slide = motion({ x: 0 }).to({ x: 10 }, 1, ease.linear);

    expect(sample(slide, 0.5, { duration: 2 })).toEqual(valuesAt(slide, 0.5, { duration: 2 }));
  });

  test("Values is ChannelValues", () => {
    const old: Values<"x"> = { x: 1 };
    const now: ChannelValues<"x"> = old;

    expect(now).toEqual({ x: 1 });
  });

  test("sampledPath is sampled.path", () => {
    const d = (t: number) => `M${t} 0L${t + 5} 5`;

    expect(scene(<path animation={sampledPath(d, { duration: 4, tolerance: 0.1 })} />)).toBe(
      scene(<path animation={sampled.path(d, { duration: 4, tolerance: 0.1 })} />),
    );
  });

  test("Pivot at is origin", () => {
    const spin = motion({ rotate: 0 }).to({ rotate: 90 }, 1);
    const a = { x: 3, y: 4 };
    const b = { x: 3, y: 4 };

    expect(
      scene(
        <Pivot at={a} animation={spin}>
          <circle r={1} />
        </Pivot>,
      ),
    ).toBe(
      scene(
        <Pivot origin={b} animation={spin}>
          <circle r={1} />
        </Pivot>,
      ),
    );
    expect(
      scene(
        <Pivot origin={a} animation={spin}>
          <circle r={1} />
        </Pivot>,
      ),
    ).toContain("transform-origin:3px 4px");
  });

  test("Steady is a steady Camera", () => {
    const frame = rect(0, 0, 400, 300);

    const stops: CameraStop[] = [
      { during: { at: 0, over: 2 }, target: "all" },
      { during: { at: 3, over: 2 }, target: rect(100, 100, 100, 75) },
    ];

    const at = { x: 150, y: 120 };

    expect(
      scene(
        <Steady frame={frame} stops={stops} at={at}>
          <circle r={1} />
        </Steady>,
      ),
    ).toBe(
      scene(
        <Camera frame={frame} stops={stops} steady origin={at}>
          <circle r={1} />
        </Camera>,
      ),
    );
  });

  test("flow loop is period", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];

    expect(String(flow(line, { at: 0, over: 1, loop: 3 }).node)).toBe(
      String(flow(line, { at: 0, over: 1, period: 3 }).node),
    );
  });
});
