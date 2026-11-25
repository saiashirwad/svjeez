import { Lettering } from "@svjeez/fonts/handwriting";
import {
  Group,
  Shape,
  circle,
  ease,
  path,
  rect,
  scene,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { theme } from "../../../examples/theme";
import { BLIP, Blip, GROUND, Pivot, jumps } from "./blip";
import { S, hand } from "./cue";

const W = 420;
const H = 148;
const D = 6;
const HOME: Vec = [120, 84];
const DECK: Vec = [270, 80];

const bar = (x: number, y: number, height: number) => (
  <Shape
    key={`bar${x}`}
    geometry={rect(5, height, { radius: 1.5 })}
    at={[x, y]}
    anchor="top-left"
    fill={theme.green}
  />
);

/** What each card shows, drawn about the middle of its bottom edge. */
const PICTURES: readonly SceneElement[] = [
  <Group>
    <Shape geometry={circle(8)} offset={[0, -26]} fill={BLIP.yellow} />
    <Shape
      geometry={path.parse("M-12 -8H12")}
      stroke={{ color: theme.border, width: 2, cap: "round" }}
    />
  </Group>,
  <Shape
    geometry={path.parse("M-13 -20Q-6 -32 0 -20T13 -20")}
    stroke={{ color: theme.blue, width: 3, cap: "round" }}
  />,
  <Group>{[bar(-11, -22, 14), bar(-3, -30, 22), bar(5, -17, 9)]}</Group>,
];

const FANS = [-24, 0, 24];
const dealt = span(0.5, 0.4).cascade(PICTURES.length, 0.25);
const gather = span(4.9, 0.45);

const hops = jumps([
  { land: 2.2, height: 40 },
  { land: 3.5, height: 30 },
]);

const look = track<Vec>([0, 0]).to([6, -3], span(0.4, 0.3)).to([0, 0], span(4.8, 0.3));

export default scene(
  {
    size: [W, H],
    duration: D,
    title: "Browse examples",
    desc: "The words browse examples are handwritten while Blip, the svjeez mascot, fans out a hand of little picture cards and hops with delight.",
    theme,
    still: 2,
  },
  () => (
    <Group>
      <Lettering font={hand} text="browse examples" width={W} y={128} from={0.3} ink={theme.text} />
      {PICTURES.map((picture, i) => (
        <Pivot
          key={`card${i}`}
          around={DECK}
          motion={{
            rotate: track(0).to(FANS[i]!, dealt[i]!, ease.pop).to(0, gather, ease.inOut),
            offset: track<Vec>([0, 0])
              .to([(i - 1) * 26, 0], dealt[i]!, ease.pop)
              .to([0, 0], gather, ease.inOut),
          }}
        >
          <Group offset={DECK}>
            <Shape
              geometry={rect(40, 56, { radius: 6 })}
              at={[-20, -56]}
              anchor="top-left"
              fill={theme.surface}
              stroke={{ color: theme.raised, width: 1.5 }}
            />
            {picture}
          </Group>
        </Pivot>
      ))}
      <Pivot around={GROUND} at={HOME} motion={{ scale: S }}>
        <Blip
          blinks={[1.4, 4.2]}
          body={{ offset: hops.body }}
          stretch={hops.stretch}
          bulb={hops.bulb}
          look={look}
          feet={{}}
        />
      </Pivot>
    </Group>
  ),
);
