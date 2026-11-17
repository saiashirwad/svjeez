/** @jsxImportSource svjeez */
import type { Attrs } from "../attributes";
import { motion, type Motion, type Seconds, type Span } from "../motion";
import { checkWindow } from "../span";
import type { SvgNode } from "../svg";

export type ReadoutOptions = Attrs<"text"> & {
  /** Seconds between samples. Default 1/12. */
  readonly step?: Seconds;
};

/**
 * Text that changes with time: `text(t)` sampled across the span, each distinct string shown while it holds. Other
 * options are attributes of every `<text>`, such as `x`, `y`, `fill`.
 */
export function readout(
  { at, over }: Span,
  text: (t: Seconds) => string,
  options: ReadoutOptions = {},
): SvgNode {
  const { step = 1 / 12, ...attrs } = options;
  checkWindow(at, over, "readout()");

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
            const lit = i === 0 && shown ? m : m.set({ opacity: 1 }, on);

            return off === undefined ? lit : lit.set({ opacity: 0 }, off);
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
