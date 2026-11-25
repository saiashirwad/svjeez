import type { d } from "typegpu";
import { hexBytes, hexOf, type Hex } from "../model/color";
import { SceneError } from "../model/scene-error";
import type { Rgb, ShaderField, ShaderMark, ShaderValue, Vec } from "../model/ir";
import { isClock, type Clock } from "./clock";
import { checkName } from "./names";
import { Slot } from "./slot";
import { isAnchor, type Anchor } from "./refs";
import type { Child, Common, SceneElement } from "./nodes";
import { typeGpuOf, uncompiled } from "./typegpu";
import type { Color, Token } from "./values";

/** What a shader reads: a clock's progress, a ref's point, a number, a point `[x, y]` or a color. */
export type ShaderInput = Clock | Anchor | Color | number | Vec;

export type ShaderInputs = Readonly<Record<string, ShaderInput>>;

/** The type a shader function sees for an input: a number is an f32, a point a vec2f and a color a vec3f. */
type Seen<T> = T extends number | Clock ? number : T extends Anchor | Vec ? d.v2f : d.v3f;

/** What the fragment function is given besides `uv`: `time` and `resolution`, then each input under its name. */
export type ShaderSees<I extends ShaderInputs> = {
  readonly time: number;
  readonly resolution: d.v2f;
} & { readonly [K in keyof I]: Seen<I[K]> };

export interface ShaderProps<I extends ShaderInputs = ShaderInputs> extends Common {
  /** The slot's name: `scene.slot(name)` is its box, and the page runner finds the shader by it. */
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Named values the shader reads, each an f32, vec2f or vec3f in `input`. A clock is its progress from 0 to 1. */
  readonly inputs?: I;
  /**
   * A TypeGPU function that starts with `"use gpu"` and returns the color of the pixel at `uv`, which runs from 0 to 1
   * across the box from its top left corner, so `uv * input.resolution` is the pixel. It may use only `d`, `std`, other
   * `"use gpu"` functions and constants from outside: it runs on the GPU, not in the scene.
   */
  readonly fragment: (uv: d.v2f, input: ShaderSees<I>) => d.v4f;
  /** The fallback, centered in the box: what the plain SVG and a page without WebGPU show. */
  readonly children?: Child;
}

type Kind = "f32" | "vec2f" | "vec3f";

const SIZES: Readonly<Record<Kind, { readonly align: number; readonly size: number }>> = {
  f32: { align: 4, size: 4 },
  vec2f: { align: 8, size: 8 },
  vec3f: { align: 16, size: 12 },
};

const isNumber = (input: ShaderInput): input is number => typeof input === "number";

const isToken = (input: ShaderInput): input is Token =>
  typeof input === "object" && input !== null && "light" in input && "dark" in input;

const isHex = (input: ShaderInput): input is Hex =>
  typeof input === "string" && input.startsWith("#");

const isVec = (input: ShaderInput): input is Vec =>
  Array.isArray(input) && input.length === 2 && input.every(isNumber);

const isFragment = <I extends ShaderInputs>(
  value: ShaderProps<I>["fragment"] | undefined,
): value is ShaderProps<I>["fragment"] => typeof value === "function";

const rgb = (hex: Hex): Rgb => {
  const [r, g, b] = hexBytes(hex);

  return [r / 255, g / 255, b / 255];
};

interface Typed {
  readonly type: Kind;
  readonly value: ShaderValue;
}

/** What an input is: the type its field has in the struct, and how a page writes it. */
const typedOf = (label: string, name: string, input: ShaderInput): Typed => {
  if (isNumber(input)) {
    if (!Number.isFinite(input))
      throw new SceneError(`${label} input "${name}" is ${input}, but a number must be finite.`);

    return { type: "f32", value: { kind: "number", value: input } };
  }

  if (isClock(input)) return { type: "f32", value: { kind: "clock", name: input.name } };

  if (isAnchor(input)) return { type: "vec2f", value: { kind: "point", value: [0, 0] } };

  if (isVec(input)) return { type: "vec2f", value: { kind: "vec", value: input } };

  if (isHex(input) || isToken(input)) {
    const [light, dark] = isToken(input)
      ? [input.light, input.dark]
      : [hexOf(input, label), hexOf(input, label)];

    return { type: "vec3f", value: { kind: "color", light: rgb(light), dark: rgb(dark) } };
  }

  throw new SceneError(
    `${label} input "${name}" is ${String(input)}, which a shader can't read.`,
    "An input is a clock, a ref's anchor, a color, a number or a point [x, y].",
  );
};

const align = (at: number, to: number): number => Math.ceil(at / to) * to;

const FIXED = ["time", "resolution"];

interface Laid {
  readonly fields: readonly ShaderField[];
  /** Each field's type in the struct, by name. */
  readonly types: Readonly<Record<string, Kind>>;
  readonly size: number;
}

