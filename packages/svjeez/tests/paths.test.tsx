import { describe, expect, test } from "bun:test";
import { matchPaths, motion, render, sampledPath, type Motion } from "svjeez";

const scene = (animation: Motion<"d">, reducedMotion?: false) =>
  render(
    { width: 100, height: 100, duration: 4, title: "Test", reducedMotion },
    <path d="M0 0H10V10Z" animation={animation} />,
  );

const commands = (d: string) => d.replace(/[^A-Za-z]/g, "");

describe("matchPaths", () => {
  test("rewrites shapes with different commands to the same commands", () => {
    const [square, circle, star] = matchPaths([
      "M0 0H10V10H0Z",
      "M5 0A5 5 0 1 1 5 10A5 5 0 1 1 5 0Z",
      "m5 0 2 3h3l-2 3 1 4-4-2-4 2 1-4-2-3h3z",
    ]);

    expect(commands(square!)).toBe(commands(circle!));
    expect(commands(circle!)).toBe(commands(star!));
  });

  test("grows a missing subpath from a point", () => {
    const [one, two] = matchPaths(["M0 0H10V10Z", "M0 0H10V10ZM20 20H30V30Z"]);

    expect(one!.match(/M/g)).toHaveLength(2);
    expect(commands(one!)).toBe(commands(two!));
    expect(one!).toContain("M25 25");
  });

  test("keeps the corners of a polygon it splits", () => {
    const [square] = matchPaths(["M0 0H10V10H0Z", "M0 0L1 0L2 0L3 0L4 0L5 0L6 0L7 0L8 0Z"]);

    for (const corner of ["10 0", "10 10", "0 10"]) expect(square).toContain(corner);
  });
});

describe("the d channel", () => {
  test("animates through SMIL with a still twin for reduced motion", () => {
    const [a, b] = matchPaths(["M0 0H10V10Z", "M5 0L10 10H0Z"]);
    const svg = scene(motion({ d: a! }).at(1).to({ d: b! }, 1));

    expect(svg).toContain('attributeName="d"');
    expect(svg).toMatch(/<path[^>]*class="[^"]*ds"[^>]*display="none"/);
    expect(svg).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*dm\{display:none\}/);
  });

  test("needs no twin when reduced motion is off", () => {
    const [a, b] = matchPaths(["M0 0H10V10Z", "M5 0L10 10H0Z"]);

    expect(scene(motion({ d: a! }).to({ d: b! }, 1), false)).not.toContain('display="none"');
  });

  test("rejects paths with different commands", () => {
    expect(() => scene(motion({ d: "M0 0H10V10Z" }).to({ d: "M0 0L10 10Z" }, 1))).toThrow(
      "d on <path> moves between paths with different commands, so it would jump. Write them through matchPaths() first.",
    );
  });
});

describe("sampledPath", () => {
  test("keeps few keys for a shape that moves steadily", () => {
    const m = sampledPath((t) => `M${10 * t} 0L${10 * t + 5} 5`, { duration: 4, tolerance: 0.1 });
    const svg = scene(m);
    const values = svg.match(/values="([^"]*)"/)![1]!.split(";");

    expect(values).toEqual(["M0 0L5 5", "M40 0L45 5"]);
  });

  test("rejects samples with different commands", () => {
    expect(() =>
      sampledPath((t) => (t < 1 ? "M0 0L1 1" : "M0 0L1 1L2 2"), { duration: 2, tolerance: 1 }),
    ).toThrow("sampledPath() returned a path with different commands at t=1 than at t=0.");
  });
});
