import {
  Group,
  Sequence,
  Shape,
  arc,
  circle,
  clock,
  ease,
  ellipse,
  line,
  linear,
  looping,
  moved,
  path,
  polygon,
  rect,
  scene,
  span,
  track,
  type Child,
  type Clock,
  type Color,
  type SceneElement,
  type Vec,
} from "svjeez";
import { theme } from "../theme";

const DURATION = 14;

// The outer layers span the whole film, so every other clock nests inside them. A state rests each one just before or
// just after its motion, and moving between the two plays that motion.
const hop = clock("hop", span(0, DURATION));
const shake = clock("shake", span(0, DURATION));
const away = clock("away", span(0, DURATION));
const alive = clock("alive", span(0, DURATION));
const HOP = span(11.2, 0.8);
const SHAKE = span(9.4, 0.8);
const AWAY = span(7.6, 0.3);

// Gaze is two clocks the page drives, lookY inside lookX, so the eyes move on both axes at once. A nested clock's span
// counts from the start of the one it sits in: lookY plays at 1.2s, and the mouth opens at 2.8s as the eyes reach the
// field.
const lookX = clock("lookX", span(0.4, 2.8));
const lookY = clock("lookY", span(0.8, 2));
const attend = clock("attend", span(1.6, 0.3));

// Expressions. Think and sad fade out again at the end of their spans, so the plain film can move on; a state rests
// them where they are shown. Whistle, spin and party loop while their state lasts, and run on to their empty start
// after it.
const shy = clock("shy", span(4.6, 0.9));
const whistle = clock("whistle", span(5.2, 2.4));
const think = clock("think", span(7.8, 1.6));
const spin = clock("spin", span(8, 1.2));
const sad = clock("sad", span(9.4, 1.7));
const cheer = clock("cheer", span(11.2, 0.8));
const party = clock("party", span(11.8, 1.6));
const THINKING = 0.3;
const SADDEST = 1.4;

// Where a clock rests `seconds` into it.
const at = (on: Clock, seconds: number) => seconds / on.over;

// The page inlines this scene beside others, so it keeps its ids to itself.
export const prefix = "bot-";

// The robot's own materials stay the same in both schemes; only the room around it changes.
const INK: Color = "#262233";
const SHELL: Color = "#F6F1E7";
const SHADE: Color = "#E4D9C6";
const SCREEN: Color = "#171A2C";
const SLAT: Color = "#2A3152";
const GLOW: Color = "#7DF3E1";
const BLUSH: Color = "#FF8FA3";
const ORANGE: Color = "#FF8A3D";

const VISOR = rect(164, 104, { radius: 36 });
const VISOR_AT: Vec = [98, 72];
const EYE_Y = 116;
const EYES: readonly number[] = [150, 210];

// Hop and shake move the whole robot. They are layers, so everything inside keeps running on its own clocks.
const Body = ({ children }: { readonly children: Child }): SceneElement => (
  <Sequence clock={hop}>
    <Group
      offset={track<Vec>([0, 0])
        .to([0, 6], span(HOP.start, 0.12), ease.out)
        .to([0, -10], span(HOP.start + 0.12, 0.28), ease.out)
        .to([0, 0], span(HOP.start + 0.4, 0.26), ease.in)
        .to([0, 4], span(HOP.start + 0.66, 0.06), ease.out)
        .to([0, 0], span(HOP.start + 0.72, 0.08))}
    >
      <Sequence clock={shake}>
        <Group
          offset={track<Vec>([0, 0])
            .to([-10, 2], span(SHAKE.start, 0.1))
            .to([10, 2], span(SHAKE.start + 0.1, 0.12))
            .to([-7, 2], span(SHAKE.start + 0.22, 0.12))
            .to([5, 1], span(SHAKE.start + 0.34, 0.12))
            .to([-2, 0], span(SHAKE.start + 0.46, 0.14))
            .to([0, 0], span(SHAKE.start + 0.6, 0.2))}
        >
          {children}
        </Group>
      </Sequence>
    </Group>
  </Sequence>
);

// A double blink every few seconds, for whichever eyes are showing.
const Blink = ({ children }: { readonly children: Child }): SceneElement => (
  <Sequence clock={alive}>
    <Group
      scale={track<Vec>([1, 1])
        .to([1, 0.1], span(2.9, 0.07), ease.in)
        .to([1, 1], span(2.97, 0.1))
        .to([1, 0.1], span(3.17, 0.07), ease.in)
        .to([1, 1], span(3.24, 0.1))
        .loop(3.5)}
    >
      {children}
    </Group>
  </Sequence>
);