/** The uniform struct: time, resolution, then the inputs as declared, each at the offset WGSL gives it. */
const layout = (label: string, inputs: ShaderInputs): Laid => {
  const wanted: readonly (Typed & { readonly name: string })[] = [
    { name: "time", type: "f32", value: { kind: "time" } },
    { name: "resolution", type: "vec2f", value: { kind: "resolution" } },
    ...Object.entries(inputs).map(([name, input]) => {
      if (FIXED.includes(name))
        throw new SceneError(
          `${label} has an input named "${name}", which every shader already has.`,
          "Give the input another name.",
        );

      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name))
        throw new SceneError(
          `${label} has an input named ${JSON.stringify(name)}, but a name is letters, digits and _, and starts with a letter.`,
          "Name it as in inputs={{ storm }}.",
        );

      return { name, ...typedOf(label, name, input) };
    }),
  ];

  let end = 0;
  let widest = 4;

  const fields = wanted.map(({ name, type, value }): ShaderField => {
    const { align: to, size } = SIZES[type];
    const at = align(end, to);

    end = at + size;
    widest = Math.max(widest, to);

    return { ...value, name, at };
  });

  return {
    fields,
    types: Object.fromEntries(wanted.map(({ name, type }) => [name, type])),
    size: align(end, widest),
  };
};

// The one full screen triangle every shader is drawn with: `uv` runs from the box's top left, down and to the right.
const TEMPLATE = `
@group(0) @binding(0) var<uniform> svjeez_inputs: SvjeezInputs;

struct SvjeezVarying {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex fn svjeez_vertex(@builtin(vertex_index) index: u32) -> SvjeezVarying {
  let corner = vec2f(f32((index << 1u) & 2u), f32(index & 2u));

  return SvjeezVarying(vec4f(corner * 2 - 1, 0, 1), vec2f(corner.x, 1 - corner.y));
}

@fragment fn svjeez_fragment(vertex: SvjeezVarying) -> @location(0) vec4f {
  return svjeez_shade(vertex.uv, svjeez_inputs);
}
`;

const causeOf = (error: Error): string => {
  let at = error;

  while (at.cause instanceof Error) at = at.cause;

  return at.message;
};

const wgslOf = (
  label: string,
  fragment: (uv: d.v2f, input: never) => d.v4f,
  types: Laid["types"],
): string => {
  const gpu = typeGpuOf();

  if (!gpu)
    throw new SceneError(
      `${label} needs TypeGPU, which this scene was not loaded with.`,
      "Install typegpu and unplugin-typegpu, and build the scene with the svjeez CLI or @svjeez/vite, which turn on its transform when typegpu is installed.",
    );

  const { d, default: tgpu } = gpu;
  const kinds = { f32: d.f32, vec2f: d.vec2f, vec3f: d.vec3f };

  try {
    const inputs = d
      .struct(Object.fromEntries(Object.entries(types).map(([name, type]) => [name, kinds[type]])))
      .$name("Inputs");

    // SAFETY: the struct is made from the inputs at run time, so TypeGPU can't know the type `fragment` was written against.
    const shade = tgpu
      .fn(
        [d.vec2f, inputs],
        d.vec4f,
      )(fragment as never)
      .$name("shade");

    return tgpu.resolve({
      template: TEMPLATE,
      externals: { SvjeezInputs: inputs, svjeez_shade: shade },
    });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const reason = uncompiled();

    if (reason)
      throw new SceneError(
        `${label}'s fragment function can't be turned into WGSL. ${reason.why}`,
        reason.fix,
        {},
        { cause: error },
      );

    throw new SceneError(
      `${label}'s fragment function can't be turned into WGSL: ${causeOf(error)}`,
      'Start it with "use gpu", build it with the svjeez CLI or @svjeez/vite (they compile "use gpu" when unplugin-typegpu is installed), and use only d, std, other "use gpu" functions and constants in it: a variable from outside must be a number, a vector or another "use gpu" function.',
      {},
      { cause: error },
    );
  }
};

/**
 * A box of `width` by `height` that a page draws with a WebGPU shader: `fragment` is a TypeGPU function written right
 * here, which the build turns into WGSL and writes into the SVG, and the page's runner draws every frame. It is a
 * `<Slot>`, so it lays out, moves and shows its fallback children as one does, and a page without WebGPU never leaves it.
 * Needs typegpu and unplugin-typegpu installed. The group carries the code in a `<script type="text/wgsl">` and the
 * uniform layout in `data-shader-inputs`. A point input is the anchor's resting place: the shader does not follow it
 * when it moves on a clock.
 */
export const Shader = <const I extends ShaderInputs = {}>({
  name,
  inputs,
  fragment,
  ...props
}: ShaderProps<I>): SceneElement => {
  const label = `<Shader name="${name}">`;

  checkName(name, "<Shader>", '<Shader name="sky" width={240} height={160} fragment={...} />');

  if (!isFragment(fragment))
    throw new SceneError(
      `${label} needs a fragment function, got ${String(fragment)}.`,
      'Write one that starts with "use gpu", as in fragment={(uv, input) => { "use gpu"; return d.vec4f(uv, 0, 1); }}.',
    );

  const { fields, types, size } = layout(label, inputs ?? {});

  const points = Object.fromEntries(
    Object.entries(inputs ?? {}).filter((entry): entry is [string, Anchor] => isAnchor(entry[1])),
  );

  const shader: ShaderMark = { wgsl: wgslOf(label, fragment, types), size, fields };

  return {
    ...Slot({ name, ...props }),
    shader,
    ...(Object.keys(points).length > 0 && { points }),
  };
};
