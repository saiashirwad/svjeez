import { Icon, type IconData } from "@svjeez/icons";
import { check, flask, gitCommit, hammer, rocket, world, x } from "@svjeez/icons/tabler";
import {
  Arrow,
  Center,
  Group,
  Sequence,
  Shape,
  Stack,
  Text,
  circle,
  clock,
  ease,
  enter,
  linear,
  looping,
  mix,
  rect,
  ref,
  scene,
  span,
  spread,
  track,
  type Anim,
  type Clock,
  type Color,
  type Paint,
  type Ref,
  type SceneElement,
  type Vec,
} from "svjeez";
import { geist } from "../fonts/faces";
import { mono, theme } from "../theme";

// The React widgets page inlines several scenes, so each keeps its ids to itself.
export const prefix = "deploy-";

const RADIUS = 28;
const NODE = 76;
const COLUMN = 112;
const COLUMN_HEIGHT = 132;
const GAP = 20;
const WIDTH = 640;

// From the right edge of one node to the left edge of the next.
const REACH = COLUMN - NODE + GAP;

/** A stage of the pipeline: the clock that starts it, the one that loops while it works, and the one that ends it. */
interface Stage {
  readonly label: string;
  readonly icon: IconData;
  readonly node: Ref;
  readonly on: Clock;
  readonly busy: Clock;
  readonly done: Clock;
  readonly working: string;
  readonly finished: string;
}

const stage = (
  name: string,
  label: string,
  icon: IconData,
  start: number,
  [working, finished]: readonly [string, string],
  finish = start + 1.8,
): Stage => ({
  label,
  icon,
  node: ref(),
  on: clock(name, span(start, 0.4)),
  busy: clock(`${name}-busy`, span(start + 0.4, 1.4)),
  done: clock(`${name}-done`, span(finish, 0.5)),
  working,
  finished,
});

const build = stage("build", "Build", hammer, 0.6, ["Compiling", "41s"]);
const test = stage("test", "Test", flask, 2.9, ["128 specs", "128 passed"], 6.8);
const ship = stage("deploy", "Deploy", rocket, 7.3, ["Rolling out", "3 regions"]);
const stages = [build, test, ship];

const running = clock("running", span(0.5, 0.3));
const live = clock("live", span(9.6, 0.6));
const beacon = clock("beacon", span(10.2, 1.6));

// Failing comes in over the clock's first 0.8s and rests there; the rest fades it out again, for the plain SVG.
const fail = clock("fail", span(4.7, 2));
const FAILED = 0.8 / fail.over;

// The tests region flags the Test stage, in and out the same way.
const flaky = clock("flaky", span(2.2, 3.7));
const FLAGGED = 0.3 / flaky.over;

const commit = ref();
const goal = ref();

/** Every stage before `finished` done, the one at `busy` working, and the rest waiting. */
const reached = (finished: number, busy = -1) =>
  Object.fromEntries(
    stages.flatMap((each, index) => [
      [each.on.name, index < finished || index === busy ? 1 : 0],
      [each.busy.name, index === busy ? looping : 1],
      [each.done.name, index < finished ? 1 : 0],
    ]),
  );

// A working clock rests at its end, so leaving a stage finishes the ripple under way instead of running it back.
const settled = { running: 1, fail: 0, live: 0, beacon: 1 };

const states = {
  "pipeline.idle": { ...reached(0), ...settled, running: 0 },
  "pipeline.running.build": { ...reached(0, 0), ...settled },
  "pipeline.running.test": { ...reached(1, 1), ...settled },
  "pipeline.running.deploy": { ...reached(2, 2), ...settled },
  "pipeline.failed": { ...reached(1), ...settled, running: 0, test: 1, fail: FAILED },
  "pipeline.live": { ...reached(3), ...settled, running: 0, live: 1, beacon: looping },
  "tests.passing": { flaky: 0 },
  "tests.failing": { flaky: FLAGGED },
};

/** A color darkened in light and lightened in dark, for text on a tint of it. */
const ink = (color: Color) => mix(color, theme.text, 0.62);

// A track counts on one clock, so each clock gets its own.
const appear = () => track(0).to(1, span(0, 0.3));

// Shown while failed, gone again in the part of the clock the plain SVG plays after it.
const failed = track(0).to(1, span(0.2, 0.3)).to(0, span(1.6, 0.4));

