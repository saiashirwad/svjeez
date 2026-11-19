import {
  Group,
  Shape,
  circle,
  ease,
  moved,
  path,
  rect,
  scene,
  span,
  tokens,
  track,
  type Vec,
} from "svjeez";

/**
 * The header's hover icons: small looping scenes the site inlines with `svg.emit`.
 *
 * A paint is a hex color or a token, so the page's ink and background are the tokens `ink` and
 * `bg`. The header drops their declarations from each inlined svg and paints `ink` as
 * currentColor, so the icons take the page's colors.
 */

const D = 1.2;
const GOLD = "#FFC21A";

const page = tokens({
  light: { ink: "#1c1c1f", bg: "#ffffff" },
  dark: { ink: "#f4f4f5", bg: "#0b0b0c" },
});

const octocat = path.parse(
  "M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3",
);

const star = path.parse("M0 -4L1.2 -1.2L4 0L1.2 1.2L0 4L-1.2 1.2L-4 0L-1.2 -1.2Z");

/** The octocat waves hello and a star pops out over its ear. */
export const github = scene({ size: [28, 28], duration: D, title: "GitHub", still: false }, () => {
  const [up, back, again, rest] = span(0, 0.2).chain(0.3, 0.25, 0.25);

  const wave = track(0)
    .to(-12, up, ease.out)
    .to(10, back, ease.inOut)
    .to(-5, again, ease.inOut)
    .to(0, rest, ease.inOut);

  const grow = span(0.15, 0.35);
  const pop = track(0).to(1.2, grow, ease.pop).to(0, grow.next(0.4), ease.in);
  const spin = track(0).to(90, grow, ease.pop).to(180, grow.next(0.4), ease.in);

  return (
    <Group>
      <Group offset={[14, 26]} origin="at" rotate={wave}>
        <Shape geometry={moved(octocat, [2 - 14, 3 - 26])} fill={page.ink} />
      </Group>
      <Shape
        geometry={star}
        at={[24, 4]}
        anchor="center"
        origin="center"
        fill={GOLD}
        scale={pop}
        rotate={spin}
      />
    </Group>
  );
});

const rays = path.parse(
  "M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6",
);

/** The sun spins its rays and puffs up. */
export const sun = scene({ size: [24, 24], duration: D, title: "Light", still: false }, () => {
  const stroke = { color: page.ink, width: 1.8, cap: "round" } as const;
  const half = span(0, D / 2);

  return (
    <Group>
      <Shape
        geometry={rays}
        origin="center"
        stroke={stroke}
        rotate={track(0).to(90, span(0, D), ease.inOut)}
      />
      <Shape
        geometry={circle(4)}
        at={[12, 12]}
        anchor="center"
        origin="center"
        stroke={stroke}
        scale={track(1)
          .to(1.25, half, ease.out)
          .to(1, half.next(D / 2), ease.in)}
      />
    </Group>
  );
});

const crescent = path.parse("M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z");

/** The moon rocks to sleep while a star twinkles beside it. */
export const moon = scene({ size: [24, 24], duration: D, title: "Dark", still: false }, () => {
  const [left, right, home] = span(0, D / 3).chain(D / 3, D / 3);
  const rock = track(0).to(-14, left, ease.inOut).to(10, right, ease.inOut).to(0, home, ease.inOut);

  const twinkle = span(0.2, 0.3);

  return (
    <Group>
      <Group offset={[12, 20]} origin="at" rotate={rock}>
        <Shape
          geometry={moved(crescent, [-12, -20])}
          stroke={{ color: page.ink, width: 1.8, join: "round" }}
        />
      </Group>
      <Shape
        geometry={star}
        at={[18.5, 5]}
        anchor="center"
        origin="center"
        fill={GOLD}
        scale={track(0).to(1, twinkle, ease.pop).to(0, twinkle.next(0.4), ease.in)}
      />
    </Group>
  );
});

/** The screen, with Blip's antenna popping up from behind it. */
export const system = scene({ size: [24, 24], duration: D, title: "System", still: false }, () => {
  const up = span(0, 0.3);
  const rise = track<Vec>([0, 6]).to([0, 0], up, ease.pop).to([0, 6], up.next(0.3, 0.5), ease.in);
  const ink = { color: page.ink, width: 1.8, cap: "round" } as const;

  return (
    <Group>
      <Group offset={rise}>
        <Shape
          geometry={path.parse("M12 4V0.5")}
          stroke={{ color: "#E3A100", width: 1.6, cap: "round" }}
        />
        <Shape geometry={circle(1.6)} at={[12, 0.8]} anchor="center" fill={GOLD} />
      </Group>
      <Shape
        geometry={moved(rect(18, 12.5, { radius: 2 }), [3, 4])}
        fill={page.bg}
        stroke={{ color: page.ink, width: 1.8 }}
      />
      <Shape geometry={path.parse("M8.5 20.5h7M12 16.5v4")} stroke={ink} />
    </Group>
  );
});
