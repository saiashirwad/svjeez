import { describe, expect, test } from "bun:test";
import { Once, restyle } from "svjeez";
import { fade, scene, smilScene } from "../helpers/timeline-once";

describe("<Once>", () => {
  test("SMIL inside plays one time and is marked for restyle, SMIL outside keeps looping", () => {
    const held = restyle(smilScene(), { at: 3, onceAt: 1, paused: true }).match(
      /<animate\b[^>]*>/g,
    )!;

    expect(held[0]).toContain('begin="-2.999s" end="0.001s" fill="freeze"');
    expect(held[1]).toContain('begin="-0.999s" end="0.001s" attributeName');
    expect(held[1]!.match(/fill=/g)).toHaveLength(1);
  });

  test("restyle sets the once clock only when asked, and a prefixed scene keeps the unprefixed clocks", () => {
    const svg = scene(<Once animation={fade()} />, "p");
    expect(restyle(svg, { at: 2 })).toContain('style="--t0:-2s"');
    expect(restyle(svg, { at: 2, onceAt: 0 })).toContain('style="--t0:-2s;--t1:-0s"');
  });
});
