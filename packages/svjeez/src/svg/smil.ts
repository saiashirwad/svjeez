import { formatValue, type Channel, type ChannelValues } from "./channels";
import type { Canvas } from "./compile";
import { num } from "../model/format";
import { moving, type Key } from "./keys";
import type { Seconds } from "../model/time";
import { element, type SvgNode } from "./tree";

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

const smilAttributes = (
  attribute: string,
  { points, discrete }: ReturnType<typeof smilPoints>,
  period: Seconds,
  duration: Seconds,
  repeats?: number,
) => {
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

const WINDOW_SHARE = 0.8;

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

  const again =
    values[0] === values[values.length - 1] ? "" : `;${id}.begin+${num((1 - from) * duration, 4)}s`;

  return [
    animate,
    element("set", {
      attributeName: attribute,
      to: values[0]!,
      begin: `0s${again}`,
      dur: `${start}s`,
      fill: "freeze",
      "data-loop": `${loop}s`,
    }),
  ];
};

export const windowEnd = (nodes: readonly SvgNode[]): string | undefined => {
  const [first] = nodes;

  return first?.kind === "element" && first.attrs["data-loop"] !== undefined
    ? String(first.attrs.values).split(";").at(-1)
    : undefined;
};

export const animate = (
  canvas: Canvas,
  attribute: string,
  lane: {
    readonly channels: readonly Channel[];
    readonly keys: readonly Key[];
    readonly period: Seconds;
    readonly snapped: Seconds;
  },
  name: () => string,
): SvgNode[] => {
  // SAFETY: SMIL lanes animate SVG attributes, never custom properties, so the first target of a smil lane is a Channel.
  const channel = lane.channels[0] as Channel;
  const duration = lane.snapped / canvas.playbackRate;

  const motion = smilPoints(lane.keys, channel);
  const { points, discrete } = motion;
  const first = formatValue(points[0]!.value);

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
        motion,
        lane.period,
        duration,
        canvas.loop ? undefined : Math.round(canvas.duration / lane.snapped),
      ),
    ),
  ];
};
