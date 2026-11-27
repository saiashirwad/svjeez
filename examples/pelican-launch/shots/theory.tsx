import { Tex } from "@svjeez/math";
import {
  Arrow,
  Group,
  Shape,
  alpha,
  circle,
  ease,
  enter,
  exit,
  line,
  morph,
  pattern,
  rect,
  ref,
  span,
  track,
  type Ref,
  type Span,
  type Anim,
  type Color,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Caption, Chapter, H, W, horizon, slate } from "../kit";
import { Pelican, joints, type Look } from "../rig";

export const THEORY = 7;

const paper = "#F7F5EC";
const ink = "#2B2A27";
const grid = "#A9C4D6";

/** One color per quantity, shared by the equation, the bones and the labels. */
const hue = { a: "#D2693F", b: "#3D74B6", c: "#3E8E5B", g: "#8B5BB8" } as const;

const look: Look = {
  line: alpha(ink, 0.75),
  width: 0.55,
  frame: alpha(ink, 0.6),
  tyre: alpha(ink, 0.6),
  leg: alpha(ink, 0.45),
  detail: false,
  far: 0.45,
};

/** Graph paper: a fine grid every 24 px and a heavier line every fifth. Static. */
const rule = (size: number, color: Color, width: number) =>
  pattern({
    size: [size, size],
    tile: (
      <Group>
        <Shape geometry={line([0, 0], [size, 0])} stroke={{ color, width }} />
        <Shape geometry={line([0, 0], [0, size])} stroke={{ color, width }} />
      </Group>
    ),
  });

const GraphPaper = (): SceneElement => (
  <Group>
    <Shape geometry={rect(W, H)} fill={paper} />
    <Shape geometry={rect(W, H)} fill={rule(24, alpha(grid, 0.45), 0.6)} />
    <Shape geometry={rect(W, H)} fill={rule(120, alpha(grid, 0.9), 1)} />
  </Group>
);

// The pelican rides 2.3x, with its ground point at BIKE. Everything that clings to the leg lives in that frame.
const BIKE: Vec = [455, 650];

/** The ground the pelican rides on, a gentle arc through its wheel: the shared horizon. */
const world = horizon(644, 3000);
const S = 2.3;
const EQ: Vec = [740, 560];
const phase = 0;
const pose = joints(phase);
const mid = (p: Vec, q: Vec): Vec => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
const thighMid = pose.knee.map((k) => mid(pose.hip, k));
const shinMid = pose.knee.with(pose.ankle).map(mid);
const reachMid = pose.ankle.map((a) => mid(pose.hip, a));

/** A bead that rides a joint or the middle of a bone, there for `Arrow`s to land on. */
const Bead = ({
  mark,
  at,
  color,
  r = 1.8,
}: {
  readonly mark: Ref;
  readonly at: Anim<Vec>;
  readonly color: Color;
  readonly r?: number;
}): SceneElement => (
  <Shape
    ref={mark}
    geometry={circle(r)}
    fill={color}
    stroke={{ color: paper, width: 0.6 }}
    motion={{ offset: at }}
  />
);

/** A colored, named piece of the formula: `\textcolor` for the paint, `\cssId` so arrows can find it. */
const term = (key: keyof typeof hue, tex: string, id?: string): string => {
  const painted = String.raw`\textcolor{${key}}{${tex}}`;

  return id ? String.raw`\cssId{${id}}{${painted}}` : painted;
};

const [a, b, c, g] = [
  (id?: string) => term("a", "a", id),
  (id?: string) => term("b", "b", id),
  (id?: string) => term("c", "c", id),
  (id?: string) => term("g", String.raw`\gamma`, id),
];

const numer = String.raw`${a("thigh")}^2 + ${b("shin")}^2 - ${c("reach")}^2`;

const steps = [
  String.raw`${c("reach")}^2 = ${a("thigh")}^2 + ${b("shin")}^2 - 2${a()}${b()}\cos ${g("knee")}`,
  String.raw`2${a()}${b()}\cos ${g()} = ${a()}^2 + ${b()}^2 - ${c()}^2`,
  String.raw`\cos ${g()} = \frac{${numer}}{2${a()}${b()}}`,
  String.raw`${g("knee")} = \arccos\frac{${numer}}{2${a()}${b()}}`,
];

