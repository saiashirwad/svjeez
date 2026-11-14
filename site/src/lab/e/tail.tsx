import { Pivot, wiggle, type Child, type Stack } from "svjeez";
import { blinkAt, Eye, Speech } from "./bits";
import { Face } from "./face";
import { tailTip } from "./layout";
import { r1, type Cx } from "./look";

/** A tail and what's on the end of it, pointing up from 0,0 before its rotation. */
export const Tail = ({
  cx,
  length: Lt,
  width: tw,
  seed,
  wag,
}: {
  cx: Cx;
  length: number;
  width: number;
  seed: string;
  wag: Stack<"rotate">;
}) => {
  const { g, pal, ink, rand, lay } = cx;
  const c = Lt * 0.22;
  const d = `M0 0C${r1(c)} ${r1(-Lt * 0.35)} ${r1(-c * 1.4)} ${r1(-Lt * 0.6)} ${r1(c * 0.4)} ${r1(-Lt * 0.86)}S${r1(c * 1.5)} ${r1(-Lt * 1.04)} ${r1(c * 1.1)} ${r1(-Lt)}`;
  const tip = tailTip(Lt);

  const stroke = (dd: string, w: number) => (
    <>
      <path d={dd} fill="none" stroke={ink} strokeWidth={r1(w + 4.5)} strokeLinecap="round" />
      <path d={dd} fill="none" stroke={pal.base} strokeWidth={r1(w)} strokeLinecap="round" />
      {g.pattern === "tabby" && (
        <path
          d={dd}
          fill="none"
          stroke={pal.dark}
          strokeWidth={r1(w * 0.85)}
          strokeDasharray={`${r1(w * 0.5)} ${r1(w * 0.9)}`}
        />
      )}
    </>
  );

  let end: Child;

  if (g.tip === "tuft")
    end = (
      <circle
        cx={r1(tip.x)}
        cy={r1(tip.y)}
        r={r1(tw * 0.85)}
        fill={pal.dark}
        stroke={ink}
        strokeWidth={2}
      />
    );
  else if (g.tip === "eye")
    end = (
      <Eye
        cx={cx}
        x={tip.x}
        y={tip.y}
        r={tw * 1.25}
        look={wiggle({ x: tw * 0.4 }, { seed: `tail${seed}`, rate: 2, period: 2 })}
        blink={blinkAt(cx)}
      />
    );
  else if (g.tip === "kitten") {
    const kr = Math.max(9, lay.G * 0.32);
    end = (
      <g transform={`translate(${r1(tip.x)} ${r1(tip.y - kr * 0.6)})`}>
        <Pivot animation={wiggle({ rotate: 18 }, { seed: `kit${seed}`, rate: 1.5, period: 4 })}>
          <Face cx={cx} r={kr} face={1} eyes={2} ears={2} seed={`k${seed}`} mini />
        </Pivot>
        <g transform={`translate(${r1(kr * 0.8)} ${r1(-kr * 1.4)})`}>
          <Speech cx={cx} text="mew" size={Math.max(10, kr * 0.8)} delay={3.3 + rand() * 0.6} />
        </g>
      </g>
    );
  } else {
    const branch = (a: number, i: number) => (
      <g transform={`translate(${r1(tip.x)} ${r1(tip.y)}) rotate(${a})`}>
        <Pivot animation={wiggle({ rotate: 20 }, { seed: `fork${seed}${i}`, rate: 2, period: 2 })}>
          {stroke(
            `M0 0C${r1(Lt * 0.06)} ${r1(-Lt * 0.12)} ${r1(-Lt * 0.06)} ${r1(-Lt * 0.2)} 0 ${r1(-Lt * 0.3)}`,
            tw * 0.7,
          )}
          <circle
            cy={r1(-Lt * 0.3)}
            r={r1(tw * 0.6)}
            fill={pal.dark}
            stroke={ink}
            strokeWidth={1.6}
          />
        </Pivot>
      </g>
    );

    end = <>{[-38, 34].map(branch)}</>;
  }

  return (
    <Pivot animation={wag}>
      {stroke(d, tw)}
      {end}
    </Pivot>
  );
};
