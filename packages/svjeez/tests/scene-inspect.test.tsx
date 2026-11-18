/** @jsxImportSource svjeez/scene */
import { describe as group, expect, test } from "bun:test";
import { font } from "svjeez";
import {
  Group,
  Shape,
  Text,
  blur,
  circle,
  draw,
  linear,
  rect,
  scene,
  span,
  spin,
  tokens,
  track,
  type Paint,
  type SceneElement,
} from "svjeez/scene";
import { describe, inspect, svg, type Code, type Finding, type Model } from "svjeez/scene/tools";

const mono = await font.load(new URL("./fixtures/SpaceMono-Regular.ttf", import.meta.url));

const made = (build: () => SceneElement, duration = 4, loop = true): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test", loop }, build);

const codes = (model: Model.Scene): Code[] => inspect(model).map((found) => found.code);

const only = (model: Model.Scene, code: Code): Finding[] =>
  inspect(model).filter((found) => found.code === code);

/** A filled square, the thing most rules look at. */
const Dot = (props: Partial<Parameters<typeof Shape>[0]>): SceneElement => (
  <Shape geometry={rect(10, 10)} fill="#FF0000" at={[20, 20]} {...props} />
);

group("never-visible", () => {
  test("a node hidden at every time, by its opacity or its scale", () => {
    for (const hidden of [
      <Dot key="a" opacity={0} />,
      <Dot key="a" scale={0} />,
      <Dot key="a" scale={[1, 0]} />,
    ]) {
      const [found] = only(
        made(() => <Group>{hidden}</Group>),
        "never-visible",
      );

      expect(found).toMatchObject({ key: "a", severity: "warning" });
      expect(found!.message).toStartWith('shape "a" is never visible');
    }
  });

  test("a node that fades or grows in at some time is visible", () => {
    expect(codes(made(() => <Dot opacity={track(0).to(1, span(1, 1))} />))).not.toContain(
      "never-visible",
    );
    expect(codes(made(() => <Dot scale={track(0).to(1, span(1, 1))} />))).not.toContain(
      "never-visible",
    );
  });

  test("a group hidden at every time is reported once, not for each thing it holds", () => {
    const found = only(
      made(() => (
        <Group key="g" opacity={0}>
          <Dot />
          <Dot at={[40, 20]} />
        </Group>
      )),
      "never-visible",
    );

    expect(found.map((f) => f.key)).toEqual(["g"]);
  });

  test("a shape that paints nothing: clear paint, a stroke 0 wide; no paint at all doesn't compile", () => {
    expect(() => made(() => <Shape key="bare" geometry={rect(10, 10)} />)).toThrow(
      '<Shape> "bare" paints nothing: it has no fill and no stroke.',
    );

    for (const shape of [
      <Shape geometry={rect(10, 10)} fill="#FF000000" />,
      <Shape geometry={rect(10, 10)} stroke={{ color: "#FF0000", width: 0 }} />,
    ])
      expect(
        only(
          made(() => <Group>{shape}</Group>),
          "never-visible",
        )[0]!.message,
      ).toMatch(/never visible: it has (no fill|a fill that is fully transparent)/);
  });

  test("a stroke alone, or a clear fill with a stroke, paints", () => {
    for (const shape of [
      <Shape geometry={rect(10, 10)} stroke={{ color: "#FF0000", width: 1 }} />,
      <Shape geometry={rect(10, 10)} fill="#FF000000" stroke={{ color: "#FF0000", width: 1 }} />,
    ])
      expect(codes(made(() => <Group>{shape}</Group>))).not.toContain("never-visible");
  });

  test("a clip with no area cuts everything away; a small one doesn't", () => {
    expect(
      only(
        made(() => <Dot clip={rect(0, 10)} />),
        "never-visible",
      )[0]!.message,
    ).toContain("clip");
    expect(codes(made(() => <Dot clip={rect(5, 5)} />))).not.toContain("never-visible");
  });

  test("a node an opaque, still, upright rect drawn after it covers at every time", () => {
    const found = only(
      made(() => (
        <Group>
          <Dot key="under" />
          <Shape key="cover" geometry={rect(60, 60)} fill="#FFFFFF" />
        </Group>
      )),
      "never-visible",
    );

    expect(found).toMatchObject([{ key: "under", related: [{ key: "cover" }] }]);
    expect(found[0]!.hint).toContain('"cover"');
  });

  test("covering stays silent when the cover is see-through, turned, smaller, under, rounded over it, or moving", () => {
    const near = [
      <Shape geometry={rect(60, 60)} fill="#FFFFFF80" />,
      <Shape geometry={rect(60, 60)} fill="#FFFFFF" rotate={10} />,
      <Shape
        geometry={rect(60, 60)}
        fill={linear({ from: [0, 0], to: [60, 0], stops: ["#FFFFFF", "#000000"] })}
      />,
      <Shape geometry={rect(25, 25)} fill="#FFFFFF" />,
      <Shape geometry={rect(32, 32, { radius: 16 })} fill="#FFFFFF" />,
      <Shape geometry={rect(60, 60)} fill="#FFFFFF" at={track([0, 0]).to([100, 0], span(1, 1))} />,
      <Shape geometry={rect(60, 60)} fill="#FFFFFF" opacity={track(1).to(0, span(1, 1))} />,
    ];

    for (const cover of near)
      expect(
        codes(
          made(() => (
            <Group>
              <Dot />
              {cover}
            </Group>
          )),
        ),
      ).not.toContain("never-visible");

    expect(
      codes(
        made(() => (
          <Group>
            <Shape geometry={rect(60, 60)} fill="#FFFFFF" />
            <Dot />
          </Group>
        )),
      ),
    ).not.toContain("never-visible");
  });

  test("a node that moves out from under the cover is visible", () => {
    expect(
      codes(
        made(() => (
          <Group>
            <Dot at={track([20, 20]).to([150, 20], span(1, 1))} />
            <Shape geometry={rect(60, 60)} fill="#FFFFFF" />
          </Group>
        )),
      ),
    ).not.toContain("never-visible");
  });
});

