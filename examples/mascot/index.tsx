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
  type Color,
  type SceneElement,
  type Vec,
} from "svjeez";
import { theme } from "../theme";

// Gaze is two clocks the page drives: the pointer while idle, the caret while the email is typed.
const lookX = clock("lookX", span(0.6, 2.2));
const lookY = clock("lookY", span(1.6, 1));

// Blinking and the chest light run on repeat in every state.
const alive = clock("alive", span(0, 14));

// Expressions rest at 0 or 1. Whistle, spin and party loop while their state lasts; every other state runs them on to
// their end, where each is empty again, so a note or a piece of confetti finishes instead of rewinding.
const attend = clock("attend", span(2.8, 0.3));
const shy = clock("shy", span(4.6, 0.9));
const whistle = clock("whistle", span(5.2, 2.4));
const think = clock("think", span(7.8, 0.3));
const spin = clock("spin", span(8, 1.2));
const sad = clock("sad", span(9.4, 1.4));
const cheer = clock("cheer", span(11.2, 0.9));
const party = clock("party", span(11.8, 1.6));

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

type Children = SceneElement | readonly Children[];

// An expression is a fresh screen over the face: it fades in at the start of its clock and covers what is beneath.
const Overlay = ({
  fade,
  children,
}: {
  readonly fade: number;
  readonly children: Children;
}): SceneElement => (
  <Group opacity={track(0).to(1, span(0, fade))}>
    <Shape geometry={VISOR} at={VISOR_AT} fill={SCREEN} />
    {children}
  </Group>
);

const Eye = ({ x }: { readonly x: number }): SceneElement => (
  <Group>
    <Shape geometry={rect(22, 32, { radius: 11 })} at={[x, EYE_Y]} anchor="center" fill={GLOW} />
    <Shape geometry={circle(3.5)} at={[x + 4, EYE_Y - 7]} anchor="center" fill="#FFFFFF" />
  </Group>
);

// Lids are bands of screen colour: the top one lowers to look down, the bottom one rises to look up.
const Gaze = (): SceneElement => (
  <Group>
    <Sequence clock={lookX}>
      <Group offset={track<Vec>([-20, 0]).to([20, 0], span(0, 1), ease.linear)}>
        {EYES.map((x) => (
          <Eye key={String(x)} x={x} />
        ))}
      </Group>
    </Sequence>
    <Sequence clock={lookY}>
      <Shape
        geometry={rect(164, 40)}
        at={track<Vec>([98, EYE_Y - 58])
          .to([98, EYE_Y - 58], span(0, 0.5), ease.linear)
          .to([98, EYE_Y - 48], span(0.5, 0.5), ease.linear)}
        fill={SCREEN}
      />
      <Shape
        geometry={rect(164, 40)}
        at={track<Vec>([98, EYE_Y + 11])
          .to([98, EYE_Y + 18], span(0, 0.5), ease.linear)
          .to([98, EYE_Y + 18], span(0.5, 0.5), ease.linear)}
        fill={SCREEN}
      />
    </Sequence>
  </Group>
);

const Cheeks = (): SceneElement => (
  <Sequence clock={lookY}>
    <Group offset={track<Vec>([0, -3]).to([0, 3], span(0, 1), ease.linear)}>
      {[128, 232].map((x) => (
        <Shape
          key={String(x)}
          geometry={ellipse(12, 6)}
          at={[x, 148]}
          anchor="center"
          fill={BLUSH}
          opacity={0.5}
        />
      ))}
    </Group>
  </Sequence>
);

// A double blink every few seconds.
const blinkAt = (closed: Vec, open: Vec) =>
  track<Vec>(open)
    .to(closed, span(2.9, 0.07), ease.in)
    .to(open, span(2.97, 0.1))
    .to(closed, span(3.17, 0.07), ease.in)
    .to(open, span(3.24, 0.1))
    .loop(3.5);

