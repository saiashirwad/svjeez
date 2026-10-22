import { anim, revealWindow, type SvgNode } from "svg-motion";
import { drawAnimation, fadeAnimation, riseAnimation } from "./motion";
import { C } from "./theme";
import { AgentAvatar, CardHeader, CardShell, MiniAvatar, PulseDots, Thread, mono, serif, ui } from "./ui";

const MENU_ROWS = [
  { cy: 476, x: 868, initial: "S", name: "Scout", role: "researcher", note: "reads sources", color: C.sage },
  { cy: 512, x: 868, initial: "A", name: "Atlas", role: "planner", note: "shapes branches", color: C.lavender },
  { cy: 548, x: 868, initial: "V", name: "Verity", role: "critic", note: "checks claims", color: C.blue },
];

const PLAN_ROWS = [
  { y: 592, number: "01", label: "Template on first publish" },
  { y: 612, number: "02", label: "Nudge at day two" },
  { y: 632, number: "03", label: "A/B against a blank canvas" },
];

const PLAN_WINDOWS: Array<[number, number]> = [
  [15.39, 15.65],
  [15.7, 15.96],
  [16.02, 16.28],
];

const planSlide = (name: string, window: [number, number]) =>
  anim(name, revealWindow({
    in: window,
    from: { opacity: 0, x: -3 },
    to: { opacity: 1, x: 0 },
  }));

export function Margin(): SvgNode {
  return (
    <>
      <line x1={812} y1={224} x2={812} y2={676} stroke={C.rule} strokeOpacity=".07" />
      <text x={836} y={232} {...mono(8, C.faint, { letterSpacing: 2 })}>MARGIN</text>
      <text x={1120} y={232} {...ui(8.5, C.faintest, { textAnchor: "end" })}>replies kept beside the thought</text>

      <Thread
        d="M772 458H832"
        endX={832}
        endY={458}
        color={C.sage}
        animation={drawAnimation("thread-scout", [5.72, 6.14], [14.25, 14.46], 1)}
      />
      <Thread
        d="M772 518H832"
        endX={832}
        endY={518}
        color={C.lavender}
        animation={drawAnimation("thread-atlas", [15.03, 15.5], [18.4, 18.62], 1)}
      />
      <Thread
        d="M772 411H832"
        endX={832}
        endY={411}
        color={C.coral}
        strokeOpacity={0.4}
        animation={drawAnimation("thread-verity", [19.76, 20.23], [23.56, 23.76], 1)}
      />

      <Menu />
      <Status />
      <ScoutCard />
      <AtlasCard />
      <VerityCard />
      <Digest />
    </>
  );
}

function Menu(): SvgNode {
  return (
    <g animation={anim("menu", revealWindow({
      in: [5.69, 6.03],
      out: [7.25, 7.47],
      from: { opacity: 0, y: 6 },
      to: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 0 },
    }))}>
      <rect x={836} y={422} width={284} height={160} rx={12} fill={C.card} stroke={C.lineSoft} filter="url(#float)" />
      <text x={852} y={441} {...mono(8, C.dim, { letterSpacing: 1.6 })}>MENTION AN AGENT</text>
      <text x={1104} y={441} {...mono(7.5, C.faintest, { textAnchor: "end" })}>ESC</text>
      <line x1={852} y1={450} x2={1104} y2={450} stroke={C.lineSoft} />

      {MENU_ROWS.map((row, index) => (
        <g key={`menu-row-${index}`} animation={riseAnimation(`menu-row-${index}`, [5.9 + index * 0.12, 6.24 + index * 0.12], undefined, 3)}>
          <MiniAvatar cx={854} cy={row.cy} initial={row.initial} color={row.color} />
          <text x={row.x} y={row.cy - 1} {...ui(11, C.ink, { fontWeight: 600 })}>{row.name}</text>
          <text x={row.x} y={row.cy + 11} {...ui(8.5, C.dim)}>{row.role}</text>
          <text x={1104} y={row.cy + 5} {...ui(8.5, C.faint, { textAnchor: "end" })}>{row.note}</text>
        </g>
      ))}

      <g animation={fadeAnimation("menu-select", [6.27, 6.53], [7.33, 7.47])}>
        <rect x={844} y={458} width={268} height={36} rx={7} fill={C.sage} fillOpacity=".08" stroke={C.sage} strokeOpacity=".24" />
        <rect x={844} y={466} width={2} height={20} rx={1} fill={C.sage} />
      </g>
    </g>
  );
}

