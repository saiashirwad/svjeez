import {
  Group,
  Shape,
  Text,
  circle,
  displace,
  ease,
  enter,
  line,
  rect,
  ride,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Caption, H, W, horizon, mono } from "./kit";
import { Pelican, type Look } from "./rig";
import { BlueprintPaper } from "./textures";

export const BLUEPRINT = 7;

const chalk = "#E6EEFA";
const faint = "#B9CBE8";
const look: Look = { line: chalk, width: 1.5, frame: chalk, tyre: chalk, detail: true, far: 0.5 };

const ground = horizon(430, 1500);
const [cx, cy] = ground.center;

/** Chalk lines wobble a little, the way a ruling pen drags over rough paper. */
const rough = [displace({ scale: 2.2, frequency: 0.7, seed: 4, octaves: 2 })];

const Cross = ({ at, size }: { readonly at: Vec; readonly size: number }): SceneElement => (
  <Group offset={at}>
    <Shape geometry={line([-size, 0], [size, 0])} stroke={{ color: faint, width: 0.8 }} />
    <Shape geometry={line([0, -size], [0, size])} stroke={{ color: faint, width: 0.8 }} />
    <Shape
      geometry={line([-size * 0.6, -size * 0.6], [size * 0.6, size * 0.6])}
      stroke={{ color: faint, width: 0.6 }}
    />
    <Shape
      geometry={line([-size * 0.6, size * 0.6], [size * 0.6, -size * 0.6])}
      stroke={{ color: faint, width: 0.6 }}
    />
  </Group>
);

/** Construction geometry: the plumb line, the datum, two dashed arcs about the deck's centre, compass stars. */
const Construction = (): SceneElement => (
  <Group opacity={0.75} effects={rough}>
    <Shape
      geometry={line([W / 2, 0], [W / 2, H])}
      stroke={{ color: faint, width: 1 }}
      draw={track(0).to(1, span(0.2, 1.4), ease.inOut)}
    />
    <Shape
      geometry={line([0, 360], [W, 360])}
      stroke={{ color: faint, width: 1 }}
      draw={track(0).to(1, span(0.4, 1.4), ease.inOut)}
    />
    {[1310, 1400].map((radius, i) => (
      <Shape
        key={radius}
        geometry={circle(radius)}
        offset={ground.center}
        stroke={{ color: faint, width: 1.1, dash: [9, 7] }}
        motion={enter(span(0.8 + i * 0.3, 1), { curve: ease.out })}
      />
    ))}
    {(
      [
        [184, 360],
        [1096, 360],
        [352, 176],
        [930, 176],
      ] as const
    ).map((at, i) => (
      <Group
        key={i}
        motion={enter(span(1.2 + i * 0.15, 0.5), { from: { opacity: 0, scale: 0.4 } })}
      >
        <Cross at={at} size={14} />
      </Group>
    ))}
    {[180, 1100].map((x) => (
      <Shape
        key={x}
        geometry={line([x, 130], [x, 560])}
        stroke={{ color: faint, width: 0.7 }}
        draw={track(0).to(1, span(0.6, 1.6), ease.inOut)}
      />
    ))}
  </Group>
);

/** The deck: a doubled arc with radial struts and their brackets, turning slowly under the rider. */
const Deck = (): SceneElement => (
  <Group offset={ground.center}>
    <Group rotate={track(0).to(-5, span(0, BLUEPRINT), ease.linear)} origin="own" effects={rough}>
      <Shape
        geometry={ground.visible(70)}
        stroke={{ color: chalk, width: 3.2 }}
        draw={track(0).to(1, span(0.3, 1.6), ease.inOut)}
      />
      <Shape
        geometry={ground.visible(70)}
        scale={(ground.radius - 14) / ground.radius}
        origin="own"
        stroke={{ color: chalk, width: 1.6 }}
        draw={track(0).to(1, span(0.5, 1.6), ease.inOut)}
      />
      {Array.from({ length: 19 }, (_, i) => {
        const deg = -90 + (i - 9) * 3.4;
        const a = (deg * Math.PI) / 180;
        const at = (r: number): Vec => [r * Math.cos(a), r * Math.sin(a)];

        return (
          <Group key={i} motion={enter(span(1.1 + Math.abs(i - 9) * 0.06, 0.6))}>
            <Shape
              geometry={line(at(ground.radius - 18), at(ground.radius - 420))}
              stroke={{ color: chalk, width: 1.4 }}
            />
            <Shape
              geometry={rect(10, 14, { radius: 1 })}
              offset={at(ground.radius - 24)}
              rotate={deg + 90}
              stroke={{ color: chalk, width: 1.2 }}
            />
          </Group>
        );
      })}
    </Group>
  </Group>
);

/** Small engineering notes: a wheel diameter, a beak length, and the title block. */
const Notes = (): SceneElement => (
  <Group motion={enter(span(3, 0.8))}>
    <Text font={mono} size={11} fill={faint} at={[40, 680]} letterSpacing={1}>
      ELEVATION A — PELICAN, SEATED, PEDALLING
    </Text>
    <Group offset={[W - 300, 640]}>
      <Shape geometry={rect(260, 52)} stroke={{ color: faint, width: 1 }} />
      <Shape geometry={line([0, 26], [260, 26])} stroke={{ color: faint, width: 0.7 }} />
      <Text font={mono} size={11} fill={chalk} at={[12, 18]} letterSpacing={1}>
        CLAUDE PELICAN 1
      </Text>
      <Text font={mono} size={10} fill={faint} at={[12, 44]} letterSpacing={1}>
        SHEET 1 OF 1 · SCALE 1:1
      </Text>
    </Group>
  </Group>
);

const travel = track(0.43).to(0.53, span(0, BLUEPRINT), ease.linear);

export const Blueprint = (): SceneElement => (
  <Group>
    <BlueprintPaper />
    <Construction />
    <Deck />
    <Group offset={[cx, cy]}>
      <Group motion={ride(ground.visible(70), travel, { turn: true })}>
        <Group
          offset={[0, -3]}
          scale={0.95}
          origin="own"
          effects={rough}
          motion={enter(span(1.4, 1), { from: { opacity: 0 } })}
        >
          <Pelican look={look} />
        </Group>
      </Group>
    </Group>
    <Notes />
    <Caption when={[1.6, 4.8]} fill={chalk}>
      We trained a model to do one thing.
    </Caption>
  </Group>
);
