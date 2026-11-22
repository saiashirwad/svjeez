import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Center,
  Group,
  Sequence,
  Shader,
  Shape,
  Stack,
  clock,
  rect,
  ref,
  scene,
  span,
  tokens,
  type SceneElement,
  type ShaderInputs,
} from "svjeez";
import { d } from "typegpu";
import { loadTypeGpu, svg, type Model } from "svjeez/tools";

// A "use gpu" function is compiled as its module is imported, so the fragments live in a module imported after this.
expect(await loadTypeGpu(import.meta.dir)).toBe(true);

const { captured, everything, gradient, solid } = await import("./fixtures/shaders");

const made = (build: () => SceneElement): Model.Scene =>
  scene({ size: [300, 200], duration: 2, title: "Test" }, build);

/** The SVG on one line, without the indents. */
const flat = (out: string): string => out.replace(/\n\s*/g, "");

const emitted = (build: () => SceneElement): string => flat(svg.emit(made(build)));

const storm = clock("storm", span(0.5, 1));

const fallback = <Shape geometry={rect(20, 20)} fill="#00ff00" />;

/** What the page reads from the group's `data-shader-inputs`. */
const fieldsOf = (out: string): Omit<Model.ShaderMark, "wgsl"> => {
  const attribute = /data-shader-inputs="([^"]*)"/.exec(out)?.[1];

  return JSON.parse((attribute ?? "").replaceAll("&quot;", '"'));
};

const sky = (inputs: ShaderInputs = {}) => (
  <Shader name="sky" width={80} height={60} inputs={inputs} fragment={solid}>
    {fallback}
  </Shader>
);

