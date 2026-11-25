/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  circle,
  ease,
  path,
  span,
  track,
  type Curve,
  type SceneElement,
  type Track,
  type Vec,
} from "svjeez";
import type { Token } from "svjeez/tools";

/** One state's mouse in scene units, and when the scene moves into that state. */
export interface Beat {
  /** Undefined while the mouse has not moved yet. */
  readonly pointer?: { readonly at: Vec; readonly down: boolean; readonly presses: readonly Vec[] };
  /** When the move into this state starts. */
  readonly start: number;
  /** How long it takes. */
  readonly over: number;
  /** How long the previous state rests: a press is reached in its last part. */
  readonly rest: number;
  /** When this state ends. */
  readonly end: number;
  /** The move's easing, the same as the page's morph. */
  readonly curve?: Curve;
}

/** A pointer arrow with its tip at [0, 0]: dark with a light edge, so it reads on either scheme. */
const ARROW = path.parse("M0 0V17.6l4.6-4.2 3.3 7.5 3.1-1.3-3.3-7.3H13.2Z");
const INK = "#111111" as const;
const EDGE = "#ffffff" as const;

/** The press ring: dark on a light page, light on a dark one. */
const RING: Token = {
  kind: "token",
  name: "svjeez-cursor-ring",
  light: "#111111",
  dark: "#ffffff",
};

/** The longest the arrow takes to reach a press before the page reacts to it. */
const LEAD = 0.45;

/** The arrow's scale while a button is down. */
const PRESSED = 0.82;

/** Seconds the arrow takes to dip on a press, to come back on a release, and to fade in or out. */
const DIP = 0.08;

const RELEASE = 0.16;

const FADE = 0.2;

const same = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5;

/**
 * The mouse as its own layer over the page: an arrow whose `at` steps with the states' moves (on the morph's easing),
 * reaching each press just before the page reacts to it, dipping while a button is down, with a ring where it went down.
 */
const cursor = (beats: readonly Beat[]): SceneElement | undefined => {
  const first = beats.find((beat) => beat.pointer)?.pointer;

  if (!first) return undefined;

  const start = beats[0]!.pointer;
  let at: Track<Vec> = track<Vec>(start?.at ?? first.at);
  let opacity = track(start ? 1 : 0);
  let scale = track(start?.down ? PRESSED : 1);
  let last = start?.at ?? first.at;
  let down = start?.down ?? false;
  let shown = !!start;
  const rings: SceneElement[] = [];

  beats.slice(1).forEach(({ pointer, start, over, rest, end, curve = ease.inOut }, i) => {
    const move = Math.max(over, FADE);

    if (!pointer) {
      if (shown) opacity = opacity.to(0, span(start, move));
      shown = false;

      return;
    }

    const [press] = pointer.presses;

    if (!shown) {
      const place = press ?? pointer.at;

      if (!same(last, place)) at = at.set(place, span(start));
      opacity = opacity.to(1, span(start, move));
      last = place;
      shown = true;
    }

    if (press) {
      const lead = Math.min(LEAD, rest);

      if (lead > 0.05 && !same(last, press)) {
        at = at.to(press, span(start - lead, lead), ease.inOut);
        last = press;
      }

      scale = scale.to(PRESSED, span(start, DIP), ease.out);

      if (!pointer.down)
        scale = scale.to(1, span(start + DIP, Math.min(RELEASE, end - start - DIP)), ease.out);

      rings.push(
        <Shape
          key={`ring-${i}`}
          geometry={circle(11)}
          at={press}
          anchor="center"
          origin="center"
          stroke={{ color: RING, width: 1.5 }}
          scale={track(0.35).to(1.25, span(start, 0.45), ease.out)}
          opacity={track(0)
            .to(0.6, span(start, 0.05))
            .to(0, span(start + 0.05, 0.4), ease.out)}
        />,
      );
    } else if (down && !pointer.down) scale = scale.to(1, span(start, RELEASE), ease.out);

    if (!same(last, pointer.at))
      at = over > 0 ? at.to(pointer.at, span(start, over), curve) : at.set(pointer.at, span(start));

    last = pointer.at;
    down = pointer.down;
  });

  return (
    <Group key="@cursor">
      {rings}
      <Shape
        key="arrow"
        geometry={ARROW}
        at={at}
        origin="top-left"
        scale={scale}
        opacity={opacity}
        fill={INK}
        stroke={{ color: EDGE, width: 1.2, join: "round" }}
      />
    </Group>
  );
};

/** The page with the mouse drawn over it, or the page alone when no state recorded the mouse. */
export const withCursor = (page: SceneElement, beats: readonly Beat[]): SceneElement => {
  const mouse = cursor(beats);

  return mouse ? (
    <Group>
      {page}
      {mouse}
    </Group>
  ) : (
    page
  );
};
