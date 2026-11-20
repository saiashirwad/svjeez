import { Group, Sequence, span, type SceneElement } from "svjeez";
import { Pivot } from "../blip";
import { APP, Filmed } from "./app";
import { Listing } from "./listing";
import { Note } from "./note";
import { CODE_COLUMN, Header, RESULT_COLUMN, SHOTS, STAGE, shown } from "./kit";

// The film slide. The script that films the app sits beside it, and a highlight steps down it a line at a time as the
// app does that thing: idle, a click on New, a title typed, Add.

const START = 1.4;
const at = (t: number) => START + t;

const lines = [
  `  await snap("idle");`,
  `  await page.getByText("+ New").click();`,
  `  await page.keyboard.type("ship to readme");`,
  `  await snap("typed");`,
  `  await page.getByText("Add").click();`,
  `  await snap("added");`,
];

const script = (count: number) =>
  ["await film(serve(app), async ({ page, snap }) => {", ...lines.slice(0, count), "});"].join(
    "\n",
  );

const when = [
  0.8,
  at(APP.clicked) - 0.2,
  at(APP.typing.start) - 0.2,
  at(APP.typing.start + APP.typing.over),
  at(APP.added) - 0.4,
  at(APP.added) + 0.1,
];

export const FilmingSlide = (): SceneElement => {
  const { over } = SHOTS.filming;
  const scale = RESULT_COLUMN[2] / APP.card.w;

  return (
    <Group>
      <Header title="film the app you already have" from="@svjeez/dom" over={over!} />
      <Group motion={shown(over!, 0.1)}>
        <Listing
          name="film.tsx"
          states={[script(lines.length)]}
          steps={[]}
          trace={when.map((at, i) => ({ line: i + 1, at }))}
          edits={0}
          size={19}
          full={{ box: CODE_COLUMN }}
        />
        <Sequence when={span(START)}>
          <Pivot
            around={[APP.card.x, APP.card.y]}
            at={[RESULT_COLUMN[0], RESULT_COLUMN[1] + (RESULT_COLUMN[3] - APP.card.h * scale) / 2]}
            motion={{ scale }}
          >
            <Filmed />
          </Pivot>
        </Sequence>
        <Note
          text="not redrawn by hand"
          at={[STAGE.x + 860, STAGE.y + 420]}
          from={at(APP.added) + 0.3}
          size={28}
          tilt={-4}
        />
      </Group>
    </Group>
  );
};
