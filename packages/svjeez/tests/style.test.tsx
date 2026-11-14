/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import { css, render, Style } from "svjeez";

const scene = (
  content: Parameters<typeof render>[1],
  options: { prefix?: string; css?: string } = {},
) => render({ width: 10, height: 10, duration: 1, title: "t", ...options }, content);

describe("<Style>", () => {
  test("puts the rule in the scene's style, after render css", () => {
    const svg = scene(
      <>
        <Style>{".b{fill:blue}"}</Style>
        <rect class="b" width={4} height={4} />
      </>,
      { css: ".a{fill:red}" },
    );

    expect(svg.indexOf(".a{fill:red}")).toBeGreaterThan(-1);
    expect(svg.indexOf(".b{fill:blue}")).toBeGreaterThan(svg.indexOf(".a{fill:red}"));
    expect(svg.match(/<style>/g)).toHaveLength(1);
  });

  test("names registered properties the way render css does, with the prefix", () => {
    const reach = css.property("style-reach", { syntax: "number", initial: 0 });

    const svg = scene(
      <>
        <Style css={css`.dot{translate:calc(${reach} * 1px) 0}`} />
        <circle class="dot" r={2} style={{ [reach]: 3 }} />
      </>,
      { prefix: "s-" },
    );

    expect(svg).toContain(".dot{translate:calc(var(--s-p1) * 1px) 0}");
    expect(svg).toContain("@property --s-p1{syntax:'<number>';inherits:false;initial-value:0}");
  });

  test("leaves nothing behind in the body", () => {
    expect(scene(<Style css=".a{fill:red}" />)).not.toContain("<Style");
  });
});

describe("css.property", () => {
  test("inherits defaults to false", () => {
    const own = css.property("own", { syntax: "length", initial: 0 });

    expect(scene(<rect width={2} height={2} style={{ [own]: 1 }} />)).toContain("inherits:false");
  });
});
