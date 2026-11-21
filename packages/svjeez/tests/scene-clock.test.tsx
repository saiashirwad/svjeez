import { describe, expect, test } from "bun:test";
import {
  Group,
  Sequence,
  Shape,
  Stack,
  Text,
  circle,
  clock,
  enter,
  font,
  line,
  looping,
  linear,
  morph,
  rect,
  scene,
  span,
  track,
  type Paint,
  type SceneElement,
} from "svjeez";
import { svg, type Model } from "svjeez/tools";

const space = font.family(
  await font.load(new URL("./fixtures/SpaceMono-Regular.ttf", import.meta.url)),
  await font.load(new URL("./fixtures/SpaceMono-Bold.ttf", import.meta.url)),
);

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test" }, build);

const emitted = (build: () => SceneElement): string => svg.emit(made(build));

const unmarked = (out: string): string => out.replace(/ data-clock[a-z-]*="[^"]*"/g, "");

const open = clock("open", span(0.5, 0.4));

const card = (key: string) => (
  <Shape key={key} geometry={rect(20, 20)} fill="#ff0000" motion={enter(span(0, 0.4))} />
);

describe("clock()", () => {
  test("is a value with a name, a start and a length", () => {
    expect(open).toMatchObject({ name: "open", start: 0.5, over: 0.4 });
  });

  test("needs a name that is an identifier and a span with a length", () => {
    expect(() => clock("", span(0, 1))).toThrow("starts with a letter");
    expect(() => clock("1st", span(0, 1))).toThrow("starts with a letter");
    expect(() => clock("a b", span(0, 1))).toThrow("starts with a letter");
    // @ts-expect-error a clock needs a span with a length
    expect(() => clock("open", span(1))).toThrow('clock("open") needs the span it plays at');
    expect(() => clock("open", span(1, 0))).toThrow("needs a positive over");
  });
});

