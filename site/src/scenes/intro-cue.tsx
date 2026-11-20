import { Lettering } from "@svjeez/fonts/handwriting";
import { Group, Shape, ease, path, rect, scene, span, track, type Paint, type Vec } from "svjeez";
import { theme } from "../../../examples/theme";
import { BLIP, BULB, Blip, GROUND, Pivot, jumps } from "./blip";
import { S, hand } from "./cue";

const W = 420;
const H = 148;
const D = 6;
const HOME: Vec = [130, 84];

/** The bulb on the page, where the beam starts. */
const LAMP: Vec = [HOME[0], HOME[1] - (GROUND[1] - BULB[1]) * S];
const SCREEN = { x: 216, y: 10, w: 104, h: 64 };

const [on, off, again] = span(0.4, 0.06).chain(0.06, 0.06);
const dim = again.next(0.3, 4.3);

// The bulb and its beam flicker on twice, then dim slowly.
const glow = track<Paint>(BLIP.yellow)
  .to("#FFF3B0", on)
  .to(BLIP.yellow, off)
  .to("#FFF3B0", again)
  .to(BLIP.yellow, dim);

const beam = track(0).to(0.5, on).to(0, off).to(0.5, again).to(0, dim);

let play = track(1);

for (let i = 0, pulse = span(0.8, 0.3); i < 3; i++) {
  const settle = pulse.next(0.4);
  play = play.to(1.2, pulse, ease.out).to(1, settle, ease.inOut);
  pulse = settle.next(0.3, 0.6);
}

const bob = span(0.9, 0.5)
  .chain(0.5, 0.5, 0.5, 0.5, 0.5)
  .reduce((t, sway, i) => t.to([5, -5, 5, -5, 5, 0][i]!, sway, ease.inOut), track(0));

const look = track<Vec>([0, 0]).to([6, -5], span(0.5, 0.3)).to([0, 0], span(4.7, 0.3));

const hops = jumps([{ land: 5.4, height: 50 }]);

export default scene(
  {
    size: [W, H],
    duration: D,
    title: "Watch a film",
    desc: "The words watch a film are handwritten while Blip, the svjeez mascot, plays projector: its antenna bulb flickers on, a beam lights a little screen with a pulsing play button, and Blip bobs along to the show.",
    theme,
    still: 2,
  },
  () => (
    <Group>
      <Lettering font={hand} text="watch a film" width={W} y={128} from={0.3} ink={theme.text} />
      <Shape
        geometry={path.parse(
          `M${LAMP[0]} ${LAMP[1]}L${SCREEN.x} ${SCREEN.y}V${SCREEN.y + SCREEN.h}Z`,
        )}
        fill="#FFE58A"
        opacity={beam}
      />
      <Shape
        geometry={rect(SCREEN.w, SCREEN.h, { radius: 8 })}
        at={[SCREEN.x, SCREEN.y]}
        anchor="top-left"
        fill={theme.raised}
      />
      <Group offset={[SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2]}>
        <Shape geometry={path.parse("M-9 -12L13 0L-9 12Z")} fill={theme.orange} scale={play} />
      </Group>
      <Pivot around={GROUND} at={HOME} motion={{ scale: S }}>
        <Group motion={{ offset: hops.body }}>
          <Pivot around={GROUND} motion={{ rotate: bob }}>
            <Blip
              blinks={[1.9, 4.1]}
              stretch={hops.stretch}
              bulb={hops.bulb}
              glow={glow}
              look={look}
              feet={{}}
            />
          </Pivot>
        </Group>
      </Pivot>
    </Group>
  ),
);
