import { formatValue, type Channel, type Target, type Values } from "./channels";
import type { Canvas } from "./compile";
import { num } from "./format";
import { moving, type Key } from "./keys";
import type { Seconds } from "./motion";
import { element, type SvgNode } from "./svg";

const isNumeric = (value: Values[Channel]): value is number => typeof value === "number";

const lerp = (from: Values[Channel], to: Values[Channel], amount: number): Values[Channel] =>
  isNumeric(from) && isNumeric(to) ? from + (to - from) * amount : amount < 1 ? from : to;

export const smilAttributes = (
  attribute: string,
  channel: Channel,
  keys: readonly Key[],
  period: Seconds,
  duration: Seconds,
  repeats?: number,
) => {
  const movingKeys = keys.filter((_, index) => moving(keys, index));
  const discrete = movingKeys.length > 0 && movingKeys.every((key) => key.ease.kind === "steps");
  const points: { t: Seconds; value: Values[Channel]; spline: string }[] = [];
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

/** The `<animate>` for a lane on `attribute`, playing at the canvas's rate. */
export const animate = (
  canvas: Canvas,
  attribute: string,
  lane: {
    readonly channels: readonly Target[];
    readonly keys: readonly Key[];
    readonly period: Seconds;
    readonly snapped: Seconds;
  },
): SvgNode => {
  // SAFETY: SMIL lanes animate SVG attributes, never custom properties, so the first target of a smil lane is a Channel.
  const channel = lane.channels[0] as Channel;

  return element(
    "animate",
    smilAttributes(
      attribute,
      channel,
      lane.keys,
      lane.period,
      lane.snapped / canvas.playbackRate,
      canvas.loop ? undefined : Math.round(canvas.duration / lane.snapped),
    ),
  );
};
