import { formatValue, type Channel, type Target, type ChannelValues } from "./channels";
import type { Canvas } from "./compile";
import { num } from "./format";
import { moving, type Key } from "./keys";
import type { Seconds } from "./motion";
import { element, type SvgNode } from "./svg";

const isNumeric = (value: ChannelValues[Channel]): value is number => typeof value === "number";

const lerp = (
  from: ChannelValues[Channel],
  to: ChannelValues[Channel],
  amount: number,
): ChannelValues[Channel] =>
  isNumeric(from) && isNumeric(to) ? from + (to - from) * amount : amount < 1 ? from : to;

interface Point {
  t: Seconds;
  value: ChannelValues[Channel];
  spline: string;
}

const smilPoints = (keys: readonly Key[], channel: Channel) => {
  const movingKeys = keys.filter((_, index) => moving(keys, index));
  const discrete = movingKeys.length > 0 && movingKeys.every((key) => key.ease.kind === "steps");
  const points: Point[] = [];
  keys.forEach((key, index) => {
    const value = key.values[channel];
    const next = keys[index + 1];

    if (!next || !moving(keys, index) || key.ease.kind !== "steps") {
      const spline =
        next && moving(keys, index) && key.ease.kind === "bezier"
          ? key.ease.points.map((point) => num(point)).join(" ")
          : "0 0 1 1";

      points.push({ t: key.t, value, spline });

      return;
    }

    const count = key.ease.count;

    for (let step = 0; step < count; step++) {
      const t = key.t + ((next.t - key.t) * step) / count;
      const stepValue = lerp(value, next.values[channel], step / count);

      if (step > 0 && !discrete)
        points.push({
          t,
          value: lerp(value, next.values[channel], (step - 1) / count),
          spline: "0 0 1 1",
        });
      points.push({ t, value: stepValue, spline: "0 0 1 1" });
    }

    if (!discrete)
      points.push({
        t: next.t,
        value: lerp(value, next.values[channel], (count - 1) / count),
        spline: "0 0 1 1",
      });
  });

  return { points, discrete };
};

export const smilAttributes = (
  attribute: string,
  channel: Channel,
  keys: readonly Key[],
  period: Seconds,
  duration: Seconds,
  repeats?: number,
) => {
  const { points, discrete } = smilPoints(keys, channel);
  const spline = !discrete && points.slice(0, -1).some((point) => point.spline !== "0 0 1 1");

  return {
    attributeName: attribute,
    values: points.map((point) => formatValue(point.value)).join(";"),
    keyTimes: points.map((point) => num(point.t / period, 5)).join(";"),
    ...(discrete
      ? { calcMode: "discrete" }
      : spline
        ? {
            calcMode: "spline",
            keySplines: points
              .slice(0, -1)
              .map((point) => point.spline)
              .join(";"),
          }
        : {}),
    dur: `${num(duration)}s`,
    ...(repeats === undefined
      ? { repeatCount: "indefinite" }
      : { repeatCount: String(repeats), fill: "freeze" }),
  };
};

/** How long a window's `<set>` runs: just long enough to start, since freezing keeps its value. */
const RESET = 0.001;

/** A loop whose motion fits in less of the loop than this plays as a window. */
const WINDOW_SHARE = 0.8;

/**
 * An indefinite `<animate>` costs the browser work every frame, even while its value holds. When the value only changes
 * inside a short stretch of the loop, the `<animate>` covers just that stretch and restarts itself every loop, freezing
 * on its last value. The element's attribute holds that last value too, and a `<set>` puts the first one back before the
 * window opens. `data-loop` keeps the full loop length for `loopLength`.
 */
const windowed = (
  points: readonly Point[],
  discrete: boolean,
  attribute: string,
  period: Seconds,
  duration: Seconds,
  name: () => string,
): SvgNode[] | undefined => {
  const values = points.map((point) => formatValue(point.value));
  const times = points.map((point) => Number(num(point.t / period, 5)));
  let first = 1;

  while (first < values.length && values[first] === values[first - 1]) first++;
  let last = values.length - 1;

  while (last > 0 && values[last] === values[last - 1]) last--;

  if (first > last || times[0] !== 0 || times[times.length - 1] !== 1) return undefined;
  const from = times[first - 1]!;
  const to = times[last]!;
  const share = to - from;

  if (share <= 0 || share >= WINDOW_SHARE) return undefined;
  const splines = points.slice(first - 1, last).map((point) => point.spline);
  const spline = !discrete && splines.some((value) => value !== "0 0 1 1");
  const id = name();
  const loop = num(duration);
  const start = num(from * duration, 4);

  const animate = element("animate", {
    id,
    attributeName: attribute,
    values: values.slice(first - 1, last + 1).join(";"),
    keyTimes: times
      .slice(first - 1, last + 1)
      .map((time) => num((time - from) / share, 5))
      .join(";"),
    ...(discrete
      ? { calcMode: "discrete" }
      : spline
        ? { calcMode: "spline", keySplines: splines.join(";") }
        : {}),
    begin: `${start}s;${id}.begin+${loop}s`,
    dur: `${num(share * duration, 4)}s`,
    fill: "freeze",
    "data-loop": `${loop}s`,
  });

  if (from === 0) return [animate];

  // The first value is set at the start, and again at the start of each later loop when the window leaves a different
  // value behind.
  const again =
    values[0] === values[values.length - 1] ? "" : `;${id}.begin+${num((1 - from) * duration, 4)}s`;

  return [
    animate,
    element("set", {
      attributeName: attribute,
      to: values[0]!,
      begin: `0s${again}`,
      // It only has to land once, so it ends at once: an open interval makes the browser apply it on every frame.
      // Frozen, so no frame falls between the set ending and the window opening. WebKit shows the attribute there.
      dur: `${RESET}s`,
      fill: "freeze",
      "data-loop": `${loop}s`,
    }),
  ];
};

/** The `<animate>` for a lane on `attribute`, playing at the canvas's rate. `name` makes a fresh id when it is windowed. */
export const animate = (
  canvas: Canvas,
  attribute: string,
  lane: {
    readonly channels: readonly Target[];
    readonly keys: readonly Key[];
    readonly period: Seconds;
    readonly snapped: Seconds;
  },
  name: () => string,
): SvgNode[] => {
  // SAFETY: SMIL lanes animate SVG attributes, never custom properties, so the first target of a smil lane is a Channel.
  const channel = lane.channels[0] as Channel;
  const duration = lane.snapped / canvas.playbackRate;

  const { points, discrete } = smilPoints(lane.keys, channel);
  const first = formatValue(points[0]!.value);

  // A lane that never leaves its first value is the attribute itself, so it needs no animation.
  if (points.every((point) => formatValue(point.value) === first)) return [];

  if (canvas.loop) {
    const cut = windowed(points, discrete, attribute, lane.period, duration, name);

    if (cut) return cut;
  }

  return [
    element(
      "animate",
      smilAttributes(
        attribute,
        channel,
        lane.keys,
        lane.period,
        duration,
        canvas.loop ? undefined : Math.round(canvas.duration / lane.snapped),
      ),
    ),
  ];
};
