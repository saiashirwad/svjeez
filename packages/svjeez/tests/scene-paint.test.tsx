import { describe, expect, test } from "bun:test";
import {
  font,
  Group,
  Run,
  Shape,
  Stack,
  Text,
  blur,
  circle,
  ease,
  linear,
  morph,
  moved,
  polygon,
  radial,
  rect,
  ref,
  scene,
  shadow,
  span,
  subtract,
  tokens,
  track,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import { boxesOf, diagnose, hitTest, isLane, svg, type Effect, type Model } from "svjeez/tools";

const mono = await font.load(new URL("./fixtures/SpaceMono-Regular.ttf", import.meta.url));

const theme = tokens({
  light: { ink: "#111111", sky: "#2266FF" },
  dark: { ink: "#EEEEEE", sky: "#88AAFF" },
});

const made = (build: () => SceneElement, duration = 4, still: number | false = 2): Model.Scene =>
  scene(
    {
      size: [200, 100],
      duration,
      title: "Test",
      reducedMotion: still,
    },
    build,
  );

const only = (model: Model.Scene): Model.SceneNode => model.root.children[0]!;

const count = (text: string, part: string): number => text.split(part).length - 1;

const emitted = (model: Model.Scene): string => svg.emit(model).replace(/>\s+</g, "><");

describe("gradients", () => {
  test("a gradient's stops spread evenly unless they say, and its points stay in the node's frame", () => {
    const node = only(
      made(() => (
        <Shape
          geometry={rect(40, 20)}
          at={[10, 10]}
          fill={linear({ from: [0, 0], to: [40, 0], stops: ["#FF0000", theme.sky, "#0000FF"] })}
        />
      )),
    );

    expect(node.kind === "shape" && node.fill).toEqual({
      kind: "linear",
      from: [0, 0],
      to: [40, 0],
      stops: [
        { offset: 0, color: [1, 0, 0, 1] },
        { offset: 0.5, color: { kind: "token", name: "sky" } },
        { offset: 1, color: [0, 0, 1, 1] },
      ],
    });
  });

  test("across forms are measured on the node's box: corner to corner along the angle, and out to the farthest corner", () => {
    const [across, round] = made(() => (
      <Group>
        <Shape
          geometry={rect(40, 20)}
          fill={linear.across({ angle: 90, stops: ["#000000", "#FFFFFF"] })}
        />
        <Shape
          geometry={rect(30, 40)}
          fill={radial.across({ center: "top-left", stops: ["#000000", "#FFFFFF"] })}
        />
      </Group>
    )).root.children;

    const fill = (node: Model.SceneNode | undefined) =>
      node?.kind === "shape" ? node.fill : undefined;

    expect(fill(across)).toMatchObject({ from: [20, 0], to: [20, 20] });
    expect(fill(round)).toMatchObject({ center: [0, 0], radius: 50 });
  });

  test("a gradient is checked where it is written", () => {
    expect(() => linear({ from: [0, 0], to: [1, 0], stops: ["#000000"] })).toThrow(
      "two stops or more",
    );
    expect(() =>
      linear({
        from: [0, 0],
        to: [1, 0],
        stops: [
          [0.6, "#000000"],
          [0.2, "#FFFFFF"],
        ],
      }),
    ).toThrow("never decrease");
    expect(() => radial({ center: [0, 0], radius: 0, stops: ["#000000", "#FFFFFF"] })).toThrow(
      "positive radius",
    );
  });

  test("a track blends a color into a gradient and gradients of one kind with any stops, and not two kinds", () => {
    const g = (x: number) => linear({ from: [0, 0], to: [x, 0], stops: ["#000000", "#FFFFFF"] });
    const three = linear({ from: [0, 0], to: [5, 0], stops: ["#000000", "#808080", "#FFFFFF"] });

    const bar = only(
      made(() => (
        <Shape
          key="bar"
          geometry={rect(10, 10)}
          fill={track<Paint>(g(10)).to("#FF0000", span(0, 1)).to(three, span(1, 1))}
        />
      )),
    );

    const keys =
      bar.kind === "shape" && bar.fill !== undefined && isLane(bar.fill) ? bar.fill.keys : [];

    const red: Model.Rgba = [1, 0, 0, 1];

    expect(keys.every(({ value }) => "stops" in value && value.stops.length === 3)).toBe(true);
    expect(keys[0]!.value).toMatchObject({
      to: [10, 0],
      stops: [{ offset: 0 }, { offset: 1 }, { offset: 1 }],
    });
    expect(keys.map(({ value }) => value)).toContainEqual({
      kind: "linear",
      from: [0, 0],
      to: [5, 0],
      stops: [
        { offset: 0, color: red },
        { offset: 0.5, color: red },
        { offset: 1, color: red },
      ],
    });
    expect(() =>
      made(() => (
        <Shape
          key="bar"
          geometry={rect(10, 10)}
          fill={track(g(10)).to(
            radial({ center: [0, 0], radius: 4, stops: ["#000000", "#FFFFFF"] }),
            span(0, 1),
          )}
        />
      )),
    ).toThrow("a linear gradient to a radial one, and the two kinds don't blend");
  });

  test("SVG writes one gradient for every use of it, its points moved to where the element's coordinates put the frame", () => {
    const sky = linear({ from: [0, 0], to: [40, 0], stops: [theme.ink, theme.sky] });

    const out = emitted(
      made(() => (
        <Group>
          <Shape geometry={rect(40, 20)} at={[10, 10]} fill={sky} />
          <Shape geometry={rect(40, 20)} at={[9.5, 9.5]} stroke={{ color: sky }} />
          <Shape geometry={rect(40, 20, { radius: [4, 0, 0, 0] })} at={[10, 10]} fill={sky} />
        </Group>
      )),
    );

    expect(count(out, "<linearGradient")).toBe(2);
    expect(out).toContain(
      '<linearGradient id="g1" gradientUnits="userSpaceOnUse" x1="10" y1="10" x2="50" y2="10">',
    );
    expect(out).toContain('<linearGradient id="g2" gradientUnits="userSpaceOnUse" x2="40">');
    expect(out).toContain('<stop stop-color="var(--ink)"/>');
    expect(out).toContain('stroke="url(#g1)"');
    expect(out).toContain('transform="translate(10 10)" fill="url(#g2)"');
  });

  test("a moving gradient moves its points by SMIL and its colors by CSS, with a still twin for reduced motion", () => {
    const g = (x: number, end: Model.Color | "#FF0000" | "#00FF00") =>
      linear({
        from: [0, 0],
        to: [x, 0],
        stops: ["#000000", end === "#FF0000" || end === "#00FF00" ? end : "#000000"],
      });

    const out = emitted(
      made(() => (
        <Shape
          geometry={rect(40, 20)}
          fill={track(g(10, "#FF0000")).to(g(40, "#00FF00"), span(1, 1))}
        />
      )),
    );

    expect(out).toContain('attributeName="x2" values="10;40"');
    expect(out).toMatch(/@keyframes k1\{[^}]*stop-color:#FF0000/);
    expect(out).toContain('<linearGradient id="g1s" gradientUnits="userSpaceOnUse" x2="40"');
    expect(out).toContain(
      '@media (prefers-reduced-motion:reduce){[fill="url(#g1)"]{fill:url(#g1s)}}',
    );

    const once = emitted(
      made(
        () => (
          <Shape
            geometry={rect(40, 20)}
            fill={track(g(10, "#FF0000")).to(g(40, "#FF0000"), span(1, 1))}
          />
        ),
        4,
        false,
      ),
    );

    expect(once).not.toContain("g1s");
    expect(once).not.toContain("@keyframes");
  });

  test("a shape whose geometry moves as a whole doesn't take its gradient with it", () => {
    const out = emitted(
      made(() => (
        <Shape
          geometry={track(
            polygon([
              [0, 0],
              [10, 0],
              [0, 10],
            ]),
          ).to(
            polygon([
              [20, 0],
              [30, 0],
              [20, 10],
            ]),
            span(0, 1),
          )}
          fill={linear({ from: [0, 0], to: [30, 0], stops: ["#000000", "#FFFFFF"] })}
        />
      )),
    );

    expect(out).not.toContain("translate:");
    expect(out).toContain('attributeName="d"');
  });
});

describe("gradients on text", () => {
  test("text takes a gradient with points, in its frame, whose origin is its box's top-left", () => {
    const out = emitted(
      made(() => (
        <Text
          font={mono}
          size={10}
          at={[20, 30]}
          fill={linear({ from: [0, 0], to: [40, 0], stops: ["#000000", "#FFFFFF"] })}
        >
          Hi
        </Text>
      )),
    );

    expect(out).toContain('x1="20" y1="30" x2="60" y2="30"');
    expect(out).toMatch(/<text x="20" y="41\.2"[^>]*fill="url\(#g1\)"/);
  });

  test("a span takes a gradient with points, in the text's frame", () => {
    const out = emitted(
      made(() => (
        <Text font={mono} size={10} at={[20, 30]} fill="#000000">
          a <Run fill={linear({ from: [0, 0], to: [40, 0], stops: ["#FF0000", "#0000FF"] })}>b</Run>
        </Text>
      )),
    );

    expect(out).toContain('x1="20" y1="30" x2="60" y2="30"');
    expect(out).toMatch(/<tspan[^>]*fill="url\(#g1\)"[^>]*>b<\/tspan>/);
  });

  test("an across gradient spreads over the whole text's box, a span's too", () => {
    const stops = ["#000000", "#FFFFFF"] as const;

    const model = made(() => (
      <Text font={mono} size={10} fill={linear.across({ stops })}>
        ab <Run fill={radial.across({ stops })}>cd</Run>
      </Text>
    ));

    const node = only(model);

    if (node.kind !== "text") throw new Error("a text");
    const { x, y, width, height } = node.box;
    const [first, second] = node.lines[0]!.runs;

    expect(first!.fill).toMatchObject({
      kind: "linear",
      from: [x + 0, y + height / 2],
      to: [x + width, y + height / 2],
    });
    expect(second!.fill).toMatchObject({
      kind: "radial",
      center: [x + width / 2, y + height / 2],
      radius: Math.hypot(width / 2, height / 2),
    });
    expect(emitted(model)).toContain("<radialGradient");
  });

  test("two spans with the same across gradient are one run", () => {
    const g = linear.across({ angle: 90, stops: ["#000000", "#FFFFFF"] });

    const node = only(
      made(() => (
        <Text font={mono} size={10} fill="#000000">
          <Run fill={g}>ab</Run>
          <Run fill={g}>cd</Run>
        </Text>
      )),
    );

    expect(node.kind === "text" && node.lines[0]!.runs.map((run) => run.text)).toEqual(["abcd"]);
  });

  test("diagnose names the gradients a text draws with", () => {
    const model = made(() => (
      <Text font={mono} size={10} fill={linear.across({ stops: ["#000000", "#FFFFFF"] })}>
        a <Run fill={radial.across({ stops: ["#000000", "#FFFFFF"] })}>b</Run>
      </Text>
    ));

    expect(diagnose(model, svg)).toEqual([]);
    expect(svg.supports.linearGradient.level).toBe("exact");
    expect(emitted(model)).toMatch(/<linearGradient.*<radialGradient/);
  });

  test("a span's animated opacity works beside an animated gradient fill", () => {
    const g = (x: number) => linear({ from: [0, 0], to: [x, 0], stops: ["#000000", "#FFFFFF"] });

    const out = emitted(
      made(() => (
        <Text font={mono} size={10} fill={track(g(10)).to(g(40), span(0, 1))}>
          a <Run opacity={track(0).to(1, span(0, 1))}>b</Run>
        </Text>
      )),
    );

    expect(out).toMatch(/<text[^>]*fill="url\(#g1\)"/);
    expect(out).toMatch(/<tspan[^>]*fill-opacity="0"[^>]*>b<\/tspan>/);
    expect(out).toMatch(/\{fill-opacity:1\}/);
    expect(out).toMatch(
      /<linearGradient id="g1"[^>]*><animate[^>]*attributeName="x2" values="10;40"/,
    );
  });

  test("clip, mask and effects dress a text, and a mask can be text", () => {
    const out = emitted(
      made(() => (
        <Group>
          <Text
            font={mono}
            size={10}
            fill="#000000"
            clip={rect(20, 10)}
            effects={[shadow({ color: "#000000", blur: 2, opacity: 0.5 })]}
          >
            Hi
          </Text>
          <Shape
            geometry={rect(80, 40)}
            fill="#2266FF"
            mask={
              <Text font={mono} size={20} fill="#FFFFFF">
                Hi
              </Text>
            }
          />
        </Group>
      )),
    );

    expect(out).toMatch(/<g filter="url\(#f1\)"><text[^>]*clip-path="url\(#c1\)">Hi<\/text><\/g>/);
    expect(out).toMatch(/<mask[^>]*>.*<text[^>]*>Hi<\/text>.*<\/mask>/);
  });

  test("a text's fill morphs gradient to gradient, and not color to gradient", () => {
    const g = (angle: number) => linear.across({ angle, stops: ["#000000", "#FFFFFF"] });

    const model = made(() =>
      morph(
        <Text key="t" font={mono} size={10} fill={g(0)}>
          Hi
        </Text>,
        <Text key="t" font={mono} size={10} fill={g(90)}>
          Hi
        </Text>,
        span(1, 1),
      ),
    );

    const t = only(model);

    expect(t.kind === "text" && isLane(t.lines[0]!.runs[0]!.fill)).toBe(true);
    expect(() =>
      made(() =>
        morph(
          <Text key="t" font={mono} size={10} fill="#FF0000">
            Hi
          </Text>,
          <Text key="t" font={mono} size={10} fill={g(0)}>
            Hi
          </Text>,
          span(0, 1),
        ),
      ),
    ).not.toThrow();
  });
});

describe("clips and masks", () => {
  test("a clip is a clipPath in the element's own coordinates, inside every layer, with its fill rule as clip-rule", () => {
    const model = made(() => (
      <Group
        key="card"
        at={[20, 10]}
        rotate={30}
        clip={subtract(
          rect(60, 40),
          polygon([
            [20, 10],
            [40, 10],
            [30, 30],
          ]),
        )}
      >
        <Shape geometry={rect(60, 40)} fill="#FF0000" />
      </Group>
    ));

    const out = emitted(model);

    expect(diagnose(model, svg)).toEqual([]);
    expect(out).toContain(
      '<clipPath id="c1"><path d="M0 0L60 0L60 40L0 40ZM20 10L40 10L30 30Z" clip-rule="evenodd"/>',
    );
    expect(out).toContain('clip-rule="evenodd"');
    expect(out).not.toMatch(/<clipPath[^>]*><[^>]*fill=/);
    expect(out).toMatch(
      /<g transform="translate\(20 10\)" clip-path="url\(#c1\)" style="transform-origin:50px 30px;rotate:30deg">/,
    );
  });

  test("a shape placed by its own coordinates takes its clip moved there", () => {
    const out = emitted(
      made(() => (
        <Shape geometry={rect(40, 20)} at={[10, 10]} fill="#FF0000" clip={rect(20, 20)} />
      )),
    );

    expect(out).toContain(
      '<clipPath id="c1"><rect x="10" y="10" width="20" height="20"/></clipPath>',
    );
    expect(out).toContain(
      '<rect x="10" y="10" width="40" height="20" fill="#FF0000" clip-path="url(#c1)"/>',
    );
  });

  test("a clip that moves takes a geometry's routes, inside its clipPath", () => {
    const out = emitted(
      made(() => (
        <Shape
          geometry={rect(40, 20)}
          fill="#FF0000"
          clip={track(rect(10, 20)).to(rect(40, 20), span(0, 1))}
        />
      )),
    );

    expect(out).toContain(
      '<clipPath id="c1"><rect width="40" height="20" style="transform-origin:0px 0px" class="a m1"/></clipPath>',
    );
    expect(out).toContain("@keyframes k1{0%{scale:0.25 1}25%,100%{scale:1 1}}");
  });

  test("a mask is alpha, drawn in the node's frame, over a region that holds all its content ever covers", () => {
    const model = made(() => (
      <Group
        key="card"
        at={[50, 20]}
        mask={
          <Shape
            geometry={rect(30, 30)}
            at={track<Vec>([-30, 0]).to([0, 0], span(0, 1))}
            fill="#000000"
          />
        }
      >
        <Shape geometry={rect(30, 30)} fill={theme.ink} />
      </Group>
    ));

    const out = emitted(model);

    expect(only(model).mask?.key).toBe("card#mask");
    expect(out).toContain(
      '<mask id="m1" maskUnits="userSpaceOnUse" x="-31" y="-1" width="62" height="32" mask-type="alpha">',
    );
    expect(out).toContain('mask="url(#m1)"');
  });

  test("a mask's content is laid out where it stands, and can't be placed from outside", () => {
    const model = made(() => (
      <Group
        mask={
          <Stack direction="row" gap={4}>
            <Shape geometry={rect(10, 10)} fill="#000000" />
            <Shape geometry={rect(10, 10)} fill="#000000" />
          </Stack>
        }
      >
        <Shape geometry={rect(30, 10)} fill="#FF0000" />
      </Group>
    ));

    const row = only(model).mask?.kind === "group" ? only(model).mask : undefined;
    const stack = row?.kind === "group" ? row.children[0] : undefined;

    expect(stack?.kind === "group" && stack.children.map((child) => child.at)).toEqual([
      [0, 0],
      [14, 0],
    ]);

    const dot = ref("dot");

    expect(() =>
      made(() => (
        <Group>
          <Shape fill="#000000" ref={dot} geometry={circle(2)} anchor="center" at={[50, 50]} />
          <Group
            mask={
              <Shape
                key="spot"
                geometry={circle(4)}
                anchor="center"
                at={dot.center}
                fill="#000000"
              />
            }
          >
            <Shape geometry={rect(30, 10)} fill="#FF0000" />
          </Group>
        </Group>
      )),
    ).toThrow('<Shape> "spot" is in the mask of <Group>');
  });

  test("hit tests and boxes stop at a clip's box", () => {
    const model = made(() => (
      <Shape key="bar" geometry={rect(100, 20)} at={[0, 0]} fill="#FF0000" clip={rect(30, 20)} />
    ));

    expect(boxesOf(model).bar).toEqual({ x: 0, y: 0, width: 30, height: 20 });
    expect(hitTest(model, [20, 10])?.key).toBe("bar");
    expect(hitTest(model, [60, 10])).toBeUndefined();
  });
});

describe("clips and masks sized by the node's box", () => {
  test("a clip given as a function of the box gets the node's box, its center and its rect", () => {
    const seen: Model.Box[] = [];

    const model = made(() => (
      <Stack
        key="s"
        padding={3}
        clip={(own) => {
          seen.push(own);

          return moved(circle(5), own.center);
        }}
      >
        <Shape key="a" geometry={rect(10, 10)} fill="#000000" />
        <Shape key="b" geometry={rect(10, 10)} fill="#000000" />
      </Stack>
    ));

    const clip = only(model).clip;

    expect(seen[0]).toMatchObject({ x: 0, y: 0, width: 16, height: 26, center: [8, 13] });
    expect(clip !== undefined && !isLane(clip) && clip.kind).toBe("path");
    expect(
      clip !== undefined && !isLane(clip) && clip.kind === "path" && clip.contours[0]!.start,
    ).toEqual([13, 13]);
  });

  test("a mask given as a function of the box covers text of any width", () => {
    const model = made(() => (
      <Text
        key="t"
        font={mono}
        size={12}
        fill="#000000"
        mask={(own) => (
          <Shape
            geometry={own.rect}
            at={track<Vec>([-own.width, 0]).to([0, 0], span(0, 1))}
            fill="#000000"
          />
        )}
      >
        any words at all
      </Text>
    ));

    const { box, mask } = only(model);
    const wipe = mask?.kind === "group" ? mask.children[0] : undefined;

    expect(wipe?.box).toEqual({ x: 0, y: 0, width: box.width, height: box.height });
    expect(wipe && isLane(wipe.at) && wipe.at.keys[0].value).toEqual([-box.width, 0]);
  });

  test("moved() shifts any geometry, so a moving round window needs no path data", () => {
    const disc = moved(circle(10), [30, 40]);

    const model = made(() => (
      <Group key="g" clip={track(disc).to(moved(circle(10), [60, 40]), span(0, 1))}>
        <Shape geometry={rect(100, 100)} fill="#000000" />
      </Group>
    ));

    expect(disc.kind === "path" && disc.contours[0]!.start).toEqual([40, 40]);
    expect(moved(rect(4, 2), [1, 1])).toMatchObject({ kind: "path" });
    expect(
      moved(
        polygon([
          [0, 0],
          [1, 0],
          [0, 1],
        ]),
        [2, 3],
      ),
    ).toEqual({
      kind: "polygon",
      points: [
        [2, 3],
        [3, 3],
        [2, 4],
      ],
      closed: true,
    });
    expect(isLane(only(model).clip!)).toBe(true);
  });

  test("a box-sized clip on a group that holds an anchored node says its box isn't known yet", () => {
    const card = ref("card");

    expect(() =>
      made(() => (
        <Group>
          <Shape ref={card} geometry={rect(10, 10)} at={[50, 50]} fill="#000000" />
          <Group key="g" clip={(own) => own.rect}>
            <Shape key="dot" geometry={circle(2)} at={card.center} fill="#000000" />
          </Group>
        </Group>
      )),
    ).toThrow(
      'The clip of <Group> "g" is sized by its box, but <Shape> "dot" inside it is placed by an anchor',
    );
  });
});

describe("effects", () => {
  test("a filter holds the effects in order, over the node's reach and the effects' own", () => {
    const out = emitted(
      made(() => (
        <Shape
          geometry={rect(40, 20)}
          at={[10, 10]}
          fill="#FF0000"
          effects={[blur(2), shadow({ color: theme.ink, offset: [0, 4], blur: 3, opacity: 0.5 })]}
        />
      )),
    );

    expect(out).toContain(
      '<filter id="f1" filterUnits="userSpaceOnUse" x="-6" y="-2" width="72" height="52" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="2"/><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.5" flood-color="var(--ink)"/></filter>',
    );
    expect(out).toContain('filter="url(#f1)"');
  });

  test("a filter's region holds a child that turns and grows, wherever its turn takes it", () => {
    const out = emitted(
      made(() => (
        <Group effects={[blur(1)]}>
          <Shape
            geometry={rect(20, 20)}
            at={[40, 40]}
            fill="#FF0000"
            rotate={track(0).to(45, span(0, 1))}
            scale={track(1).to(2, span(0, 1))}
          />
        </Group>
      )),
    );

    expect(out).toContain('x="17" y="17" width="66" height="66"');
  });

  test("an effect that changes nothing writes no filter", () => {
    const out = emitted(
      made(() => (
        <Shape
          geometry={rect(40, 20)}
          fill="#FF0000"
          effects={[blur(0), shadow({ color: "#00000000", blur: 4 })]}
        />
      )),
    );

    expect(out).not.toContain("<filter");
  });

  test("effects come after the clip, on an element around it, and turn with the node's layers", () => {
    const out = emitted(
      made(() => (
        <Shape
          geometry={rect(40, 20)}
          fill="#FF0000"
          clip={rect(20, 20)}
          rotate={track(0).to(90, span(0, 1))}
          effects={[shadow({ color: "#000000", offset: [2, 2], blur: 2 })]}
        />
      )),
    );

    expect(out).toMatch(
      /<g filter="url\(#f1\)"[^>]*class="a m1"><rect width="40" height="20" fill="#FF0000" clip-path="url\(#c1\)"\/><\/g>/,
    );
    expect(out).toContain('x="-5" y="-5" width="34" height="34"');
  });

  test("a blur that moves animates its filter by SMIL, with a still twin a reduced-motion viewer sees", () => {
    const out = emitted(
      made(() => (
        <Shape
          geometry={rect(40, 20)}
          fill="#FF0000"
          effects={[blur(track(8).to(0, span(0, 1), ease.linear))]}
        />
      )),
    );

    expect(out).toContain('attributeName="stdDeviation" values="8;0"');
    expect(out).toContain('<filter id="f1s"');
    expect(out).toContain('[filter="url(#f1)"]{filter:url(#f1s)}');
    expect(out).toContain('x="-25" y="-25" width="90" height="70"');
  });

  test("an effect's lengths are checked, and a non-scaling stroke can't be bounded under one", () => {
    expect(() =>
      made(() => <Shape fill="#000000" key="a" geometry={rect(4, 4)} effects={[blur(-1)]} />),
    ).toThrow('blur on <Shape> "a" needs a finite length of 0 or more, got -1.');
    expect(() =>
      emitted(
        made(() => (
          <Shape
            key="a"
            geometry={rect(4, 4)}
            stroke={{ color: "#000000", nonScaling: true }}
            effects={[blur(1)]}
          />
        )),
      ),
    ).toThrow('"a" has a non-scaling stroke inside the effects of "a"');
  });

  test("SVG draws blur and shadow exactly, and warns only for a blur under 1.5", () => {
    const warned = (effect: Effect) =>
      diagnose(
        made(() => <Shape fill="#000000" key="a" geometry={rect(4, 4)} effects={[effect]} />),
        svg,
      ).map((entry) => [entry.severity, entry.feature]);

    expect(warned(blur(1))).toEqual([["warning", "softBlur"]]);
    expect(warned(blur(2))).toEqual([]);
    expect(warned(blur(0))).toEqual([]);
    expect(warned(blur(track(4).to(0, span(0, 1))))).toEqual([["warning", "softBlur"]]);
    expect(warned(shadow({ color: "#000000", blur: 3, opacity: 0.5 }))).toEqual([]);
    expect(warned(shadow({ color: "#000000", blur: 1, opacity: 0.5 }))).toEqual([
      ["warning", "softBlur"],
    ]);
  });
});

describe("morph", () => {
  test("gradients, clips and effects blend between states", () => {
    const g = (x: number) => linear({ from: [0, 0], to: [x, 0], stops: ["#000000", "#FFFFFF"] });

    const model = made(() =>
      morph(
        <Shape key="card" geometry={rect(40, 20)} fill={g(10)} clip={rect(10, 20)} />,
        <Shape
          key="card"
          geometry={rect(40, 20)}
          fill={g(40)}
          clip={rect(40, 20)}
          effects={[shadow({ color: "#000000", blur: 4, opacity: 0.5 })]}
        />,
        span(1, 1),
      ),
    );

    const card = only(model);

    if (card.kind !== "shape") throw new Error("a shape");
    expect(card.fill && "kind" in card.fill && card.fill.kind).toBe("lane");
    expect(card.clip && "kind" in card.clip && card.clip.kind).toBe("lane");
    expect(card.effects[0]).toMatchObject({ kind: "shadow", blur: 4, opacity: { kind: "lane" } });

    const shown = card.effects[0]!.kind === "shadow" ? card.effects[0]!.opacity : 0;

    expect(isLane(shown) && [shown.keys[0].value, shown.keys.at(-1)!.value]).toEqual([0, 0.5]);
  });

  test("a gradient fades in from a clear color, a color blends into a gradient, and two kinds of effect don't", () => {
    const g = linear({ from: [0, 0], to: [10, 0], stops: ["#000000", "#FFFFFF"] });

    const model = made(() =>
      morph(
        <Shape fill="#00000000" key="a" geometry={rect(4, 4)} />,
        <Shape key="a" geometry={rect(4, 4)} fill={g} />,
        span(0, 1),
      ),
    );

    const a = only(model);

    expect(
      a.kind === "shape" && a.fill !== undefined && isLane(a.fill) && a.fill.keys[0].value,
    ).toMatchObject({
      stops: [{ color: [0, 0, 0, 0] }, { color: [0, 0, 0, 0] }],
    });

    expect(() =>
      made(() =>
        morph(
          <Shape key="a" geometry={rect(4, 4)} fill="#FF0000" />,
          <Shape key="a" geometry={rect(4, 4)} fill={g} />,
          span(0, 1),
        ),
      ),
    ).not.toThrow();
    expect(() =>
      made(() =>
        morph(
          <Shape fill="#000000" key="a" geometry={rect(4, 4)} effects={[blur(2)]} />,
          <Shape
            fill="#000000"
            key="a"
            geometry={rect(4, 4)}
            effects={[shadow({ color: "#000000" })]}
          />,
          span(0, 1),
        ),
      ),
    ).toThrow('can\'t blend the effects of <Shape> "a"');
  });
});

describe("subtract", () => {
  test("cuts holes inside the base as one even-odd path, and drops cuts that miss it", () => {
    const ring = subtract(
      circle(20),
      circle(10),
      polygon([
        [12, -2],
        [16, -2],
        [14, 2],
      ]),
    );

    expect(ring.kind === "path" && ring.rule).toBe("evenodd");
    expect(ring.kind === "path" && ring.contours.length).toBe(3);
    expect(
      subtract(
        rect(10, 10),
        polygon([
          [50, 50],
          [60, 50],
          [55, 60],
        ]),
      ),
    ).toMatchObject({ contours: [{}] });
  });

  test("a hole in a hole already cut keeps cutting, and anything a single even-odd path would draw wrong is an error", () => {
    const card = subtract(
      rect(100, 40),
      polygon([
        [10, 10],
        [20, 10],
        [15, 20],
      ]),
    );

    expect(
      subtract(
        card,
        polygon([
          [60, 10],
          [80, 10],
          [70, 30],
        ]),
      ),
    ).toMatchObject({ contours: [{}, {}, {}] });
    expect(() => subtract(rect(10, 10), rect(20, 5))).toThrow("crosses or touches the base's edge");
    expect(() => subtract(rect(10, 10), rect(10, 10))).toThrow("crosses or touches");
    expect(() =>
      subtract(
        rect(40, 40),
        polygon([
          [5, 5],
          [20, 5],
          [20, 20],
        ]),
        polygon([
          [10, 6],
          [25, 6],
          [25, 30],
        ]),
      ),
    ).toThrow("overlaps or touches cut 1");
    expect(() => subtract(rect(10, 10), circle(50))).toThrow("covers the whole base");
    expect(() =>
      subtract(
        polygon([
          [0, 0],
          [10, 10],
          [10, 0],
          [0, 10],
        ]),
        circle(1),
      ),
    ).toThrow("never crosses itself");
  });
});
