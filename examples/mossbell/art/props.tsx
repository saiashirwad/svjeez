/** @jsxImportSource svjeez */
import { Clip, def, ease, motion, Pivot, span, wiggle, type SvgNode } from "svjeez";
import { shade, type Hex } from "./color";
import { nightGlow } from "./daylight";

/** Every prop is drawn around its base: the point on the ground it stands on, at 0,0, with up as negative y. */

const SHADOW = "rgba(30,50,20,0.22)";

const sway = (seed: string, by: number) => wiggle({ rotate: by }, { seed, rate: 1, period: 6 });

export type TreeKind = "oak" | "pine" | "blossom" | "apple";

const LEAVES = {
  oak: "#4f9a4a",
  pine: "#2f7d5b",
  blossom: "#f2a7c3",
  apple: "#5fa84e",
} as const satisfies { readonly [K in TreeKind]: Hex };

interface TreeProps {
  readonly kind: TreeKind;
  readonly seed: string;
  /** 1 is full size. */
  readonly size: number;
  readonly still?: boolean;
}

const Trunk = (): SvgNode => (
  <>
    <path d="M-7 0C-5.5 -14 -5 -24 -4.5 -40L4.5 -40C5 -24 5.5 -14 7 0Z" fill="#8a5a3c" />
    <path d="M1 0C2 -14 2 -24 1.5 -40L4.5 -40C5 -24 5.5 -14 7 0Z" fill="#74482f" />
  </>
);

const Pine = ({ fill }: { readonly fill: Hex }): SvgNode => (
  <>
    {[
      [34, -20, -68],
      [28, -46, -92],
      [20, -72, -116],
    ].map(([half = 0, bottom = 0, top = 0]) => (
      <>
        <path
          d={`M0 ${top}L${-half} ${bottom}L${half} ${bottom}Z`}
          fill={fill}
          stroke={fill}
          strokeWidth={7}
          strokeLinejoin="round"
        />
        <path
          d={`M0 ${top}L${-half} ${bottom}L${-half * 0.2} ${bottom}Z`}
          fill={shade(fill, 0.16)}
        />
      </>
    ))}
  </>
);

const Canopy = ({ fill, apples }: { readonly fill: Hex; readonly apples: boolean }): SvgNode => (
  <>
    <circle cx={0} cy={-58} r={32} fill={shade(fill, -0.2)} />
    <circle cx={-21} cy={-50} r={20} fill={shade(fill, -0.2)} />
    <circle cx={21} cy={-50} r={20} fill={shade(fill, -0.2)} />
    <circle cx={0} cy={-64} r={30} fill={fill} />
    <circle cx={-20} cy={-54} r={18} fill={fill} />
    <circle cx={20} cy={-55} r={18} fill={fill} />
    <circle cx={-9} cy={-74} r={18} fill={shade(fill, 0.16)} />
    <circle cx={12} cy={-62} r={11} fill={shade(fill, 0.16)} />
    <circle cx={-14} cy={-80} r={7} fill={shade(fill, 0.34)} />
    {apples &&
      [
        [-18, -52],
        [6, -48],
        [17, -66],
        [-4, -72],
        [-24, -64],
      ].map(([cx = 0, cy = 0]) => <circle cx={cx} cy={cy} r={3.6} fill="#e4572e" />)}
  </>
);

export const Tree = ({ kind, seed, size, still }: TreeProps): SvgNode => (
  <g transform={`scale(${size})`}>
    <ellipse cx={0} cy={0} rx={kind === "pine" ? 22 : 28} ry={9} fill={SHADOW} />
    <Trunk />
    <Pivot
      origin={{ x: 0, y: -30 }}
      animation={still ? undefined : sway(seed, kind === "pine" ? 1 : 1.8)}
    >
      {kind === "pine" ? (
        <Pine fill={LEAVES.pine} />
      ) : (
        <Canopy fill={LEAVES[kind]} apples={kind === "apple"} />
      )}
    </Pivot>
  </g>
);

export const Bush = ({ berries }: { readonly berries?: boolean }): SvgNode => (
  <>
    <ellipse cx={0} cy={0} rx={20} ry={6} fill={SHADOW} />
    <circle cx={-10} cy={-9} r={11} fill="#3f8a45" />
    <circle cx={10} cy={-9} r={11} fill="#3f8a45" />
    <circle cx={0} cy={-15} r={13} fill="#57a654" />
    <circle cx={-5} cy={-19} r={6} fill="#74bd63" />
    {berries &&
      [
        [-9, -10],
        [4, -14],
        [11, -7],
        [-1, -5],
      ].map(([cx = 0, cy = 0]) => <circle cx={cx} cy={cy} r={2.6} fill="#d1495b" />)}
  </>
);