// Each clock sweeps its whole length: progress 0 looks up and to the left, 1 down and to the right.
const Look = ({
  x,
  up,
  down,
  children,
}: {
  readonly x: number;
  readonly up: number;
  readonly down: number;
  readonly children: Child;
}): SceneElement => (
  <Sequence clock={lookX}>
    <Group offset={track<Vec>([-x, 0]).to([x, 0], span(0, lookX.over), ease.linear)}>
      <Sequence clock={lookY}>
        <Group offset={track<Vec>([0, -up]).to([0, down], span(0, lookY.over), ease.linear)}>
          {children}
        </Group>
      </Sequence>
    </Group>
  </Sequence>
);

const Eye = ({ x }: { readonly x: number }): SceneElement => (
  <Group>
    <Shape geometry={rect(22, 32, { radius: 11 })} at={[x, EYE_Y]} anchor="center" fill={GLOW} />
    <Shape geometry={circle(3.5)} at={[x + 4, EYE_Y - 7]} anchor="center" fill="#FFFFFF" />
  </Group>
);

const SMILE = path().moveTo([168, 150]).quadTo([180, 160], [192, 150]);

const Mouth = (): SceneElement => (
  <Sequence clock={attend}>
    <Shape
      geometry={SMILE}
      stroke={{ color: GLOW, width: 4, cap: "round" }}
      opacity={track(1).to(0, span(0, 0.15))}
    />
    <Shape
      geometry={circle(5.5)}
      at={[180, 154]}
      anchor="center"
      stroke={{ color: GLOW, width: 3.5 }}
      scale={track(0.2).to(1, span(0.05, 0.25), ease.pop)}
      opacity={track(0).to(1, span(0.05, 0.1))}
    />
  </Sequence>
);

// Password: privacy blinds roll down over the eyes, and a little padlock settles on them.
const Blinds = (): SceneElement => (
  <Sequence clock={shy}>
    {span(0, 0.45)
      .cascade(4, 0.09)
      .map((drop, index) => (
        <Shape
          key={`slat-${index}`}
          geometry={rect(170, 14, { radius: 4 })}
          at={track<Vec>([95, 56]).to([95, 76 + index * 16], drop, ease.pop)}
          fill={SLAT}
          stroke={{ color: "#3A4370", width: 1.5 }}
        />
      ))}
    <Group
      scale={track(0).to(1, span(0.55, 0.35), ease.pop)}
      opacity={track(0).to(1, span(0.55, 0.1))}
    >
      <Shape
        geometry={arc({ radius: 6, start: 180, sweep: 180 })}
        at={[180, 108]}
        anchor="bottom"
        stroke={{ color: GLOW, width: 3, cap: "round" }}
      />
      <Shape geometry={rect(20, 15, { radius: 4 })} at={[180, 112]} anchor="center" fill={GLOW} />
      <Shape geometry={circle(2.2)} at={[180, 112]} anchor="center" fill={SLAT} />
    </Group>
  </Sequence>
);

// The face the robot wears until it has news. Away switches it off like an old screen: it flattens to a line and goes
// dark, and the expression that has the news takes its place.
const Face = (): SceneElement => (
  <Sequence clock={away}>
    <Group
      scale={track<Vec>([1, 1]).to([1.08, 0.04], span(AWAY.start, 0.2), ease.in)}
      opacity={track(1).to(0, span(AWAY.start + 0.16, 0.14))}
    >
      <Blink>
        <Look x={18} up={10} down={12}>
          {EYES.map((x) => (
            <Eye key={String(x)} x={x} />
          ))}
        </Look>
      </Blink>
      <Look x={6} up={3} down={4}>
        {[128, 232].map((x) => (
          <Shape
            key={`cheek-${x}`}
            geometry={ellipse(12, 6)}
            at={[x, 148]}
            anchor="center"
            fill={BLUSH}
            opacity={0.5}
          />
        ))}
        <Mouth />
      </Look>
      <Blinds />
    </Group>
  </Sequence>
);

const Note = ({ at: from, flag }: { readonly at: Vec; readonly flag: boolean }): SceneElement => (
  <Group offset={from}>
    <Shape geometry={ellipse(6.5, 5)} at={[0, 18]} anchor="center" fill={ORANGE} rotate={-20} />
    <Shape geometry={rect(3, 20)} at={[3.5, -1]} fill={ORANGE} />
    {flag ? (
      <Shape
        geometry={line([5, 0], [13, 5], [13, 11])}
        stroke={{ color: ORANGE, width: 3, cap: "round", join: "round" }}
      />
    ) : null}
  </Group>
);

