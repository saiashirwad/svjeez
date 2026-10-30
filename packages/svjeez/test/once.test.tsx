import { describe, expect, test } from "bun:test";
import { Once, ease, motion, render, restyle } from "svjeez";

const scene = (content: Parameters<typeof render>[1], prefix?: string) =>
  render({ width: 20, height: 20, duration: 4, title: "Once", prefix }, content);

const fade = () => motion({ opacity: 0 }).to({ opacity: 1 }, 1, ease.linear);

describe("<Once>", () => {
  test("a once part plays one time on its own clock while the rest loops", () => {
    const svg = scene(
      <>
        <rect width={10} height={10} animation={fade()} />
        <Once animation={fade()}>
          <rect width={5} height={5} />
        </Once>
      </>,
    );

    expect(svg).toContain(".a{animation-duration:4s;animation-iteration-count:infinite;");
    expect(svg).toContain(".o{animation-iteration-count:1;animation-delay:var(--t1,var(--t0,0s))}");
    expect(svg).toMatch(/<g class="a o m\d+">/);
    expect(svg).toMatch(/<rect width="10" height="10" class="a m\d+"\/>/);
  });

  test("motions nested inside are once too, an inner loop repeats only to the end of the timeline", () => {
    const svg = scene(
      <Once>
        <g>
          <rect width={5} height={5} animation={fade().loop(1)} />
        </g>
      </Once>,
    );

    expect(svg).toMatch(/<rect width="5" height="5" class="a o m\d+"\/>/);
    expect(svg).toMatch(/animation-duration:1s;animation-iteration-count:4/);
  });

  test("SMIL inside plays one time and is marked for restyle, SMIL outside keeps looping", () => {
    const blur = () => motion({ blur: 0 }).to({ blur: 4 }, 2, ease.linear);

    const svg = scene(
      <>
        <rect width={5} height={5} animation={blur()} />
        <Once>
          <rect width={5} height={5} animation={blur()} />
        </Once>
      </>,
    );

    const animates = svg.match(/<animate\b[^>]*>/g)!;
    expect(animates).toHaveLength(2);
    expect(animates[0]).toContain('repeatCount="indefinite"');
    expect(animates[1]).toContain('data-once=""');
    expect(animates[1]).toMatch(/repeatCount="1" fill="freeze"/);

    const held = restyle(svg, { at: 3, onceAt: 1, paused: true }).match(/<animate\b[^>]*>/g)!;
    expect(held[0]).toContain('begin="-2.999s" end="0.001s" fill="freeze"');
    expect(held[1]).toContain('begin="-0.999s" end="0.001s" attributeName');
    expect(held[1]!.match(/fill=/g)).toHaveLength(1);
  });

  test("restyle sets the once clock only when asked, and a prefixed scene keeps the unprefixed clocks", () => {
    const svg = scene(<Once animation={fade()} />, "p");
    expect(svg).toContain(
      ".po{animation-iteration-count:1;animation-delay:var(--t1,var(--t0,0s))}",
    );
    expect(restyle(svg, { at: 2 })).toContain('style="--t0:-2s"');
    expect(restyle(svg, { at: 2, onceAt: 0 })).toContain('style="--t0:-2s;--t1:-0s"');
  });

  test("a scene without <Once> has no once rule", () => {
    expect(scene(<rect width={5} height={5} animation={fade()} />)).not.toContain(
      "{animation-iteration-count:1;animation-delay",
    );
  });
});
