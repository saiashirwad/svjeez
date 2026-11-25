/** @jsxImportSource svjeez */
import {
  Align,
  Arrow,
  Center,
  Group,
  Shape,
  Stack,
  Text,
  circle,
  ease,
  enter,
  exit,
  ref,
  scene,
  span,
  track,
  type Ref,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { sans, theme } from "./style";

const Node = ({
  handle,
  when,
  children,
}: {
  readonly handle: Ref;
  readonly when: Span;
  readonly children: string;
}): SceneElement => (
  <Center
    ref={handle}
    width={112}
    height={44}
    radius={10}
    fill={theme.surface}
    stroke={{ color: theme.border, width: 1.5 }}
    motion={enter(when)}
  >
    <Text font={sans} weight={600} size={14} fill={theme.text}>
      {children}
    </Text>
  </Center>
);

const [source, model, svg, frames, video] = [ref(), ref(), ref(), ref(), ref()];
const targets = [svg, frames, video];

const FIRST = span(0.3, 0.4);
const LINK = FIRST.next(0.35);
const [toModel, ...toTargets] = LINK.cascade(4, 0.4);
const [atModel, ...atTargets] = LINK.next(0.3, -0.05).cascade(4, 0.4);
const LEAVE = span(6.8, 0.5);

/** A dot that rides from the source to the model, then to one target, and is gone. */
const Packet = ({ to, when }: { readonly to: Ref; readonly when: Span }): SceneElement => {
  const [first, second] = when.chain(0.35);

  const at = track<Vec>([0, 0])
    .set(source.right, span(when.start))
    .to(model.left, first, ease.in)
    .set(model.right, second)
    .to(to.left, second, ease.out);

  const seen = track(0)
    .set(1, span(when.start))
    .set(0, span(second.end + 0.1));

  return <Shape geometry={circle(5)} offset={at} opacity={seen} fill={theme.blue} />;
};

export default scene(
  {
    size: [560, 240],
    duration: 7.5,
    title: "One model, many targets",
    desc: "A scene file feeds a model, which fans out to SVG, frames and video. Each box appears with the arrow into it, then a dot runs along the arrows to each target in turn, and everything fades before the loop.",
    theme,
    still: 3,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Group motion={exit(LEAVE)}>
        <Align>
          <Stack direction="row" gap={56} align="center">
            <Node handle={source} when={FIRST}>
              scene.tsx
            </Node>
            <Node handle={model} when={atModel}>
              model
            </Node>
            <Stack gap={12}>
              <Node handle={svg} when={atTargets[0]!}>
                SVG
              </Node>
              <Node handle={frames} when={atTargets[1]!}>
                frames
              </Node>
              <Node handle={video} when={atTargets[2]!}>
                video
              </Node>
            </Stack>
          </Stack>
        </Align>
        <Arrow
          from={source.right}
          to={model.left}
          inset={6}
          stroke={{ color: theme.muted }}
          draw={track(0).to(1, toModel)}
        />
        {targets.map((target, i) => (
          <Arrow
            from={model.right}
            to={target.left}
            inset={6}
            stroke={{ color: theme.muted }}
            draw={track(0).to(1, toTargets[i]!)}
          />
        ))}
        {span(2.6, 0.5)
          .cascade(targets.length, 1.3)
          .map((when, i) => (
            <Packet to={targets[i]!} when={when} />
          ))}
      </Group>
    </Group>
  ),
);
