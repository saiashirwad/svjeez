import { expect, test } from "bun:test";
import { fx, motion, render, validateSvg } from "svjeez";

test("a prefixed scene still warns about a filter over many animated elements", () => {
  const svg = (prefix?: string) =>
    render(
      { width: 100, height: 100, duration: 2, title: "Glow", prefix },
      <g filter={fx.blur(2)}>
        {Array.from({ length: 45 }, (_, i) => (
          <circle
            cx={i}
            cy={50}
            r={1}
            animation={motion({ opacity: 0 })
              .at(i / 45)
              .to({ opacity: 1 }, 0.5)}
          />
        ))}
      </g>,
    );

  const warnings = (source: string) =>
    validateSvg(source).warnings.filter((w) => w.includes("animated elements"));

  expect(warnings(svg())).toHaveLength(1);
  expect(warnings(svg("p-"))).toHaveLength(1);
});