describe("<Sequence clock>", () => {
  test("takes when or clock, and exactly one of them", () => {
    // @ts-expect-error neither when nor clock is a type error as well as a runtime one
    expect(() => <Sequence>{card("a")}</Sequence>).toThrow("takes when={span(start, over)}");
    expect(() => (
      // @ts-expect-error both when and clock is a type error as well as a runtime one
      <Sequence when={span(0, 1)} clock={open}>
        {card("a")}
      </Sequence>
    )).toThrow("takes when or clock, not both");
    expect(() => <Sequence clock={{ name: "x", start: 0, over: 1 }} />).toThrow(
      "with a c from clock(name, span(start, over))",
    );
  });

  test("lowers like the same when, apart from the attributes that mark the clock", () => {
    const clocked = emitted(() => (
      <Sequence clock={open}>
        {card("a")}
        <Group key="g" motion={enter(span(0.1, 0.2))}>
          <Shape geometry={circle(5)} fill="#00ff00" />
        </Group>
      </Sequence>
    ));

    const timed = emitted(() => (
      <Sequence when={span(0.5, 0.4)}>
        {card("a")}
        <Group key="g" motion={enter(span(0.1, 0.2))}>
          <Shape geometry={circle(5)} fill="#00ff00" />
        </Group>
      </Sequence>
    ));

    expect(clocked).toContain('data-clock="open"');
    expect(unmarked(clocked)).toBe(timed);
  });

  test("marks the outermost element of each top node with the name, absolute start and length", () => {
    const out = emitted(() => (
      <Sequence when={span(1)}>
        <Sequence clock={open}>{card("a")}</Sequence>
        {card("b")}
      </Sequence>
    ));

    expect(out.match(/data-clock/g)).toHaveLength(3);
    expect(out).toMatch(/<rect[^>]* data-clock="open" data-clock-at="1.5" data-clock-over="0.4"/);
  });

  test("marks a group that would otherwise vanish into its children", () => {
    const out = emitted(() => (
      <Sequence clock={open}>
        <Group>
          <Shape geometry={rect(5, 5)} fill="#000000" motion={enter(span(0, 0.4))} />
          <Shape geometry={rect(5, 5)} fill="#000000" at={[10, 0]} motion={enter(span(0, 0.4))} />
        </Group>
      </Sequence>
    ));

    expect(out).toMatch(/<g data-clock="open" data-clock-at="0.5" data-clock-over="0.4" fill=/);
  });

  test("keeps the clock of a group whose only child is lifted into it", () => {
    const out = emitted(() => (
      <Sequence clock={open}>
        <Group at={[10, 10]}>
          <Shape geometry={rect(5, 5)} fill="#000000" motion={enter(span(0, 0.4))} />
        </Group>
      </Sequence>
    ));

    expect(out.match(/data-clock="open"/g)).toHaveLength(1);
  });

  test("leaves a node's own parent out of the clock", () => {
    const out = emitted(() => (
      <Group motion={enter(span(0, 1))}>
        <Sequence clock={open}>{card("a")}</Sequence>
      </Group>
    ));

    expect(out).toMatch(/<g[^>]*class="[^"]*"[^>]*>\s*<rect[^>]* data-clock="open"/);
    expect(out.match(/data-clock="open"/g)).toHaveLength(1);
  });

  test("one clock can drive two sequences, each marked with where it plays", () => {
    const out = emitted(() => (
      <>
        <Sequence clock={open}>{card("a")}</Sequence>
        <Sequence when={span(2)}>
          <Sequence clock={open}>{card("b")}</Sequence>
        </Sequence>
      </>
    ));

    expect(out).toContain('data-clock-at="0.5"');
    expect(out).toContain('data-clock-at="2.5"');
  });

  test("marks the definitions a clocked node animates, and not the ones another node shares", () => {
    const from = linear({ from: [0, 0], to: [20, 0], stops: ["#000000", "#ff0000"] });
    const to = linear({ from: [0, 0], to: [20, 0], stops: ["#000000", "#00ff00"] });
    const fill = track<Paint>(from).to(to, span(0, 0.4));

    const out = emitted(() => (
      <>
        <Sequence clock={open}>
          <Shape geometry={rect(20, 20)} fill={fill} />
        </Sequence>
        <Shape geometry={rect(20, 20)} fill={from} />
      </>
    ));

    expect(out.match(/<linearGradient/g)).toHaveLength(2);
    expect(out).toMatch(/<linearGradient[^>]* data-clock="open" data-clock-at="0.5"/);
    expect(out.match(/data-clock="open"/g)).toHaveLength(2);
  });

  test("marks the clip a clocked node is cut by", () => {
    const out = emitted(() => (
      <Sequence clock={open}>
        <Shape
          geometry={rect(20, 20)}
          fill="#000000"
          clip={track(circle(2)).to(circle(10), span(0, 0.4))}
        />
      </Sequence>
    ));

    expect(out).toMatch(/<clipPath[^>]* data-clock="open"/);
  });

  test("keeps the clock on its nodes through layout and morphs", () => {
    const model = made(() => (
      <Sequence when={span(1)}>
        <Sequence clock={open}>
          <Stack key="row" direction="row" gap={4}>
            {card("a")}
            {card("b")}
          </Stack>
          {morph(
            <Shape key="m" geometry={rect(10, 10)} fill="#000000" />,
            <Shape key="m" geometry={rect(20, 10)} fill="#000000" />,
            span(0, 0.4),
          )}
        </Sequence>
      </Sequence>
    ));

    const mark = { name: "open", start: 1.5, over: 0.4 };

    expect(model.root.children.map((node) => [node.key, node.clock])).toEqual([
      ["row", mark],
      ["m", mark],
    ]);
  });
});

