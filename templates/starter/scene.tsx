import { Chart, area, line } from "@svjeez/charts";
import { Code } from "@svjeez/code";
import { tomorrow } from "@svjeez/code/palettes";
import { Icon, type IconData } from "@svjeez/icons";
import { flask, gitCommit, hammer, rocket } from "@svjeez/icons/tabler";
import {
  Align,
  Arrow,
  Center,
  Group,
  Shape,
  Stack,
  Text,
  circle,
  count,
  ease,
  enter,
  exit,
  font,
  path,
  ref,
  scene,
  span,
  spread,
  tokens,
  track,
  type Ref,
  type SceneElement,
  type Span,
} from "svjeez";

// Colors with a value per scheme: the SVG follows the viewer's light or dark mode.
const theme = tokens({
  light: {
    background: "#F6F7F9",
    surface: "#FFFFFF",
    raised: "#E9ECF1",
    border: "#CDD3DC",
    muted: "#5B6472",
    text: "#161A21",
    blue: "#2F6FEB",
    green: "#17723F",
  },
  dark: {
    background: "#0E1116",
    surface: "#171B22",
    raised: "#232934",
    border: "#384152",
    muted: "#9AA4B2",
    text: "#EEF1F5",
    blue: "#6EA2FF",
    green: "#4CC38A",
  },
});

// Text is measured with the real font when the scene builds, and only the glyphs it uses are embedded.
const geist = (file: string) =>
  font.load(`https://cdn.jsdelivr.net/npm/geist@1.9.2/dist/fonts/${file}`);

const sans = font.family(
  await geist("geist-sans/Geist-Regular.ttf"),
  await geist("geist-sans/Geist-SemiBold.ttf"),
);

const mono = await geist("geist-mono/GeistMono-Regular.ttf");

const COMMIT = `const pop = ease.spring({
  stiffness: 320,
  damping: 14,
});`;

const INNER = 236;

// Seconds each stage takes, and how long the whole deploy took on the runs before this one.
const STAGES = [
  { name: "Build", icon: hammer, seconds: 42 },
  { name: "Test", icon: flask, seconds: 78 },
  { name: "Deploy", icon: rocket, seconds: 25 },
] as const;

const THIS_RUN = "#47";
const total = STAGES.reduce((sum, { seconds }) => sum + seconds, 0);
const past = [171, 166, 174, 158, 162, 153].map((seconds, i) => [`#${41 + i}`, seconds] as const);

// The beats, each built from the one before it: move one and everything after follows.
const appear = span(0.3, 0.5);
const typing = appear.next(1.2);
const handoff = typing.next(0.4);
const pipeline = handoff.next(4.2);
const weights = STAGES.map(({ seconds }) => seconds);
const runs = pipeline.pace(weights, { gap: 0.2 });
const live = pipeline.next(0.4);
const leave = live.next(0.5, 1.4);

const pop = ease.spring({ stiffness: 320, damping: 14 });

const [commit, deploy] = [ref(), ref()];

const Card = ({
  handle,
  icon,
  title,
  aside,
  children,
}: {
  readonly handle: Ref;
  readonly icon: IconData;
  readonly title: string;
  readonly aside: SceneElement;
  readonly children: SceneElement | readonly SceneElement[];
}): SceneElement => (
  <Stack
    ref={handle}
    gap={14}
    stretch
    padding={18}
    radius={14}
    fill={theme.surface}
    stroke={{ color: theme.border, width: 1 }}
  >
    <Stack direction="row" justify={spread} align="center" width={INNER}>
      <Stack direction="row" gap={8} align="center">
        <Icon icon={icon} size={18} color={theme.muted} />
        <Text font={sans} weight={600} size={14} fill={theme.text}>
          {title}
        </Text>
      </Stack>
      {aside}
    </Stack>
    {children}
  </Stack>
);

