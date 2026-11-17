/** @jsxImportSource svjeez */
import { ease, motion, Pivot, span, type Motion, type SvgNode } from "svjeez";
import { shade, type Hex } from "./color";

export type HairStyle = "short" | "bob" | "long" | "puffs" | "spiky" | "bun";

export type Outfit = "tee" | "overalls" | "striped";

export type Hat = "none" | "straw" | "beanie";

/** Everything the wardrobe can change about a villager. */
export interface Look {
  readonly skin: Hex;
  readonly hair: HairStyle;
  readonly hairColor: Hex;
  readonly outfit: Outfit;
  readonly shirt: Hex;
  readonly pants: Hex;
  readonly hat: Hat;
  readonly accent: Hex;
}

export const OPTIONS = {
  skin: ["#fbe0c8", "#f3c9a5", "#e0a67c", "#c58656", "#9c6240", "#6f4530"],
  hair: ["short", "bob", "long", "puffs", "spiky", "bun"],
  hairColor: [
    "#3a2a26",
    "#6b4226",
    "#a8642c",
    "#e0b25a",
    "#d8573b",
    "#8d8fa8",
    "#f2ede4",
    "#5a7bd0",
    "#e58bb4",
    "#4f9a6a",
  ],
  outfit: ["tee", "overalls", "striped"],
  shirt: [
    "#e4572e",
    "#f2a541",
    "#f6d55c",
    "#76b041",
    "#3caea3",
    "#4f86c6",
    "#8e6bbf",
    "#e88fb4",
    "#f4efe6",
  ],
  pants: ["#3d5a80", "#5b4636", "#7a8f3c", "#444b5a", "#a65d57", "#c9a66b"],
  hat: ["none", "straw", "beanie"],
  accent: ["#d1495b", "#edae49", "#00798c", "#6a4c93", "#2f9e6e", "#f4efe6"],
} as const satisfies { readonly [K in keyof Look]: readonly Look[K][] };

export const DEFAULT_LOOK: Look = {
  skin: "#f3c9a5",
  hair: "bob",
  hairColor: "#6b4226",
  outfit: "overalls",
  shirt: "#f6d55c",
  pants: "#3d5a80",
  hat: "straw",
  accent: "#d1495b",
};

export type Facing = "down" | "up" | "side";

export type Gait = "idle" | "walk";

/** The box a character is drawn in, and the point between its feet. */
export const CHARACTER = { width: 64, height: 84, feet: { x: 32, y: 76 } } as const;

/** One walk cycle, in seconds. Every loop here divides {@link CHARACTER_LOOP}. */
const STEP = 0.5;

/** A scene length every character loop divides. */
export const CHARACTER_LOOP = 6;

const INK: Hex = "#2b2233";
const SHOE: Hex = "#4a3328";

interface Pose {
  readonly look: Look;
  readonly gait: Gait;
}

const lift = (gait: Gait, phase: 0 | 1, by: number): Motion<"x" | "y"> | undefined =>
  gait === "walk"
    ? motion({ y: 0 })
        .to({ y: -by }, span((phase * STEP) / 2, STEP / 4), ease.out)
        .to({ y: 0 }, span((phase * STEP) / 2 + STEP / 4, STEP / 4), ease.in)
        .loop(STEP)
    : undefined;

const swing = (gait: Gait, by: number): Motion<"rotate"> | undefined =>
  gait === "walk"
    ? motion({ rotate: by })
        .to({ rotate: -by }, span(0, STEP / 2), ease.inOut)
        .to({ rotate: by }, span(STEP / 2, STEP / 2), ease.inOut)
        .loop(STEP)
    : undefined;

const bob = (gait: Gait): Motion<"x" | "y"> =>
  gait === "walk"
    ? motion({ y: 0 })
        .to({ y: -1.6 }, span(0, STEP / 4), ease.out)
        .to({ y: 0 }, span(STEP / 4, STEP / 4), ease.in)
        .loop(STEP / 2)
    : motion({ y: 0 })
        .to({ y: 1 }, span(0, 1), ease.inOut)
        .to({ y: 0 }, span(1, 1), ease.inOut)
        .loop(2);

const blink = motion({ opacity: 1 }).set({ opacity: 0 }, 2.7).set({ opacity: 1 }, 2.84).loop(3);

const Shadow = (): SvgNode => (
  <ellipse cx={32} cy={76} rx={14} ry={4.5} fill="rgba(40,40,20,0.2)" />
);