group("zero-size", () => {
  test("geometry with no size at any time", () => {
    expect(
      only(
        made(() => <Dot key="a" geometry={rect(0, 10)} />),
        "zero-size",
      )[0]!.message,
    ).toContain("a rect 0 by 10");
    expect(codes(made(() => <Dot geometry={circle(0)} />))).toContain("zero-size");
  });

  test("geometry that grows from nothing, or a flat line, has a size", () => {
    expect(
      codes(made(() => <Dot geometry={track(rect(0, 10)).to(rect(10, 10), span(1, 1))} />)),
    ).not.toContain("zero-size");
  });
});

group("off-canvas", () => {
  test("outside the canvas at every time is an error, with where it stays", () => {
    const [found] = only(
      made(() => <Dot key="far" at={[300, 10]} />),
      "off-canvas",
    );

    expect(found).toMatchObject({ key: "far", severity: "error" });
    expect(found!.message).toContain("x 300 to 310");
  });

  test("something that flies in from outside is on the canvas at some time", () => {
    expect(codes(made(() => <Dot at={track([300, 10]).to([10, 10], span(1, 1))} />))).not.toContain(
      "off-canvas",
    );
  });

  test("cut by an edge at rest is a warning that says how far", () => {
    const [found] = only(
      made(() => <Dot at={[192, 10]} />),
      "off-canvas",
    );

    expect(found).toMatchObject({ severity: "warning" });
    expect(found!.message).toContain("cut off 2 past the right edge");
  });

  test("a background that bleeds, or a shape mostly past the edge, is meant", () => {
    expect(
      codes(made(() => <Shape geometry={rect(220, 120)} at={[-10, -10]} fill="#FFFFFF" />)),
    ).not.toContain("off-canvas");
    expect(codes(made(() => <Dot at={[198, 10]} />))).not.toContain("off-canvas");
    expect(codes(made(() => <Dot at={[190, 10]} />))).not.toContain("off-canvas");
  });
});

const say = (
  text: string,
  at: readonly [number, number],
  extra: Partial<Parameters<typeof Text>[0]> = {},
): SceneElement => (
  <Text font={mono} size={12} fill="#000000" at={at} {...extra}>
    {text}
  </Text>
);

