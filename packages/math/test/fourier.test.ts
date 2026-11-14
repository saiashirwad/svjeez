import { expect, test } from "bun:test";
import { fourier } from "../src/index";

const circle = Array.from({ length: 90 }, (_, i): [number, number] => {
  const a = (2 * Math.PI * i) / 90;

  return [10 + 3 * Math.cos(a + 0.5), 20 + 3 * Math.sin(a + 0.5)];
});

test("a circle is one term, turning once, at its radius and starting angle, around its center", () => {
  const { mean, terms } = fourier(circle, { samples: 256 });

  expect(mean[0]).toBeCloseTo(10, 2);
  expect(mean[1]).toBeCloseTo(20, 2);
  expect(terms[0]!.k).toBe(1);
  expect(terms[0]!.r).toBeCloseTo(3, 2);
  expect(terms[0]!.phase).toBeCloseTo(0.5, 2);
  expect(terms[1]!.r).toBeLessThan(0.01);
});

test("the terms sum back to the samples, largest first", () => {
  const square = [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ] as const;

  const { mean, terms, points } = fourier(square, { samples: 64 });

  expect(terms).toHaveLength(63);
  expect(points).toHaveLength(64);
  expect(terms.every((t, i) => i === 0 || t.r <= terms[i - 1]!.r)).toBe(true);

  const at = (s: number) => {
    let [x, y] = mean;

    for (const { k, r, phase } of terms) {
      x += r * Math.cos(2 * Math.PI * k * s + phase);
      y += r * Math.sin(2 * Math.PI * k * s + phase);
    }

    return [x, y] as const;
  };

  for (const m of [0, 9, 30]) {
    const [x, y] = at(m / 64);
    expect(x).toBeCloseTo(points[m]![0], 6);
    expect(y).toBeCloseTo(points[m]![1], 6);
  }
});

test("terms keeps only the largest", () => {
  expect(fourier(circle, { samples: 64, terms: 5 }).terms).toHaveLength(5);
});

test("fourier() names itself in its errors", () => {
  expect(() => fourier(circle, { samples: 63 })).toThrow(
    "fourier() needs an even number of samples, 4 or more, got 63.",
  );
  expect(() => fourier(circle, { terms: 0 })).toThrow("fourier() keeps 1 to 1023 terms, got 0.");
  expect(() =>
    fourier([
      [0, 0],
      [1, 1],
    ]),
  ).toThrow("fourier() needs an outline with at least three points.");
});