const Blink = (): SceneElement => (
  <Sequence clock={alive}>
    <Shape
      geometry={rect(164, 40)}
      at={blinkAt([98, EYE_Y - 40], [98, EYE_Y - 60])}
      fill={SCREEN}
    />
    <Shape geometry={rect(164, 40)} at={blinkAt([98, EYE_Y], [98, EYE_Y + 20])} fill={SCREEN} />
  </Sequence>
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

const Note = ({ at, flag }: { readonly at: Vec; readonly flag: boolean }): SceneElement => (
  <Group offset={at}>
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

const Think = (): SceneElement => (
  <Group>
    <Sequence clock={think}>
      <Overlay fade={0.15}>
        {EYES.map((x) => (
          <Shape
            key={`think-${x}`}
            geometry={rect(20, 26, { radius: 10 })}
            at={[x + 12, EYE_Y - 8]}
            anchor="center"
            fill={GLOW}
          />
        ))}
      </Overlay>
    </Sequence>
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
  <Sequence clock={sad}>
    <Overlay fade={0.12}>
      <Group
        offset={track<Vec>([0, 0])
          .to([-8, 0], span(0.1, 0.1))
          .to([8, 0], span(0.2, 0.12))
          .to([-6, 0], span(0.32, 0.12))
          .to([4, 0], span(0.44, 0.12))
          .to([0, 0], span(0.56, 0.14))}
      >
        <Group offset={track<Vec>([0, 0]).to([0, 5], span(0.7, 0.5), ease.inOut)}>
          {EYES.map((x, index) => (
            <Group key={`sad-${x}`}>
              <Shape
                geometry={rect(22, 30, { radius: 11 })}
                at={[x, EYE_Y]}
                anchor="center"
                fill={GLOW}
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
      </Group>
    </Overlay>
  </Sequence>
);

const Cheer = (): SceneElement => (
  <Sequence clock={cheer}>
    <Overlay fade={0.1}>
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
    </Overlay>
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

// The antenna droops when sign-in fails, and a sweat drop runs down the forehead.
const Antenna = (): SceneElement => (
  <Sequence clock={sad}>
    <Group origin="bottom" rotate={track(0).to(28, span(0.6, 0.78), ease.pop)}>
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
);

const Sweat = (): SceneElement => (
  <Sequence clock={sad}>
    <Shape
      geometry={DROP}
      at={track<Vec>([262, 50]).to([268, 64], span(0.8, 0.6), ease.in)}
      fill="#9AD8FF"
      stroke={{ color: INK, width: 2 }}
      opacity={track(0).to(1, span(0.8, 0.15))}
    />
  </Sequence>
);

const CONFETTI: readonly Color[] = [ORANGE, GLOW, BLUSH, "#FFD166", "#9BB0FF"];

// Success: confetti rains and the antenna rings out, each piece gone before the loop wraps.
const Party = (): SceneElement => (
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

export default scene(
  {
    size: [360, 280],
    duration: 14,
    title: "Robot mascot",
    desc: "A cream robot with a dark visor face watches a sign-in form. Its glowing eyes look around and blink, then look down as an email is typed; for the password it pulls privacy blinds over its eyes and whistles; while checking, its ear dials spin; a failed sign-in gets a sad shake and a drooping antenna, and success gets happy eyes, raised arms and confetti.",
    theme,
    loop: false,
    still: 12.6,
    states: {
      idle: {
        alive: looping,
        lookX: 0.5,
        lookY: 0.5,
        attend: 0,
        shy: 0,
        whistle: 1,
        think: 0,
        spin: 1,
        sad: 0,
        cheer: 0,
        party: 1,
      },
      email: {
        alive: looping,
        attend: 1,
        lookY: 1,
        shy: 0,
        whistle: 1,
        think: 0,
        spin: 1,
        sad: 0,
        cheer: 0,
        party: 1,
      },
      password: {
        alive: looping,
        attend: 1,
        shy: 1,
        whistle: looping,
        think: 0,
        spin: 1,
        sad: 0,
        cheer: 0,
        party: 1,
      },
      checking: {
        alive: looping,
        attend: 0,
        think: 1,
        spin: looping,
        whistle: 1,
        sad: 0,
        cheer: 0,
        party: 1,
      },
      failed: {
        alive: looping,
        attend: 0,
        sad: 1,
        shy: 0,
        think: 0,
        spin: 1,
        whistle: 1,
        cheer: 0,
        party: 1,
      },
      success: {
        alive: looping,
        attend: 0,
        cheer: 1,
        party: looping,
        shy: 0,
        think: 0,
        spin: 1,
        whistle: 1,
        sad: 0,
      },
    },
  },
  () => (
    <Group>
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
      <Group>
        <Antenna />
        <Party />
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
          <Gaze />
          <Blink />
          <Cheeks />
          <Mouth />
          <Blinds />
          <Think />
          <Sad />
          <Cheer />
          <Shape
            geometry={path().moveTo([112, 96]).quadTo([116, 80], [136, 78])}
            stroke={{ color: "#FFFFFF", width: 5, cap: "round" }}
            opacity={0.14}
          />
        </Group>
        <Whistle />
      </Group>
      {/* The top of the sign-in card, which the page's card continues: the robot leans on it. */}
      <Shape
        geometry={rect(357, 60, { radius: 20 })}
        at={[1.5, 252]}
        fill={theme.surface}
        stroke={{ color: theme.raised, width: 1.5 }}
      />
      <Sequence clock={cheer}>
        <Arm x={118} side={1} />
        <Arm x={242} side={-1} />
      </Sequence>
    </Group>
  ),
);
