import { describe, expect, test } from "bun:test";
import { Ambient, Clip, ease, motion, render, span } from "svjeez";
import { restyle } from "svjeez/page";

const scene = (content: Parameters<typeof render>[1], prefix?: string) =>
  render({ width: 20, height: 20, duration: 4, title: "Scroll", prefix }, content);

const fade = (seconds = 1) =>
  motion({ opacity: 0 }).to({ opacity: 1 }, span(0, seconds), ease.linear);

const tail = (svg: string) => svg.slice(svg.lastIndexOf("<style>"));

describe("restyle({ timeline })", () => {
  test("follows the timeline once, with a count that ends each rule at the loop", () => {
    const svg = scene(
      <>
        <rect width={10} height={10} animation={fade(4)} />
        <rect width={5} height={5} animation={fade(0.5).loop(1)} />
      </>,
    );

    const css = tail(restyle(svg, { timeline: "--story", range: "contain" }));

    expect(css).toContain(
      "@supports (animation-timeline:scroll()){@media (prefers-reduced-motion:no-preference){",
    );
    expect(css).toContain(
      ".a:not(.c){animation-timeline:--story;animation-delay:0s;animation-iteration-count:1;animation-range:contain}",
    );
    expect(css).toMatch(/\.m\d+:not\(\.c\)\{animation-iteration-count:4\}/);
  });

  test("a prefixed scene keeps its prefix, and a rule's comma list gets a comma list of counts", () => {
    const svg = scene(
      <rect
        width={5}
        height={5}
        animation={[
          fade(0.5).loop(1),
          motion({ x: 0 }).to({ x: 5 }, span(0, 1), ease.linear).loop(2),
        ]}
      />,
      "p",
    );

    const css = tail(restyle(svg, { timeline: "scroll(root)" }));

    expect(css).toContain(".pa:not(.pc){animation-timeline:scroll(root);");
    expect(css).toMatch(/\.pm\d+:not\(\.pc\)\{animation-iteration-count:2,4\}/);
    expect(css).not.toContain("animation-range");
  });

  test("without the option the scene is untouched", () => {
    const svg = scene(<rect width={5} height={5} animation={fade()} />);
    expect(restyle(svg, {})).toBe(svg);
  });

  test("a scene with SMIL points to seek()", () => {
    const svg = scene(
      <filter id="f">
        <feGaussianBlur
          stdDeviation={0}
          animation={motion({ stdDeviation: 0 }).to({ stdDeviation: 4 }, span(0, 1), ease.linear)}
        />
      </filter>,
    );

    expect(svg).toContain("<animate");
    expect(() => restyle(svg, { timeline: "--story" })).toThrow("seek() from svjeez/page");
  });

  test("a timeline that is neither a dashed name nor a function throws", () => {
    const svg = scene(<rect width={5} height={5} animation={fade()} />);
    expect(() => restyle(svg, { timeline: "story" })).toThrow("restyle() needs a timeline");
  });

  describe("<Ambient>", () => {
    const spin = () => motion({ rotate: 0 }).to({ rotate: 360 }, span(0, 1), ease.linear).loop(1);

    test("marks its motions and those inside it, and changes nothing else in the scene", () => {
      const svg = scene(
        <>
          <rect width={10} height={10} animation={spin()} />
          <Ambient animation={fade(4)}>
            <g>
              <rect width={5} height={5} animation={spin()} />
            </g>
          </Ambient>
        </>,
      );

      expect(svg).toMatch(/<rect width="10" height="10" class="a m\d+ fb"\/>/);
      expect(svg).toMatch(/<g class="a c m\d+">/);
      expect(svg).toMatch(/<rect width="5" height="5" class="a c m\d+ fb"\/>/);
      expect(svg.match(/animation-duration:1s/g)).toHaveLength(1);
      expect(svg).not.toContain(".c{");
    });

    test("no timeline rule reaches it, so it keeps its duration, its endless loop and its delay", () => {
      const svg = scene(
        <>
          <rect width={10} height={10} animation={spin()} />
          <Ambient>
            <rect width={5} height={5} animation={spin()} />
          </Ambient>
        </>,
        "p",
      );

      const css = tail(restyle(svg, { timeline: "--story" }));

      expect(css).toContain(
        ".pa:not(.pc){animation-timeline:--story;animation-delay:0s;animation-iteration-count:1}",
      );
      expect(css).toMatch(/\.pm\d+:not\(\.pc\)\{animation-iteration-count:4\}/);

      for (const [selector] of css.matchAll(/\.p[\w-]+[^{}]*(?=\{animation-)/g))
        expect(selector).toContain(":not(.pc)");
      expect(
        restyle(svg, { timeline: "--story" }).startsWith(svg.slice(0, svg.lastIndexOf("</svg>"))),
      ).toBe(true);
      expect(svg).toMatch(
        /\.pa\{animation-duration:4s;animation-iteration-count:infinite;[^}]*animation-delay:var\(--t0,0s\)\}/,
      );
      expect(svg).toContain(".pm1{animation-name:pk1;animation-duration:1s;");
    });

    test("at still starts the ambient parts partway in", () => {
      const svg = scene(<Ambient animation={spin()} />);
      const out = restyle(svg, { timeline: "--story", at: 0.5 });

      expect(out).toContain('style="--t0:-0.5s"');
      expect(tail(out)).toContain("animation-timeline:--story");
    });

    test("a clip's offset stays in its keyframes, which the clock still plays", () => {
      const svg = scene(
        <Clip at={1}>
          <Ambient>
            <rect width={5} height={5} animation={fade(1)} />
          </Ambient>
        </Clip>,
      );

      expect(svg).toMatch(/@keyframes k\d+\{0%,25%\{opacity:0\}50%,100%\{opacity:1\}\}/);
      expect(tail(restyle(svg, { timeline: "--story" }))).not.toMatch(/\.m\d+[^:]/);
    });

    test("SMIL inside it is allowed under a timeline, and SMIL outside still throws", () => {
      const blur = () => motion({ blur: 0 }).to({ blur: 4 }, span(0, 2), ease.linear);

      const inside = scene(
        <>
          <rect width={5} height={5} animation={fade(4)} />
          <Ambient>
            <rect width={5} height={5} animation={blur()} />
          </Ambient>
        </>,
      );

      expect(inside).toMatch(/<animate\b[^>]*data-ambient=""/);
      expect(tail(restyle(inside, { timeline: "--story" }))).toContain(
        "animation-timeline:--story",
      );

      const outside = scene(
        <>
          <rect width={5} height={5} animation={blur()} />
          <Ambient animation={fade(4)} />
        </>,
      );

      expect(() => restyle(outside, { timeline: "--story" })).toThrow("outside <Ambient>");
    });
  });
});
