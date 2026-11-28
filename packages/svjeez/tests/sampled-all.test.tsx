import { describe, expect, test } from "bun:test";
import { line, path, sampled, span, type Geometry, type Vec } from "svjeez";

type Pair = { a: number; b: number };

// SAFETY: deliberately drops `b` to test the runtime check for a sample missing a key.
const incomplete = (t: number): Pair => ({ a: t }) as Pair;

const win = span(0, 2);
const options = { tolerance: 0.05, step: 0.1 };

type Pose = { angle: number; at: Vec; bar: Geometry };

const pose = (t: number): Pose => ({
  angle: t * 90,
  at: [Math.sin(t * 3) * 10, t * 4],
  bar: line([0, 0], [Math.cos(t * 3) * 10, t * 5]),
});

describe("sampled.all", () => {
  test("calls the function once per time, not once per key", () => {
    const times: number[] = [];

    sampled.all(
      (t) => {
        times.push(t);

        return pose(t);
      },
      win,
      options,
    );
    expect(new Set(times).size).toBe(times.length);

    // A smooth function is sampled exactly once per step, whatever the number of keys.
    let smooth = 0;
    let single = 0;

    sampled.all(
      (t) => {
        smooth++;

        const c: Vec = [t * 0.1, t * 0.1];

        return { a: t * 0.1, b: t * 0.2, c };
      },
      win,
      options,
    );
    sampled(
      (t) => {
        single++;

        return t * 0.1;
      },
      win,
      options,
    );
    expect(smooth).toBe(single);
  });

  test("each key matches sampled for that key alone", () => {
    const tracks = sampled.all(pose, win, options);

    expect(tracks.angle).toEqual(sampled((t) => pose(t).angle, win, options));
    expect(tracks.at).toEqual(sampled((t) => pose(t).at, win, options));
    expect(tracks.bar).toEqual(sampled((t) => pose(t).bar, win, options));
  });

  test("keys are simplified independently", () => {
    const tracks = sampled.all((t) => ({ flat: t * 10, bent: Math.sin(t * 6) * 10 }), win, options);

    expect(JSON.stringify(tracks.flat).length).toBeLessThan(JSON.stringify(tracks.bent).length);
  });

  test("a key whose geometry changes shape errors", () => {
    expect(() =>
      sampled.all(
        (t) => ({
          ok: t,
          bad: t < 1 ? line([0, 0], [1, 1]) : path().moveTo([0, 0]).lineTo([1, 1]).lineTo([2, 0]),
        }),
        win,
        options,
      ),
    ).toThrow(/doesn't match the first sample/);
  });

  test("a missing key errors", () => {
    expect(() =>
      sampled.all((t): Pair => (t < 1 ? { a: t, b: t } : incomplete(t)), win, options),
    ).toThrow(/needs every key|every sample needs every key/);
  });

  test("tracks loop like sampled tracks", () => {
    const tracks = sampled.all(pose, win, options);
    const looped = tracks.angle.loop(2);

    expect(looped).toEqual(sampled((t) => pose(t).angle, win, options).loop(2));
    expect(() => tracks.bar.loop(2)).not.toThrow();
  });
});