const Label = ({
  text,
  color,
  opacity,
}: {
  readonly text: string;
  readonly color: Color;
  readonly opacity?: Anim<number>;
}): SceneElement => (
  // On the card's own color, so the label it covers doesn't show through.
  <Center width={COLUMN} height={18} fill={theme.surface} opacity={opacity}>
    <Text font={geist} size={12} fill={ink(color)}>
      {text}
    </Text>
  </Center>
);

/** Two rings that swell out of a node and fade, both gone at the clock's ends so it loops without a seam. */
const Ripples = ({ color, over }: { readonly color: Color; readonly over: number }) => (
  <Center>
    {[0, 1].map((index) => {
      const life = span(index * 0.4, over - 0.4);

      return (
        <Shape
          geometry={circle(RADIUS)}
          stroke={{ color, width: 2 }}
          scale={track(1).to(1.55, life, ease.out)}
          opacity={track(0)
            .to(0.55, span(life.start, 0.1))
            .to(0, span(life.start + 0.1, life.over - 0.1), ease.in)}
        />
      );
    })}
  </Center>
);

const Disc = ({ paint, icon }: { readonly paint: Paint; readonly icon: IconData }) => (
  <Center>
    <Shape geometry={circle(RADIUS + 2)} fill={paint} />
    <Icon icon={icon} size={26} color="#FFFFFF" stroke={{ width: 2.25 }} />
  </Center>
);

const green = linear.across({
  angle: 90,
  stops: [theme.green, mix(theme.green, theme.cyan, 0.55)],
});

const pop = () => enter(span(0, 0.35), { from: { scale: 0.6, opacity: 0 }, curve: ease.pop });

// A short decaying shake, side to side.
const shake = [-6, 6, -4, 4, -2, 0].reduce(
  (moves, dx, index) => moves.to([dx, 0], span(0.25 + index * 0.07, 0.07)),
  track<Vec>([0, 0]),
);

const Node = ({ each }: { readonly each: Stage }): SceneElement => (
  <Center ref={each.node} width={NODE} height={NODE}>
    <Shape
      geometry={circle(RADIUS)}
      fill={theme.background}
      stroke={{ color: theme.raised, width: 2 }}
    />
    <Icon icon={each.icon} size={26} color={theme.muted} stroke={{ width: 1.75 }} />
    <Sequence clock={each.on}>
      <Center opacity={appear()}>
        <Shape
          geometry={circle(RADIUS)}
          fill={mix(theme.blue, theme.background, 0.12)}
          stroke={{ color: theme.blue, width: 2.5 }}
        />
        <Icon icon={each.icon} size={26} color={theme.blue} stroke={{ width: 1.75 }} />
      </Center>
    </Sequence>
    <Sequence clock={each.busy}>
      <Ripples color={theme.blue} over={each.busy.over} />
    </Sequence>
    <Sequence clock={each.done}>
      <Group motion={pop()}>
        <Disc paint={green} icon={check} />
      </Group>
    </Sequence>
    {each === test && (
      <Sequence clock={fail}>
        <Group motion={[pop(), { offset: shake, opacity: track(1).to(0, span(1.6, 0.4)) }]}>
          <Disc paint={theme.red} icon={x} />
        </Group>
      </Sequence>
    )}
  </Center>
);

const Column = ({ each }: { readonly each: Stage }): SceneElement => (
  <Stack gap={8} align="center" width={COLUMN} height={COLUMN_HEIGHT}>
    <Node each={each} />
    <Text font={geist} weight={600} size={14} fill={theme.text}>
      {each.label}
    </Text>
    <Center>
      <Label text="Queued" color={theme.muted} />
      <Sequence clock={each.on}>
        <Label text={each.working} color={theme.blue} opacity={appear()} />
      </Sequence>
      <Sequence clock={each.done}>
        <Label text={each.finished} color={theme.green} opacity={appear()} />
      </Sequence>
      {each === test && (
        <Sequence clock={fail}>
          <Label text="3 failed" color={theme.red} opacity={failed} />
        </Sequence>
      )}
    </Center>
  </Stack>
);

const Pill = ({
  text,
  color,
  opacity,
}: {
  readonly text: string;
  readonly color: Color;
  readonly opacity?: Anim<number>;
}) => (
  <Center
    width={112}
    height={28}
    radius={14}
    fill={mix(color, theme.surface, 0.14)}
    opacity={opacity}
  >
    <Stack direction="row" gap={7} align="center">
      <Shape geometry={circle(3.5)} fill={color} />
      <Text font={geist} weight={600} size={12} fill={ink(color)}>
        {text}
      </Text>
    </Stack>
  </Center>
);

