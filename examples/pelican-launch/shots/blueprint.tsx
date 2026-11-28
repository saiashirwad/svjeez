import {
  Group,
  Shape,
  Text,
  alpha,
  arc,
  noise,
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
import { Caption, Chapter, H, W, horizon, mono } from "../kit";
import { Pelican, type Look } from "../rig";
import { BlueprintPaper } from "../textures";

export const BLUEPRINT = 7;

const chalk = "#E6EEFA";
const faint = "#B9CBE8";
const look: Look = { line: chalk, width: 1.5, frame: chalk, tyre: chalk, detail: true, far: 0.5 };

const ground = horizon(430, 1500);
const [cx, cy] = ground.center;

/**
 * Chalk grain: a still noise mask, so lines read as dragged over rough paper without any filter on moving content.
 * Luminance masks: white keeps the stroke, grey thins it.
 */
const Chalky = ({
  children,
  seed,
  floor = 0.3,
}: {
  readonly children: SceneElement | readonly SceneElement[];
  readonly seed: number;
  readonly floor?: number;
}): SceneElement => (
  <Group
    mask={
      <Shape
        geometry={rect(W, H)}
        fill={noise({
          frequency: [0.55, 0.7],
          octaves: 3,
          seed,
          ramp: [
            [0.3, alpha("#FFFFFF", floor)],
            [0.52, "#FFFFFF"],
          ],
        })}
      />
    }
  >
    {children}
  </Group>
);

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

/** Construction geometry: the plumb line, the datum, two dashed arcs above the deck, compass stars. */
const Construction = (): SceneElement => (
  <Chalky seed={4}>
    <Group opacity={0.8}>
      <Shape
        geometry={line([W / 2, 0], [W / 2, H])}
        stroke={{ color: faint, width: 1 }}
        draw={track(0).to(1, span(0.2, 1.4), ease.inOut)}
      />
      <Shape
        geometry={line([0, 300], [W, 300])}
        stroke={{ color: faint, width: 1, dash: [14, 5, 2, 5] }}
        draw={track(0).to(1, span(0.4, 1.4), ease.inOut)}
      />
      {[70, 140, 215].map((gap, i) => (
        <Shape
          key={gap}
          geometry={arc({ radius: ground.radius + gap, start: -90 - 24, sweep: 48 })}
          offset={ground.center}
          stroke={{ color: faint, width: 1.1, dash: [9, 7] }}
          draw={track(0).to(1, span(0.8 + i * 0.3, 1.8), ease.inOut)}
        />
      ))}
      {(
        [
          [184, 300],
          [1096, 300],
          [352, 150],
          [930, 150],
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
          geometry={line([x, 110], [x, 560])}
          stroke={{ color: faint, width: 0.7 }}
          draw={track(0).to(1, span(0.6, 1.6), ease.inOut)}
        />
      ))}
    </Group>
  </Chalky>
);

/** The deck: a doubled arc with radial struts and their brackets, turning slowly under the rider. Each stroke is a wide faint pass under a thin bright one, like chalk pressed hard. */
const Deck = (): SceneElement => (
  <Chalky seed={9} floor={0.2}>
    <Group offset={ground.center}>
      <Group rotate={track(0).to(-5, span(0, BLUEPRINT), ease.linear)} origin="own">
        <Shape
          geometry={ground.visible(70)}
          stroke={{ color: alpha(chalk, 0.3), width: 6 }}
          draw={track(0).to(1, span(0.3, 1.6), ease.inOut)}
        />
        <Shape
          geometry={ground.visible(70)}
          stroke={{ color: chalk, width: 2.6 }}
          draw={track(0).to(1, span(0.3, 1.6), ease.inOut)}
        />
        <Shape
          geometry={ground.visible(70)}
          scale={(ground.radius - 16) / ground.radius}
          origin="own"
          stroke={{ color: chalk, width: 1.4 }}
          draw={track(0).to(1, span(0.5, 1.6), ease.inOut)}
        />
        <Shape
          geometry={ground.visible(70)}
          scale={(ground.radius - 260) / ground.radius}
          origin="own"
          stroke={{ color: faint, width: 1, dash: [3, 6] }}
          draw={track(0).to(1, span(0.8, 1.6), ease.inOut)}
        />
        {Array.from({ length: 21 }, (_, i) => {
          const deg = -90 + (i - 10) * 3.2;
          const a = (deg * Math.PI) / 180;
          const at = (r: number): Vec => [r * Math.cos(a), r * Math.sin(a)];

          return (
            <Group key={i} motion={enter(span(1.1 + Math.abs(i - 10) * 0.06, 0.6))}>
              <Shape
                geometry={line(at(ground.radius - 18), at(ground.radius - 480))}
                stroke={{ color: chalk, width: 1.4 }}
              />
              <Shape
                geometry={rect(10, 14, { radius: 1, anchor: "center" })}
                offset={at(ground.radius - 26)}
                rotate={deg + 90}
                stroke={{ color: chalk, width: 1.2 }}
              />
            </Group>
          );
        })}
      </Group>
    </Group>
  </Chalky>
);

/** Small engineering notes: a wheel diameter, a beak length, and the title block. */
const Notes = (): SceneElement => (
  <Group motion={enter(span(3, 0.8))}>
    <Text font={mono} size={11} fill={faint} at={[48, 168]} letterSpacing={1.5}>
      ELEVATION A — PELICAN, SEATED, PEDALLING
    </Text>
    <Text font={mono} size={10} fill={faint} at={[48, 186]} letterSpacing={1.5}>
      DATUM +0.00 · PLUMB AT MIDSPAN
    </Text>
    <Text font={mono} size={10} fill={faint} at={[48, 204]} letterSpacing={1.5}>
      R = 1500 · ARC 70°
    </Text>
    <Group offset={[W - 300, 630]}>
      <Shape geometry={rect(260, 60)} fill="#10346C" stroke={{ color: faint, width: 1 }} />
      <Shape geometry={line([0, 30], [260, 30])} stroke={{ color: faint, width: 0.7 }} />
      <Text font={mono} size={11} fill={chalk} at={[12, 9]} letterSpacing={1}>
        CLAUDE PELICAN 1
      </Text>
      <Text font={mono} size={10} fill={faint} at={[12, 39]} letterSpacing={1}>
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
    {/* The shared horizon: the same chalk line as the deck's top arc, outside the turning group and undrawn, so it can morph. */}
    <Shape
      key="horizon"
      geometry={ground.visible(ground.reach)}
      offset={ground.center}
      stroke={{ color: chalk, width: 2.6 }}
    />
    <Chalky seed={21} floor={0.35}>
      <Group offset={[cx, cy]}>
        <Group motion={ride(ground.visible(70), travel, { turn: true })}>
          <Group
            offset={[0, -3]}
            scale={1.5}
            origin="own"
            motion={enter(span(1.4, 1), { from: { opacity: 0 } })}
          >
            <Pelican look={look} />
          </Group>
        </Group>
      </Group>
    </Chalky>
    <Notes />
    <Caption when={[1.4, 4.2]} fill={chalk}>
      Some days, the world is still being drawn.
    </Caption>
    <Chapter numeral="II" medium="Cyanotype" fill={chalk} length={BLUEPRINT} />
  </Group>
);