// Whistling innocently: notes drift up from the mouth, each gone again before the loop wraps.
const Whistle = (): SceneElement => (
  <Sequence clock={whistle}>
    {[span(0.1, 1.2), span(0.8, 1.2), span(1.15, 1.2)].map((rise, index) => (
      <Group
        key={`note-${index}`}
        offset={track<Vec>([196, 140]).to(
          [index === 1 ? 300 : 286, index === 1 ? 52 : 78],
          rise,
          ease.out,
        )}
        rotate={track(-10).to(index === 1 ? 18 : 12, rise)}
        opacity={track(0)
          .to(1, span(rise.start, 0.2))
          .to(0, span(rise.end - 0.4, 0.4))}
      >
        <Note at={[0, 0]} flag={index !== 2} />
      </Group>
    ))}
  </Sequence>
);

// Checking: the eyes glance up and to the side while three dots pulse.
const Think = (): SceneElement => (
  <Group>
    <Blink>
      <Sequence clock={think}>
        <Group
          scale={track<Vec>([1, 0.1]).to([1, 1], span(0.05, 0.25), ease.pop)}
          opacity={track(0).to(1, span(0.05, 0.1)).to(0, span(1.3, 0.3))}
        >
          {EYES.map((x) => (
            <Shape
              key={`think-${x}`}
              geometry={rect(20, 26, { radius: 10 })}
              at={[x + 12, EYE_Y - 8]}
              anchor="center"
              fill={GLOW}
            />
          ))}
        </Group>
      </Sequence>
    </Blink>
    <Sequence clock={spin}>
      {span(0, 0.5)
        .cascade(3, 0.2)
        .map((pulse, index) => (
          <Shape
            key={`dot-${index}`}
            geometry={circle(4)}
            at={[166 + index * 14, 152]}
            anchor="center"
            fill={GLOW}
            opacity={track(0)
              .to(1, span(pulse.start, 0.25))
              .to(0, span(pulse.start + 0.25, 0.4))}
            motion={{
              offset: track<Vec>([0, 0])
                .to([0, -5], span(pulse.start, 0.25))
                .to([0, 0], span(pulse.start + 0.25, 0.4)),
            }}
          />
        ))}
    </Sequence>
  </Group>
);

// The outer corner of each eye is cut away, so it droops.
const droop = (x: number, side: number) =>
  polygon([x - 18 * side, EYE_Y - 20], [x + 18 * side, EYE_Y - 20], [x - 18 * side, EYE_Y - 2]);

const Sad = (): SceneElement => (
  <Blink>
    <Sequence clock={sad}>
      <Group
        offset={track<Vec>([0, 0]).to([0, 5], span(0.7, 0.5), ease.inOut)}
        opacity={track(0).to(1, span(0.15, 0.1)).to(0, span(SADDEST, 0.3))}
      >
        {EYES.map((x, index) => (
          <Group key={`sad-${x}`}>
            <Shape
              geometry={rect(22, 30, { radius: 11 })}
              at={[x, EYE_Y]}
              anchor="center"
              fill={GLOW}
              scale={track<Vec>([1, 0.1]).to([1, 1], span(0.15, 0.25), ease.pop)}
            />
            <Shape
              geometry={droop(x, index === 0 ? 1 : -1)}
              fill={SCREEN}
              opacity={track(0).to(1, span(0.65, 0.3))}
            />
          </Group>
        ))}
        <Shape
          geometry={path().moveTo([168, 156]).quadTo([180, 146], [192, 156])}
          stroke={{ color: GLOW, width: 4, cap: "round" }}
        />
      </Group>
    </Sequence>
  </Blink>
);

const Cheer = (): SceneElement => (
  <Sequence clock={cheer}>
    <Group opacity={track(0).to(1, span(0.05, 0.1))}>
      {EYES.map((x) => (
        <Shape
          key={`happy-${x}`}
          geometry={arc({ radius: 11, start: 180, sweep: 180 })}
          at={[x, EYE_Y + 6]}
          stroke={{ color: GLOW, width: 5, cap: "round" }}
          scale={track(0.3).to(1, span(0.05, 0.4), ease.pop)}
        />
      ))}
      <Shape
        geometry={path()
          .moveTo([160, 140])
          .lineTo([200, 140])
          .curveTo([200, 156], [191, 164], [180, 164])
          .curveTo([169, 164], [160, 156], [160, 140])
          .close()}
        fill={GLOW}
        origin="top"
        scale={track(0.2).to(1, span(0.1, 0.4), ease.pop)}
      />
      {[124, 236].map((x) => (
        <Shape
          key={`glow-${x}`}
          geometry={ellipse(14, 7)}
          at={[x, 146]}
          anchor="center"
          fill={BLUSH}
          opacity={0.8}
        />
      ))}
    </Group>
  </Sequence>
);

