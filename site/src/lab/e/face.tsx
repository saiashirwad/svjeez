import { motion, shake, wiggle } from "svjeez";
import { blinkAt, Eye, Pivot } from "./bits";
import { r1, type Cx } from "./look";
import { INK, PINK } from "./palette";

const EYE_SPOTS = [
  [0, -0.55],
  [-0.74, 0.3],
  [0.74, 0.3],
  [0, 0.62],
  [-0.34, -0.8],
  [0.34, -0.8],
] as const;

export const Face = ({
  cx,
  r,
  face,
  eyes,
  ears,
  seed,
  mini,
}: {
  cx: Cx;
  r: number;
  face: number;
  eyes: number;
  ears: number;
  seed: string;
  mini?: boolean;
}) => {
  const { g, f, pal, ink, rand } = cx;
  const { horse, loaf, snout } = f;
  const blink = blinkAt(cx);
  const look = wiggle({ x: r * 0.12 }, { seed: `look${seed}`, rate: 1.2, period: 4 });
  const spread = ears <= 1 ? 0 : Math.min(85, 28 + ears * 11);

  const earList = Array.from({ length: ears }, (_, i) =>
    ears <= 1 ? 0 : -spread + (2 * spread * i) / (ears - 1),
  );

  const twitch = Math.floor(rand() * Math.max(1, ears));

  const earShape = (a: number, i: number) => {
    const rad = (a * Math.PI) / 180;
    const x = r * 0.82 * Math.sin(rad);
    const y = -r * 0.82 * Math.cos(rad);
    const h = r * (0.78 + horse * 0.5 - loaf * 0.45);
    const w = r * (0.7 - horse * 0.25);

    const shape = f.floppy
      ? `M${r1(-w * 0.4)} 0C${r1(-w * 0.7)} ${r1(h * 0.6)} ${r1(w * 0.2)} ${r1(h * 1.1)} ${r1(w * 0.45)} ${r1(h * 0.2)}Z`
      : f.boxy
        ? `M${r1(-w / 2)} 0Q0 ${r1(-h * 1.6)} ${r1(w / 2)} 0Z`
        : `M${r1(-w / 2)} 0L${r1(w * 0.05)} ${r1(-h)}L${r1(w / 2)} 0Z`;

    return (
      <g
        transform={`translate(${r1(x)} ${r1(y)}) rotate(${r1(f.floppy ? a + Math.sign(a || face) * 60 : a)})`}
      >
        <Pivot
          size={h}
          animation={
            i === twitch ? shake({ at: 2.4 + rand() * 4, over: 0.45 }, { rotate: 14 }) : undefined
          }
        >
          <path
            d={shape}
            fill={f.floppy ? pal.dark : pal.base}
            stroke={ink}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          {!f.floppy && !f.boxy && (
            <path
              d={`M${r1(-w * 0.22)} 0L${r1(w * 0.03)} ${r1(-h * 0.6)}L${r1(w * 0.22)} 0Z`}
              fill={PINK}
            />
          )}
        </Pivot>
      </g>
    );
  };

  const sx = face * r * (0.55 + snout * 0.55);
  const sy = r * (0.25 + horse * 0.2);
  const eyeR = eyes === 1 ? r * 0.4 : eyes === 2 ? r * 0.25 : r * 0.21;

  const eyePlaces: [number, number][] =
    eyes === 1
      ? [[0, -0.08]]
      : eyes === 0
        ? []
        : [
            [-0.38, -0.1],
            [0.38, -0.1],
            ...EYE_SPOTS.slice(0, eyes - 2).map(([x, y]) => [x, y] as [number, number]),
          ];

  const mouthAt = f.snouted ? { x: sx + face * r * 0.1, y: sy + r * 0.3 } : { x: 0, y: r * 0.42 };

  return (
    <>
      {earList.map(earShape)}
      {f.boxy ? (
        <rect
          x={r1(-r * 1.15)}
          y={r1(-r * 0.92)}
          width={r1(r * 2.3)}
          height={r1(r * 1.84)}
          rx={r1(r * 0.62)}
          fill={pal.base}
          stroke={ink}
          strokeWidth={2.6}
        />
      ) : (
        <ellipse
          rx={r1(r * (1.08 + horse * 0.1))}
          ry={r1(r)}
          fill={pal.base}
          stroke={ink}
          strokeWidth={2.6}
        />
      )}
      {f.boxy && (
        <path
          d={`M${r1(-r * 0.9)} ${r1(-r * 0.62)}Q0 ${r1(-r * 0.95)} ${r1(r * 0.9)} ${r1(-r * 0.62)}`}
          fill="none"
          stroke={pal.dark}
          strokeWidth={3}
          strokeLinecap="round"
        />
      )}
      {g.pattern === "tabby" && !mini && (
        <path
          d={`M${r1(-r * 0.3)} ${r1(-r * 0.92)}l${r1(r * 0.08)} ${r1(r * 0.28)}M0 ${r1(-r)}v${r1(r * 0.32)}M${r1(r * 0.3)} ${r1(-r * 0.92)}l${r1(-r * 0.08)} ${r1(r * 0.28)}`}
          stroke={pal.dark}
          strokeWidth={r1(Math.max(2, r * 0.1))}
          strokeLinecap="round"
        />
      )}
      {f.snouted && (
        <>
          <ellipse
            cx={r1(sx)}
            cy={r1(sy)}
            rx={r1(r * (0.4 + snout * 0.3))}
            ry={r1(r * 0.42)}
            fill={g.pattern === "socks" ? pal.light : pal.base}
            stroke={ink}
            strokeWidth={2.4}
          />
          <ellipse
            cx={r1(sx + face * r * (0.25 + snout * 0.25))}
            cy={r1(sy - r * 0.12)}
            rx={r1(r * 0.12)}
            ry={r1(r * 0.09)}
            fill={INK}
          />
        </>
      )}
      {eyePlaces.map(([x, y]) => (
        <Eye
          cx={cx}
          x={x * r + (f.snouted ? -face * r * 0.12 : 0)}
          y={y * r}
          r={eyeR}
          look={look}
          blink={blink}
        />
      ))}
      {!f.snouted && (
        <path
          d={`M${r1(-r * 0.09)} ${r1(r * 0.2)}h${r1(r * 0.18)}l${r1(-r * 0.09)} ${r1(r * 0.1)}Z`}
          fill={PINK}
          stroke={ink}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      )}
      <path
        d={`M${r1(mouthAt.x - r * 0.2)} ${r1(mouthAt.y - r * 0.05)}q${r1(r * 0.1)} ${r1(r * 0.14)} ${r1(r * 0.2)} 0q${r1(r * 0.1)} ${r1(r * 0.14)} ${r1(r * 0.2)} 0`}
        fill="none"
        stroke={ink}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {!f.floppy && !mini && rand() < 0.5 && (
        <rect
          x={r1(mouthAt.x - r * 0.07)}
          y={r1(mouthAt.y + r * 0.04)}
          width={r1(r * 0.14)}
          height={r1(r * 0.17)}
          rx={r1(r * 0.07)}
          fill={PINK}
          stroke={ink}
          strokeWidth={1}
          animation={motion({ opacity: 0 })
            .at(blink[1] - 1.6)
            .set({ opacity: 1 })
            .at(blink[1] - 0.5)
            .set({ opacity: 0 })}
        />
      )}
      {f.floppy && (
        <rect
          x={r1(mouthAt.x - r * 0.09)}
          y={r1(mouthAt.y + r * 0.04)}
          width={r1(r * 0.18)}
          height={r1(r * 0.26)}
          rx={r1(r * 0.09)}
          fill={PINK}
          stroke={ink}
          strokeWidth={1.2}
        />
      )}
      {!mini && !f.snouted && (
        <path
          d={[-1, 1]
            .map((s) =>
              [0.1, 0.24, 0.38]
                .map(
                  (y) =>
                    `M${r1(s * r * 0.5)} ${r1(r * y)}l${r1(s * r * 0.55)} ${r1((y - 0.24) * r * 0.8)}`,
                )
                .join(""),
            )
            .join("")}
          stroke={ink}
          strokeWidth={1}
          opacity={0.7}
        />
      )}
      {f.maned && (
        <path
          d={`M${r1(-face * r * 0.2)} ${r1(-r * 0.95)}l${r1(-face * r * 0.3)} ${r1(-r * 0.25)}l${r1(-face * r * 0.05)} ${r1(r * 0.35)}l${r1(-face * r * 0.35)} ${r1(-r * 0.15)}l${r1(-face * r * 0.0)} ${r1(r * 0.4)}`}
          fill={pal.dark}
          stroke={ink}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      )}
      {f.hat > 0 && (
        <g transform={`translate(0 ${r1(-r * 0.82)})`}>
          <rect
            x={r1(-r * 0.62)}
            y={r1(-r * f.hat)}
            width={r1(r * 1.24)}
            height={r1(r * f.hat)}
            rx={2}
            fill={INK}
          />
          <rect
            x={r1(-r * 0.62)}
            y={r1(-r * 0.32)}
            width={r1(r * 1.24)}
            height={r1(r * 0.16)}
            fill="#B33A3A"
          />
          <ellipse rx={r1(r * 1.02)} ry={r1(r * 0.17)} fill={INK} />
        </g>
      )}
    </>
  );
};