function Status(): SvgNode {
  return (
    <g animation={anim("status", revealWindow({
      in: [7.72, 8.2],
      out: [8.74, 8.94],
      from: { opacity: 0, y: 4 },
      to: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 0 },
    }))}>
      <rect x={836} y={436} width={284} height={52} rx={10} fill={C.card} stroke={C.sage} strokeOpacity=".2" filter="url(#float)" />
      <AgentAvatar cx={858} cy={462} r={7} initial="S" color={C.sage} size={7} />
      <text x={874} y={459} {...ui(10.5, C.ink, { fontWeight: 600 })}>Scout</text>
      <text x={874} y={471} {...ui(8.5, C.dim)}>reading the branch above</text>
      <PulseDots x={1084} y={462} gap={8} color={C.sage} />
    </g>
  );
}

function ScoutCard(): SvgNode {
  return (
    <CardShell
      y={436}
      h={208}
      animation={anim("scout-card", revealWindow({
        in: [8.84, 9.2],
        out: [14.22, 14.48],
        from: { opacity: 0, y: 8 },
        to: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 0 },
      }))}
    >
      <CardHeader y={436} initial="S" name="Scout" role="researcher · reading 3 sources" meta="11s" color={C.sage} />

      <g animation={fadeAnimation("scout-thinking", [9.2, 9.4], [9.93, 10.09])}>
        <PulseDots x={854} y={503} color={C.sage} />
        <text x={880} y={507} {...ui(9, C.muted)}>reading Notion’s teardown</text>
      </g>

      <g animation={riseAnimation("answer-1", [9.93, 10.19], undefined, 3)}>
        <text x={852} y={530} {...ui(12, C.text)}>Notion’s 2024 teardown found the</text>
      </g>
      <g animation={riseAnimation("answer-2", [10.22, 10.48], undefined, 3)}>
        <text x={852} y={548} {...ui(12, C.text)}>
          drop is a <tspan fill={C.ink} fontWeight={600}>second-publish</tspan> problem,
        </text>
      </g>
      <g animation={riseAnimation("answer-3", [10.5, 10.76], undefined, 3)}>
        <text x={852} y={566} {...ui(12, C.text)}>not an onboarding one.</text>
      </g>

      <g animation={riseAnimation("sources", [10.87, 11.18], undefined, 3)}>
        <rect x={852} y={584} width={126} height={20} rx={5} fill={C.sage} fillOpacity=".07" stroke={C.sage} strokeOpacity=".22" />
        <text x={860} y={597} {...mono(8, C.sourceText)}>notion.so/teardown</text>
        <rect x={986} y={584} width={32} height={20} rx={5} fill={C.rule} fillOpacity=".04" stroke={C.rule} strokeOpacity=".08" />
        <text x={1002} y={597} {...mono(8, C.muted, { textAnchor: "middle" })}>+2</text>
      </g>

      <g animation={fadeAnimation("insert-button", [11.39, 11.65], [12.25, 12.38])}>
        <rect x={852} y={612} width={152} height={24} rx={6} fill={C.sage} fillOpacity=".07" stroke={C.sage} strokeOpacity=".28" />
        <text x={862} y={628} {...ui(9.5, C.sageText)}>Insert as child</text>
        <text x={992} y={628} {...mono(9, "#7E947E", { textAnchor: "end" })}>↵</text>
      </g>
      <g animation={fadeAnimation("inserted", [12.25, 12.43], [14.2, 14.35])}>
        <text x={852} y={628} {...mono(9, C.sage)}>✓</text>
        <text x={866} y={628} {...ui(9.5, C.sageText)}>inserted as a child node</text>
      </g>
    </CardShell>
  );
}

