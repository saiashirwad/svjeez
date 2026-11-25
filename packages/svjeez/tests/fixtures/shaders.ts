import { d, std } from "typegpu";

/** A gradient that reads nothing, for a scene that is only about how it is written. */
export const solid = (uv: d.v2f): d.v4f => {
  "use gpu";

  return d.vec4f(uv, 0, 1);
};

/** Red by x, green by y, blue by the storm clock: the same picture at every time. */
export const gradient = (uv: d.v2f, input: { readonly storm: number }): d.v4f => {
  "use gpu";

  return d.vec4f(uv.x, uv.y, input.storm, 1);
};

/** The same picture, reading the storm clock under another name. */
export const renamed = (uv: d.v2f, input: { readonly weather: number }): d.v4f => {
  "use gpu";

  return d.vec4f(uv.x, uv.y, input.weather, 1);
};

/** The same, with red turning with the seconds. */
export const turning = (uv: d.v2f, input: { readonly time: number }): d.v4f => {
  "use gpu";

  return d.vec4f(std.fract(input.time * 0.5), uv.x, uv.y, 1);
};

/** One input of each kind. */
export const everything = (
  uv: d.v2f,
  input: {
    readonly time: number;
    readonly resolution: d.v2f;
    readonly storm: number;
    readonly focus: d.v2f;
    readonly tint: d.v3f;
    readonly gain: number;
    readonly off: d.v2f;
  },
): d.v4f => {
  "use gpu";
  const near = std.distance(std.mul(uv, input.resolution), input.focus);
  const wave = input.gain * std.sin(near + input.time + input.storm);

  return d.vec4f(std.mul(input.tint, wave), input.off.x);
};

const helper = (x: number): number => x + 1;

/** Reaches for a plain function from outside, which the GPU can't run. */
export const captured = (uv: d.v2f): d.v4f => {
  "use gpu";

  return d.vec4f(helper(uv.x), 0, 0, 1);
};
