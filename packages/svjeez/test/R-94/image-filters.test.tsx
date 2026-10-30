import { describe, expect, test } from "bun:test";
import { fx, render } from "svjeez";

describe("image filters", () => {
  const filtered = (filter: ReturnType<typeof fx.grayscale>) =>
    render(
      { width: 10, height: 10, duration: 1, title: "Fx" },
      <rect width={10} height={10} filter={filter} />,
    );

  test("each filter renders into the scene", () => {
    expect(filtered(fx.grayscale({ amount: 0.25 }))).toContain('values="0.75"');
    expect(filtered(fx.blur(3))).toContain('stdDeviation="3"');
    expect(
      filtered(fx.shadow({ dx: 2, dy: 3, blur: 4, color: "#000000", opacity: 0.5 })),
    ).toContain("<feDropShadow");
  });

  test("duotone maps black to dark and white to light", () => {
    const svg = filtered(fx.duotone({ dark: "#000000", light: "#ff8000" }));
    const values = /values="([^"]+)"/.exec(svg)![1]!.split(" ").map(Number);

    const apply = (gray: number) =>
      [0, 1, 2].map((row) => {
        // SAFETY: duotone writes a four-row, five-value color matrix, so each row slice holds five numbers.
        const [r, g, b, , offset] = values.slice(row * 5, row * 5 + 5) as [
          number,
          number,
          number,
          number,
          number,
        ];

        return (r + g + b) * gray + offset;
      });

    expect(apply(0)).toEqual([0, 0, 0]);
    expect(apply(1)[0]).toBeCloseTo(1, 3);
    expect(apply(1)[1]).toBeCloseTo(128 / 255, 3);
    expect(svg).toContain('color-interpolation-filters="sRGB"');
  });
});