describe("Shader", () => {
  test("is a slot that carries its WGSL in a script and its fallback after it", () => {
    const out = emitted(() => (
      <Shader
        name="sky"
        width={80}
        height={60}
        at={[10, 20]}
        inputs={{ storm }}
        fragment={gradient}
      >
        {fallback}
      </Shader>
    ));

    expect(out).toMatch(
      /<g data-slot="sky" data-slot-box="10 20 80 60" data-shader-inputs="[^"]*">/,
    );
    expect(out).toMatch(/<script type="text\/wgsl">.*<\/script><rect /);
  });

  test("writes WGSL that holds the user's code, a uniform struct and a full screen triangle", () => {
    const wgsl = /<script type="text\/wgsl">([\s\S]*?)<\/script>/.exec(
      svg.emit(
        made(() => (
          <Shader name="sky" width={80} height={60} inputs={{ storm }} fragment={gradient}>
            {fallback}
          </Shader>
        )),
      ),
    )?.[1];

    // It is text in the markup, so < and & are escaped, and a page reads them back as they were.
    expect(wgsl).toContain("fn shade(uv: vec2f, input: Inputs) -&gt; vec4f {");
    expect(wgsl).toContain("return vec4f(uv.x, uv.y, input.storm, 1f);");
    expect(wgsl).toContain("struct Inputs {\n  time: f32,\n  resolution: vec2f,\n  storm: f32,\n}");
    expect(wgsl).toContain("@group(0) @binding(0) var&lt;uniform&gt; svjeez_inputs: Inputs;");
    expect(wgsl).toContain("@vertex fn svjeez_vertex(");
    expect(wgsl).toContain("@fragment fn svjeez_fragment(");
    expect(wgsl).toContain("&amp; 2u");
  });

  test("lays the uniform struct out as time, resolution, then the inputs in the order given", () => {
    const body = (
      <Shader
        name="sky"
        width={80}
        height={60}
        inputs={{ storm, focus: [3, 4], tint: "#336699", gain: 2, off: [1, 2] }}
        fragment={everything}
      />
    );

    const { size, fields } = fieldsOf(emitted(() => body));

    expect(fields.map(({ name, kind, at }) => [name, kind, at])).toEqual([
      ["time", "time", 0],
      ["resolution", "resolution", 8],
      ["storm", "clock", 16],
      ["focus", "vec", 24],
      ["tint", "color", 32],
      ["gain", "number", 44],
      ["off", "vec", 48],
    ]);

    expect(size).toBe(64);
  });

  test("lays out as WGSL does, as TypeGPU measures its own struct", () => {
    const { size, fields } = fieldsOf(
      emitted(() => (
        <Shader
          name="sky"
          width={80}
          height={60}
          inputs={{ gain: 2, tint: "#336699", storm, focus: [3, 4] }}
          fragment={solid}
        />
      )),
    );

    const struct = d.struct({
      time: d.f32,
      resolution: d.vec2f,
      gain: d.f32,
      tint: d.vec3f,
      storm: d.f32,
      focus: d.vec2f,
    });

    expect(size).toBe(d.sizeOf(struct));
    expect(fields.map((field) => field.at)).toEqual([0, 8, 16, 32, 44, 48]);
  });

  test("writes each input as what the page writes: a clock's name, a number, a point, colors in both schemes", () => {
    const palette = tokens({ light: { sea: "#ff0000" }, dark: { sea: "#0000ff" } });

    const { fields } = fieldsOf(
      emitted(() => (
        <Shader
          name="sky"
          width={80}
          height={60}
          inputs={{ storm, gain: 0.5, off: [7, 9], tint: palette.sea, focus: "#00ff00" }}
          fragment={solid}
        />
      )),
    );

    const by = Object.fromEntries(fields.map((field) => [field.name, field]));

    expect(by.storm).toMatchObject({ kind: "clock", name: "storm" });
    expect(by.gain).toMatchObject({ kind: "number", value: 0.5 });
    expect(by.off).toMatchObject({ kind: "vec", value: [7, 9] });
    expect(by.tint).toMatchObject({ kind: "color", light: [1, 0, 0], dark: [0, 0, 1] });
    expect(by.focus).toMatchObject({ kind: "color", light: [0, 1, 0], dark: [0, 1, 0] });
  });

  test("a point input is where its anchor rests, in the slot's own pixels", () => {
    const target = ref();

    const out = emitted(() => (
      <Group>
        <Shape ref={target} geometry={rect(40, 20)} at={[100, 90]} fill="#ff0000" />
        <Shader
          name="sky"
          width={80}
          height={60}
          at={[30, 50]}
          inputs={{ focus: target.center }}
          fragment={solid}
        />
      </Group>
    ));

    // The target's center is at (120, 100); the slot's corner is at (30, 50).
    expect(fieldsOf(out).fields.find((field) => field.name === "focus")).toMatchObject({
      kind: "point",
      value: [90, 50],
    });
  });

  test("a point is found after layout, in a slot that a stack places", () => {
    const target = ref();

    const out = emitted(() => (
      <Group>
        <Shape ref={target} geometry={rect(10, 10)} at={[200, 150]} fill="#ff0000" />
        <Stack at={[20, 20]} gap={10}>
          <Shape geometry={rect(30, 30)} fill="#0000ff" />
          <Shader
            name="sky"
            width={80}
            height={60}
            inputs={{ focus: target.topLeft }}
            fragment={solid}
          />
        </Stack>
      </Group>
    ));

    // The stack puts the slot 40 down from its own top, so its corner is at (20, 60).
    expect(fieldsOf(out).fields.find((field) => field.name === "focus")).toMatchObject({
      value: [180, 90],
    });
  });

  test("a function that reads an input it was not given fails by the node's name", () => {
    // The types say so too: a shader's function is typed by its inputs.
    const unfed = () => (
      // @ts-expect-error The fragment reads inputs that this shader was not given.
      <Shader name="sky" width={80} height={60} fragment={everything} />
    );

    expect(() => emitted(unfed)).toThrow(
      "<Shader name=\"sky\">'s fragment function can't be turned into WGSL: Property 'focus' not found on 'input'",
    );
  });

  test("keeps its fallback and sits in a layout like a Slot", () => {
    const model = made(() => (
      <Stack key="column" at={[10, 20]} gap={5}>
        <Shape key="bar" geometry={rect(30, 10)} fill="#ff0000" />
        <Shader key="fx" name="fx" width={80} height={50} fragment={solid}>
          {fallback}
        </Shader>
      </Stack>
    ));

    const [column] = model.root.children;
    const slot = column!.kind === "group" ? column!.children[1] : undefined;

    expect(slot?.slot).toBe("fx");
    expect(slot?.shader?.fields.map((field) => field.name)).toEqual(["time", "resolution"]);
    expect([slot?.box.width, slot?.box.height]).toEqual([80, 50]);
  });

  test("inputs are named apart from the two every shader has", () => {
    for (const name of ["time", "resolution"])
      expect(() => emitted(() => sky({ [name]: 1 }))).toThrow(
        `<Shader name="sky"> has an input named "${name}", which every shader already has.`,
      );

    for (const name of ["1st", "a b", "", "_x"])
      expect(() => emitted(() => sky({ [name]: 1 }))).toThrow(
        "but a name is letters, digits and _",
      );
  });

  test("an input is a clock, an anchor, a color, a number or a point, and nothing else", () => {
    expect(() => emitted(() => sky({ gain: Number.NaN }))).toThrow(
      '<Shader name="sky"> input "gain" is NaN, but a number must be finite.',
    );

    // SAFETY: a scene in plain JavaScript can hand over anything.
    for (const wrong of ["red", [1, 2, 3], { x: 1 }, null] as never[])
      expect(() => emitted(() => sky({ gain: wrong }))).toThrow('input "gain" is');

    expect(() => emitted(() => sky({ gain: "#12" }))).toThrow(
      "needs #rgb or #rrggbb colors, got #12.",
    );
  });

  test("needs a name, a size and a fragment function", () => {
    expect(() =>
      emitted(() => <Shader name="1st" width={10} height={10} fragment={solid} />),
    ).toThrow("<Shader> needs a name of letters, digits, - and _ that starts with a letter");

    expect(() =>
      emitted(() => <Shader name="sky" width={0} height={10} fragment={solid} />),
    ).toThrow("needs a width and a height above 0, got 0 by 10.");

    // SAFETY: a scene in plain JavaScript can hand over anything.
    const none = undefined as never;

    expect(() =>
      emitted(() => <Shader name="sky" width={10} height={10} fragment={none} />),
    ).toThrow('<Shader name="sky"> needs a fragment function, got undefined.');
  });

  test("a function that reaches for a plain function outside fails by the node's name and place", () => {
    const capturing = () =>
      emitted(() => <Shader name="sky" width={80} height={60} fragment={captured} />);

    expect(capturing).toThrow(
      "<Shader name=\"sky\">'s fragment function can't be turned into WGSL:",
    );
    expect(capturing).toThrow("Function 'helper' is not marked with the 'use gpu' directive");
  });

  test("a function the transform did not compile says to use the CLI or @svjeez/vite", () => {
    // Made at run time, which TypeGPU's transform never sees, wherever this file sits among the ones that install it: it has
    // no WGSL to give.
    // SAFETY: the source is a "use gpu" function from `d.v2f` to `d.v4f`.
    const plain: (uv: d.v2f) => d.v4f = new Function(
      "d",
      "return (uv) => { 'use gpu'; return d.vec4f(uv, 0, 1); };",
    )(d);

    expect(() =>
      emitted(() => <Shader name="sky" width={10} height={10} fragment={plain} />),
    ).toThrow("Missing metadata for tgpu.fn function body");
    expect(() =>
      emitted(() => <Shader name="sky" width={10} height={10} fragment={plain} />),
    ).toThrow("build it with the svjeez CLI or @svjeez/vite");
  });

  test("without TypeGPU loaded, it says what to install", async () => {
    Reflect.deleteProperty(globalThis, Symbol.for("svjeez.typegpu"));

    try {
      expect(() => emitted(() => sky())).toThrow(
        '<Shader name="sky"> needs TypeGPU, which this scene was not loaded with. Install typegpu and unplugin-typegpu',
      );
    } finally {
      await loadTypeGpu(import.meta.dir);
    }
  });

  test("two shaders in one scene each have a name of their own", () => {
    expect(() =>
      emitted(() => (
        <Center>
          <Shader name="sky" width={10} height={10} fragment={solid} />
          <Shader name="sky" width={10} height={10} fragment={solid} />
        </Center>
      )),
    ).toThrow('Two <Slot>s are both named "sky".');
  });

  test("a shader moves on a clock like any slot, and is written once", () => {
    const out = emitted(() => (
      <Sequence clock={storm}>
        <Shader name="sky" width={10} height={10} fragment={solid} inputs={{ storm }} />
      </Sequence>
    ));

    expect(out.match(/<script type="text\/wgsl">/g)?.length).toBe(1);
  });
});

describe("loadTypeGpu", () => {
  test("finds nothing, and changes nothing, in a project without typegpu", async () => {
    expect(await loadTypeGpu(mkdtempSync(join(tmpdir(), "svjeez-no-gpu-")))).toBe(false);
  });
});
