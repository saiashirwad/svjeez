import {
  bell,
  box,
  eye,
  heartFilled,
  moon,
  rocket,
  settings,
  sun,
  wifi,
} from "@svjeez/icons/tabler";
import {
  Icon,
  draw,
  ease,
  enter,
  exit,
  motion,
  render,
  shake,
  type Color,
  type IconData,
  type Stack,
} from "svjeez";
import { CSS, chrome, outro } from "./kit";
import { theme } from "../style";

// Eight Tabler icons, each arriving its own way, then a few of them keep moving.
const W = 504;
const H = 340;
const BAR = 40;
const D = 8;
const win = chrome(W, H, "icons.tsx");

const SIZE = 40;
const CELL = W / 4;
const ROWS = [BAR + 44, BAR + 156];
const at = (index: number) => 0.3 + index * 0.12;

type Rest = Stack<"opacity" | "x" | "y" | "scale" | "rotate" | "blur">;

interface Cell {
  readonly label: string;
  readonly icon: IconData;
  readonly color: Color;
  /** Moves the whole icon. */
  readonly motion?: Rest;
  /** Runs on each path of the icon. */
  readonly paths?: (d: string, index: number) => Stack<"opacity" | "draw">;
}

const cells: readonly (readonly Cell[])[] = [
  [
    {
      label: "draw",
      icon: rocket,
      color: theme.base0D,
      paths: (_, i) => draw({ at: at(0) + i * 0.14, over: 0.55 }),
    },
    {
      label: "pop",
      icon: heartFilled,
      color: theme.base08,
      motion: [
        enter({ at: at(1), over: 0.6 }, { opacity: 0, scale: 0 }, ease.pop),
        motion({ scale: 1 })
          .at(3)
          .to({ scale: 1.2 }, 0.12)
          .to({ scale: 1 }, 0.16)
          .to({ scale: 1.14 }, 0.12)
          .to({ scale: 1 }, 0.3)
          .at(5.4)
          .to({ scale: 1.2 }, 0.12)
          .to({ scale: 1 }, 0.16)
          .to({ scale: 1.14 }, 0.12)
          .to({ scale: 1 }, 0.3),
      ],
    },
    {
      label: "drop",
      icon: box,
      color: theme.base09,
      motion: enter({ at: at(2), over: 0.7 }, { opacity: 0, y: -56 }, ease.pop),
    },
    {
      label: "spin",
      icon: settings,
      color: theme.base0E,
      motion: [
        enter({ at: at(3), over: 1 }, { opacity: 0, scale: 0.2, rotate: -270 }),
        motion({ rotate: 0 })
          .at(at(3) + 1)
          .to({ rotate: 120 }, D - at(3) - 1, ease.linear),
      ],
    },
  ],
  [
    {
      label: "focus",
      icon: eye,
      color: theme.base0C,
      motion: enter({ at: at(4), over: 0.9 }, { opacity: 0, scale: 1.5, blur: 8 }),
    },
    {
      label: "cascade",
      icon: wifi,
      color: theme.base0B,
      paths: (_, i) =>
        motion({ opacity: 0 })
          .at(at(5) + i * 0.18)
          .to({ opacity: 1 }, 0.2)
          .at(4.6)
          .to({ opacity: i ? 0.15 : 1 }, 0.25)
          .at(5 + i * 0.18)
          .to({ opacity: 1 }, 0.2),
    },
    {
      label: "swap",
      icon: sun,
      color: theme.base0A,
      motion: [
        enter({ at: at(6), over: 0.6 }, { opacity: 0, scale: 0, rotate: -90 }, ease.pop),
        exit({ at: 4, over: 0.4 }, { opacity: 0, scale: 0, rotate: 90 }, ease.in),
      ],
    },
    {
      label: "ring",
      icon: bell,
      color: theme.base06,
      paths: (_, i) => draw({ at: at(7) + i * 0.2, over: 0.5 }),
      motion: shake({ at: 3.6, over: 1 }, { rotate: 16 }),
    },
  ],
];

/** The moon that the sun swaps for, in the same place. */
const swapIn: Cell = {
  label: "",
  icon: moon,
  color: theme.base0E,
  motion: enter({ at: 4.3, over: 0.6 }, { opacity: 0, scale: 0, rotate: -90 }, ease.pop),
};

function Place({ cell, x, y }: { cell: Cell; x: number; y: number }) {
  return (
    <g animation={cell.motion}>
      <Icon
        icon={cell.icon}
        x={x}
        y={y}
        size={SIZE}
        stroke={cell.color}
        fill={cell.color}
        strokeWidth={1.75}
        animation={cell.paths}
      />
    </g>
  );
}

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Icons",
      desc: "Eight Tabler icons arrive in eight ways: a rocket draws on, a heart pops, a box drops, a gear spins in, an eye comes into focus, wifi bars cascade, a sun swaps for a moon and a bell draws on and rings.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        {cells.flatMap((row, r) =>
          row.map((cell, c) => {
            const x = c * CELL + (CELL - SIZE) / 2;
            const y = ROWS[r]!;

            return (
              <>
                <Place cell={cell} x={x} y={y} />
                {cell.label === "swap" && <Place cell={swapIn} x={x} y={y} />}
                <g class="sans" animation={enter({ at: at(r * 4 + c), over: 0.5 })}>
                  <text
                    x={x + SIZE / 2}
                    y={y + SIZE + 28}
                    fontSize={12}
                    textAnchor="middle"
                    fill={theme.base03}
                  >
                    {cell.label}
                  </text>
                </g>
              </>
            );
          }),
        )}
        <g class="sans" animation={enter({ at: 2.8, over: 0.6 }, { opacity: 0, y: 6 })}>
          <text x={W / 2} y={H - 26} fontSize={12} textAnchor="middle" fill={theme.base03}>
            {"<Icon icon={rocket} animation={(d, i) => draw({ at: i * 0.14, over: 0.5 })} />"}
          </text>
        </g>
      </g>
    </>,
  );
}
