import { describe, expect, test } from "bun:test";
import { Once } from "svjeez";
import { fade, scene, smilScene } from "../helpers/timeline-once";

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
    const animates = smilScene().match(/<animate\b[^>]*>/g)!;
    expect(animates).toHaveLength(2);
    expect(animates[0]).toContain('repeatCount="indefinite"');
    expect(animates[1]).toContain('data-once=""');
    expect(animates[1]).toMatch(/repeatCount="1" fill="freeze"/);
  });

  test("a prefixed scene keeps its once rule", () => {
    expect(scene(<Once animation={fade()} />, "p")).toContain(
      ".po{animation-iteration-count:1;animation-delay:var(--t1,var(--t0,0s))}",
    );
  });

  test("a scene without <Once> has no once rule", () => {
    expect(scene(<rect width={5} height={5} animation={fade()} />)).not.toContain(
      "{animation-iteration-count:1;animation-delay",
    );
  });
});