export const Rock = (): SvgNode => (
  <>
    <ellipse cx={0} cy={0} rx={17} ry={5} fill={SHADOW} />
    <path
      d="M-15 0C-17 -9 -10 -17 -1 -17C8 -18 15 -11 15 -3C15 0 13 1 10 1L-11 1C-13 1 -15 1 -15 0Z"
      fill="#9aa3a8"
    />
    <path d="M-9 -9C-7 -14 0 -15 4 -13C0 -12 -5 -10 -9 -9Z" fill="#c3cacd" />
  </>
);

export const Stump = (): SvgNode => (
  <>
    <ellipse cx={0} cy={0} rx={16} ry={5} fill={SHADOW} />
    <path d="M-12 -12L-13 0C-8 3 8 3 13 0L12 -12Z" fill="#7a4e33" />
    <ellipse cx={0} cy={-12} rx={12} ry={4.5} fill="#d9b382" />
    <ellipse cx={0} cy={-12} rx={7} ry={2.5} fill="none" stroke="#b98c5a" strokeWidth={1} />
  </>
);

/** Five petals around a center, as one path. */
const petals = (cx: number, cy: number, r: number): string =>
  [0, 1, 2, 3, 4]
    .map((i) => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const x = (cx + Math.cos(a) * r).toFixed(1);
      const y = (cy + Math.sin(a) * r).toFixed(1);

      return `M${x} ${y}m${-r} 0a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
    })
    .join("");

export const Flower = ({
  color,
  seed,
  tall,
}: {
  readonly color: Hex;
  readonly seed: string;
  readonly tall?: boolean;
}): SvgNode => {
  const top = tall ? -30 : -12;
  const r = tall ? 4.6 : 2.6;

  return (
    <Pivot origin={{ x: 0, y: 0 }} animation={sway(seed, tall ? 4 : 6)}>
      <path
        d={`M0 0Q1 ${top / 2} 0 ${top}`}
        fill="none"
        stroke="#3f8a45"
        strokeWidth={tall ? 2.4 : 1.6}
        strokeLinecap="round"
      />
      {tall && (
        <path d="M0 -12Q-8 -16 -9 -10Q-4 -9 0 -12M0 -18Q8 -22 9 -16Q4 -15 0 -18" fill="#57a654" />
      )}
      <path d={petals(0, top, r)} fill={color} />
      <circle cx={0} cy={top} r={r * 0.8} fill={tall ? "#6b4226" : "#f6d55c"} />
    </Pivot>
  );
};

export const FenceAcross = ({ width }: { readonly width: number }): SvgNode => (
  <>
    <rect x={0} y={-15} width={width} height={3.5} fill="#c79a63" />
    <rect x={0} y={-8.5} width={width} height={3.5} fill="#b58752" />
    {[0, width / 2, width].map((x) => (
      <rect x={x - 2.5} y={-20} width={5} height={21} rx={1.5} fill="#d9b382" />
    ))}
  </>
);

export const FenceDown = ({ height }: { readonly height: number }): SvgNode => (
  <>
    <rect x={-1.5} y={-height - 12} width={3} height={height} fill="#b58752" />
    {[0, height / 2, height].map((y) => (
      <rect x={-2.5} y={-y - 20} width={5} height={21} rx={1.5} fill="#d9b382" />
    ))}
  </>
);

const Pane = ({ x, y }: { readonly x: number; readonly y: number }): SvgNode => (
  <>
    <rect x={x - 17} y={y - 17} width={34} height={34} rx={4} fill="#8b5a3c" />
    <rect x={x - 13.5} y={y - 13.5} width={27} height={27} rx={2} fill="#9fd3e6" />
    <rect
      x={x - 13.5}
      y={y - 13.5}
      width={27}
      height={27}
      rx={2}
      fill="#ffd97a"
      animation={nightGlow}
    />
    <path
      d={`M${x} ${y - 13.5}V${y + 13.5}M${x - 13.5} ${y}H${x + 13.5}`}
      stroke="#8b5a3c"
      strokeWidth={2.5}
    />
    <rect x={x - 20} y={y + 15} width={40} height={8} rx={2} fill="#a8683f" />
    {[-13, -5, 4, 12].map((dx, i) => (
      <circle cx={x + dx} cy={y + 13} r={3.6} fill={i % 2 === 0 ? "#e88fb4" : "#f6d55c"} />
    ))}
  </>
);

const Smoke = (): SvgNode => (
  <>
    {[0, 1, 2].map((i) => (
      <Clip at={i * 1.3}>
        <circle
          cx={i % 2 === 0 ? -2 : 3}
          cy={0}
          r={7}
          fill="#f4efe6"
          animation={motion({ opacity: 0, y: 0, scale: 0.5 })
            .to({ y: -52, scale: 1.7 }, span(0, 4), ease.linear)
            .to({ opacity: 0.75 }, span(0, 0.7))
            .to({ opacity: 0 }, span(2.2, 1.8), ease.in)
            .loop(4)}
        />
      </Clip>
    ))}
  </>
);

/** The cottage: 240 wide, door in the middle, walls 92 tall under a roof that rises to -206. */
export const Cottage = (): SvgNode => (
  <>
    <ellipse cx={0} cy={2} rx={128} ry={12} fill={SHADOW} />
    <rect x={70} y={-214} width={22} height={50} fill="#b0705a" />
    <rect x={66} y={-220} width={30} height={9} rx={2} fill="#8f5645" />
    <g transform="translate(81 -224)">
      <Smoke />
    </g>
    <rect x={-112} y={-92} width={224} height={92} fill="#f6e7c8" />
    <rect x={-112} y={-14} width={224} height={14} fill="#a8a29a" />
    <path d="M-112 -14H112" stroke="#8d877f" strokeWidth={2} />
    <path d="M-112 -92V0M112 -92V0M-38 -92V-14M38 -92V-14" stroke="#b58752" strokeWidth={6} />
    <path
      d="M-130 -88L-100 -196C-98 -203 -92 -206 -86 -206L86 -206C92 -206 98 -203 100 -196L130 -88Z"
      fill="#d9694a"
    />
    <path d="M-130 -88L-124 -110H124L130 -88Z" fill="#b8503a" />
    {[-132, -154, -176].map((y) => (
      <path
        d={`M${-118 - (y + 132) * 0.28} ${y}H${118 + (y + 132) * 0.28}`}
        stroke="#c25a40"
        strokeWidth={3}
        strokeDasharray="22 6"
        fill="none"
      />
    ))}
    <path
      d="M-100 -196C-98 -203 -92 -206 -86 -206L86 -206C92 -206 98 -203 100 -196Z"
      fill="#e88163"
    />
    <path d="M-20 0V-50C-20 -72 20 -72 20 -50V0Z" fill="#8b5a3c" />
    <path d="M-14 0V-49C-14 -64 14 -64 14 -49V0Z" fill="#a8683f" />
    <circle cx={8} cy={-26} r={2.4} fill="#f6d55c" />
    <rect x={-26} y={-4} width={52} height={6} rx={2} fill="#8d877f" />
    <Pane x={-74} y={-52} />
    <Pane x={74} y={-52} />
  </>
);

const Blade = ({ turn }: { readonly turn: number }): SvgNode => (
  <g transform={`rotate(${turn})`}>
    <path d="M0 0V-84" stroke="#74482f" strokeWidth={4} strokeLinecap="round" />
    <rect
      x={3}
      y={-82}
      width={19}
      height={62}
      rx={2}
      fill="#f6efdd"
      stroke="#c9b78f"
      strokeWidth={1.5}
    />
    <path d="M3 -66H22M3 -51H22M3 -36H22M12.5 -82V-20" stroke="#c9b78f" strokeWidth={1.2} />
  </g>
);

/** A stone windmill, 190 tall, with sails that turn about (0, -150). */
export const Windmill = (): SvgNode => (
  <>
    <ellipse cx={0} cy={2} rx={54} ry={12} fill={SHADOW} />
    <path d="M-44 0L-28 -150H28L44 0Z" fill="#d8d2c4" />
    <path d="M8 0L6 -150H28L44 0Z" fill="#c4bdae" />
    <path
      d="M-30 -40H-18M4 -70H18M-22 -100H-8M10 -118H20M-36 -18H-24M14 -30H30"
      stroke="#a9a293"
      strokeWidth={3}
      strokeLinecap="round"
    />
    <path d="M-34 -150C-30 -182 30 -182 34 -150Z" fill="#b8503a" />
    <path d="M-13 0V-30C-13 -46 13 -46 13 -30V0Z" fill="#8b5a3c" />
    <rect x={-9} y={-94} width={18} height={20} rx={9} fill="#5b6b8a" />
    <rect x={-9} y={-94} width={18} height={20} rx={9} fill="#ffd97a" animation={nightGlow} />
    <g transform="translate(0 -150)">
      <g
        animation={motion({ rotate: 0 }).to({ rotate: 360 }, span(0, 12), ease.linear).loop(12)}
        style="transform-box:view-box;transform-origin:0 0"
      >
        {[0, 90, 180, 270].map((turn) => (
          <Blade turn={turn} />
        ))}
      </g>
      <circle r={6.5} fill="#74482f" />
      <circle r={2.5} fill="#d9b382" />
    </g>
  </>
);

export const Well = (): SvgNode => (
  <>
    <ellipse cx={0} cy={2} rx={30} ry={8} fill={SHADOW} />
    <path d="M-20 -22V-62M20 -22V-62" stroke="#8b5a3c" strokeWidth={5} strokeLinecap="round" />
    <path
      d="M-30 -58L0 -80L30 -58Z"
      fill="#d9694a"
      stroke="#d9694a"
      strokeWidth={5}
      strokeLinejoin="round"
    />
    <path d="M0 -58V-34" stroke="#74482f" strokeWidth={1.5} />
    <rect x={-5} y={-36} width={10} height={9} rx={2} fill="#a8683f" />
    <path d="M-24 -22V-2C-24 6 24 6 24 -2V-22Z" fill="#a9a293" />
    <path
      d="M-24 -12C-10 -8 10 -8 24 -12M-8 -20V-9M9 -9V3M-16 -9V2"
      stroke="#8d877f"
      strokeWidth={1.6}
      fill="none"
    />
    <ellipse cx={0} cy={-22} rx={24} ry={7.5} fill="#c4bdae" />
    <ellipse cx={0} cy={-22} rx={17} ry={5} fill="#3d6f93" />
  </>
);

const glow = def.radialGradient(
  { cx: 0.5, cy: 0.5, r: 0.5 },
  <>
    <stop offset={0} stopColor="#ffe08a" stopOpacity={0.85} />
    <stop offset={0.4} stopColor="#ffd97a" stopOpacity={0.35} />
    <stop offset={1} stopColor="#ffd97a" stopOpacity={0} />
  </>,
);

/** Light that spills from a lamp or a window after dark. The world draws these above the night, so they cut through it. */
export const Glow = ({ r }: { readonly r: number }): SvgNode => (
  <circle r={r} fill={glow} animation={nightGlow} />
);

export const Lamp = (): SvgNode => (
  <>
    <ellipse cx={0} cy={1} rx={9} ry={3} fill={SHADOW} />
    <rect x={-2} y={-58} width={4} height={58} rx={2} fill="#4a4f5c" />
    <rect x={-5} y={-4} width={10} height={5} rx={2} fill="#3a3f4a" />
    <path d="M-8 -60H8L6 -76H-6Z" fill="#dfe8ea" />
    <path d="M-8 -60H8L6 -76H-6Z" fill="#ffd97a" animation={nightGlow} />
    <path d="M-10 -76H10L0 -86Z" fill="#3a3f4a" />
    <rect x={-9} y={-61} width={18} height={3} rx={1.5} fill="#3a3f4a" />
  </>
);

export const Sign = ({ text }: { readonly text: string }): SvgNode => (
  <>
    <ellipse cx={0} cy={1} rx={12} ry={3.5} fill={SHADOW} />
    <rect x={-2.5} y={-30} width={5} height={30} rx={1.5} fill="#8b5a3c" />
    <rect
      x={-26}
      y={-44}
      width={52}
      height={22}
      rx={4}
      fill="#d9b382"
      stroke="#a8683f"
      strokeWidth={2}
    />
    <text
      x={0}
      y={-29.5}
      textAnchor="middle"
      fontSize={9}
      fontWeight="bold"
      fill="#5b3a26"
      fontFamily="ui-rounded, system-ui, sans-serif"
    >
      {text}
    </text>
  </>
);

export const HayBale = (): SvgNode => (
  <>
    <ellipse cx={0} cy={1} rx={24} ry={6} fill={SHADOW} />
    <rect x={-21} y={-28} width={42} height={29} rx={7} fill="#e8c35a" />
    <rect x={-21} y={-28} width={42} height={10} rx={5} fill="#f3d77e" />
    <path d="M-9 -28V1M9 -28V1" stroke="#b98c3a" strokeWidth={2.5} />
  </>
);

export const Scarecrow = (): SvgNode => (
  <>
    <ellipse cx={0} cy={1} rx={12} ry={4} fill={SHADOW} />
    <rect x={-2} y={-40} width={4} height={40} fill="#8b5a3c" />
    <Pivot origin={{ x: 0, y: -8 }} animation={sway("scarecrow", 2.5)}>
      <path d="M-26 -42H26" stroke="#8b5a3c" strokeWidth={4} strokeLinecap="round" />
      <path d="M-18 -47H18L14 -22H-14Z" fill="#4f86c6" />
      <path d="M-18 -47H-26V-38H-17ZM18 -47H26V-38H17Z" fill="#3f6fa6" />
      <rect x={-5} y={-40} width={10} height={9} fill="#e4572e" />
      <circle cx={0} cy={-58} r={11} fill="#f0d9a8" />
      <path
        d="M-4 -60H-2M2 -60H4M-4 -54Q0 -51 4 -54"
        stroke="#5b3a26"
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx={0} cy={-66} rx={18} ry={4.5} fill="#c9963f" />
      <path d="M-10 -66C-10 -80 10 -80 10 -66Z" fill="#e3b85a" />
    </Pivot>
  </>
);

/** The crate the day's harvest is sold from. */
export const ShippingBin = (): SvgNode => (
  <>
    <ellipse cx={0} cy={1} rx={27} ry={6} fill={SHADOW} />
    <rect x={-23} y={-24} width={46} height={25} rx={3} fill="#a8683f" />
    <path d="M-23 -12H23M-8 -24V1M8 -24V1" stroke="#8b5a3c" strokeWidth={2} />
    <path d="M-26 -24L-20 -36H20L26 -24Z" fill="#c79a63" />
    <path d="M-20 -36H20" stroke="#d9b382" strokeWidth={3} strokeLinecap="round" />
    <circle cx={0} cy={-12} r={3} fill="#f6d55c" />
  </>
);

export const Mailbox = (): SvgNode => (
  <>
    <ellipse cx={0} cy={1} rx={8} ry={3} fill={SHADOW} />
    <rect x={-2} y={-28} width={4} height={28} fill="#8b5a3c" />
    <path d="M-11 -28V-36C-11 -46 11 -46 11 -36V-28Z" fill="#4f86c6" />
    <rect x={9} y={-44} width={2.5} height={10} fill="#d1495b" />
    <rect x={9} y={-45} width={8} height={5} fill="#d1495b" />
  </>
);

export const Bench = (): SvgNode => (
  <>
    <ellipse cx={0} cy={1} rx={30} ry={5} fill={SHADOW} />
    <path d="M-24 0V-14M24 0V-14" stroke="#74482f" strokeWidth={4} strokeLinecap="round" />
    <rect x={-28} y={-28} width={56} height={6} rx={2} fill="#c79a63" />
    <rect x={-28} y={-20} width={56} height={5} rx={2} fill="#b58752" />
    <rect x={-30} y={-14} width={60} height={6} rx={2} fill="#d9b382" />
  </>
);

/** A lily pad that bobs on the water. Ground decor: nothing walks behind it. */
export const LilyPad = ({
  seed,
  bloom,
}: {
  readonly seed: string;
  readonly bloom?: boolean;
}): SvgNode => (
  <g animation={wiggle({ y: 1.5, rotate: 5 }, { seed, rate: 0.6, period: 8 })}>
    <path d="M0 0L11 -3A11.5 7 0 1 0 10.5 4Z" fill="#4f9a6a" />
    <path d="M0 0L-8 -2M0 0L-5 4" stroke="#3f8a55" strokeWidth={1} />
    {bloom && (
      <>
        <path d={petals(-3, -2, 2.6)} fill="#f8d7e3" />
        <circle cx={-3} cy={-2} r={1.8} fill="#f6d55c" />
      </>
    )}
  </g>
);

export const Reeds = ({ seed }: { readonly seed: string }): SvgNode => (
  <Pivot origin={{ x: 0, y: 0 }} animation={sway(seed, 4)}>
    <path
      d="M-5 0Q-7 -14 -6 -24M0 0Q1 -18 0 -30M5 0Q8 -12 8 -20"
      fill="none"
      stroke="#5f9a4a"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <rect x={-7.5} y={-30} width={3.4} height={9} rx={1.7} fill="#7a4e33" />
    <rect x={-1.7} y={-37} width={3.4} height={10} rx={1.7} fill="#7a4e33" />
  </Pivot>
);

/** A four-point glint that fades in and out on water. */
export const Glint = ({
  at,
  period,
}: {
  readonly at: number;
  readonly period: number;
}): SvgNode => (
  <Clip at={at}>
    <path
      d="M0 -5Q0.8 -0.8 5 0Q0.8 0.8 0 5Q-0.8 0.8 -5 0Q-0.8 -0.8 0 -5Z"
      fill="#ffffff"
      animation={motion({ opacity: 0, scale: 0.4 })
        .to({ opacity: 0.9, scale: 1 }, span(0, 0.6))
        .to({ opacity: 0, scale: 0.4 }, span(0.9, 0.7), ease.in)
        .loop(period)}
    />
  </Clip>
);
