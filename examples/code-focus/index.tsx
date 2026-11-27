import { Code, codeLayout, codeTokens, ts } from "@svjeez/code";
import { tomorrow } from "@svjeez/code/palettes";
import {
  Group,
  Sequence,
  Series,
  Shape,
  Text,
  durationOf,
  ease,
  rect,
  scene,
  span,
  track,
} from "svjeez";
import { mono, theme } from "../theme";

const SIZE: readonly [number, number] = [560, 260];
const [W] = SIZE;
const STEP = 1.6;

const SRC = `const word = take_while1(isAlpha);
const words = many(word);
parse(words, "hello world");`;

const style = { font: mono, size: 16, lineHeight: 1.6 } as const;

/** The top-center of the code's cells lands at (W / 2, 60): no measuring first. */
const layout = codeLayout({ ...style, at: [W / 2, 60], anchor: [0.5, 0] }, SRC);

/** Each step lights a few tokens, keyed `text#occurrence`, and dims the rest. */
const steps = [
  { lit: ["take_while1#0", "isAlpha#0"], caption: "take_while1 reads letters" },
  { lit: ["many#0", "word#1"], caption: "many repeats it" },
  { lit: ["parse#0", "words#1"], caption: "parse runs it" },
];

const brightness = (key: string) => {
  const at = (i: number) => (steps[i]!.lit.includes(key) ? 1 : 0.25);

  return steps
    .slice(1)
    .reduce((t, _, i) => t.to(at(i + 1), span(STEP * (i + 1) - 0.2, 0.3)), track(at(0)));
};

const captions = (
  <Series>
    {steps.map(({ caption }) => (
      <Sequence when={span(0, STEP)}>
        <Text
          font={mono}
          size={13}
          fill={theme.muted}
          at={[W / 2, 180]}
          anchor="center"
          opacity={track(0)
            .to(1, span(0, 0.2))
            .to(0, span(STEP - 0.2, 0.2))}
        >
          {caption}
        </Text>
      </Sequence>
    ))}
  </Series>
);

/** The progress bar spans every caption: its length is read off the series, not summed by hand. */
const total = durationOf(captions);

export default scene(
  {
    size: SIZE,
    title: "Code, one step at a time",
    desc: "Three lines of parser code sit centered on the stage. Each step lights the tokens it is about, dims the rest, and names them in a caption, while a bar under the captions fills across all three steps.",
    theme,
    loop: false,
    markers: { take: 0.8, many: STEP + 0.8, parse: STEP * 2 + 0.8 },
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={rect(layout.bounds.width, layout.bounds.height)}
        at={layout.bounds.at}
        fill={theme.surface}
      />
      <Code
        {...style}
        lang={ts}
        palette={tomorrow}
        at={layout.origin}
        by={codeTokens}
        part={({ key }) => ({ opacity: brightness(key) })}
      >
        {SRC}
      </Code>
      {captions}
      <Sequence when={span(0, total)}>
        <Shape geometry={rect(W - 80, 4)} at={[40, 226]} fill={theme.raised} />
        <Shape
          geometry={rect(W - 80, 4)}
          at={[40, 226]}
          fill={theme.blue}
          origin="at"
          scale={track<[number, number]>([0, 1]).to([1, 1], span(0, total), ease.linear)}
        />
      </Sequence>
    </Group>
  ),
);
