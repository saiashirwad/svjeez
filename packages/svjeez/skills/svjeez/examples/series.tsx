/** @jsxImportSource svjeez */
import {
  Align,
  Group,
  Sequence,
  Series,
  Shape,
  Text,
  context,
  enter,
  exit,
  scene,
  span,
  type Paint,
  type SceneElement,
} from "svjeez";
import { sans, theme } from "./style";

const Accent = context<Paint>(theme.text);

/** One beat, written from 0: its length is its <Sequence>'s, so a <Series> can place the next one after it. */
const Beat = ({ text }: { readonly text: string }): SceneElement => (
  <Sequence when={span(0, 1.4)}>
    <Text
      font={sans}
      weight={600}
      size={20}
      fill={Accent.read()}
      motion={[enter(span(0, 0.3)), exit(span(1.1, 0.3))]}
    >
      {text}
    </Text>
  </Sequence>
);

/** No `duration`: the scene lasts as long as its root, three beats and a rest. */
export default scene(
  {
    size: [320, 160],
    title: "Beats",
    desc: "Three lines of text appear one after another, each in the accent color its parent provides.",
    theme,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align>
        <Accent value={theme.green}>
          <Group>
            <Series>
              <Beat text="Draft" />
              <Beat text="Review" />
              <Beat text="Ship" />
            </Series>
          </Group>
        </Accent>
      </Align>
    </Group>
  ),
);
