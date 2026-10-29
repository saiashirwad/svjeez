import { def, ease, motion, type Child } from "svjeez";
import { Speech } from "./bits";
import { H, W } from "./geometry";
import { CAT } from "./layout";
import { r1, type Cx } from "./look";
import { INK } from "./palette";
import { QUIRK, QUIRK_AT } from "./quirk";

/** The quirk: the one odd thing this specimen does each loop, as motion on a wrapper around the whole creature. */
export const stage = (cx: Cx, creature: () => Child): Child => {
  const { g, lay } = cx;
  const midX = lay.ox + lay.center.x * lay.scale;
  if (g.quirk === "wrap")
    return (
      <g animation={motion({ x: 0 }).at(QUIRK_AT.at).to({ x: W }, 1.9, ease.inOut).set({ x: 0 })}>
        {creature()}
        <g transform={`translate(${-W} 0)`}>{creature()}</g>
      </g>
    );
  if (g.quirk === "split") {
    const half = (left: boolean) => (
      <g animation={motion({ x: 0, rotate: 0 }).at(QUIRK_AT.at).to({ x: left ? -36 : 36, rotate: left ? -6 : 6 }, 0.7, ease.pop).at(QUIRK_AT.at + 1.5).to({ x: 0, rotate: 0 }, 0.5, ease.in)}>
        <g clipPath={def.clipPath({}, <rect x={left ? -W : midX} y={-H} width={left ? midX + W : W * 2} height={H * 3} />)}>{creature()}</g>
      </g>
    );
    return (
      <>
        {half(true)}
        {half(false)}
      </>
    );
  }
  if (g.quirk === "float")
    return <g animation={motion({ y: 0, rotate: 0 }).at(QUIRK_AT.at).to({ y: -26, rotate: 360 }, 1.8, ease.inOut).to({ y: 0 }, 0.6, ease.pop)}>{creature()}</g>;
  if (g.quirk === "spin" && lay.heads.length === 0)
    return <g animation={motion({ rotate: 0 }).at(QUIRK_AT.at).to({ rotate: 360 }, 1.2, ease.inOut)}>{creature()}</g>;
  return creature();
};

/** The hat that drops over the first head. */
export const magicHat = (cx: Cx) => {
  const { g, lay } = cx;
  const first = lay.heads[0];
  const at = first
    ? { x: lay.ox + first.at.x * lay.scale, y: lay.oy + (first.at.y - first.r * 0.3) * lay.scale }
    : { x: lay.ox + lay.center.x * lay.scale, y: lay.oy + lay.center.y * lay.scale };
  const hr = (first?.r ?? lay.G) * lay.scale;
  return (
    g.quirk === "hat" && (
      <g transform={`translate(${r1(at.x)} ${r1(at.y)})`}>
        <g
          animation={motion({ y: -H, rotate: 0 })
            .at(QUIRK_AT.at)
            .to({ y: 0 }, 0.6, ease.in)
            .at(QUIRK_AT.hatLift)
            .to({ y: -H, rotate: 24 }, 0.9, ease.in)}
        >
          <rect x={r1(-hr * 1.1)} y={r1(-hr * 2.2)} width={r1(hr * 2.2)} height={r1(hr * 2.2)} rx={3} fill={INK} />
          <rect x={r1(-hr * 1.1)} y={r1(-hr * 0.55)} width={r1(hr * 2.2)} height={r1(hr * 0.28)} fill="#B33A3A" />
          <ellipse rx={r1(hr * 1.7)} ry={r1(hr * 0.3)} fill={INK} />
        </g>
      </g>
    )
  );
};

/** The word the specimen says when its quirk happens. */
export const quirkWord = (cx: Cx) => {
  const { g, lay } = cx;
  const word = QUIRK[g.quirk].word;
  const midX = lay.ox + lay.center.x * lay.scale;
  const topY = lay.oy + (Math.min(...lay.spine.map((p) => p.y)) - lay.G) * lay.scale;
  return (
    word && (
      <g transform={`translate(${r1(Math.min(W - 130, Math.max(40, midX + 30)))} ${r1(Math.max(34, topY - 8))})`}>
        <Speech cx={cx} text={word} size={18} delay={g.quirk === "hat" ? QUIRK_AT.at + 1.1 : QUIRK_AT.at - 0.5} />
      </g>
    )
  );
};

/** The scale bar in the corner. */
export const unitBar = (cx: Cx) => {
  const bar = CAT * cx.lay.scale;
  const x = W - 22 - bar;
  return (
    <g fontFamily="ui-monospace, 'SF Mono', Menlo, monospace" fontSize={11} fill={INK}>
      <path d={`M${r1(x)} 378v6H${W - 22}v-6`} fill="none" stroke={INK} strokeWidth={1.4} />
      <text x={W - 22} y={372} textAnchor="end" opacity={0.75}>
        1 cat
      </text>
    </g>
  );
};
