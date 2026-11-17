/** @jsxImportSource svjeez */
import { ease, enter, Once, Pivot, span, wiggle, type SvgNode } from "svjeez";
import type { Hex } from "./color";

export type CropKind = "turnip" | "carrot" | "pumpkin";

/** 0 is seed, 1 a sprout, 2 leaves, 3 ready to pull. */
export type Growth = 0 | 1 | 2 | 3;

/** What each crop is called, what it sells for, and the seconds each stage of growing takes. */
export const CROPS = {
  turnip: { name: "Turnip", price: 8, seconds: 4 },
  carrot: { name: "Carrot", price: 12, seconds: 6 },
  pumpkin: { name: "Pumpkin", price: 20, seconds: 8 },
} as const satisfies {
  readonly [K in CropKind]: {
    readonly name: string;
    readonly price: number;
    readonly seconds: number;
  };
};

/** The box a crop is drawn in, and the point where it meets the soil. */
export const CROP = { width: 48, height: 60, root: { x: 24, y: 48 } } as const;

const Seeds = (): SvgNode => (
  <>
    {[-10, 0, 10].map((x) => (
      <>
        <ellipse cx={x} cy={-2} rx={5.5} ry={3} fill="#a8774f" />
        <ellipse cx={x} cy={-3.2} rx={1.8} ry={1.2} fill="#f0d9a8" />
      </>
    ))}
  </>
);

const Sprout = (): SvgNode => (
  <>
    {[-10, 0, 10].map((x) => (
      <path
        d={`M${x} 0V-7M${x} -7Q${x - 6} -12 ${x - 7} -6Q${x - 3} -5 ${x} -7Q${x + 6} -12 ${x + 7} -6Q${x + 3} -5 ${x} -7`}
        fill="#7ac74f"
        stroke="#4f9a3a"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    ))}
  </>
);

const Leaves = ({ fill, tall }: { readonly fill: Hex; readonly tall: number }): SvgNode => (
  <>
    {[-13, -6, 0, 6, 13].map((x, i) => (
      <path
        d={`M0 0Q${x * 0.6} ${-tall * 0.6} ${x} ${-tall + Math.abs(x) * 0.5}Q${x * 0.2} ${-tall * 0.5} 0 0`}
        fill={i % 2 === 0 ? fill : "#4f9a3a"}
      />
    ))}
  </>
);

const Ripe = ({ kind }: { readonly kind: CropKind }): SvgNode =>
  kind === "turnip" ? (
    <>
      <g transform="translate(0 -9)">
        <Leaves fill="#7ac74f" tall={20} />
      </g>
      <path d="M-10 -8C-10 -15 10 -15 10 -8C10 -1 4 3 0 5C-4 3 -10 -1 -10 -8Z" fill="#f6efe6" />
      <path d="M-10 -8C-10 -15 10 -15 10 -8C4 -6 -4 -6 -10 -8Z" fill="#c77dba" />
    </>
  ) : kind === "carrot" ? (
    <>
      <g transform="translate(0 -8)">
        <Leaves fill="#5fb85a" tall={24} />
      </g>
      <path d="M-7.5 -9C-7.5 -13 7.5 -13 7.5 -9L1.5 4C0.8 5.5 -0.8 5.5 -1.5 4Z" fill="#f08a3c" />
      <path d="M-4 -6H1M-1 -1H3" stroke="#d96f24" strokeWidth={1.4} strokeLinecap="round" />
    </>
  ) : (
    <>
      <ellipse cx={0} cy={-9} rx={17} ry={12} fill="#f08a3c" />
      <ellipse cx={0} cy={-9} rx={9} ry={12} fill="#f6a04e" />
      <ellipse cx={0} cy={-9} rx={3} ry={12} fill="#f08a3c" />
      <path
        d="M0 -20Q-1 -26 4 -27"
        fill="none"
        stroke="#4f9a3a"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path d="M2 -22Q10 -27 13 -21Q8 -19 2 -22" fill="#5fb85a" />
    </>
  );

/** A crop at one stage: it pops out of the soil once, then sways for as long as it stands. */
export const Crop = ({
  kind,
  growth,
}: {
  readonly kind: CropKind;
  readonly growth: Growth;
}): SvgNode => (
  <g transform={`translate(${CROP.root.x} ${CROP.root.y})`}>
    <Pivot
      origin={{ x: 0, y: 0 }}
      animation={
        growth > 0
          ? wiggle({ rotate: 3 }, { seed: `${kind}-${growth}`, rate: 1, period: 6 })
          : undefined
      }
    >
      <Once>
        <Pivot
          origin={{ x: 0, y: 0 }}
          animation={enter(span(0, 0.45), { scale: 0.2, opacity: 0 }, ease.pop)}
        >
          {growth === 0 ? (
            <Seeds />
          ) : growth === 1 ? (
            <Sprout />
          ) : growth === 2 ? (
            <Leaves
              fill={kind === "pumpkin" ? "#5fb85a" : "#7ac74f"}
              tall={kind === "carrot" ? 22 : 17}
            />
          ) : (
            <Ripe kind={kind} />
          )}
        </Pivot>
      </Once>
    </Pivot>
  </g>
);

/** A crop as it looks in the pack: ripe, and holding still. */
export const CropIcon = ({ kind }: { readonly kind: CropKind }): SvgNode => (
  <g transform="translate(24 34)">
    <Ripe kind={kind} />
  </g>
);