const Banner = ({
  text,
  color,
  icon,
}: {
  readonly text: string;
  readonly color: Color;
  readonly icon: IconData;
}) => (
  <Center width={WIDTH} height={40} radius={10} fill={mix(color, theme.surface, 0.12)}>
    <Stack direction="row" gap={8} align="center">
      <Icon icon={icon} size={16} color={ink(color)} stroke={{ width: 2.25 }} />
      <Text font={geist} weight={600} size={13} fill={ink(color)}>
        {text}
      </Text>
    </Stack>
  </Center>
);

const LINE = { width: 2, cap: "round" } as const;

/**
 * The arrow into a node: grey while it waits, drawn on `drawn`, carrying packets on `busy` and turning green on
 * `done`; red on `fail`, for the stage that can fail.
 */
const Link = ({
  from,
  to,
  drawn,
  color,
  busy,
  done,
  failing,
}: {
  readonly from: Ref;
  readonly to: Ref;
  readonly drawn: Clock;
  readonly color: Color;
  readonly busy?: Clock;
  readonly done?: Clock;
  readonly failing?: boolean;
}): SceneElement => {
  const ends = { from: from.right, to: to.left, inset: 6, head: 7 };
  const start = from.right.map(([px, py]): Vec => [px + 8, py]);
  const end = to.left.map(([px, py]): Vec => [px - 14, py]);

  return (
    <Group>
      <Arrow {...ends} stroke={{ ...LINE, color: mix(theme.border, theme.surface, 0.8) }} />
      <Sequence clock={drawn}>
        <Arrow
          {...ends}
          stroke={{ ...LINE, color }}
          draw={track(0).to(1, span(0, 0.4), ease.inOut)}
        />
      </Sequence>
      {busy && (
        <Sequence clock={busy}>
          {[0, 1, 2].map((index) => {
            const life = span(index * 0.35, 0.7);

            return (
              <Shape
                geometry={circle(3)}
                anchor="center"
                fill={theme.blue}
                at={track<Vec>([0, 0]).set(start, span(life.start)).to(end, life, ease.linear)}
                opacity={track(0)
                  .to(1, span(life.start, 0.12))
                  .to(0, span(life.end - 0.12, 0.12))}
              />
            );
          })}
        </Sequence>
      )}
      {done && (
        <Sequence clock={done}>
          <Arrow {...ends} stroke={{ ...LINE, color: theme.green }} opacity={appear()} />
        </Sequence>
      )}
      {failing && (
        <Sequence clock={fail}>
          <Arrow {...ends} stroke={{ ...LINE, color: theme.red }} opacity={failed} />
        </Sequence>
      )}
    </Group>
  );
};

/** While the tests are set to fail, a warning badge sits on the Test node. */
const Flag = (): SceneElement => (
  <Sequence clock={flaky}>
    <Center
      at={test.node.topRight.map(([px, py]): Vec => [px - 18, py + 18])}
      anchor="center"
      motion={[
        enter(span(0, 0.3), { from: { scale: 0.4, opacity: 0 }, curve: ease.pop }),
        { opacity: track(1).to(0, span(3.4, 0.3)) },
      ]}
    >
      <Shape
        geometry={circle(10)}
        fill={theme.orange}
        stroke={{ color: theme.surface, width: 3 }}
      />
      <Text font={geist} weight={600} size={13} fill="#FFFFFF">
        !
      </Text>
    </Center>
  </Sequence>
);

/** While failed: the stages after Test dim, and a stop sign sits on the arrow into Deploy. */
const Halt = (): SceneElement => (
  <Sequence clock={fail}>
    <Group opacity={failed}>
      <Shape
        geometry={rect(2 * COLUMN + GAP, COLUMN_HEIGHT + 8)}
        at={ship.node.topLeft.map(([px, py]): Vec => [px - (COLUMN - NODE) / 2, py - 4])}
        fill={theme.surface}
        opacity={0.72}
      />
      <Center at={test.node.right.map(([px, py]): Vec => [px + REACH / 2, py])} anchor="center">
        <Shape geometry={circle(11)} fill={theme.red} stroke={{ color: theme.surface, width: 3 }} />
        <Shape geometry={rect(10, 3, { radius: 1.5 })} fill="#FFFFFF" />
      </Center>
    </Group>
  </Sequence>
);