/** A stage's ring fills while it runs, then a check springs in and its time stops counting. */
const Stage = ({
  name,
  icon,
  seconds,
  run,
}: {
  readonly name: string;
  readonly icon: IconData;
  readonly seconds: number;
  readonly run: Span;
}): SceneElement => (
  <Stack direction="row" justify={spread} align="center" width={INNER}>
    <Stack direction="row" gap={10} align="center">
      <Center>
        <Shape geometry={circle(6)} fill={theme.raised} />
        <Shape
          geometry={circle(11)}
          rotate={-90}
          stroke={{ color: theme.blue, width: 2.5, cap: "round" }}
          draw={track(0).to(1, run, ease.linear)}
          motion={exit(span(run.end, 0.2))}
        />
        <Group motion={enter(span(run.end, pop.settle), { from: { scale: 0 }, curve: pop })}>
          <Shape geometry={circle(9)} fill={theme.green} />
          <Shape
            geometry={path().moveTo([0, 3]).lineTo([2.5, 5.5]).lineTo([7, 0])}
            at={[0, 0]}
            anchor="center"
            stroke={{ color: theme.surface, width: 1.8, cap: "round", join: "round" }}
            draw={track(0).to(1, span(run.end + 0.1, 0.25))}
          />
        </Group>
      </Center>
      <Icon icon={icon} size={16} color={theme.muted} />
      <Text font={sans} size={13} fill={theme.text}>
        {name}
      </Text>
    </Stack>
    <Text font={mono} size={12} fill={theme.muted} align="end">
      {count(track(0).to(seconds, run, ease.linear), { format: (n) => `${Math.round(n)}s` })}
    </Text>
  </Stack>
);

const swap = (from: number) => track(from).to(1 - from, live);

export default scene(
  {
    size: [640, 340],
    duration: leave.end + 0.1,
    title: "A commit deploys",
    desc: "A commit card types in a change to a spring, and an arrow hands it to a deploy card. Build, Test and Deploy run in turn: each ring fills while its time counts up, then a green check springs in. The status turns Live, this deploy's time lands on a chart of recent ones, and both cards leave before the loop.",
    theme,
    still: live.end + 0.6,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Group
        motion={[
          enter(appear, { from: { opacity: 0, offset: [0, 16] } }),
          exit(leave, { to: { opacity: 0, offset: [0, -10] } }),
        ]}
      >
        <Align>
          <Stack direction="row" gap={56} align="center">
            <Card
              handle={commit}
              icon={gitCommit}
              title="Tune the spring"
              aside={
                <Text font={mono} size={12} fill={theme.muted}>
                  a7c7a1e
                </Text>
              }
            >
              <Stack padding={12} radius={8} fill={theme.background}>
                <Code lang="ts" font={mono} size={12} palette={tomorrow} typing={typing}>
                  {COMMIT}
                </Code>
              </Stack>
            </Card>
            <Card
              handle={deploy}
              icon={rocket}
              title="Deploy"
              aside={
                <Center>
                  <Text key="running" font={sans} size={12} fill={theme.muted} opacity={swap(1)}>
                    Running…
                  </Text>
                  <Text
                    key="live"
                    font={sans}
                    weight={600}
                    size={12}
                    fill={theme.green}
                    opacity={swap(0)}
                  >
                    Live
                  </Text>
                </Center>
              }
            >
              <Stack gap={12}>
                {STAGES.map((stage, i) => (
                  <Stage {...stage} run={runs[i]!} />
                ))}
              </Stack>
              <Group>
                <Chart
                  size={[200, 56]}
                  x={{ kind: "band", domain: [...past.map(([run]) => run), THIS_RUN] }}
                  y={{ domain: [100, 200], ticks: 2 }}
                  font={mono}
                  textSize={10}
                  axis={theme.border}
                  label={theme.muted}
                  series={[
                    area(past, { color: theme.blue }),
                    line([...past.slice(-1), [THIS_RUN, total]], {
                      name: "now",
                      color: theme.green,
                      draw: track(0).to(1, live),
                    }),
                  ]}
                >
                  {({ x, y }) => (
                    <Shape
                      geometry={circle(4)}
                      at={[x(THIS_RUN), y(total)]}
                      anchor="center"
                      fill={theme.green}
                      motion={enter(span(live.start, pop.settle), {
                        from: { scale: 0 },
                        curve: pop,
                      })}
                    />
                  )}
                </Chart>
              </Group>
            </Card>
          </Stack>
        </Align>
        <Arrow
          from={commit.right}
          to={deploy.left}
          inset={8}
          stroke={{ color: theme.muted }}
          draw={track(0).to(1, handoff)}
        />
      </Group>
    </Group>
  ),
);