const Leg = ({ x, pants }: { readonly x: number; readonly pants: Hex }): SvgNode => (
  <>
    <rect x={x} y={57} width={8.5} height={16} rx={3.6} fill={pants} />
    <rect x={x - 1} y={69.5} width={10.5} height={6.5} rx={3.2} fill={SHOE} />
  </>
);

const Arm = ({ x, look }: { readonly x: number; readonly look: Look }): SvgNode => (
  <>
    <rect x={x} y={42} width={8} height={16} rx={4} fill={shade(look.shirt, -0.12)} />
    <circle cx={x + 4} cy={58.5} r={3.7} fill={look.skin} />
  </>
);

const Torso = ({
  look,
  x,
  width,
}: {
  readonly look: Look;
  readonly x: number;
  readonly width: number;
}): SvgNode => (
  <>
    <rect x={x} y={39.5} width={width} height={23} rx={8} fill={look.shirt} />
    {look.outfit === "striped" && (
      <>
        <rect x={x + 1} y={46} width={width - 2} height={3.2} fill={shade(look.shirt, 0.45)} />
        <rect x={x + 0.5} y={53} width={width - 1} height={3.2} fill={shade(look.shirt, 0.45)} />
      </>
    )}
    {look.outfit === "overalls" && (
      <path
        d={`M${x} 55 h${width} v2 a8 8 0 0 1 -8 8 h${-(width - 16)} a8 8 0 0 1 -8 -8z`}
        fill={look.pants}
      />
    )}
  </>
);

const HAIR_CAP =
  "M15 29C13.5 12 24 8.5 32 8.500C40 8.5 50.5 12 49 29C47.5 24 45 20.5 41 19C35 22.5 27 22.5 23 19C19 20.5 16.5 24 15 29Z";

const BackHair = ({ look, side }: { readonly look: Look; readonly side?: boolean }): SvgNode => {
  if (look.hair !== "long" && look.hair !== "bob") return <></>;
  const to = look.hair === "long" ? 52 : 44;
  const fill = shade(look.hairColor, -0.12);

  return side ? (
    <path d={`M17 24C12 36 13 ${to - 4} 18 ${to}L30 ${to}C32 42 31 34 31 26Z`} fill={fill} />
  ) : (
    <path
      d={`M14.5 25C12 38 13.5 ${to - 3} 18 ${to}L46 ${to}C50.5 ${to - 3} 52 38 49.5 25Z`}
      fill={fill}
    />
  );
};

/** What a hair style adds on top of the cap: puffs, spikes or a bun. `cx` is the middle of the head. */
const HairExtras = ({
  look,
  cx,
  side,
}: {
  readonly look: Look;
  readonly cx: number;
  readonly side?: boolean;
}): SvgNode => {
  const fill = look.hairColor;
  const lit = shade(fill, 0.18);

  if (look.hair === "puffs")
    return side ? (
      <circle cx={cx - 14} cy={15} r={7.5} fill={fill} />
    ) : (
      <>
        <circle cx={cx - 15.5} cy={15.5} r={7.5} fill={fill} />
        <circle cx={cx + 15.5} cy={15.5} r={7.5} fill={fill} />
        <circle cx={cx - 17} cy={13.5} r={2.5} fill={lit} />
        <circle cx={cx + 14} cy={13.5} r={2.5} fill={lit} />
      </>
    );

  if (look.hair === "spiky")
    return (
      <path
        d={`M${cx - 12} 15L${cx - 9} 3.500L${cx - 4} 10.500L${cx} 1.500L${cx + 4} 10.500L${cx + 9} 3.500L${cx + 12} 15Z`}
        fill={fill}
        stroke={fill}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    );

  if (look.hair === "bun")
    return side ? (
      <circle cx={cx - 15} cy={13} r={6.5} fill={fill} />
    ) : (
      <>
        <circle cx={cx} cy={7.5} r={6.5} fill={fill} />
        <circle cx={cx - 2} cy={5.5} r={2} fill={lit} />
      </>
    );

  return <></>;
};

const HatOn = ({ look, cx }: { readonly look: Look; readonly cx: number }): SvgNode => {
  if (look.hat === "straw")
    return (
      <>
        <ellipse cx={cx} cy={17} rx={22.5} ry={6.5} fill="#e3b85a" />
        <ellipse cx={cx} cy={16} rx={22.5} ry={6} fill="#f0cf7a" />
        <path
          d={`M${cx - 12.5} 16C${cx - 12.5} 2 ${cx + 12.5} 2 ${cx + 12.5} 16Z`}
          fill="#f5dc94"
        />
        <path
          d={`M${cx - 12.3} 13.500Q${cx} 17.5 ${cx + 12.3} 13.5`}
          fill="none"
          stroke={look.accent}
          strokeWidth={3.2}
        />
      </>
    );

  if (look.hat === "beanie")
    return (
      <>
        <path
          d={`M${cx - 16.5} 20C${cx - 17} 3 ${cx + 17} 3 ${cx + 16.5} 20Z`}
          fill={look.accent}
        />
        <rect
          x={cx - 17}
          y={16.5}
          width={34}
          height={6.5}
          rx={3.2}
          fill={shade(look.accent, -0.18)}
        />
        <circle cx={cx} cy={5} r={4.2} fill={shade(look.accent, 0.3)} />
      </>
    );

  return <></>;
};