const SHELL_FILL = linear.across({
  angle: 90,
  stops: [
    [0, SHELL],
    [0.62, SHELL],
    [1, SHADE],
  ],
});

const Ear = ({ x }: { readonly x: number }): SceneElement => (
  <Group>
    <Shape
      geometry={circle(20)}
      at={[x, 124]}
      anchor="center"
      fill={ORANGE}
      stroke={{ color: INK, width: 3 }}
    />
    <Shape
      geometry={circle(9)}
      at={[x, 124]}
      anchor="center"
      fill={SHADE}
      stroke={{ color: INK, width: 2 }}
    />
    <Sequence clock={spin}>
      <Shape
        geometry={rect(3, 9, { radius: 1.5 })}
        at={[x, 124]}
        anchor="bottom"
        origin="at"
        fill={INK}
        rotate={track(0).to(360, span(0, 1.2), ease.linear)}
      />
    </Sequence>
  </Group>
);

const DROP = path()
  .moveTo([0, 0])
  .curveTo([3, 5], [7, 8], [7, 12])
  .curveTo([7, 16], [3.5, 19], [0, 19])
  .curveTo([-3.5, 19], [-7, 16], [-7, 12])
  .curveTo([-7, 8], [-3, 5], [0, 0])
  .close();

// The antenna droops when sign-in fails, and a sweat drop runs down the forehead. Success rings it out.
const Antenna = (): SceneElement => (
  <Group>
    <Sequence clock={sad}>
      <Group
        origin="bottom"
        rotate={track(0).to(28, span(0.6, 0.78), ease.pop).to(0, span(SADDEST, 0.3))}
      >
        <Shape
          geometry={line([180, 46], [180, 26])}
          stroke={{ color: INK, width: 7, cap: "round" }}
        />
        <Shape
          geometry={line([180, 46], [180, 26])}
          stroke={{ color: SHADE, width: 2.5, cap: "round" }}
        />
        <Shape
          geometry={circle(9)}
          at={[180, 18]}
          anchor="center"
          fill={ORANGE}
          stroke={{ color: INK, width: 3 }}
        />
      </Group>
    </Sequence>
    <Sequence clock={party}>
      {[0, 0.8].map((start) => (
        <Shape
          key={`ring-${start}`}
          geometry={circle(10)}
          at={[180, 18]}
          anchor="center"
          stroke={{ color: ORANGE, width: 3 }}
          scale={track(1).to(3.2, span(start, 0.8), ease.out)}
          opacity={track(0)
            .to(0.9, span(start, 0.05))
            .to(0, span(start + 0.05, 0.75))}
        />
      ))}
    </Sequence>
  </Group>
);

const Sweat = (): SceneElement => (
  <Sequence clock={sad}>
    <Shape
      geometry={DROP}
      at={track<Vec>([262, 50]).to([268, 64], span(0.8, 0.6), ease.in)}
      fill="#9AD8FF"
      stroke={{ color: INK, width: 2 }}
      opacity={track(0).to(1, span(0.8, 0.15)).to(0, span(SADDEST, 0.3))}
    />
  </Sequence>
);

const CONFETTI: readonly Color[] = [ORANGE, GLOW, BLUSH, "#FFD166", "#9BB0FF"];

// Success: confetti rains, each piece gone before the loop wraps.
const Confetti = (): SceneElement => (
  <Sequence clock={party}>
    {Array.from({ length: 16 }, (_, index) => {
      const x = 24 + ((index * 113) % 312);
      const fall = span((index * 0.07) % 0.55, 1);

      return (
        <Shape
          key={`confetti-${index}`}
          geometry={index % 3 === 0 ? circle(4) : rect(7, 11, { radius: 2 })}
          at={track<Vec>([x, -12]).to([x + (index % 2 ? 18 : -18), 150], fall, ease.in)}
          anchor="center"
          fill={CONFETTI[index % CONFETTI.length]!}
          rotate={track(0).to(index % 2 ? 300 : -300, fall, ease.linear)}
          opacity={track(0)
            .to(1, span(fall.start, 0.1))
            .to(0, span(fall.end - 0.3, 0.3))}
        />
      );
    })}
  </Sequence>
);

