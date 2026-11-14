import { describe, expect, test } from "bun:test";
import {
  Brace,
  Camera,
  Focus,
  Marker,
  Pivot,
  Steady,
  code,
  cut,
  during,
  ease,
  flow,
  motion,
  rect,
  render,
  reveal,
  sample,
  sampled,
  sampledPath,
  show,
  terminal,
  timeline,
  typewriter,
  valuesAt,
  visible,
  type CameraStop,
  type Child,
  type ChannelValues,
  type Values,
} from "svjeez";

const scene = (child: Child) =>
  render({ width: 300, height: 200, duration: 4, title: "Aliases", reducedMotion: false }, child);

describe("deprecated names from before 0.7 still work", () => {
  test("sample is valuesAt", () => {
    const slide = motion({ x: 0 }).to({ x: 10 }, 1, ease.linear);

    expect(sample(slide, 0.5, { duration: 2 })).toEqual(valuesAt(slide, 0.5, { duration: 2 }));
  });

  test("Values is ChannelValues", () => {
    const old: Values<"x"> = { x: 1 };
    const now: ChannelValues<"x"> = old;

    expect(now).toEqual({ x: 1 });
  });

  test("sampledPath is sampled.path", () => {
    const d = (t: number) => `M${t} 0L${t + 5} 5`;

    expect(scene(<path animation={sampledPath(d, { duration: 4, tolerance: 0.1 })} />)).toBe(
      scene(<path animation={sampled.path(d, { duration: 4, tolerance: 0.1 })} />),
    );
  });

  test("Pivot at is origin", () => {
    const spin = motion({ rotate: 0 }).to({ rotate: 90 }, 1);
    const a = { x: 3, y: 4 };
    const b = { x: 3, y: 4 };

    expect(
      scene(
        <Pivot at={a} animation={spin}>
          <circle r={1} />
        </Pivot>,
      ),
    ).toBe(
      scene(
        <Pivot origin={b} animation={spin}>
          <circle r={1} />
        </Pivot>,
      ),
    );
    expect(
      scene(
        <Pivot origin={a} animation={spin}>
          <circle r={1} />
        </Pivot>,
      ),
    ).toContain("transform-origin:3px 4px");
  });

  test("during is the old name of show on annotations, Focus, Marker and Camera stops", () => {
    const box = rect(0, 0, 10, 10);
    const when = { at: 1, over: 2 };

    expect(scene(<Brace target={box} during={when} />)).toBe(
      scene(<Brace target={box} show={when} />),
    );
    expect(scene(<Marker stops={[{ during: when, target: box }]} />)).toBe(
      scene(<Marker stops={[{ show: when, target: box }]} />),
    );
    expect(scene(<Focus stops={[{ during: when, target: box }]}>{<g />}</Focus>)).toBe(
      scene(<Focus stops={[{ show: when, target: box }]}>{<g />}</Focus>),
    );
    // SAFETY: the missing show is the case under test
    expect(() => Brace({ target: box } as never)).toThrow("Brace() needs a show span");
  });

  test("Steady is a steady Camera", () => {
    const frame = rect(0, 0, 400, 300);

    const stops: CameraStop[] = [
      { during: { at: 0, over: 2 }, target: "all" },
      { during: { at: 3, over: 2 }, target: rect(100, 100, 100, 75) },
    ];

    const at = { x: 150, y: 120 };

    expect(
      scene(
        <Steady frame={frame} stops={stops} at={at}>
          <circle r={1} />
        </Steady>,
      ),
    ).toBe(
      scene(
        <Camera frame={frame} stops={stops} steady origin={at}>
          <circle r={1} />
        </Camera>,
      ),
    );
  });

  test("flow loop is period", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];

    expect(String(flow(line, { at: 0, over: 1, loop: 3 }).node)).toBe(
      String(flow(line, { at: 0, over: 1, period: 3 }).node),
    );
  });

  test("sampled duration is over", () => {
    const fn = (t: number) => ({ x: t });
    const tolerance = { translate: 0.1 };

    expect(scene(<g animation={sampled(fn, { duration: 3, tolerance })} />)).toBe(
      scene(<g animation={sampled(fn, { over: 3, tolerance })} />),
    );
  });

  test("during, cut, tl.show and tl.enter are show", () => {
    const tl = timeline({ a: 1, b: 2 });

    expect(scene(<g animation={during({ at: 1, over: 2 }, 0.4)} />)).toBe(
      scene(<g animation={show({ at: 1, over: 2 }, { fade: 0.4 })} />),
    );
    expect(scene(<g animation={cut({ at: 1, over: 2 })} />)).toBe(
      scene(<g animation={show({ at: 1, over: 2 }, { fade: 0 })} />),
    );
    expect(scene(<g animation={tl.show("b")} />)).toBe(scene(<g animation={show(tl.b)} />));
  });

  test("visible still fades outside its spans, where show fades inside them", () => {
    const spans = [{ at: 1, over: 1 }];

    expect(scene(<g animation={visible(spans)} />)).not.toBe(scene(<g animation={show(spans)} />));
  });

  test("a result's end is its span's end", () => {
    const typed = typewriter(code("ab"), { at: 1 });
    const shell = terminal([{ cmd: "ls" }], { at: 1 });
    const blocks = reveal(code("a\n\nb"), { at: 1 });

    const trip = flow(
      [
        { x: 0, y: 0 },
        { x: 9, y: 0 },
      ],
      { at: 1, over: 1 },
    );

    expect([typed.end, shell.end, blocks.end, trip.end]).toEqual([
      typed.span.end,
      shell.span.end,
      blocks.span.end,
      trip.span.end,
    ]);
  });
});
