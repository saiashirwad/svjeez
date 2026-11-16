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
    expect(svg).toContain(
      "@property --s-p1{syntax:'\\3c number\\3e ';inherits:false;initial-value:0}",
    );
  });

  test("leaves nothing behind in the body", () => {
    expect(scene(<Style css=".a{fill:red}" />)).not.toContain("<Style");
  });
});

describe("style", () => {
  test("a css value keeps its property holes, beside plain values", () => {
    const turn = css.property("style-turn", { syntax: "angle", inherits: true, initial: 0 });

    const svg = scene(
      <g style={{ [turn]: 30 }}>
        <rect
          width={2}
          height={2}
          style={{ transformOrigin: "1px 1px", rotate: css`calc(${turn} * ${-0.5})` }}
        />
      </g>,
      { prefix: "s-" },
    );

    expect(svg).toContain('<g style="--s-p1:30deg">');
    expect(svg).toContain('style="transform-origin:1px 1px;rotate:calc(var(--s-p1) * -0.5)"');
  });

  test("a css value with no holes is plain text", () => {
    expect(scene(<rect width={2} height={2} style={{ opacity: css`calc(1 / 2)` }} />)).toContain(
      'style="opacity:calc(1 / 2)"',
    );
  });
});

describe("css.property", () => {
  test("the syntax has no angle bracket, so the rule survives an SVG pasted inline into HTML", () => {
    const hue = css.property("style-hue", { syntax: "angle", initial: 0 });
    const svg = scene(<rect width={2} height={2} style={{ [hue]: 1 }} />);
    const rule = /@property [^{]+\{[^}]*\}/.exec(svg)![0];

    expect(rule).toContain("syntax:'\\3c angle\\3e ';");
    expect(rule).not.toMatch(/[<>]/);
  });

  test("inherits defaults to false", () => {
    const own = css.property("own", { syntax: "length", initial: 0 });

    expect(scene(<rect width={2} height={2} style={{ [own]: 1 }} />)).toContain("inherits:false");
  });
});
