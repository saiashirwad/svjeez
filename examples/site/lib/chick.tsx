import { ease, motion, type Motion, type PathData } from "svjeez";

// The chick from the site's favicon (site/public/favicon.svg), in the favicon's own coordinates: the body sits on y 162
// and is centered on x 104, the antenna bulb on 104,38. Scenes place it with a transform and bring their own motions.

export const CHICK = {
  yellow: "#FFC21A",
  belly: "#F2A900",
  stem: "#E3A100",
  cheek: "#FF8C6B",
  ink: "#26262A",
} as const;

const K = 0.5523;

/** An ellipse as four cubics, so an open eye and a shut one share their commands and `d` can move between them. */
const ellipse = (cx: number, cy: number, rx: number, ry: number): PathData =>
  `M${cx - rx} ${cy}${[
    [cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry],
    [cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy],
    [cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry],
    [cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy],
  ]
    .map((c) => `C${c.map((n) => +n.toFixed(2)).join(" ")}`)
    .join("")}Z`;

const EYES = [84, 124] as const;

export interface ChickMotions {
  /** Times each blink starts. A blink takes a quarter of a second. */
  readonly blinks?: readonly number[];
  /** Moves the whole chick: hops and walks. */
  readonly body?: Motion<"x" | "y" | "rotate">;
  /** Moves the eyes and their glints inside the face: looking around. */
  readonly look?: Motion<"x" | "y">;
  /** Moves the bulb on its stem. Keep it within 3px, or the stem shows its end. */
  readonly bulb?: Motion<"y">;
  /** Recolors the bulb. */
  readonly glow?: Motion<"fill">;
}

export const chick = ({ blinks = [], body, look, bulb, glow }: ChickMotions = {}) => {
  const eye = (cx: number) => {
    const open = ellipse(cx, 110, 7, 9);
    const shut = ellipse(cx, 112, 7.5, 1.4);

    const d = blinks.reduce(
      (m, at) => m.at(at).to({ d: shut }, 0.07, ease.in).wait(0.05).to({ d: open }, 0.12),
      motion({ d: open }),
    );

    const glint = blinks.reduce(
      (m, at) => m.at(at).to({ opacity: 0 }, 0.04).wait(0.12).to({ opacity: 1 }, 0.08),
      motion({ opacity: 1 }),
    );

    return (
      <>
        <path d={open} fill={CHICK.ink} animation={blinks.length > 0 ? d : undefined} />
        <circle
          cx={cx + 2}
          cy={106}
          r={2.4}
          fill="#FFF"
          animation={blinks.length > 0 ? glint : undefined}
        />
      </>
    );
  };

  return (
    <g animation={body}>
      <path d="M104 60V42" stroke={CHICK.stem} strokeWidth={7} strokeLinecap="round" />
      <circle cx={104} cy={38} r={9} fill={CHICK.yellow} animation={[bulb, glow]} />
      <path
        d="M38 150C38 94 68 60 104 60S170 94 170 150C170 158 165 162 157 162H51C43 162 38 158 38 150Z"
        fill={CHICK.yellow}
      />
      <path
        d="M38 150C38 158 43 162 51 162H157C165 162 170 158 170 150C170 146 170 143 169 140C160 148 150 150 104 150S48 148 39 140C38 143 38 146 38 150Z"
        fill={CHICK.belly}
      />
      <ellipse cx={66} cy={124} rx={9} ry={6} fill={CHICK.cheek} opacity={0.55} />
      <ellipse cx={142} cy={124} rx={9} ry={6} fill={CHICK.cheek} opacity={0.55} />
      <g animation={look}>{EYES.map(eye)}</g>
      <path
        d="M97 124Q104 131 111 124"
        fill="none"
        stroke={CHICK.ink}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
    </g>
  );
};