const Equation = ({ mark, spans }: { readonly mark: Ref; readonly spans: readonly Span[] }) => (
  <Group ref={mark}>
    {morph.between(
      steps.map((src) => (
        <Tex key="eq" size={40} fill={ink} colors={hue} at={[EQ[0], EQ[1]]} anchor="left">
          {src}
        </Tex>
      )),
      spans,
      { curve: ease.inOut },
    )}
  </Group>
);

/** The four quantities: which bead on the leg, which named term in the formula, and the way the arrow bows. */
const links = [
  { part: "thigh", color: hue.a, bend: 0.2 },
  { part: "shin", color: hue.b, bend: 0.12 },
  { part: "reach", color: hue.c, bend: 0.05 },
  { part: "knee", color: hue.g, bend: 0.3 },
] as const;

/** Arrows from the formula's colored terms to the moving bones; they ride the beads, so they stay attached. */
const Links = ({
  eq,
  beads,
  when,
  keep = false,
}: {
  readonly eq: Ref;
  readonly beads: Record<(typeof links)[number]["part"], Ref>;
  readonly when: Span;
  readonly keep?: boolean;
}): SceneElement => (
  <Group>
    {links.map(({ part, color, bend }, i) => (
      <Arrow
        key={part}
        from={eq.part(`eq/${part}`).top}
        to={beads[part].center}
        bend={bend}
        inset={6}
        stroke={{ color, width: 1.6, cap: "round" }}
        draw={track(0).to(1, span(when.start + i * 0.12, 0.6), ease.inOut)}
        motion={[
          enter(span(when.start, 0.2)),
          !keep && exit(span(when.start + when.over - 0.3, 0.3)),
        ]}
      />
    ))}
  </Group>
);

export const Theory = (): SceneElement => {
  const [thighBead, shinBead, reachBead, gammaBead, eq] = [ref(), ref(), ref(), ref(), ref()];

  return (
    <Group>
      <GraphPaper />
      <Shape
        key="horizon"
        geometry={world.visible(world.reach)}
        offset={world.center}
        stroke={{ color: alpha(ink, 0.75), width: 2 }}
      />
      <Group offset={BIKE} scale={S} origin="own">
        <Pelican look={look} phase={phase} />
        <Shape geometry={pose.thigh} stroke={{ color: hue.a, width: 2.2 / S, cap: "round" }} />
        <Shape geometry={pose.shin} stroke={{ color: hue.b, width: 2.2 / S, cap: "round" }} />
        <Shape
          geometry={pose.reach}
          stroke={{ color: hue.c, width: 1.6 / S, dash: [6 / S, 5 / S] }}
        />
        <Shape geometry={pose.kneeArc} stroke={{ color: hue.g, width: 2 / S, cap: "round" }} />
        <Bead mark={thighBead} at={thighMid} color={hue.a} />
        <Bead mark={shinBead} at={shinMid} color={hue.b} />
        <Bead mark={reachBead} at={reachMid} color={hue.c} />
        <Bead mark={gammaBead} at={pose.knee} color={hue.g} />
      </Group>
      <Equation mark={eq} spans={[span(2.4, 0.7), span(3.2, 0.7), span(4, 0.7)]} />
      <Links
        eq={eq}
        beads={{ thigh: thighBead, shin: shinBead, reach: reachBead, knee: gammaBead }}
        when={span(0.9, 1.4)}
      />
      <Links
        eq={eq}
        beads={{ thigh: thighBead, shin: shinBead, reach: reachBead, knee: gammaBead }}
        when={span(4.9, 1.5)}
        keep
      />
      <Chapter numeral="IX" medium="Theory" fill={slate} length={THEORY} />
      <Caption when={[0.8, 5.6]} fill={ink}>
        Some days are all theory.
      </Caption>
    </Group>
  );
};
