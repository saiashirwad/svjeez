/** @jsxImportSource svjeez */
import type { Attrs } from "../attributes";
import { motion, type Motion, type Seconds, type Span } from "../motion";
import type { SvgNode } from "../svg";

export type ReadoutOptions = Span &
  Attrs<"text"> & {
    /** Seconds between samples. Default 1/12. */
    readonly step?: Seconds;
  };

/**
 * Text that changes with time: `text(t)` sampled across the span, each distinct string shown while it holds. The
 * other options are attributes of every `<text>`, such as `x`, `y`, `fill` and `textAnchor`.
 */
export function readout(text: (t: Seconds) => string, options: ReadoutOptions): SvgNode {
  const { at, over, step = 1 / 12, ...attrs } = options;

  if (!(at >= 0) || !(over > 0))
    throw new Error(
      `readout() needs a non-negative at and a positive over, got at ${at} and over ${over}.`,
    );

  if (!(step > 0)) throw new Error(`readout() needs a positive step, got ${step}.`);
  const count = Math.max(1, Math.round(over / step));
  const times = Array.from({ length: count + 1 }, (_, i) => at + (over * i) / count);
  const windows = new Map<string, [Seconds, Seconds | undefined][]>();
  let current: string | undefined;

  times.forEach((t, i) => {
    const s = text(t);

    if (s === current) return;
    const open = current === undefined ? undefined : windows.get(current)!.at(-1);

    if (open) open[1] = t;
    windows.set(s, [...(windows.get(s) ?? []), [i === 0 ? 0 : t, undefined]]);
    current = s;
  });

  return (
    <g>
      {[...windows].map(([s, spans]) => {
        const shown = spans[0]![0] === 0;

        const track = spans.reduce<Motion<"opacity">>(
          (m, [on, off], i) => {
            const lit = i === 0 && shown ? m : m.at(on).set({ opacity: 1 });

            return off === undefined ? lit : lit.at(off).set({ opacity: 0 });
          },
          motion({ opacity: shown ? 1 : 0 }),
        );

        return (
          <text {...attrs} animation={track}>
            {s}
          </text>
        );
      })}
    </g>
  );
}
