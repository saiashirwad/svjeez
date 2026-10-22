import { anim, frame, revealWindow, typewriter, type SvgNode } from "svg-motion";
import { buildAnimation, drawAnimation, fadeAnimation, riseAnimation } from "./motion";
import { C } from "./theme";
import { TreeRow, mono, ui } from "./ui";

export function NoteTree(): SvgNode {
  return (
    <>
      <g
        animation={fadeAnimation("rails", [0.83, 1.46])}
        stroke={C.rule}
        strokeOpacity=".06"
        strokeWidth={1}
      >
        <path d="M396 249V517" />
        <path d="M418 279V301M418 339V361M418 399V421" />
      </g>

      <TreeRow animation={buildAnimation(0)} x={411} y={246} bulletX={396} r={2.9} fill={C.gold} size={15} weight={600} color={C.ink}>
        What we know
      </TreeRow>
      <TreeRow animation={buildAnimation(1)} x={433} y={276} bulletX={418} r={2.4} fill="#6B6255" size={14} color={C.text}>
        Churn starts in week 3
      </TreeRow>
      <TreeRow animation={buildAnimation(2)} x={455} y={306} bulletX={440} r={2.1} fill={C.faint} size={13} color={C.textSoft}>
        Creators publish once, then stall
      </TreeRow>
      <TreeRow animation={buildAnimation(3)} x={433} y={336} bulletX={418} r={2.4} fill="#6B6255" size={14} color={C.text}>
        Support answers the same four questions
      </TreeRow>
      <TreeRow animation={buildAnimation(4)} x={455} y={366} bulletX={440} r={2.1} fill={C.faint} size={13} color={C.textSoft}>
        “Where is my draft?” · “Can I undo?”
      </TreeRow>
      <TreeRow animation={buildAnimation(5)} x={433} y={396} bulletX={418} r={2.4} fill="#6B6255" size={14} color={C.text}>
        Pricing promises a team plan we don’t ship
      </TreeRow>
      <TreeRow animation={buildAnimation(6)} x={455} y={426} bulletX={440} r={2.1} fill={C.faint} size={13} color={C.textSoft}>
        “Not this year.” — decision, Mar 12
      </TreeRow>

      <g animation={riseAnimation("mention", [4.47, 4.73], undefined, 5)}>
        <circle cx={418} cy={457} r={2.6} fill={C.gold} fillOpacity=".9" />
        <text x={433} y={462} {...ui(14, C.ink)}>
          Who has solved week-3 churn before?{" "}
          <tspan
            fill={C.gold}
            animation={anim("at-sign", [
              frame(0, { opacity: 0 }),
              frame(5.49, { opacity: 0 }),
              frame(5.59, { opacity: 1 }),
              frame(6.47, { opacity: 1 }),
              frame(6.58, { opacity: 0 }),
            ])}
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
          animation={anim("type-cover", typewriter({ start: 4.78, end: 5.51, distance: 266, steps: 38 }))}
        />
        <g animation={anim("cursor", revealWindow({
          in: [4.7, 4.78],
          out: [5.54, 5.64],
          from: { opacity: 0 },
          to: { opacity: 1 },
          exit: { opacity: 0 },
        }))}>
          <rect class="blink" x={701} y={447} width={1.5} height={16} fill={C.gold} />
        </g>
        <g animation={anim("chip-scout", [
          frame(0, { opacity: 0, y: 2 }),
          frame(6.47, { opacity: 0, y: 2 }),
          frame(6.68, { opacity: 1, y: 0 }),
        ])}>
          <rect x={690} y={448} width={58} height={20} rx={10} fill={C.sage} fillOpacity=".1" stroke={C.sage} strokeOpacity=".38" />
          <text x={700} y={462} {...mono(9.5, C.sageText)}>@Scout</text>
        </g>
      </g>

      <g animation={riseAnimation("reply-child", [12.27, 12.53], undefined, 5)}>
        <circle cx={440} cy={487} r={3.5} fill="none" stroke={C.sage} strokeOpacity=".85" strokeWidth={1.2} />
        <circle cx={440} cy={487} r={1.2} fill={C.sage} />
        <text x={455} y={492} {...ui(12.5, C.replyText)}>
          The bottleneck is the second post, not onboarding.
          <tspan dx={3} dy={-4} fontSize={8} fill={C.sage}>1</tspan>
        </text>
      </g>
      <path
        d="M418 465V487H436"
        pathLength={1}
        stroke={C.sage}
        strokeOpacity=".5"
        strokeWidth={1}
        strokeDasharray={1}
        fill="none"
        animation={drawAnimation("rail-reply", [12.32, 12.84], undefined, 0.55)}
      />

      <g animation={riseAnimation("atlas-mention", [14.5, 14.77], undefined, 5)}>
        <circle cx={418} cy={517} r={2.6} fill={C.lavender} fillOpacity=".9" />
        <rect x={433} y={507} width={58} height={20} rx={10} fill={C.lavender} fillOpacity=".1" stroke={C.lavender} strokeOpacity=".35" />
        <text x={443} y={521} {...mono(9.5, C.lavText)}>@Atlas</text>
        <text x={499} y={522} {...ui(14, C.ink)}>turn the fix into a two-week plan</text>
      </g>

      <g animation={riseAnimation("plan-node-1", [16.43, 16.74], undefined, 5)}>
        <circle cx={440} cy={547} r={2.4} fill={C.lavender} fillOpacity=".8" />
        <text x={455} y={552} {...ui(13, C.planText)}>Ship a template on first publish</text>
      </g>
      <g animation={riseAnimation("plan-node-2", [16.9, 17.21], undefined, 5)}>
        <circle cx={462} cy={577} r={2.1} fill={C.lavender} fillOpacity=".65" />
        <text x={477} y={582} {...ui(13, C.textSoft)}>Nudge at day two, from support macros</text>
      </g>
      <g animation={riseAnimation("plan-node-3", [17.37, 17.68], undefined, 5)}>
        <circle cx={440} cy={607} r={2.4} fill={C.lavender} fillOpacity=".8" />
        <text x={455} y={612} {...ui(13, C.planText)}>A/B the nudge against a blank canvas</text>
      </g>

      <path
        d="M418 525V607H436"
        pathLength={1}
        stroke={C.lavender}
        strokeOpacity=".5"
        strokeWidth={1}
        strokeDasharray={1}
        fill="none"
        animation={drawAnimation("rail-plan", [16.48, 17.63], undefined, 0.55)}
      />
      <path
        d="M440 555V577H458"
        pathLength={1}
        stroke={C.lavender}
        strokeOpacity=".4"
        strokeWidth={1}
        strokeDasharray={1}
        fill="none"
        animation={drawAnimation("rail-plan-nested", [16.95, 17.52], undefined, 0.45)}
      />

      <path
        d="M433 404H708"
        pathLength={1}
        stroke={C.coral}
        strokeOpacity=".55"
        strokeWidth={1.2}
        strokeDasharray={1}
        fill="none"
        animation={drawAnimation("conflict-line-1", [20.7, 21.16], undefined, 0.8)}
      />
      <path
        d="M455 434H650"
        pathLength={1}
        stroke={C.coral}
        strokeOpacity=".55"
        strokeWidth={1.2}
        strokeDasharray={1}
        fill="none"
        animation={drawAnimation("conflict-line-2", [20.9, 21.37], undefined, 0.8)}
      />
      <path
        d="M414 389H407V433H414"
        pathLength={1}
        stroke={C.coral}
        strokeOpacity=".55"
        strokeWidth={1}
        fill="none"
        strokeDasharray={1}
        animation={drawAnimation("conflict-bracket", [20.85, 21.42], undefined, 0.65)}
      />
      <g animation={fadeAnimation("neq", [21.1, 21.32])}>
        <circle cx={407} cy={411} r={8.5} fill={C.panel} />
        <text x={407} y={415} {...ui(9.5, C.coral, { textAnchor: "middle" })}>≠</text>
      </g>
    </>
  );
}
