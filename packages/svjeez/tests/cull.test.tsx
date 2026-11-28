import { describe, expect, test } from "bun:test";
import { costOf, renderFrames } from "svjeez/frames";
import { restyle } from "svjeez/page";
import {
  Group,
  Sequence,
  Shape,
  blur,
  clock,
  ease,
  enter,
  exit,
  rect,
  scene,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { check, svg, type Hex, type SceneOptions } from "svjeez/tools";

const emit = (build: () => SceneElement, options: Partial<SceneOptions> = {}): string =>
  svg.emit(
    scene(
      { size: [40, 40], duration: 12, loop: false, still: 11, title: "Cull", ...options },
      build,
    ),
  );

const toggles = (out: string) => out.match(/<animateTransform\b[^>]*>/g) ?? [];

/** A shot of `length` seconds that fades in and out unless it opens or closes the film, with a square looping under a blur, as a pedal does all scene long. */
const shot = (start: number, length: number, fill: Hex, { first = false, last = false } = {}) => (
  <Sequence when={span(start, length)}>
    <Group
      motion={[
        !first && enter(span(0, 0.5), { curve: ease.inOut }),
        !last && exit(span(length - 0.5, 0.5), { curve: ease.inOut }),
      ]}
    >
      <Group effects={[blur(1 + start / 10)]}>
        <Shape
          geometry={rect(30, 30)}
          fill={fill}
          at={track<Vec>([10, 10])
            .to([20, 10], span(0, 0.5), ease.linear)
            .to([10, 10], span(0.5, 0.5), ease.linear)
            .loop(1)}
        />
      </Group>
    </Group>
  </Sequence>
);

const film = () => (
  <Group>
    {shot(0, 4, "#FF0000", { first: true })}
    {shot(3.5, 4, "#00FF00")}
    {shot(7, 5, "#0000FF", { last: true })}
  </Group>
);

const out = emit(film);

describe("culling what holds at opacity 0", () => {
  test("a shot is scaled to 0 outside its window, half a second clear of each fade", () => {
    expect(toggles(out)).toEqual([
      '<animateTransform attributeName="transform" type="scale" values="1;0" keyTimes="0;0.375" calcMode="discrete" dur="12s" fill="freeze"/>',
      '<animateTransform attributeName="transform" type="scale" values="0;1;0" keyTimes="0;0.25;0.66667" calcMode="discrete" dur="12s" fill="freeze"/>',
    ]);
  });

  test("the shot the still frame shows is never culled, since reduced motion does not stop SMIL", () => {
    expect(toggles(emit(film, { still: 1 }))).toEqual([
      '<animateTransform attributeName="transform" type="scale" values="0;1;0" keyTimes="0;0.25;0.66667" calcMode="discrete" dur="12s" fill="freeze"/>',
      '<animateTransform attributeName="transform" type="scale" values="0;1" keyTimes="0;0.54167" calcMode="discrete" dur="12s" fill="freeze"/>',
    ]);
  });

  test("a looping scene repeats the toggle and keeps the margin at the seam", () => {
    const looped = emit(() => shot(0, 6, "#FF0000", { first: true }), {
      loop: true,
      still: 9,
    });

    expect(toggles(looped)).toEqual([
      '<animateTransform attributeName="transform" type="scale" values="1;0;1" keyTimes="0;0.54167;0.95833" calcMode="discrete" dur="12s" repeatCount="indefinite"/>',
    ]);
  });

  test("it runs at playback speed", () => {
    const fast = svg.emit(
      scene({ size: [40, 40], duration: 12, loop: false, still: 11, title: "Cull" }, film),
      { playbackRate: 2 },
    );

    expect(toggles(fast)[0]).toContain('dur="6s"');
  });

  test("nothing hidden, nothing moving, a short gap or a page clock leave the SVG as it was", () => {
    const still = () => (
      <Group motion={[enter(span(0, 0.5)), exit(span(8, 0.5))]}>
        <Shape geometry={rect(10, 10)} fill="#FF0000" />
      </Group>
    );

    const shown = () => (
      <Group>
        <Shape
          geometry={rect(10, 10)}
          fill="#FF0000"
          at={track<Vec>([0, 0]).to([9, 0], span(0, 12))}
        />
      </Group>
    );

    const brief = () => (
      <Group motion={[exit(span(9, 0.5))]}>
        <Shape
          geometry={rect(10, 10)}
          fill="#FF0000"
          at={track<Vec>([0, 0]).to([9, 0], span(0, 12))}
        />
      </Group>
    );

    for (const build of [still, shown, brief])
      expect(toggles(emit(build, { still: 1 }))).toEqual([]);

    expect(
      toggles(
        emit(() => <Sequence clock={clock("open", span(0, 6))}>{shot(0, 6, "#FF0000")}</Sequence>, {
          still: 1,
        }),
      ),
    ).toEqual([]);
  });

  test("a group that sets its own transform gets the toggle on a group around it", () => {
    const placed = emit(() => (
      <Group at={[5, 5]} motion={[exit(span(2, 0.5))]}>
        <Shape
          geometry={rect(10, 10)}
          fill="#FF0000"
          at={track<Vec>([0, 0]).to([9, 0], span(0, 2))}
        />
      </Group>
    ));

    expect(placed).toMatch(/<g>\s*<animateTransform [^>]*\/>\s*<g transform="translate\(5 5\)"/);
  });

  test("restyle shifts the toggle with the rest of the clock, and a timeline drops it", () => {
    expect(toggles(restyle(out, { at: 3 }))[0]).toContain('<animateTransform begin="-3s"');
    expect(toggles(restyle(out, { at: 3, paused: true }))[0]).toContain('end="0.001s"');
    expect(toggles(restyle(out, { timeline: "--story" }))).toEqual([]);
  });

  test("the cost estimate counts what a cull stops only while it is drawn", () => {
    const plain = costOf(out.replace(/<animateTransform\b[^>]*\/>/g, ""));
    const culled = costOf(out);

    expect(culled.animations).toBeLessThan(plain.animations);
    expect(culled.repaint).toBeLessThan(plain.repaint);
  });

  test("check times a moving filter by when it is drawn, not by its loop", () => {
    const times = check(
      scene({ size: [40, 40], duration: 12, loop: false, still: 11, title: "Cull" }, film),
    )
      .problems.filter((problem) => problem.code === "moving-filter")
      .map((problem) => problem.times);

    expect(times).toEqual([
      [0, 4.5],
      [3, 8],
      [0, 12],
    ]);
  });
});

const browser = await renderFrames(out, { times: [0] }).then(
  () => true,
  (error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping frame tests: ${error.message.split("\n")[0]}`);

    return false;
  },
);

describe.if(browser)("culled frames", () => {
  test("look the same as without the toggles, crossfades included", async () => {
    const times = [0.2, 3.75, 4.6, 7.25, 9, 11.9];
    const plain = out.replace(/<animateTransform\b[^>]*\/>/g, "");

    const [culled, reference] = await Promise.all([
      renderFrames(out, { times }),
      renderFrames(plain, { times }),
    ]);

    times.forEach((time, index) => {
      const [a, b] = [culled.frames[index]!.png, reference.frames[index]!.png];

      expect(Buffer.from(a).equals(Buffer.from(b)), `at ${time}s`).toBe(true);
    });
  });
});
