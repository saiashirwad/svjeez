import { draw, ease, enter, motion, type SvgNode } from "svg-motion";
import { C } from "./theme";
import { TreeRow, mono, ui } from "./ui";

const build = (index: number) => enter({ at: 0.8 + index * 0.12, over: 0.45 }, { opacity: 0, y: 6 });

const blink = motion({ opacity: 1 }).at(0.55).set({ opacity: 0 }).loop(1.1);

export function NoteTree(): SvgNode {
  return (
    <>
      <g
        animation={enter({ at: 0.83, over: 0.63 })}
        stroke={C.rule}
        strokeOpacity={0.06}
        strokeWidth={1}
      >
        <path d="M396 249V517" />
        <path d="M418 279V301M418 339V361M418 399V421" />
      </g>

      <TreeRow animation={build(0)} x={411} y={246} bulletX={396} r={2.9} fill={C.gold} size={15} weight={600} color={C.ink}>
        What we know
      </TreeRow>
      <TreeRow animation={build(1)} x={433} y={276} bulletX={418} r={2.4} fill="#6B6255" size={14} color={C.text}>
        Churn starts in week 3
      </TreeRow>
      <TreeRow animation={build(2)} x={455} y={306} bulletX={440} r={2.1} fill={C.faint} size={13} color={C.textSoft}>
        Creators publish once, then stall
      </TreeRow>
      <TreeRow animation={build(3)} x={433} y={336} bulletX={418} r={2.4} fill="#6B6255" size={14} color={C.text}>
        Support answers the same four questions
      </TreeRow>
      <TreeRow animation={build(4)} x={455} y={366} bulletX={440} r={2.1} fill={C.faint} size={13} color={C.textSoft}>
        “Where is my draft?” · “Can I undo?”
      </TreeRow>
      <TreeRow animation={build(5)} x={433} y={396} bulletX={418} r={2.4} fill="#6B6255" size={14} color={C.text}>
        Pricing promises a team plan we don’t ship
      </TreeRow>
      <TreeRow animation={build(6)} x={455} y={426} bulletX={440} r={2.1} fill={C.faint} size={13} color={C.textSoft}>
        “Not this year.” — decision, Mar 12
      </TreeRow>

      <g animation={enter({ at: 4.47, over: 0.26 }, { opacity: 0, y: 5 })}>
        <circle cx={418} cy={457} r={2.6} fill={C.gold} fillOpacity={0.9} />
        <text x={433} y={462} {...ui(14, C.ink)}>
          Who has solved week-3 churn before?{" "}
          <tspan
            fill={C.gold}
            animation={motion({ fill: "transparent" }).at(5.49).to({ fill: C.gold }, 0.1).at(6.47).to({ fill: "transparent" }, 0.11)}
          >
            @
          </tspan>
        </text>
        <rect
          x={433}
          y={448}
          width={266}
          height={19}
          fill={C.panel}
          animation={motion().at(4.78).to({ x: 266 }, 0.73, ease.steps(38))}
        />
        <g animation={enter({ at: 4.7, over: 0.08 }).at(5.54).to({ opacity: 0 }, 0.1)}>
          <rect animation={blink} x={701} y={447} width={1.5} height={16} fill={C.gold} />
        </g>
        <g animation={enter({ at: 6.47, over: 0.21 }, { opacity: 0, y: 2 })}>
          <rect x={690} y={448} width={58} height={20} rx={10} fill={C.sage} fillOpacity={0.1} stroke={C.sage} strokeOpacity={0.38} />
          <text x={700} y={462} {...mono(9.5, C.sageText)}>@Scout</text>
        </g>
      </g>

      <g animation={enter({ at: 12.27, over: 0.26 }, { opacity: 0, y: 5 })}>
        <circle cx={440} cy={487} r={3.5} fill="none" stroke={C.sage} strokeOpacity={0.85} strokeWidth={1.2} />
        <circle cx={440} cy={487} r={1.2} fill={C.sage} />
        <text x={455} y={492} {...ui(12.5, C.replyText)}>
          The bottleneck is the second post, not onboarding.
          <tspan dx={3} dy={-4} fontSize={8} fill={C.sage}>1</tspan>
        </text>
      </g>
      <path
        d="M418 465V487H436"
        stroke={C.sage}
        strokeOpacity={0.5}
        strokeWidth={1}
        fill="none"
        opacity={0.55}
        animation={draw({ at: 12.32, over: 0.52 })}
      />

      <g animation={enter({ at: 14.5, over: 0.27 }, { opacity: 0, y: 5 })}>
        <circle cx={418} cy={517} r={2.6} fill={C.lavender} fillOpacity={0.9} />
        <rect x={433} y={507} width={58} height={20} rx={10} fill={C.lavender} fillOpacity={0.1} stroke={C.lavender} strokeOpacity={0.35} />
        <text x={443} y={521} {...mono(9.5, C.lavText)}>@Atlas</text>
        <text x={499} y={522} {...ui(14, C.ink)}>turn the fix into a two-week plan</text>
      </g>

      <g animation={enter({ at: 16.43, over: 0.31 }, { opacity: 0, y: 5 })}>
        <circle cx={440} cy={547} r={2.4} fill={C.lavender} fillOpacity={0.8} />
        <text x={455} y={552} {...ui(13, C.planText)}>Ship a template on first publish</text>
      </g>
      <g animation={enter({ at: 16.9, over: 0.31 }, { opacity: 0, y: 5 })}>
        <circle cx={462} cy={577} r={2.1} fill={C.lavender} fillOpacity={0.65} />
        <text x={477} y={582} {...ui(13, C.textSoft)}>Nudge at day two, from support macros</text>
      </g>
      <g animation={enter({ at: 17.37, over: 0.31 }, { opacity: 0, y: 5 })}>
        <circle cx={440} cy={607} r={2.4} fill={C.lavender} fillOpacity={0.8} />
        <text x={455} y={612} {...ui(13, C.planText)}>A/B the nudge against a blank canvas</text>
      </g>

      <path
        d="M418 525V607H436"
        stroke={C.lavender}
        strokeOpacity={0.5}
        strokeWidth={1}
        fill="none"
        opacity={0.55}
        animation={draw({ at: 16.48, over: 1.15 })}
      />
      <path
        d="M440 555V577H458"
        stroke={C.lavender}
        strokeOpacity={0.4}
        strokeWidth={1}
        fill="none"
        opacity={0.45}
        animation={draw({ at: 16.95, over: 0.57 })}
      />

      <path
        d="M433 404H708"
        stroke={C.coral}
        strokeOpacity={0.55}
        strokeWidth={1.2}
        fill="none"
        opacity={0.8}
        animation={draw({ at: 20.7, over: 0.46 })}
      />
      <path
        d="M455 434H650"
        stroke={C.coral}
        strokeOpacity={0.55}
        strokeWidth={1.2}
        fill="none"
        opacity={0.8}
        animation={draw({ at: 20.9, over: 0.47 })}
      />
      <path
        d="M414 389H407V433H414"
        stroke={C.coral}
        strokeOpacity={0.55}
        strokeWidth={1}
        fill="none"
        opacity={0.65}
        animation={draw({ at: 20.85, over: 0.57 })}
      />
      <g animation={enter({ at: 21.1, over: 0.22 })}>
        <circle cx={407} cy={411} r={8.5} fill={C.panel} />
        <text x={407} y={415} {...ui(9.5, C.coral, { textAnchor: "middle" })}>≠</text>
      </g>
    </>
  );
}