const Front = ({ look, gait }: Pose): SvgNode => (
  <>
    <Shadow />
    <g animation={lift(gait, 0, 4)}>
      <Leg x={22.5} pants={look.pants} />
    </g>
    <g animation={lift(gait, 1, 4)}>
      <Leg x={33} pants={look.pants} />
    </g>
    <g animation={bob(gait)}>
      <BackHair look={look} />
      <g animation={lift(gait, 1, 2.5)}>
        <Arm x={14} look={look} />
      </g>
      <g animation={lift(gait, 0, 2.5)}>
        <Arm x={42} look={look} />
      </g>
      <Torso look={look} x={20} width={24} />
      {look.outfit === "overalls" && (
        <>
          <rect x={24.5} y={46} width={15} height={12} rx={2.5} fill={look.pants} />
          <path d="M26 46V40M38 46V40" stroke={look.pants} strokeWidth={3} />
          <circle cx={26} cy={47.5} r={1.1} fill="#f6d55c" />
          <circle cx={38} cy={47.5} r={1.1} fill="#f6d55c" />
        </>
      )}
      {look.hair === "bun" && <HairExtras look={look} cx={32} />}
      <circle cx={16.5} cy={29.5} r={3.2} fill={shade(look.skin, -0.08)} />
      <circle cx={47.5} cy={29.5} r={3.2} fill={shade(look.skin, -0.08)} />
      <circle cx={32} cy={27} r={16} fill={look.skin} />
      <ellipse cx={22.5} cy={34} rx={3.2} ry={1.9} fill="#f08a8a" opacity={0.45} />
      <ellipse cx={41.5} cy={34} rx={3.2} ry={1.9} fill="#f08a8a" opacity={0.45} />
      <g animation={blink}>
        <ellipse cx={26} cy={29.5} rx={2.1} ry={2.9} fill={INK} />
        <ellipse cx={38} cy={29.5} rx={2.1} ry={2.9} fill={INK} />
        <circle cx={26.7} cy={28.3} r={0.8} fill="#ffffff" />
        <circle cx={38.7} cy={28.3} r={0.8} fill="#ffffff" />
      </g>
      <path
        d="M29.5 35.500Q32 37.8 34.5 35.5"
        fill="none"
        stroke="#8a4b3c"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <path d={HAIR_CAP} fill={look.hairColor} />
      <path
        d="M24 12.500C27 10.5 31 10 34 10.5"
        fill="none"
        stroke={shade(look.hairColor, 0.22)}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {look.hair !== "bun" && <HairExtras look={look} cx={32} />}
      <HatOn look={look} cx={32} />
    </g>
  </>
);

const Back = ({ look, gait }: Pose): SvgNode => (
  <>
    <Shadow />
    <g animation={lift(gait, 0, 4)}>
      <Leg x={22.5} pants={look.pants} />
    </g>
    <g animation={lift(gait, 1, 4)}>
      <Leg x={33} pants={look.pants} />
    </g>
    <g animation={bob(gait)}>
      <g animation={lift(gait, 1, 2.5)}>
        <Arm x={14} look={look} />
      </g>
      <g animation={lift(gait, 0, 2.5)}>
        <Arm x={42} look={look} />
      </g>
      <Torso look={look} x={20} width={24} />
      {look.outfit === "overalls" && (
        <path d="M26 54L37 40M38 54L27 40" stroke={look.pants} strokeWidth={3} />
      )}
      <circle cx={16.5} cy={29.5} r={3.2} fill={shade(look.skin, -0.08)} />
      <circle cx={47.5} cy={29.5} r={3.2} fill={shade(look.skin, -0.08)} />
      <circle cx={32} cy={27} r={16} fill={look.skin} />
      <circle cx={32} cy={25.3} r={16.6} fill={look.hairColor} />
      <BackHair look={look} />
      <path
        d="M22 16C26 12 34 11 40 13.5"
        fill="none"
        stroke={shade(look.hairColor, 0.2)}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <HairExtras look={look} cx={32} />
      <HatOn look={look} cx={32} />
    </g>
  </>
);

