import { describe, expect, test } from "bun:test";
import { el, enter } from "svjeez";
import { scene } from "../helpers/compile-scene";

describe("el", () => {
  test("renders exactly what the equivalent JSX renders", () => {
    const viaJsx = scene(
      <g opacity={0.5}>
        <rect x={12} y={34} width={10} height={10} animation={enter({ at: 1, over: 0.5 })} />
        <text x={4} y={10} fontSize={8}>
          {"  hi  "}
        </text>
      </g>,
    );

    const viaEl = scene(
      el.g({ opacity: 0.5 }, [
        el.rect({ x: 12, y: 34, width: 10, height: 10, animation: enter({ at: 1, over: 0.5 }) }),
        el.text({ x: 4, y: 10, fontSize: 8 }, "  hi  "),
      ]),
    );

    expect(viaEl).toBe(viaJsx);
  });

  test("destructures and takes no arguments", () => {
    const { circle } = el;
    expect(scene(circle())).toBe(scene(<circle />));
  });
});
