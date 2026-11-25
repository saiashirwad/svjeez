import { Lettering, casual, handwrite } from "@svjeez/fonts/handwriting";
import { Group, Shape, ease, path, span, track, type SceneElement, type Vec } from "svjeez";
import { theme } from "./kit";

/** The marker the landing page writes in. */
const hand = await casual();

interface NoteProps {
  readonly text: string;
  /** The middle of the note's baseline. */
  readonly at: Vec;
  /** When the pen starts, in the shot's seconds. */
  readonly from: number;
  readonly size?: number;
  /** A slight tilt, in degrees, as if jotted down. */
  readonly tilt?: number;
  /** A hand-drawn arrow out of the side of the writing it points toward, ending this far from that side. */
  readonly to?: Vec;
}

const WIDTH = 900;

/** Faster than the landing page's pen: a note has to be done well before its shot ends. */
const SPEED = 1100;

/** A handwritten aside on the stage, written stroke by stroke, with an arrow at what it is about. */
export const Note = ({ text, at, from, size = 38, tilt = -4, to }: NoteProps): SceneElement => {
  const { end } = handwrite(hand, text, { width: WIDTH, y: 0, from, size, speed: SPEED });
  const half = (text.length * size * 0.5) / 2 + 10;
  const start: Vec = to ? [Math.sign(to[0]) * half, -size * 0.3] : [0, 0];
  const tip: Vec = to ? [start[0] + to[0], start[1] + to[1]] : start;
  const shaft = to && path().moveTo(start).quadTo([tip[0], start[1]], tip);
  const back = Math.atan2(start[1] - tip[1], 0);

  const arm = (turn: number): Vec => [
    tip[0] + 11 * Math.cos(back + turn),
    tip[1] + 11 * Math.sin(back + turn),
  ];

  const drawn = span(end + 0.05, 0.3);

  return (
    <Group offset={at} motion={{ rotate: tilt }}>
      <Group offset={[-WIDTH / 2, 0]}>
        <Lettering
          font={hand}
          text={text}
          width={WIDTH}
          y={0}
          from={from}
          size={size}
          speed={SPEED}
          ink={theme.text}
        />
      </Group>
      {shaft && (
        <Group>
          <Shape
            geometry={shaft}
            stroke={{ color: theme.text, width: 3, cap: "round" }}
            draw={track(0).to(1, drawn, ease.out)}
          />
          <Shape
            geometry={path().moveTo(arm(0.6)).lineTo(tip).lineTo(arm(-0.6))}
            stroke={{ color: theme.text, width: 3, cap: "round", join: "round" }}
            draw={track(0).to(1, drawn.next(0.15), ease.out)}
          />
        </Group>
      )}
    </Group>
  );
};
