/** @jsxImportSource svjeez */
import {
  Align,
  Arrow,
  Center,
  Group,
  Shape,
  Stack,
  Text,
  canvas,
  circle,
  draw,
  ease,
  enter,
  exit,
  par,
  ref,
  scene,
  seq,
  span,
  timeline,
  wait,
  type Action,
  type Ref,
  type SceneElement,
  type Span,
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

const FIRST = span(0.3, 0.4);
const LINK = FIRST.next(0.35);
const [toModel, toSvg, toFrames, toVideo] = LINK.cascade(4, 0.4);
const [atModel, atSvg, atFrames, atVideo] = LINK.next(0.3, -0.05).cascade(4, 0.4);
const LEAVE = span(6.8, 0.5);

export default scene(
  {
    size: [560, 240],
    duration: 7.5,
    title: "One model, many targets",
    desc: "A scene file feeds a model, which fans out to SVG, frames and video. Each box appears with the arrow into it, then a dot runs along the arrows to each target in turn, which lights up as it lands, and everything fades before the loop.",
    theme,
    reducedMotion: 3,
  },
  () => {
    const source = ref("scene");
    const model = ref("model");
    const svg = ref("svg");
    const frames = ref("frames");
    const video = ref("video");
    const dot = ref("dot");

    const targets = [
      [svg, toSvg],
      [frames, toFrames],
      [video, toVideo],
    ] as const;

    const deliver = (target: Ref): Action =>
      seq(
        dot.set({ at: source.right }),
        dot.show(0.15),
        dot.move(model.left, 0.35, ease.in),
        dot.hide(0.1),
        dot.set({ at: model.right }),
        dot.show(0.1),
        dot.move(target.left, 0.35, ease.out),
        par(dot.hide(0.15), target.stroke({ color: theme.blue }, 0.2)),
      );

    timeline(wait(atVideo.end + 0.3), seq(...targets.map(([target]) => deliver(target))));

    return (
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
                <Node handle={svg} when={atSvg}>
                  SVG
                </Node>
                <Node handle={frames} when={atFrames}>
                  frames
                </Node>
                <Node handle={video} when={atVideo}>
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
            trim={draw(toModel)}
          />
          {targets.map(([target, link]) => (
            <Arrow
              from={model.right}
              to={target.left}
              inset={6}
              stroke={{ color: theme.muted }}
              trim={draw(link)}
            />
          ))}
          <Shape ref={dot} geometry={circle(5)} anchor="center" opacity={0} fill={theme.blue} />
        </Group>
      </Group>
    );
  },
);
