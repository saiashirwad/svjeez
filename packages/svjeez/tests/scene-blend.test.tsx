import { describe, expect, test } from "bun:test";
import {
  Group,
  Shape,
  circle,
  morph,
  rect,
  scene,
  span,
  track,
  type Anim,
  type SceneElement,
} from "svjeez";
import { isLane, svg, type Model } from "svjeez/tools";

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test" }, build);

const emit = (build: () => SceneElement): string => svg.emit(made(build));

const only = (model: Model.Scene): Model.SceneNode => model.root.children[0]!;

describe("blend", () => {
  test("lowers onto the node; normal is the absence of a blend", () => {
    const model = made(() => (
      <Group>
        <Shape fill="#FF0000" geometry={rect(10, 10)} blend="multiply" />
        <Shape fill="#FF0000" geometry={rect(10, 10)} blend="normal" />
      </Group>
    ));

    expect(model.root.children.map((child) => child.blend)).toEqual(["multiply", undefined]);
  });

  test("emits mix-blend-mode on the outermost element, past opacity wrappers", () => {
    const out = emit(() => (
      <Group>
        <Shape fill="#FF0000" geometry={rect(10, 10)} blend="screen" />
        <Shape
          fill="#00FF00"
          geometry={rect(10, 10)}
          blend="difference"
          opacity={track(0).to(1, span(0, 1))}
        />
      </Group>
    ));

    expect(out).toContain("mix-blend-mode:screen");
    expect(out).toMatch(/<rect[^>]*style="mix-blend-mode:difference"/);
  });

  test("a group whose children blend is isolated, so they blend only inside it", () => {
    const blending = emit(() => (
      <Group key="card">
        <Shape fill="#FF0000" geometry={rect(10, 10)} />
        <Shape fill="#00FF00" geometry={rect(10, 10)} blend="multiply" />
      </Group>
    ));

    expect(blending).toMatch(/<g[^>]*style="isolation:isolate"/);

    const plain = emit(() => (
      <Group key="card">
        <Shape fill="#FF0000" geometry={rect(10, 10)} />
        <Shape fill="#00FF00" geometry={rect(10, 10)} />
      </Group>
    ));

    expect(plain).not.toContain("isolation");
  });

  test("a lone blending child keeps its group, so the group still isolates it", () => {
    const out = emit(() => (
      <Group key="card" at={[5, 5]}>
        <Shape fill="#FF0000" geometry={rect(10, 10)} blend="multiply" />
      </Group>
    ));

    expect(out).toContain("isolation:isolate");
  });

  test("the scene root isolates its blending children", () => {
    const top = emit(() => <Shape fill="#FF0000" geometry={rect(10, 10)} blend="overlay" />);

    expect(top).toMatch(/<g style="isolation:isolate">/);
  });

  test("morph keeps a blend the states agree on and throws when they differ", () => {
    const state = (blend: "multiply" | "normal") => (
      <Shape key="a" fill="#FF0000" geometry={rect(10, 10)} blend={blend} />
    );

    const model = made(() => morph(state("multiply"), state("multiply"), span(1, 1)));

    expect(only(model).blend).toBe("multiply");

    expect(() => made(() => morph(state("multiply"), state("normal"), span(1, 1)))).toThrow(
      "its blend differs between states",
    );
  });
});

describe("stroke dashOffset", () => {
  const dashed = (dashOffset: Anim<number>) => (
    <Shape
      key="ring"
      geometry={circle(10)}
      stroke={{ color: "#FF0000", dash: [4, 4], dashOffset }}
    />
  );

  test("a still offset is an attribute", () => {
    expect(emit(() => dashed(6))).toContain('stroke-dashoffset="6"');
  });

  test("a track becomes a lane and a CSS animation of stroke-dashoffset", () => {
    const build = () => dashed(track(0).to(8, span(0, 2)));
    const node = only(made(build));

    if (node.kind !== "shape") throw new Error("expected a shape");
    expect(isLane(node.stroke!.dashOffset!)).toBe(true);

    const style = emit(build).split("</style>")[0]!;

    expect(style).toContain("stroke-dashoffset:0");
    expect(style).toContain("stroke-dashoffset:8");
  });

  test("needs a dash", () => {
    expect(() =>
      made(() => <Shape geometry={circle(10)} stroke={{ color: "#FF0000", dashOffset: 3 }} />),
    ).toThrow("has a dashOffset but no dash to slide");
  });

  test("can't be combined with trim", () => {
    expect(() =>
      made(() => (
        <Shape
          geometry={circle(10)}
          stroke={{ color: "#FF0000", dash: [4, 4], dashOffset: 3 }}
          trim={[0, 0.5]}
        />
      )),
    ).toThrow("both drive the dash");
  });

  test("morph blends the offset like the width, treating a missing one as 0", () => {
    const state = (stroke: { dashOffset?: number }) => (
      <Shape key="a" geometry={circle(10)} stroke={{ color: "#FF0000", dash: [4, 4], ...stroke }} />
    );

    const model = made(() => morph(state({}), state({ dashOffset: 8 }), span(1, 1)));
    const node = only(model);

    if (node.kind !== "shape") throw new Error("expected a shape");
    const { dashOffset } = node.stroke!;

    if (dashOffset === undefined || !isLane(dashOffset)) throw new Error("expected a lane");
    expect([dashOffset.keys[0].value, dashOffset.keys.at(-1)!.value]).toEqual([0, 8]);
  });

  test("morph throws when a dash differs, since the pattern doesn't animate", () => {
    expect(() =>
      made(() =>
        morph(
          <Shape key="a" geometry={circle(10)} stroke={{ color: "#FF0000", dash: [4, 4] }} />,
          <Shape key="a" geometry={circle(10)} stroke={{ color: "#FF0000", dash: [2, 2] }} />,
          span(1, 1),
        ),
      ),
    ).toThrow("dash");
  });
});
