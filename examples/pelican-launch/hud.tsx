import {
  Align,
  Group,
  Shape,
  Stack,
  Text,
  alpha,
  count,
  ease,
  enter,
  exit,
  line,
  numeral,
  rect,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { ivory, mono, slate } from "./kit";

const KM_PER_SECOND = 0.25;
const WINDOW = 8; // seconds of cadence on the sparkline
const PX_PER_SECOND = 12;
const STEP = 0.5; // seconds between cadence samples
const SPARK: Vec = [WINDOW * PX_PER_SECOND, 18];

const ink = ivory;
const faint = alpha(ivory, 0.62);
const plate = alpha(slate, 0.62);

/** Cadence in rpm: about 60, easing around with two slow incommensurate waves. */
const cadence = (t: number): number => 60 + 7 * Math.sin(t * 0.9) + 4 * Math.sin(t * 2.3 + 1);

const Label = ({ children }: { readonly children: string }): SceneElement => (
  <Text font={mono} size={10} letterSpacing={2.2} fill={faint}>
    {children}
  </Text>
);

/** The whole cadence trace as one static polyline, slid left at constant speed behind a window. */
const Sparkline = ({ length }: { readonly length: number }): SceneElement => {
  const samples = Math.ceil((length + WINDOW) / STEP);

  const points = Array.from({ length: samples + 1 }, (_, i): Vec => {
    const t = i * STEP - WINDOW;

    return [(t + WINDOW) * PX_PER_SECOND, SPARK[1] / 2 - (cadence(t) - 60) * 0.7];
  });

  return (
    <Group clip={rect(...SPARK, { radius: 3 })}>
      <Shape geometry={rect(...SPARK, { radius: 3 })} fill={alpha(ink, 0.08)} />
      <Shape
        geometry={line(...points)}
        stroke={{ color: ink, width: 1.4, cap: "round", join: "round" }}
        motion={{
          offset: track<Vec>([0, 0]).to([-length * PX_PER_SECOND, 0], span(0, length), ease.linear),
        }}
      />
    </Group>
  );
};

/**
 * A film-wide odometer in the top-right corner: kilometres ridden and a live cadence trace on a quiet translucent plate.
 * Place it above the shots on the film's root clock; `length` is the film's total seconds.
 */
export const Odometer = ({ length }: { readonly length: number }): SceneElement => {
  return (
    <Group
      motion={[
        enter(span(1, 1), { curve: ease.out }),
        exit(span(length - 2, 1), { curve: ease.inOut }),
      ]}
    >
      <Align place="top-right" inset={[24, 20]}>
        <Stack
          direction="column"
          gap={5}
          padding={[12, 10]}
          align="end"
          fill={plate}
          stroke={{ color: alpha(ivory, 0.22), width: 1 }}
          radius={10}
        >
          <Label>DISTANCE</Label>
          <Text font={mono} size={17} fill={ink}>
            {count(track(0).to(length * KM_PER_SECOND, span(0, length), ease.linear), {
              format: numeral({ decimals: 2, suffix: " km" }),
            })}
          </Text>
          <Label>CADENCE</Label>
          <Sparkline length={length} />
        </Stack>
      </Align>
    </Group>
  );
};