describe("what a clock refuses", () => {
  test("a clocked sequence inside another", () => {
    const inner = clock("inner", span(0, 0.2));

    expect(() =>
      made(() => (
        <Sequence clock={open}>
          <Sequence when={span(0.1)}>
            <Sequence clock={inner}>{card("a")}</Sequence>
          </Sequence>
        </Sequence>
      )),
    ).toThrow(
      '<Sequence clock="inner"> sits inside a <Sequence clock="open">, and clocks don\'t nest',
    );
  });

  test("two different clocks with one name, but not one clock used twice", () => {
    expect(() =>
      made(() => (
        <>
          <Sequence clock={open}>{card("a")}</Sequence>
          <Sequence clock={clock("open", span(2, 0.4))}>{card("b")}</Sequence>
        </>
      )),
    ).toThrow('Two clocks are both named "open"');

    expect(() =>
      made(() => (
        <>
          <Sequence clock={open}>{card("a")}</Sequence>
          <Sequence clock={open}>{card("b")}</Sequence>
        </>
      )),
    ).not.toThrow();
  });

  test("a track read on a clock and anywhere else, even when the offsets match", () => {
    const fade = track(0).to(1, span(0, 0.4));
    const other = clock("other", span(0.5, 0.4));

    const reads = (...parts: SceneElement[]) =>
      made(() => (
        <>
          {parts.map((part, i) => (
            <Group key={`p${i}`}>{part}</Group>
          ))}
        </>
      ));

    const fading = (key: string) => (
      <Shape key={key} geometry={rect(5, 5)} fill="#000000" opacity={fade} />
    );

    expect(() =>
      reads(
        <Sequence clock={open}>{fading("a")}</Sequence>,
        <Sequence when={span(0.5)}>{fading("b")}</Sequence>,
      ),
    ).toThrow("read the same track, but they count time on different clocks");

    expect(() => reads(<Sequence clock={open}>{fading("a")}</Sequence>, fading("b"))).toThrow(
      'the clock "open" and the scene\'s clock',
    );

    expect(() =>
      reads(
        <Sequence clock={open}>{fading("a")}</Sequence>,
        <Sequence clock={other}>{fading("b")}</Sequence>,
      ),
    ).toThrow('the clock "open" and the clock "other"');

    expect(() =>
      reads(
        <Sequence clock={open}>{fading("a")}</Sequence>,
        <Sequence clock={open}>{fading("b")}</Sequence>,
      ),
    ).not.toThrow();
  });

  test("a morph, a moving gradient and a text-path start play by SMIL, which the page's clock takes over", () => {
    const g = (x: number) => linear({ from: [0, 0], to: [x, 0], stops: ["#000000", "#ff0000"] });

    const out = emitted(() => (
      <Sequence clock={open}>
        <Shape
          key="bar"
          geometry={track(rect(20, 20)).to(circle(10), span(0, 0.4))}
          fill={track<Paint>(g(10)).to(g(30), span(0, 0.4))}
        />
        <Text
          key="word"
          font={space}
          size={10}
          fill="#000000"
          along={line([0, 50], [180, 50])}
          start={track(0).to(1, span(0, 0.4))}
        >
          Hi
        </Text>
      </Sequence>
    ));

    expect(out).toContain('attributeName="d"');
    expect(out).toContain('attributeName="x2"');
    expect(out).toContain('attributeName="startOffset"');
    expect(out).toMatch(/<linearGradient id="g1"[^>]*data-clock="open"/);
  });
});

describe("states", () => {
  const stated = (states?: Parameters<typeof scene>[0]["states"]) =>
    svg.emit(
      scene({ size: [200, 100], duration: 4, title: "Test", states }, () => (
        <Sequence clock={open}>{card("a")}</Sequence>
      )),
    );

  test("ride on the root svg as compact JSON, and only when given", () => {
    const out = stated({ closed: { open: 0 }, "menu.open": { open: 1 } });

    expect(out).toContain(
      `data-states="{&quot;closed&quot;:{&quot;open&quot;:0},&quot;menu.open&quot;:{&quot;open&quot;:1}}"`,
    );
    expect(stated()).not.toContain("data-states");
    expect(out.replace(/ data-states="[^"]*"/, "")).toBe(stated());
  });

  test("name clocks the scene uses, at places from 0 to 1", () => {
    expect(() => stated({ shut: { nope: 0 } })).toThrow(
      'State "shut" names the clock "nope", but the scene\'s clocks are "open".',
    );
    expect(() => stated({ shut: { open: 2 } })).toThrow(
      'State "shut" rests the clock "open" at 2, but a place is progress from 0 to 1.',
    );
    expect(() => stated({ shut: { open: NaN } })).toThrow("a place is progress from 0 to 1");
    expect(() => stated({ "": { open: 0 } })).toThrow("a state with an empty name");
  });

  test('may name a clock as looping, written as "loop", and nothing else', () => {
    expect(stated({ busy: { open: looping } })).toContain(
      `data-states="{&quot;busy&quot;:{&quot;open&quot;:&quot;loop&quot;}}"`,
    );
    expect(looping).toBe("loop");
    // @ts-expect-error a place is a number or looping
    expect(() => stated({ busy: { open: "spin" } })).toThrow("a place is progress from 0 to 1");
  });
});
