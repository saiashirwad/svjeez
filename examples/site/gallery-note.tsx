import { gzipSync } from "node:zlib";
import { Ink, Once, ease, render } from "svjeez";
import earth from "../earth/index";
import { lettering, marker } from "./cue";

// The lead scene's size, handwritten above the gallery's second card with an arrow back at the globe. The site passes
// the size it measured, so the note stays true; built on its own, it measures the lead itself. The ink is
// `currentColor`, and the site colors it with the accent. It writes once, after "your agent" in the headline is done.

const W = 160;
const H = 76;
const DELAY = 1.9;

/** Pen strokes for an arrow along `d`, ending at `tip` and heading the way `from` to `tip` does. */
const arrow = (d: string, from: [number, number], tip: [number, number], arm = 9) => {
  const back = Math.atan2(from[1] - tip[1], from[0] - tip[0]);

  const end = (turn: number) =>
    `${(tip[0] + arm * Math.cos(back + turn)).toFixed(1)} ${(tip[1] + arm * Math.sin(back + turn)).toFixed(1)}`;

  return [d, `M${end(0.6)}L${tip[0]} ${tip[1]}L${end(-0.6)}`];
};

export const note = (size: string): string => {
  const words = lettering(size, 104, 40).map((s) => ({ ...s, at: s.at - 0.3 + DELAY }));
  const done = words[words.length - 1]!;
  const shaft = arrow("M60 34C42 24 18 30 8 62", [12, 48], [8, 62]);
  let t = done.at + done.over + 0.12;

  const strokes = [
    ...words.map((s) => ({ ...s, d: s.d, dx: 56 })),
    ...shaft.map((d, i) => {
      const over = i === 0 ? 0.32 : 0.14;
      const stroke = { d, at: t, over, dx: 0 };
      t += over + 0.02;

      return stroke;
    }),
  ];

  const D = t + 0.3;

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: size,
      // Inlined beside "your agent", so its ids and classes keep to their own names.
      prefix: "gn",
      desc: `${size}, handwritten, with an arrow pointing left.`,
      reducedMotion: { at: D },
    },
    <Once>
      {strokes.map((s) => (
        <g transform={`translate(${s.dx} 0)`}>
          <Ink
            d={s.d}
            tool={marker}
            fill="currentColor"
            draw={{ at: s.at, over: s.over }}
            ease={ease.linear}
          />
        </g>
      ))}
    </Once>,
  );
};

const kb = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;

export default function build(): string {
  return note(kb(gzipSync(earth()).length));
}
