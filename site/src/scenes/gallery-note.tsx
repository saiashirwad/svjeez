import { Lettering, handwrite } from "@svjeez/fonts/handwriting";
import {
  Group,
  Shape,
  ease,
  path,
  scene,
  span,
  tokens,
  track,
  type SceneElement,
  type Span,
} from "svjeez";
import { hand } from "./cue";

const W = 160;
const H = 76;
const DELAY = 1.9;
const SHIFT = 56;

const page = tokens({
  light: { ink: "#1c1c1f" },
  dark: { ink: "#f4f4f5" },
});

const arrow = (
  d: string,
  from: [number, number],
  tip: [number, number],
  arm = 9,
): readonly [string, string] => {
  const back = Math.atan2(from[1] - tip[1], from[0] - tip[0]);

  const end = (turn: number) =>
    `${(tip[0] + arm * Math.cos(back + turn)).toFixed(1)} ${(tip[1] + arm * Math.sin(back + turn)).toFixed(1)}`;

  return [d, `M${end(0.6)}L${tip[0]} ${tip[1]}L${end(-0.6)}`];
};

const Stroke = ({ d, when }: { d: string; when: Span }): SceneElement => (
  <Shape
    geometry={path.parse(d)}
    stroke={{ color: page.ink, width: 3.4, cap: "round", join: "round" }}
    draw={track(0).to(1, when, ease.linear)}
  />
);

/** `size` handwritten with an arrow back at the card on its left: the lead scene's size, written into the gallery. */
export const note = (size: string) => {
  const { end } = handwrite(hand, size, { width: 104, y: 40, from: DELAY });
  const [shaft, head] = arrow("M60 34C42 24 18 30 8 62", [12, 48], [8, 62]);
  const first = span(end + 0.12, 0.32);
  const second = first.next(0.02, 0.14);

  return scene(
    {
      size: [W, H],
      duration: second.end + 0.3,
      title: size,
      desc: `${size}, handwritten, with an arrow pointing left.`,
      theme: page,
      still: second.end + 0.3,
      loop: false,
    },
    () => (
      <Group>
        <Group at={[SHIFT, 0]}>
          <Lettering font={hand} text={size} width={104} y={40} from={DELAY} ink={page.ink} />
        </Group>
        <Stroke d={shaft} when={first} />
        <Stroke d={head} when={second} />
      </Group>
    ),
  );
};