export default scene(
  {
    size: [WIDTH + 44, 304],
    duration: 12.4,
    title: "Deploy pipeline",
    desc: "A deploy of one commit through Build, Test, Deploy and Live. The working stage glows blue and pulses while packets flow along the arrow into it; a finished stage turns green with a check. Here the tests are flagged to fail: Test turns red and shakes, the stages after it dim behind a stop sign and a banner says the pipeline halted. Then the flag clears, Test passes, the deploy rolls out and Live lights up and broadcasts. The page passes the XState value; the scene's states say where each clock rests.",
    theme,
    loop: false,
    still: 12,
    states,
  },
  () => (
    <Group>
      <Stack
        at={[1, 1]}
        gap={22}
        padding={20}
        radius={20}
        fill={theme.surface}
        stroke={{ color: theme.raised, width: 1 }}
      >
        <Stack direction="row" justify={spread} align="center" width={WIDTH}>
          <Stack gap={6}>
            <Text font={geist} weight={600} size={18} fill={theme.text}>
              Production deploy
            </Text>
            <Text font={mono} size={12} fill={theme.muted}>
              acme/web · main · 3f9c2a1
            </Text>
          </Stack>
          <Center>
            <Pill text="Ready" color={theme.muted} />
            <Sequence clock={running}>
              <Pill text="Deploying" color={theme.blue} opacity={appear()} />
            </Sequence>
            <Sequence clock={fail}>
              <Pill text="Failed" color={theme.red} opacity={failed} />
            </Sequence>
            <Sequence clock={live}>
              <Pill text="Live" color={theme.green} opacity={appear()} />
            </Sequence>
          </Center>
        </Stack>
        <Stack direction="row" gap={GAP} align="start">
          <Stack gap={8} align="center" width={COLUMN} height={COLUMN_HEIGHT}>
            <Center ref={commit} width={NODE} height={NODE}>
              <Shape
                geometry={circle(RADIUS)}
                fill={theme.background}
                stroke={{ color: theme.raised, width: 2 }}
              />
              <Icon icon={gitCommit} size={26} color={theme.text} stroke={{ width: 1.75 }} />
            </Center>
            <Text font={geist} weight={600} size={14} fill={theme.text}>
              Commit
            </Text>
            <Label text="3f9c2a1" color={theme.muted} />
          </Stack>
          {stages.map((each) => (
            <Column each={each} />
          ))}
          <Stack gap={8} align="center" width={COLUMN} height={COLUMN_HEIGHT}>
            <Center ref={goal} width={NODE} height={NODE}>
              <Shape
                geometry={circle(RADIUS)}
                fill={theme.background}
                stroke={{ color: theme.raised, width: 2 }}
              />
              <Icon icon={world} size={26} color={theme.muted} stroke={{ width: 1.75 }} />
              <Sequence clock={beacon}>
                <Ripples color={theme.green} over={beacon.over} />
              </Sequence>
              <Sequence clock={live}>
                <Group motion={pop()}>
                  <Disc paint={green} icon={world} />
                </Group>
              </Sequence>
            </Center>
            <Text font={geist} weight={600} size={14} fill={theme.text}>
              Live
            </Text>
            <Center>
              <Label text="v2.4.0" color={theme.muted} />
              <Sequence clock={live}>
                <Label text="acme.app" color={theme.green} opacity={appear()} />
              </Sequence>
            </Center>
          </Stack>
        </Stack>
        <Center width={WIDTH} height={40}>
          <Center width={WIDTH} height={40} radius={10} fill={theme.background}>
            <Text font={mono} size={12} fill={theme.muted}>
              fix: refresh session tokens before they expire
            </Text>
          </Center>
          <Sequence clock={fail}>
            <Group opacity={failed}>
              <Banner
                text="3 of 128 specs failed in auth/session.test.ts · pipeline halted"
                color={theme.red}
                icon={x}
              />
            </Group>
          </Sequence>
          <Sequence clock={live}>
            <Group opacity={appear()}>
              <Banner
                text="Live on acme.app · v2.4.0 in 3 regions"
                color={theme.green}
                icon={check}
              />
            </Group>
          </Sequence>
        </Center>
      </Stack>
      <Link
        from={commit}
        to={build.node}
        drawn={build.on}
        color={theme.blue}
        busy={build.busy}
        done={build.done}
      />
      <Link
        from={build.node}
        to={test.node}
        drawn={test.on}
        color={theme.blue}
        busy={test.busy}
        done={test.done}
        failing
      />
      <Link
        from={test.node}
        to={ship.node}
        drawn={ship.on}
        color={theme.blue}
        busy={ship.busy}
        done={ship.done}
      />
      <Link from={ship.node} to={goal} drawn={live} color={theme.green} />
      <Halt />
      <Flag />
    </Group>
  ),
);
