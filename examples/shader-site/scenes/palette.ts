import { ease, span, track, type Color, type Track } from "svjeez";
import { d, std } from "typegpu";

/** One time of day: the sky at its top and at the horizon, the sun, the mountains and the deep water. */
interface Tones {
  readonly top: Color;
  readonly horizon: Color;
  readonly sun: Color;
  readonly land: Color;
  readonly deep: Color;
}

type Role = keyof Tones;

const dawn: Tones = {
  top: "#6874B4",
  horizon: "#F5C2AE",
  sun: "#FFE9D2",
  land: "#8C7FA8",
  deep: "#474C84",
};

const day: Tones = {
  top: "#5A9FD8",
  horizon: "#D6ECF4",
  sun: "#FFF9E8",
  land: "#6488A6",
  deep: "#367494",
};

const dusk: Tones = {
  top: "#3D4382",
  horizon: "#F4A26C",
  sun: "#FFD99E",
  land: "#6A4C78",
  deep: "#2C2B5C",
};

const night: Tones = {
  top: "#0C1332",
  horizon: "#283263",
  sun: "#E8EDFF",
  land: "#1B2247",
  deep: "#0A1030",
};

// Where on the hour clock (0 to 1) each palette is reached: dawn, full day until DUSK_FROM, dusk, then night at 1.
const DAY = 0.28;
const DUSK_FROM = 0.55;
const DUSK = 0.82;

/** A role's color across the day, as a track on a clock that runs `over` seconds, for the vector parts. */
export const shifting = (role: Role, over: number): Track<Color> =>
  track(dawn[role])
    .to(day[role], span(0, DAY * over), ease.linear)
    .to(dusk[role], span(DUSK_FROM * over, (DUSK - DUSK_FROM) * over), ease.linear)
    .to(night[role], span(DUSK * over, (1 - DUSK) * over), ease.linear);

const vec = (hex: Color) => {
  const value = Number.parseInt(String(hex).slice(1), 16);

  return d.vec3f((value >> 16) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
};

const keys = (role: Role) => ({
  dawn: vec(dawn[role]),
  day: vec(day[role]),
  dusk: vec(dusk[role]),
  night: vec(night[role]),
});

const TOP = keys("top");
const HORIZON = keys("horizon");
const SUN = keys("sun");
const LAND = keys("land");
const DEEP = keys("deep");

/** The same walk through the four palettes as `shifting`, on the GPU. */
const shift = (hour: number, a: d.v3f, b: d.v3f, c: d.v3f, e: d.v3f): d.v3f => {
  "use gpu";
  const morning = std.mix(a, b, std.clamp(hour / DAY, 0, 1));
  const evening = std.mix(morning, c, std.clamp((hour - DUSK_FROM) / (DUSK - DUSK_FROM), 0, 1));

  return std.mix(evening, e, std.clamp((hour - DUSK) / (1 - DUSK), 0, 1));
};

export const top = (hour: number): d.v3f => {
  "use gpu";

  return shift(hour, TOP.dawn, TOP.day, TOP.dusk, TOP.night);
};

export const horizon = (hour: number): d.v3f => {
  "use gpu";

  return shift(hour, HORIZON.dawn, HORIZON.day, HORIZON.dusk, HORIZON.night);
};

export const sun = (hour: number): d.v3f => {
  "use gpu";

  return shift(hour, SUN.dawn, SUN.day, SUN.dusk, SUN.night);
};

export const land = (hour: number): d.v3f => {
  "use gpu";

  return shift(hour, LAND.dawn, LAND.day, LAND.dusk, LAND.night);
};

export const deep = (hour: number): d.v3f => {
  "use gpu";

  return shift(hour, DEEP.dawn, DEEP.day, DEEP.dusk, DEEP.night);
};
