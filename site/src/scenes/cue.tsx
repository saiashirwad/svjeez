import {
  Group,
  Shape,
  ease,
  path,
  scene,
  span,
  track,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import { theme } from "../../../examples/theme";
import { BLIP, Blip, GROUND, Pivot, jumps, waddle } from "./blip";
import { strokeFont } from "./stroke-font";

const W = 420;
const H = 148;
const D = 8;

/** Blip's scale in the cues, and where its feet stand. */
export const S = 0.38;
const HOME: Vec = [W / 2, 84];

const casual = await strokeFont.load(new URL("fonts/EMSCasualHand.svg", import.meta.url));

/** The length of a stroke's polyline through every point of its path data, control points included. */
const lengthOf = (d: string) => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;

  for (let i = 2; i + 1 < xy.length; i += 2)
    sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);

  return sum;
};

/** `text` handwritten in a marker, centered across `width` on a baseline at `y`, one stroke after another from 0.3s. */
export const Lettering = ({
  text,
  width = W,
  y = 128,
}: {
  readonly text: string;
  readonly width?: number;
  readonly y?: number;
}): SceneElement => {
  const xs = (casual.path(text, { size: 40 }).match(/-?[\d.]+/g) ?? [])
    .map(Number)
    .filter((_, i) => i % 2 === 0);

  const left = Math.min(...xs);
  const d = casual.path(text, { size: 40, x: (width - (Math.max(...xs) - left)) / 2 - left, y });
  let at = 0.3;

  return (
    <Group>
      {d.split(/(?=M)/).map((piece, i) => {
        const over = Math.max(0.06, lengthOf(piece) / 600);
        const draw = track(0).to(1, span(at, over), ease.linear);
        at += over + 0.02;

        return (
          <Shape
            key={`stroke${i}`}
            geometry={path.parse(piece)}
            stroke={{ color: theme.text, width: 3.4, cap: "round", join: "round" }}
            draw={draw}
          />
        );
      })}
    </Group>
  );
};

const legs = [span(0.3, 1.2), span(3.1, 1.4), span(6.8, 0.9)] as const;
const walks = [waddle(legs[0], 5), waddle(legs[1], 7), waddle(legs[2], 4)];

/** Out to the right, back past home to the left, and home again, in Blip's own units. */
const travel = track<Vec>([0, 0])
  .to([100 / S, 0], legs[0], ease.linear)
  .to([-100 / S, 0], legs[1], ease.linear)
  .to([0, 0], legs[2], ease.linear);

const hops = jumps([
  { land: 2.6, height: 70 },
  { land: 6.0, height: 36 },
]);

const turn = span(2.15, 0.42);
const spin = track(0).to(360, turn, ease.inOut).set(0, span(turn.end));

const [fall, bounce] = span(4.55, 0.2).chain(0.1);

const trip = track(0)
  .to(-72, fall, ease.in)
  .to(-64, bounce, ease.out)
  .to(0, bounce.next(0.45, 0.35), ease.pop);

const look = track<Vec>([0, 0])
  .to([6, 0], span(0.2, 0.2))
  .to([-2, 5], span(1.6, 0.2))
  .to([-6, 0], span(3.0, 0.2))
  .to([0, 4], span(5.3, 0.2))
  .to([6, 0], span(6.7, 0.2))
  .to([0, 0], span(7.6, 0.3));

const flash = span(2.3, 0.1);
const glow = track<Paint>(BLIP.yellow).to("#FFF3B0", flash).to(BLIP.yellow, flash.next(0.5));

export default scene(
  {
    size: [W, H],
    duration: D,
    title: "Play with svjeez",
    desc: "The words play with svjeez are handwritten while Blip, the svjeez mascot, waddles, hops and spins, trips and picks itself up above them.",
    theme,
    still: D - 0.01,
  },
  () => (
    <Group>
      <Lettering text="play with svjeez" />
      <Pivot around={GROUND} at={HOME} motion={[{ scale: S }, { offset: travel }]}>
        <Group motion={{ offset: hops.body }}>
          <Pivot around={[GROUND[0], 110]} motion={{ rotate: spin }}>
            <Pivot around={[44, GROUND[1] + 4]} motion={{ rotate: trip }}>
              <Blip
                blinks={[1.7, 5.4, 7.3]}
                body={walks.flatMap((w) => w.body)}
                stretch={hops.stretch}
                bulb={hops.bulb}
                glow={glow}
                look={look}
                feet={{
                  left: walks.map((w) => w.feet.left),
                  right: walks.map((w) => w.feet.right),
                }}
              />
            </Pivot>
          </Pivot>
        </Group>
      </Pivot>
    </Group>
  ),
);
