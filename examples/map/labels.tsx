import { ease, enter, type Paint, type Point, type SvgNode } from "svjeez";
import { pts, trace } from "./curve";
import { C, Words, coarse, n, pathSymbol, roman, type Play } from "./kit";
import { PLACES, type Place } from "./places";

interface Label {
  readonly text: string;
  readonly size: number;
  readonly path: Point[];
  readonly tracking?: number;
  readonly fill?: Paint;
  readonly at: number;
}

const LABELS: Label[] = [
  {
    text: "THE IRON TEETH",
    size: 13,
    path: pts([630, 170, 648, 250, 640, 318]),
    at: 3,
  },
  {
    text: "ELDERWOOD",
    size: 12,
    path: pts([360, 336, 420, 326, 482, 336]),
    tracking: 0.5,
    fill: C.faded,
    at: 3.2,
  },
  {
    text: "THE ASHLANDS",
    size: 12,
    path: pts([700, 268, 772, 252, 846, 276]),
    tracking: 0.4,
    fill: C.red,
    at: 3.4,
  },
  {
    text: "GREY HILLS",
    size: 10,
    path: pts([254, 210, 304, 216, 352, 208]),
    tracking: 0.35,
    fill: C.faded,
    at: 3.5,
  },
  {
    text: "SEA OF WHISPERS",
    size: 17,
    path: pts([300, 600, 470, 618, 640, 596]),
    tracking: 0.6,
    fill: C.faded,
    at: 3.6,
  },
  {
    text: "THE GREAT WEST",
    size: 15,
    path: pts([52, 470, 46, 330, 64, 200]),
    tracking: 0.5,
    fill: C.faded,
    at: 3.7,
  },
  {
    text: "WESTWOLD",
    size: 9.5,
    path: pts([156, 205, 196, 198, 236, 205]),
    tracking: 0.45,
    fill: C.faded,
    at: 3.75,
  },
  {
    text: "THE BARROWS",
    size: 9.5,
    path: pts([140, 500, 186, 515, 236, 530]),
    tracking: 0.35,
    fill: C.faded,
    at: 3.75,
  },
  {
    text: "River Glass",
    size: 8.5,
    path: pts([334, 420, 324, 470, 304, 512]),
    tracking: 0.2,
    fill: C.river,
    at: 3.8,
  },
];

/** A label whose letters sit on a curve, each glyph turned to the curve's direction. */
function Curved({
  text,
  size,
  path,
  tracking = 0.25,
  fill = C.ink,
  at,
  play,
}: Label & { play: Play }): SvgNode {
  const line = trace(path, 30);
  const gap = tracking * size;
  const chars = [...text].map((char) => ({ char, width: roman.measure(char, size) }));
  const total = chars.reduce((sum, c) => sum + c.width, 0) + gap * (chars.length - 1);
  const lift = (roman.metrics.capHeight ?? 0.7) * size * 0.5;
  let s = (line.total - total) / 2;

  return (
    <g fill={fill} role="img" aria-label={text}>
      {chars.map(({ char, width }, i) => {
        const { x, y, angle } = line.at(s + width / 2);
        s += width + gap;

        return (
          char !== " " && (
            <g transform={`translate(${n(x)} ${n(y)}) rotate(${n(angle)})`}>
              <use
                href={pathSymbol(coarse(roman.path(char, { size, x: -width / 2, y: lift }).d))}
                animation={play(enter({ at: at + i * 0.04, over: 0.4 }))}
              />
            </g>
          )
        );
      })}
    </g>
  );
}

/** A town, tower or port: its sign and its name, on the side that has room. */
function Marker({ place, at, play }: { place: Place; at: number; play: Play }): SvgNode {
  const { x, y } = place.at;

  const name = {
    right: { x: x + 8, y: y + 3.5, anchor: "start" },
    left: { x: x - 8, y: y + 3.5, anchor: "end" },
    above: { x, y: y - 10, anchor: "middle" },
    below: { x, y: y + 16, anchor: "middle" },
  } as const;

  const icon =
    place.kind === "tower" ? (
      <path
        d={`M${x - 3} ${y + 4}V${y - 5}h1.5v1.5h1.5v-1.5h1.5v-1.5h-.01h1.5v1.5h1.5v-1.5h0V${y + 4}Z`}
        fill={C.ink}
      />
    ) : place.kind === "port" ? (
      <path
        d={`M${x} ${y - 5}v9M${x - 4} ${y + 1}q4 5 8 0M${x - 2.5} ${y - 3}h5`}
        fill="none"
        stroke={C.ink}
        strokeWidth={1.2}
      />
    ) : (
      <>
        <circle cx={x} cy={y} r={3.6} fill="none" stroke={C.ink} strokeWidth={1} />
        <circle cx={x} cy={y} r={1.6} fill={C.ink} />
      </>
    );

  return (
    <g animation={play(enter({ at, over: 0.5 }, { opacity: 0, scale: 0.6 }, ease.pop))}>
      {icon}
      <Words face={roman} text={place.name} size={10.5} {...name[place.side ?? "right"]} />
    </g>
  );
}

/** Every name on the map. */
export function Labels({ play }: { play: Play }): SvgNode {
  return (
    <>
      {LABELS.map((label) => (
        <Curved {...label} play={play} />
      ))}
      {Object.values(PLACES).map((place, i) => (
        <Marker place={place} at={3 + i * 0.12} play={play} />
      ))}
    </>
  );
}