group("text", () => {
  test("text past the canvas while it rests", () => {
    const [found] = only(
      made(() => say("hello world", [150, 50])),
      "text-overflow",
    );

    expect(found!.message).toContain("past the right edge of the canvas");
    expect(codes(made(() => say("hello", [20, 50])))).not.toContain("text-overflow");
  });

  test("a line wider than the column it wraps to: one character wider than the width", () => {
    const [found] = only(
      made(() => say("W", [20, 50], { width: 2 })),
      "text-overflow",
    );

    expect(found!.message).toContain("wider than the width it wraps to");
    expect(codes(made(() => say("a long line that wraps", [20, 30], { width: 60 })))).not.toContain(
      "text-overflow",
    );
  });

  test("two texts over each other while both rest", () => {
    const found = only(
      made(() => (
        <Group>
          {say("first", [20, 50])}
          {say("second", [24, 52])}
        </Group>
      )),
      "overlap",
    );

    expect(found).toHaveLength(1);
    expect(found[0]!.related).toHaveLength(1);
  });

  test("overlap stays silent for the same words, text passing by, and text hidden under a shape", () => {
    const near = [
      <Group>
        {say("same", [20, 50])}
        {say("same", [22, 50])}
      </Group>,
      <Group>
        {say("first", [20, 50])}
        {say("second", [24, 50], { at: track([200, 50]).to([-100, 50], span(0, 4)) })}
      </Group>,
      <Group>
        {say("first", [20, 50])}
        <Shape geometry={rect(100, 40)} at={[10, 30]} fill="#FFFFFF" />
        {say("second", [24, 52])}
      </Group>,
    ];

    for (const scene of near) expect(codes(made(() => scene))).not.toContain("overlap");
  });

  test("characters the face has no glyph for are an error that names them", () => {
    const [found] = only(
      made(() => say("a日b", [20, 50])),
      "missing-glyph",
    );

    expect(found!.severity).toBe("error");
    expect(found!.message).toContain('"日" (U+65E5)');
    expect(codes(made(() => say("plain text", [20, 50])))).not.toContain("missing-glyph");
  });
});

group("low-contrast", () => {
  const theme = tokens({
    light: { ink: "#111111", paper: "#FFFFFF" },
    dark: { ink: "#111111", paper: "#222222" },
  });

  const on = (fill: Paint | undefined, ink: Paint): Model.Scene =>
    made(() => (
      <Group>
        {fill !== undefined && <Shape key="back" geometry={rect(200, 100)} fill={fill} />}
        <Text key="words" font={mono} size={12} fill={ink} at={[20, 50]}>
          words
        </Text>
      </Group>
    ));

  test("text too close to the flat color behind it, by scheme", () => {
    const [found] = only(on(theme.paper, theme.ink), "low-contrast");

    expect(found).toMatchObject({ key: "words", severity: "warning", related: [{ key: "back" }] });
    expect(found!.message).toContain("in the dark scheme");
    expect(found!.message).toContain("ink on paper");
  });

  test("silent on good contrast, a gradient behind, or nothing behind", () => {
    expect(codes(on("#FFFFFF", "#000000"))).not.toContain("low-contrast");
    expect(
      codes(on(linear({ from: [0, 0], to: [200, 0], stops: ["#777777", "#888888"] }), "#808080")),
    ).not.toContain("low-contrast");
    expect(codes(on(undefined, "#808080"))).not.toContain("low-contrast");
  });

  test("silent when what is behind is two colors", () => {
    expect(
      codes(
        made(() => (
          <Group>
            <Shape geometry={rect(200, 100)} fill="#777777" />
            <Shape geometry={rect(30, 100)} fill="#000000" />
            {say("words", [20, 50], { fill: "#808080" })}
          </Group>
        )),
      ),
    ).not.toContain("low-contrast");
  });
});

group("loop-seam", () => {
  test("a value that ends where it didn't start jumps, by how far in scene units", () => {
    const [found] = only(
      made(() => <Dot key="a" at={track([0, 0]).to([50, 0], span(0, 1))} />),
      "loop-seam",
    );

    expect(found!.message).toContain("its at moves it 50");
    expect(found!.times).toEqual([4, 0]);
  });

  test("silent when the motion comes back, plays once, loops on its own period, or the node is hidden at the seam", () => {
    const near = [
      made(() => <Dot at={track([0, 0]).to([50, 0], span(0, 1)).to([0, 0], span(2, 1))} />),
      made(() => <Dot at={track([0, 0]).to([50, 0], span(0, 1))} />, 4, false),
      made(() => <Dot rotate={spin({ every: 2 })} />),
      made(() => <Dot rotate={track(0).to(360, span(0, 4))} />),
      made(() => (
        <Dot at={track([0, 0]).to([50, 0], span(0, 1))} opacity={track(1).to(0, span(3, 0.5))} />
      )),
    ];

    for (const model of near) expect(codes(model)).not.toContain("loop-seam");
  });
});

