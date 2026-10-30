import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { renderFrames } from "svjeez/frames";
import { browser } from "../helpers/frames-browser";
import { fade, pngSize } from "../helpers/frames";

describe.if(browser)("renderFrames", () => {
  test("a sheet too big for one capture comes back whole, at a lower scale", async () => {
    const wide = render(
      { width: 2000, height: 100, duration: 4, title: "Wide" },
      <rect width={2000} height={100} fill="#3EE6D6" />,
    );

    const { sheet } = await renderFrames(wide, { count: 4, scale: 3, sheet: true });
    const { width, height } = pngSize(sheet!);
    const css = { width: 4 * (2000 + 12) + 12, height: 100 + 12 + 20 + 12 };
    expect(width).toBeLessThanOrEqual(16384);
    expect(width).toBeGreaterThan(css.width);
    expect(height / width).toBeCloseTo(css.height / css.width, 2);
  });

  test("the contact sheet lays frames out in columns", async () => {
    const { sheet } = await renderFrames(fade, {
      times: [0, 1, 2, 3, 4, 5],
      sheet: { columns: 3 },
    });

    const { width, height } = pngSize(sheet!);
    expect(width).toBeGreaterThan(3 * 40);
    expect(width).toBeLessThan(4 * 40 + 60);
    expect(height).toBeGreaterThan(2 * 20);
  });
});