const SIDE_CAP =
  "M17 31C13.5 14 24 8.5 33 8.500C42 8.5 50 13 49.5 24.500C46.5 20.5 42.5 19 38.5 19C36.5 23 35.5 28 35 31.500C30.5 32 28.5 36.5 25 38C20.5 38.5 18 35 17 31Z";

/** Facing right. The stage mirrors it for left. */
const Side = ({ look, gait }: Pose): SvgNode => (
  <>
    <Shadow />
    <g animation={bob(gait)}>
      <Pivot origin={{ x: 32, y: 44 }} animation={swing(gait, -26)}>
        <rect x={28} y={42} width={8} height={16} rx={4} fill={shade(look.shirt, -0.28)} />
        <circle cx={32} cy={58.5} r={3.7} fill={shade(look.skin, -0.12)} />
      </Pivot>
    </g>
    <Pivot origin={{ x: 32, y: 58 }} animation={swing(gait, 24)}>
      <rect x={27.5} y={57} width={8.5} height={16} rx={3.6} fill={shade(look.pants, -0.2)} />
      <rect x={27} y={69.5} width={11.5} height={6.5} rx={3.2} fill={shade(SHOE, -0.2)} />
    </Pivot>
    <Pivot origin={{ x: 32, y: 58 }} animation={swing(gait, -24)}>
      <rect x={27.5} y={57} width={8.5} height={16} rx={3.6} fill={look.pants} />
      <rect x={27} y={69.5} width={11.5} height={6.5} rx={3.2} fill={SHOE} />
    </Pivot>
    <g animation={bob(gait)}>
      <BackHair look={look} side />
      <Torso look={look} x={23} width={18} />
      {look.outfit === "overalls" && (
        <>
          <rect x={31} y={46} width={10} height={12} rx={2.5} fill={look.pants} />
          <path d="M33 46V40" stroke={look.pants} strokeWidth={3} />
        </>
      )}
      <Pivot origin={{ x: 32, y: 44 }} animation={swing(gait, 26)}>
        <rect x={28} y={42} width={8} height={16} rx={4} fill={shade(look.shirt, -0.12)} />
        <circle cx={32} cy={58.5} r={3.7} fill={look.skin} />
      </Pivot>
      <circle cx={33} cy={27} r={16} fill={look.skin} />
      <circle cx={49} cy={30.5} r={1.9} fill={look.skin} />
      <ellipse cx={43.5} cy={34.5} rx={3} ry={1.8} fill="#f08a8a" opacity={0.45} />
      <g animation={blink}>
        <ellipse cx={42} cy={29.5} rx={1.9} ry={2.9} fill={INK} />
        <circle cx={42.6} cy={28.3} r={0.8} fill="#ffffff" />
      </g>
      <path
        d="M44.5 36.500Q46.5 37.6 48 36.2"
        fill="none"
        stroke="#8a4b3c"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <path d={SIDE_CAP} fill={look.hairColor} />
      <circle cx={30} cy={31} r={3} fill={shade(look.skin, -0.08)} />
      <path
        d="M24 13C27 11 31 10 35 10.5"
        fill="none"
        stroke={shade(look.hairColor, 0.22)}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <HairExtras look={look} cx={33} side />
      <HatOn look={look} cx={33} />
    </g>
  </>
);

export interface CharacterProps extends Pose {
  readonly facing: Facing;
}

/** A villager in one pose, drawn in the {@link CHARACTER} box. Every motion loops, so a pose can play forever. */
export const Character = ({ look, facing, gait }: CharacterProps): SvgNode =>
  facing === "down" ? (
    <Front look={look} gait={gait} />
  ) : facing === "up" ? (
    <Back look={look} gait={gait} />
  ) : (
    <Side look={look} gait={gait} />
  );

/** A look picked from the wardrobe by a seeded stream of numbers from 0 up to 1. */
export const randomLook = (next: () => number): Look => {
  const pick = <T,>(from: readonly T[]): T => {
    const found = from[Math.floor(next() * from.length)];

    if (found === undefined) throw new Error("randomLook() needs a stream of numbers below 1.");

    return found;
  };

  return {
    skin: pick(OPTIONS.skin),
    hair: pick(OPTIONS.hair),
    hairColor: pick(OPTIONS.hairColor),
    outfit: pick(OPTIONS.outfit),
    shirt: pick(OPTIONS.shirt),
    pants: pick(OPTIONS.pants),
    hat: pick(OPTIONS.hat),
    accent: pick(OPTIONS.accent),
  };
};
