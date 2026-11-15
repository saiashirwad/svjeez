import { Ink, Once, ease, render } from "svjeez";
import { lettering, marker } from "./cue";

// "your agent", handwritten in the examples page's headline after "you" is scratched out. The site inlines it and colors
// it with the accent: the ink is `currentColor`.

const W = 200;
const H = 60;
const DELAY = 1.05;

export default function build(): string {
  const strokes = lettering("your agent", W, 38).map((s) => ({ ...s, at: s.at - 0.3 + DELAY }));
  const last = strokes[strokes.length - 1]!;
  const D = last.at + last.over + 0.3;

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "your agent",
      desc: "The words your agent, handwritten.",
      reducedMotion: { at: D },
    },
    <Once>
      {strokes.map((s) => (
        <Ink d={s.d} tool={marker} fill="currentColor" draw={{ at: s.at, over: s.over }} ease={ease.linear} />
      ))}
    </Once>,
  );
}
