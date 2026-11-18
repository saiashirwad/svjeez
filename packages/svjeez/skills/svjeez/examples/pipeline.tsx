/** @jsxImportSource svjeez */
import {
  Align,
  Arrow,
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
  rect,
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

/** A labelled box that fades in during `when`. */
const Node = ({
  handle,
  when,
  children,
}: {
  readonly handle: Ref;
  readonly when: Span;
  readonly children: string;
}): SceneElement => {
  const box = handle.part("box");

  return (
    <Group ref={handle} motion={enter(when)}>
      <Shape
        key="box"
        geometry={rect(112, 44, { radius: 10 })}
        fill={theme.surface}
        stroke={{ color: theme.border, width: 1.5 }}
      />
      <Align to={box}>
        <Text font={sans} weight={600} size={14} fill={theme.text}>
          {children}
        </Text>
      </Align>
    </Group>
  );
};

/** The scene file arrives first; then each arrow draws, and the box it points to arrives as it lands. */
const FIRST = span(0.3, 0.4);
const links = FIRST.next(0.35).cascade(4, 0.4);
const arrivals = links.map((link) => link.next(0.3, -0.05));
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

    const targets = [svg, frames, video];

    /** A dot runs along both arrows to a target, and the target lights up as it lands. */
    const deliver = (target: Ref): Action =>
      seq(
        dot.set({ at: source.right }),
        dot.show(0.15),
        dot.move(model.left, 0.35, ease.in),
        dot.hide(0.1),
        dot.set({ at: model.right }),
        dot.show(0.1),
        dot.move(target.left, 0.35, ease.out),
        par(dot.hide(0.15), target.part("box").stroke({ color: theme.blue }, 0.2)),
      );

    timeline(wait(arrivals.at(-1)!.end + 0.3), seq(...targets.map(deliver)));

    return (
      <Group>
        <Shape geometry={canvas.rect} fill={theme.background} />
        <Group motion={exit(LEAVE)}>
          <Align>
            <Stack direction="row" gap={56} align="center">
              <Node handle={source} when={FIRST}>
                scene.tsx
              </Node>
              <Node handle={model} when={arrivals[0]!}>
                model
              </Node>
              <Stack gap={12}>
                <Node handle={svg} when={arrivals[1]!}>
                  SVG
                </Node>
                <Node handle={frames} when={arrivals[2]!}>
                  frames
                </Node>
                <Node handle={video} when={arrivals[3]!}>
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
            trim={draw(links[0]!)}
          />
          {targets.map((target, i) => (
            <Arrow
              from={model.right}
              to={target.left}
              inset={6}
              stroke={{ color: theme.muted }}
              trim={draw(links[i + 1]!)}
            />
          ))}
          <Shape ref={dot} geometry={circle(5)} anchor="center" opacity={0} fill={theme.blue} />
        </Group>
      </Group>
    );
  },
);
