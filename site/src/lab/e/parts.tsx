import { ease, motion, sampled, wiggle } from "svjeez";
import { clamp } from "../util";
import { blinkAt, Eye, Pivot, Speech } from "./bits";
import { Face } from "./face";
import { DURATION, sub } from "./geometry";
import { wordFor, speechSize } from "./layout";
import { r1, type Cx } from "./look";
import { meltScale, partMotion } from "./motions";
import { INK } from "./palette";
import { QUIRK_AT } from "./quirk";
import { Tail } from "./tail";

export const legs = (cx: Cx) => {
  const { g, f, lay, pal, ink, rand } = cx;

  return lay.legs.map((l, i) => {
    const phase = (i * 0.19 + (i % 2) * 0.5) % 1;
    const swing = 20 - Math.min(10, g.legs);

    const walk = sampled(
      (t) => ({ rotate: Math.round(swing * Math.sin(Math.PI * 2 * (t - phase)) * 10) / 10 }),
      {
        duration: 1,
        step: 0.05,
        tolerance: { rotate: 0.8 },
      },
    ).loop(1);

    const paw = g.pattern === "socks" ? "#FFFFFF" : f.hoofed ? INK : pal.base;

    return (
      <g transform={`translate(${r1(l.at.x)} ${r1(l.at.y)})`}>
        <g animation={partMotion(cx, l.at, (rand() - 0.5) * 2)}>
          <g transform={`rotate(${r1(l.angle)})`}>
            <Pivot size={l.length + l.width} animation={[walk, f.liquid && meltScale(0.25)]}>
              <path
                d={`M0 0V${r1(l.length)}`}
                stroke={ink}
                strokeWidth={r1(l.width + 4.5)}
                strokeLinecap="round"
              />
              <path
                d={`M0 0V${r1(l.length)}`}
                stroke={pal.base}
                strokeWidth={r1(l.width)}
                strokeLinecap="round"
              />
              <ellipse
                cy={r1(l.length)}
                rx={r1(l.width * 0.78)}
                ry={r1(l.width * 0.55)}
                fill={paw}
                stroke={ink}
                strokeWidth={2}
              />
            </Pivot>
          </g>
        </g>
      </g>
    );
  });
};

export const tails = (cx: Cx) =>
  cx.lay.tails.map((t, i) => (
    <g transform={`translate(${r1(t.at.x)} ${r1(t.at.y)})`}>
      <g animation={partMotion(cx, t.at, (cx.rand() - 0.5) * 2)}>
        <g transform={`rotate(${r1(t.angle)})`}>
          <Tail cx={cx} length={t.length} width={t.width} seed={`${cx.g.seed}-${i}`} />
        </g>
      </g>
    </g>
  ));

export const bodyEyes = (cx: Cx) =>
  cx.lay.bodyEyes.map((e, i) => (
    <g animation={partMotion(cx, e, (cx.rand() - 0.5) * 2)}>
      <Eye
        cx={cx}
        x={e.x}
        y={e.y}
        r={e.r}
        look={wiggle({ x: e.r * 0.3 }, { seed: `be${i}${cx.g.seed}`, rate: 1.5, period: 4 })}
        blink={blinkAt(cx)}
      />
    </g>
  ));

export const heads = (cx: Cx) => {
  const { g, f, lay, pal, ink, rand } = cx;

  const spin =
    g.quirk === "spin"
      ? motion({ rotate: 0 }).at(QUIRK_AT.spin).to({ rotate: 360 }, 1, ease.inOut)
      : undefined;

  return lay.heads.map((h, i) => {
    const look = wiggle({ rotate: 11 }, { seed: `head${g.seed}${i}`, rate: 0.9, period: 4 });

    const orbit = lay.orbit
      ? sampled(
          (t) => {
            const a = (Math.PI * 2 * t) / DURATION + (Math.PI * 2 * i) / lay.heads.length;

            return { x: r1(lay.orbit!.rx * Math.cos(a)), y: r1(lay.orbit!.ry * Math.sin(a)) };
          },
          { duration: DURATION, step: 0.1, tolerance: { translate: 1 } },
        )
      : undefined;

    const vanish =
      g.quirk === "hat" && i === 0
        ? motion({ scale: 1 })
            .at(QUIRK_AT.at + 0.75)
            .set({ scale: 0.001 })
            .at(QUIRK_AT.back)
            .to({ scale: 1 }, 0.5, ease.pop)
        : undefined;

    const meow = 0.9 + i * 0.45;
    const neck = h.neck && sub(h.neck, h.at);

    return (
      <g transform={`translate(${r1(h.at.x)} ${r1(h.at.y)})`}>
        <g animation={[orbit, partMotion(cx, h.at, (rand() - 0.5) * 2), vanish]}>
          {neck && (
            <>
              <path
                d={`M0 0L${r1(neck.x)} ${r1(neck.y)}`}
                stroke={ink}
                strokeWidth={r1(h.r * 0.7 + 4.5)}
                strokeLinecap="round"
              />
              <path
                d={`M0 0L${r1(neck.x)} ${r1(neck.y)}`}
                stroke={pal.base}
                strokeWidth={r1(h.r * 0.7)}
                strokeLinecap="round"
              />
            </>
          )}
          <Pivot size={h.r * (1.9 + f.hat)} animation={[i === 0 ? spin : undefined, look]}>
            <Face cx={cx} r={h.r} face={h.face} eyes={g.eyes} ears={g.ears} seed={`${i}`} />
          </Pivot>
          <g transform={`translate(${r1(h.face * h.r * 0.55)} ${r1(-h.r * (1.45 + f.hat * 0.9))})`}>
            <Speech cx={cx} text={wordFor(g, i)} size={speechSize(h.r)} delay={meow} />
          </g>
        </g>
      </g>
    );
  });
};

/** A headless specimen still has something to say. */
export const headless = (cx: Cx) => {
  const { g, lay } = cx;
  const mid = lay.frames[Math.floor(lay.frames.length / 2)]!;

  return (
    lay.heads.length === 0 && (
      <g transform={`translate(${r1(mid.p.x)} ${r1(mid.p.y - lay.G * 0.9)})`}>
        <g animation={partMotion(cx, mid.p, 0)}>
          <Speech
            cx={cx}
            text={`(${wordFor(g, 0)})`}
            size={clamp(lay.G * 0.45, 12, 22)}
            delay={1.2}
          />
        </g>
      </g>
    )
  );
};