function AtlasCard(): SvgNode {
  return (
    <CardShell
      y={508}
      h={164}
      animation={anim("atlas-card", revealWindow({
        in: [15.03, 15.34],
        out: [18.43, 18.67],
        from: { opacity: 0, y: 8 },
        to: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 0 },
      }))}
    >
      <CardHeader y={508} initial="A" name="Atlas" role="planner · working from 2 nodes" meta="2 WEEKS" color={C.lavender} />

      <g animation={planSlide("plan-label", [15.39, 15.65])}>
        <text x={852} y={570} {...mono(8.5, "#8C7FAE", { letterSpacing: 1.4 })}>PLAN · 3 NODES</text>
      </g>
      {PLAN_ROWS.map((row, index) => (
        <g key={`plan-card-${index}`} animation={planSlide(`plan-card-${index + 1}`, PLAN_WINDOWS[index]!)}>
          <text x={852} y={row.y} {...mono(7.5, "#8C7FAE")}>{row.number}</text>
          <text x={870} y={row.y} {...ui(10.5, C.text)}>{row.label}</text>
        </g>
      ))}

      <g animation={fadeAnimation("atlas-writing", [15.39, 15.65], [16.48, 16.61])}>
        <PulseDots x={856} y={649} count={1} color={C.lavender} />
        <text x={864} y={652} {...ui(9, C.muted)}>writing into the branch</text>
      </g>
      <g animation={fadeAnimation("atlas-done", [16.48, 16.64], [18.36, 18.51])}>
        <text x={852} y={652} {...mono(9, C.lavender)}>✓</text>
        <text x={866} y={652} {...ui(9, C.lavText)}>3 nodes added beneath the mention</text>
      </g>
    </CardShell>
  );
}

function VerityCard(): SvgNode {
  return (
    <CardShell
      y={310}
      h={218}
      animation={anim("verity-card", revealWindow({
        in: [19.71, 20.05],
        out: [23.56, 23.79],
        from: { opacity: 0, y: 8 },
        to: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 0 },
      }))}
    >
      <CardHeader y={310} initial="V" name="Verity" role="critic · read the whole note" meta="JUST NOW" color={C.blue} />

      <text x={852} y={374} {...mono(8, C.coral, { letterSpacing: 1.4 })}>TWO NOTES DISAGREE</text>
      <g animation={riseAnimation("verity-body-1", [20.18, 20.44], undefined, 3)}>
        <text x={852} y={394} {...ui(12, C.text)}>Your pricing page promises a</text>
      </g>
      <g animation={riseAnimation("verity-body-2", [20.44, 20.7], undefined, 3)}>
        <text x={852} y={412} {...ui(12, C.text)}>team plan. This decision says</text>
      </g>
      <g animation={riseAnimation("verity-body-3", [20.7, 20.96], undefined, 3)}>
        <text x={852} y={430} {...ui(12, C.text)}>it isn’t shipping this year.</text>
      </g>
      <line x1={852} y1={446} x2={1104} y2={446} stroke={C.lineSoft} />

      <text x={852} y={464} {...mono(8, C.faint, { letterSpacing: 1.4 })}>SUGGESTED</text>
      <g animation={riseAnimation("verity-suggest", [20.9, 21.16], undefined, 3)}>
        <text x={852} y={484} {...serif(12, C.noteInk, { fontStyle: "italic" })}>Reconcile the promise, or</text>
        <text x={852} y={500} {...serif(12, C.noteInk, { fontStyle: "italic" })}>date the team plan.</text>
        <text x={852} y={518} {...ui(8.5, C.coral)}>Review both notes →</text>
      </g>
    </CardShell>
  );
}

function Digest(): SvgNode {
  return (
    <g animation={anim("close-digest", revealWindow({
      in: [23.92, 24.23],
      out: [25.77, 25.95],
      from: { opacity: 0, y: 6 },
      to: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 0 },
    }))}>
      <text x={836} y={494} {...mono(8, C.faint, { letterSpacing: 1.8 })}>TODAY IN THE MARGIN</text>
      <line x1={836} y1={504} x2={1104} y2={504} stroke={C.rule} strokeOpacity=".08" />
      <circle cx={840} cy={525} r={2.5} fill={C.sage} />
      <text x={852} y={529} {...ui(10.5, C.text)}>Scout</text>
      <text x={1104} y={529} {...ui(8.5, C.dim, { textAnchor: "end" })}>answered · 3 sources</text>
      <circle cx={840} cy={549} r={2.5} fill={C.lavender} />
      <text x={852} y={553} {...ui(10.5, C.text)}>Atlas</text>
      <text x={1104} y={553} {...ui(8.5, C.dim, { textAnchor: "end" })}>planned · 3 nodes</text>
      <circle cx={840} cy={573} r={2.5} fill={C.blue} />
      <text x={852} y={577} {...ui(10.5, C.text)}>Verity</text>
      <text x={1104} y={577} {...ui(8.5, C.dim, { textAnchor: "end" })}>flagged · 1 conflict</text>
    </g>
  );
}
