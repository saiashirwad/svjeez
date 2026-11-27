import { derive, pad } from "@svjeez/live";
import type { Signals } from "@svjeez/live";
import { Group, Shape, circle, ease, enter, scene, span } from "svjeez";

const SIZE = 200;
const RADIUS = 24;
const STAGGER = 0.25;
const DUR = 1.5;
const INK = "#3EE6D6";
const CENTER: [number, number] = [100, 60];
const CURVE = ease.out;

export const controls = (d: Signals) => ({
  rhythm: derive([d["STAGGER"], d["DUR"]], {
    kind: "number",
    label: "total time",
    get: ([stagger, dur]) => Number(stagger) * 2 + Number(dur),
    set: (total, [stagger, dur]) => {
      const scale = total / (Number(stagger) * 2 + Number(dur));

      return [Number(stagger) * scale, Number(dur) * scale];
    },
  }),
  center: pad(d["CENTER[0]"], d["CENTER[1]"], "center"),
  ...d,
});

export default scene(
  { size: [SIZE, 120], duration: 4, title: "Pulse", desc: "Three dots pop in, one after another." },
  () => (
    <Group>
      {[0, 1, 2].map((i) => (
        <Shape
          key={String(i)}
          geometry={circle(RADIUS)}
          offset={[CENTER[0] + (i - 1) * 60, CENTER[1]]}
          fill={INK}
          motion={enter(span(STAGGER * i, DUR), { from: { scale: 0 }, curve: CURVE })}
        />
      ))}
      <Shape
        geometry={circle(4)}
        offset={[10, 10]}
        fill="#888888"
        motion={enter(span(0.5, 1), { from: { scale: 0 } })}
      />
    </Group>
  ),
);