group("timing", () => {
  test("shown at 0s, then cut out and straight back in", () => {
    const found = only(
      made(() => <Dot key="a" opacity={track(1).to(0, span(1, 0.01)).to(1, span(1.02, 0.05))} />),
      "visible-at-zero",
    );

    expect(found).toMatchObject([{ key: "a", severity: "error" }]);
    expect(codes(made(() => <Dot opacity={track(0).to(1, span(1, 0.5))} />))).not.toContain(
      "visible-at-zero",
    );
  });

  test("a fill showing while its stroke draws in", () => {
    const stroked = { color: "#000000", width: 2 } as const;

    expect(codes(made(() => <Dot stroke={stroked} trim={draw(span(0, 1))} />))).toContain(
      "visible-at-zero",
    );
    expect(
      codes(made(() => <Dot fill={undefined} stroke={stroked} trim={draw(span(0, 1))} />)),
    ).not.toContain("visible-at-zero");
  });

  test("a value that changes before the node is first seen", () => {
    const [found] = only(
      made(() => (
        <Dot
          key="a"
          opacity={track(0).to(1, span(2, 0.5))}
          at={track([0, 0]).to([10, 0], span(0, 1))}
        />
      )),
      "wasted-motion",
    );

    expect(found!.message).toContain("at (0s to 1s) before it is first visible at 2s");
    expect(
      codes(
        made(() => (
          <Dot opacity={track(0).to(1, span(2, 0.5))} at={track([0, 0]).to([10, 0], span(2, 1))} />
        )),
      ),
    ).not.toContain("wasted-motion");
  });

  test("a scene where nothing moves, and one where nothing enters", () => {
    expect(
      only(
        made(() => <Dot />),
        "static",
      )[0]!.message,
    ).toContain("Nothing in the scene moves");
    expect(codes(made(() => <Dot rotate={spin({ every: 2 })} />))).toContain("nothing-enters");
    expect(codes(made(() => <Dot opacity={track(0).to(1, span(0, 1))} />))).not.toContain(
      "nothing-enters",
    );
  });
});

group("capabilities and the model alone", () => {
  test("what a backend can't draw comes out in the same shape", () => {
    const model = made(() => <Dot key="soft" effects={[blur(2)]} />);
    const none = { level: "none", note: "no filters" } as const;
    const backend = { name: "Flat", supports: { ...svg.supports, blur: none } };

    expect(inspect(model, { backend }).filter((f) => f.code === "unsupported")).toMatchObject([
      { key: "soft", severity: "error" },
    ]);
  });

  test("a symbol no instance draws", () => {
    const model = made(() => <Dot />);
    const ghost = model.root.children[0]!;

    expect(only({ ...model, symbols: { ghost } }, "unused-symbol")[0]!.message).toContain(
      '"ghost"',
    );
  });

  test("findings come errors first, then warnings, then info, and are the same every time", () => {
    const model = made(() => (
      <Group>
        <Dot key="far" at={[300, 10]} />
        <Dot key="cut" at={[192, 10]} />
        <Dot key="spin" rotate={spin({ every: 2 })} />
      </Group>
    ));

    const found = inspect(model);

    expect(found.map((f) => f.severity)).toEqual(
      found
        .map((f) => f.severity)
        .sort(
          (a, b) =>
            ["error", "warning", "info"].indexOf(a) - ["error", "warning", "info"].indexOf(b),
        ),
    );
    expect(inspect(model)).toEqual(found);
  });
});

group("describe", () => {
  const model = made(() => (
    <Group>
      <Shape key="back" geometry={rect(200, 100)} fill="#FFFFFF" />
      <Group key="row">
        <Dot at={[10, 10]} />
        <Dot at={[30, 10]} />
        <Dot at={[50, 10]} />
      </Group>
      <Shape
        key="ball"
        geometry={circle(5)}
        fill="#0000FF"
        at={track([20, 60]).to([120, 60], span(1, 2))}
      />
      <Text
        key="title"
        font={mono}
        size={12}
        fill="#000000"
        at={[20, 90]}
        opacity={track(0).to(1, span(0.5, 0.5))}
      >
        A title
      </Text>
    </Group>
  ));

  test("what shows at each time, in paint order, with what is moving it", () => {
    const { frames } = describe(model, [0, 2]);

    expect(frames[0]!.nodes.map((node) => node.key)).not.toContain("title");
    const ball = frames[1]!.nodes.find((node) => node.key === "ball")!;

    expect(ball).toMatchObject({ kind: "shape", geometry: "ellipse", fill: "#0000FF" });
    expect(ball.box.slice(1)).toEqual([55, 10, 10]);
    expect(ball.changing).toEqual([{ value: "at", from: 1, to: 3 }]);
  });

  test("the text folds repeated siblings, leaves out defaults, and says when each node shows and moves", () => {
    const { text } = describe(model, [2]);

    expect(text).toContain(
      "  row group 50×10 at 10,10\n    {0,1,2} ×3 shape rect 10×10 at 10,10; 30,10; 50,10 fill #FF0000",
    );
    expect(text).toContain("ball: shown throughout; at 1s–3s");
    expect(text).toContain("title: shown 0.5s–end; opacity 0.5s–1s");
    expect(text).toContain("title text");
    expect(text).not.toContain("opacity 1");
  });

  test("times must be seconds from 0", () => {
    expect(() => describe(model, [-1])).toThrow("times in seconds from 0");
  });
});