// Each part turns about the shoulder, the point its at places.
const Arm = ({ x, side }: { readonly x: number; readonly side: number }): SceneElement => {
  const raise = track(24 * side).to(128 * side, span(0, 0.6), ease.pop);

  return (
    <Group>
      <Shape
        geometry={rect(22, 50, { radius: 11 })}
        at={[x, 214]}
        anchor={[0.5, 0.12]}
        origin="at"
        rotate={raise}
        fill={SHELL}
        stroke={{ color: INK, width: 3 }}
      />
      <Shape
        geometry={circle(14)}
        at={[x, 214]}
        anchor={[0.5, -1.07]}
        origin="at"
        rotate={raise}
        fill={ORANGE}
        stroke={{ color: INK, width: 3 }}
      />
    </Group>
  );
};

// Every state names every clock but the gaze, which the page drives.
const calm = {
  alive: looping,
  hop: at(hop, HOP.start),
  shake: at(shake, SHAKE.start),
  away: at(away, AWAY.start),
  attend: 0,
  shy: 0,
  whistle: 0,
  think: 0,
  spin: 0,
  sad: 0,
  cheer: 0,
  party: 0,
};

// With news to give, the face is off and an expression takes its place.
const news = { ...calm, away: at(away, AWAY.end) };

export default scene(
  {
    size: [360, 280],
    duration: DURATION,
    title: "Robot mascot",
    desc: "A cream robot with a dark visor face watches a sign-in form. Its glowing eyes look around and blink, then look down as an email is typed; for the password it pulls privacy blinds over its eyes and whistles; while checking, its face switches off for thinking eyes and its ear dials spin; a failed sign-in shakes the whole robot, with sad eyes and a drooping antenna, and success makes it hop with happy eyes, raised arms and confetti.",
    theme,
    loop: false,
    still: 12.6,
    states: {
      idle: { ...calm, lookX: 0.5, lookY: 0.5 },
      email: { ...calm, attend: 1, lookY: 1 },
      password: { ...calm, attend: 1, shy: 1, whistle: looping },
      checking: { ...news, think: at(think, THINKING), spin: looping },
      failed: { ...news, sad: at(sad, SADDEST), shake: at(shake, SHAKE.end) },
      success: { ...news, cheer: 1, hop: at(hop, HOP.end), party: looping },
    },
  },
  () => (
    <Group>
      <Confetti />
      <Body>
        <Shape
          geometry={rect(150, 120, { radius: 36 })}
          at={[105, 198]}
          fill={SHELL_FILL}
          stroke={{ color: INK, width: 3 }}
        />
        <Sequence clock={alive}>
          <Shape
            geometry={circle(7)}
            at={[180, 236]}
            anchor="center"
            fill={GLOW}
            stroke={{ color: INK, width: 2.5 }}
            opacity={track(1)
              .to(0.45, span(0, 1.75), ease.inOut)
              .to(1, span(1.75, 1.75), ease.inOut)
              .loop(3.5)}
          />
        </Sequence>
        <Antenna />
        <Ear x={73} />
        <Ear x={287} />
        <Shape
          geometry={rect(214, 160, { radius: 56 })}
          at={[73, 44]}
          fill={SHELL_FILL}
          stroke={{ color: INK, width: 3 }}
        />
        <Shape
          geometry={ellipse(22, 9)}
          at={[112, 62]}
          anchor="center"
          rotate={-18}
          fill="#FFFFFF"
          opacity={0.7}
        />
        <Sweat />
        <Shape
          geometry={VISOR}
          at={VISOR_AT}
          fill={SCREEN}
          stroke={{ color: INK, width: 3, under: true }}
        />
        <Group clip={moved(VISOR, VISOR_AT)}>
          <Face />
          <Think />
          <Sad />
          <Cheer />
          <Shape
            geometry={path().moveTo([112, 96]).quadTo([116, 80], [136, 78])}
            stroke={{ color: "#FFFFFF", width: 5, cap: "round" }}
            opacity={0.14}
          />
        </Group>
      </Body>
      <Whistle />
      {/* The top of the sign-in card, which the page's card continues: the robot leans on it. */}
      <Shape
        geometry={rect(357, 60, { radius: 20 })}
        at={[1.5, 252]}
        fill={theme.surface}
        stroke={{ color: theme.raised, width: 1.5 }}
      />
      <Body>
        <Sequence clock={cheer}>
          <Arm x={118} side={1} />
          <Arm x={242} side={-1} />
        </Sequence>
      </Body>
    </Group>
  ),
);
