/** @jsxImportSource svjeez */
import { random, render } from "svjeez";
import {
  Character,
  CHARACTER,
  CHARACTER_LOOP,
  DEFAULT_LOOK,
  randomLook,
  type Facing,
  type Gait,
} from "./character";

const POSES: readonly (readonly [Facing, Gait])[] = [
  ["down", "idle"],
  ["down", "walk"],
  ["side", "walk"],
  ["up", "walk"],
];

/** Every pose of a few looks, side by side: the sheet to look at when the character art changes. */
export default function build(): string {
  const next = random("lineup");
  const looks = [DEFAULT_LOOK, ...Array.from({ length: 5 }, () => randomLook(next))];

  return render(
    {
      width: POSES.length * CHARACTER.width,
      height: looks.length * CHARACTER.height,
      duration: CHARACTER_LOOP,
      title: "Villagers",
      reducedMotion: false,
    },
    <>
      <rect
        width={POSES.length * CHARACTER.width}
        height={looks.length * CHARACTER.height}
        fill="#8fc46a"
      />
      {looks.map((look, row) =>
        POSES.map(([facing, gait], column) => (
          <g transform={`translate(${column * CHARACTER.width} ${row * CHARACTER.height})`}>
            <Character look={look} facing={facing} gait={gait} />
          </g>
        )),
      )}
    </>,
  );
}
