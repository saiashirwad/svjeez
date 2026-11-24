import { Icon } from "@svjeez/icons";
import { brandReact } from "@svjeez/icons/tabler";
import {
  Group,
  Shape,
  Stack,
  Text,
  circle,
  ease,
  enter,
  path,
  rect,
  span,
  track,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Listing } from "./listing";
import { Note } from "./note";
import { CODE_COLUMN, RESULT_COLUMN, SHOTS, geist, mono, shown, theme } from "./kit";

// The film slide. A script films one React component on its own: it snaps it, re-renders it with new props, snaps it
// again. A highlight steps down the script as the component beside it does each thing, and each snap flashes the
// frame the component is filmed in.

const SCRIPT = `import TaskCard from "./TaskCard.tsx";

await film(
  component(TaskCard, { task }),
  async ({ snap, update }) => {
    await snap("todo");
    await update({ task: { ...task, note: "in review" } });
    await snap("review");
    await update({ task: { ...task, done: true } });
    await snap("done");
  },
);`;

/** When each line of the script runs, in the slide's seconds, and which line it is (counting from 0). */
const RUNS = [
  { line: 5, at: 0.9 },
  { line: 6, at: 2.1 },
  { line: 7, at: 3.2 },
  { line: 8, at: 4.2 },
  { line: 9, at: 5.3 },
] as const;

/** A beat after a line runs, the component shows it. */
const after = (run: { readonly at: number }) => run.at + 0.25;

const [todo, noted, review, done, last] = [
  after(RUNS[0]),
  after(RUNS[1]),
  after(RUNS[2]),
  after(RUNS[3]),
  after(RUNS[4]),
];

const CARD: Vec = [440, 128];

const AT: Vec = [
  RESULT_COLUMN[0] + (RESULT_COLUMN[2] - CARD[0]) / 2,
  RESULT_COLUMN[1] + (RESULT_COLUMN[3] - CARD[1]) / 2 + 10,
];

/** The dashed frame the component is filmed in, a little outside it. */
const FRAME = 18;

/** A snap: the frame flashes, the way a shutter would. */
const flash = (at: number) =>
  track(0)
    .to(0.5, span(at, 0.05))
    .to(0, span(at + 0.05, 0.4), ease.out);

const flashes = (times: readonly number[]) =>
  times
    .slice(1)
    .reduce(
      (t, at) => t.to(0.5, span(at, 0.05)).to(0, span(at + 0.05, 0.4), ease.out),
      flash(times[0]!),
    );

const tick = path().moveTo([-6, 0]).lineTo([-2, 4]).lineTo([6, -5]);

/** The component, as it renders for each set of props. */
const TaskCard = (): SceneElement => (
  <Group offset={AT}>
    <Shape
      geometry={rect(CARD[0], CARD[1], { radius: 12 })}
      fill={theme.background}
      stroke={{ color: theme.line, width: 1 }}
    />
    <Group offset={[34, 46]}>
      <Shape
        geometry={circle(11)}
        at={[0, 0]}
        anchor="center"
        fill={track<Paint>(theme.background).to(theme.green, span(done, 0.25))}
        stroke={{ color: track<Paint>(theme.faint).to(theme.green, span(done, 0.25)), width: 1.5 }}
      />
      <Shape
        geometry={tick}
        stroke={{ color: "#FFFFFF", width: 2.2, cap: "round", join: "round" }}
        draw={track(0).to(1, span(done + 0.1, 0.3), ease.out)}
      />
    </Group>
    <Text
      font={geist}
      weight={600}
      size={22}
      at={[60, 54]}
      anchor="baseline-left"
      fill={track<Paint>(theme.text).to(theme.muted, span(done, 0.3))}
    >
      ship the launch film
    </Text>
    {[
      { text: "two scenes left", from: 0, to: noted },
      { text: "in review", from: noted, to: done },
      { text: "shipped", from: done, to: undefined },
    ].map(({ text, from, to }) => (
      <Text
        font={mono}
        size={16}
        at={[60, 92]}
        anchor="baseline-left"
        fill={theme.muted}
        opacity={
          from === 0
            ? track(1).to(0, span(to!, 0.2))
            : to === undefined
              ? track(0).to(1, span(from, 0.25))
              : track(0).to(1, span(from, 0.25)).to(0, span(to, 0.2))
        }
      >
        {text}
      </Text>
    ))}
  </Group>
);

/** What it is: a React component, filmed on its own. */
const Label = (): SceneElement => (
  <Stack direction="row" gap={10} align="center" at={[AT[0] - FRAME, AT[1] - FRAME - 34]}>
    <Icon icon={brandReact} size={22} color="#149ECA" stroke={{ width: 1.8 }} />
    <Text font={mono} size={15} fill={theme.muted}>
      {"<TaskCard />"}
    </Text>
  </Stack>
);

const Frame = (): SceneElement => {
  const [w, h] = [CARD[0] + 2 * FRAME, CARD[1] + 2 * FRAME];

  return (
    <Group offset={[AT[0] - FRAME, AT[1] - FRAME]}>
      <Shape
        geometry={rect(w, h, { radius: 16 })}
        stroke={{ color: theme.faint, width: 1, dash: [5, 6] }}
      />
      <Shape
        geometry={rect(w, h, { radius: 16 })}
        fill={theme.blue}
        opacity={flashes([todo, review, last])}
      />
    </Group>
  );
};

/** Where the frame's top edge is, so Blip can stand on it. */
export const FRAME_TOP: Vec = [AT[0] + CARD[0] - 40, AT[1] - FRAME];
export const FILMING = { snaps: [todo, review, last], done } as const;

export const FilmingSlide = (): SceneElement => (
  <Group motion={shown(SHOTS.filming.over!, 0.1)}>
    <Listing
      name="card.film.tsx"
      size={20}
      states={[SCRIPT]}
      steps={[]}
      edits={0}
      trace={RUNS}
      full={{ box: CODE_COLUMN }}
    />
    <Group
      motion={enter(span(0.3, 0.4), { from: { opacity: 0, offset: [0, 10] }, curve: ease.out })}
    >
      <Label />
      <Frame />
      <TaskCard />
    </Group>
    <Note
      text="just the component"
      at={[AT[0] + CARD[0] / 2, AT[1] + CARD[1] + FRAME + 70]}
      from={1.4}
      size={30}
      tilt={-3}
    />
  </Group>
);
