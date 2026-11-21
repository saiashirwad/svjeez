import { expect, test } from "bun:test";
import {
  linear,
  track,
  type Anim,
  type Curve,
  type Derived,
  type Goal,
  type Interval,
  type Track,
} from "svjeez";

// A helper generic over the value type must be writable with exported types alone.
const keyframes = <V,>(
  frames: readonly (readonly [Interval, Goal<V>, Curve?])[],
  from: V,
): Track<V> => frames.reduce((t, [when, value, curve]) => t.to(value, when, curve), track(from));

const scaled = (t: Track<number>, by: number): Derived<number> => t.map((v) => v * by);

const anim: Anim<number> = scaled(keyframes([[{ start: 0, over: 1 }, 5]], 0), 2);

test("generic track helpers type-check with exported types", () => {
  expect(anim).toBeDefined();
  expect(linear).toBeDefined();
});
