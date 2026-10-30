import { describe, expect, test } from "bun:test";
import { ease, motion, Pivot, render, type Child } from "svjeez";
import { openScene } from "svjeez/frames";
import { browser } from "../helpers/timeline-browser";

const quarter = motion({ rotate: 0 }).to({ rotate: 90 }, 1, ease.linear);

const scene = (child: Child) =>
  render({ width: 100, height: 100, duration: 2, title: "Pivot" }, child);

/** Where the box's center lands at `time`, in the scene's px. */
const centerAt = async (svg: string, time: number) => {
  const page = await openScene(svg);

  try {
    await page.capture(time);

    return await page.evaluate(() => {
      const box = document.querySelector("#box")!.getBoundingClientRect();

      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }, undefined);
  } finally {
    await page.close();
  }
};

describe("Pivot", () => {
  test("gives every layer of the stack its own group, each turning about `at`", () => {
    const svg = scene(
      <Pivot at={{ x: 50, y: 40.5 }} animation={[quarter, false, quarter]}>
        <rect width={4} height={4} />
      </Pivot>,
    );

    expect(
      svg.match(/<g style="transform-box:view-box;transform-origin:50px 40.5px"/g),
    ).toHaveLength(2);
    expect(svg).not.toMatch(/class="[^"]*\bfb\b/);
  });

  test.if(browser)(
    "two stacked turns of 90 degrees carry a box halfway round the point",
    async () => {
      const svg = scene(
        <Pivot at={{ x: 50, y: 50 }} animation={[quarter, quarter]}>
          <rect id="box" x={86} y={46} width={8} height={8} />
        </Pivot>,
      );

      const at = await centerAt(svg, 1.5);

      expect(at.x).toBeCloseTo(10, 0);
      expect(at.y).toBeCloseTo(50, 0);
    },
  );

  test.if(browser)("without Pivot the same stack turns about the box's own center", async () => {
    const svg = scene(
      <g animation={[quarter, quarter]}>
        <rect id="box" x={86} y={46} width={8} height={8} />
      </g>,
    );

    const at = await centerAt(svg, 1.5);

    expect(at.x).toBeCloseTo(90, 0);
    expect(at.y).toBeCloseTo(50, 0);
  });
});
