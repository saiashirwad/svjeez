import { Ink, Pivot, ease, motion, render, strokeFont, tool, type Child } from "svjeez";

// The header's icons, drawn with svjeez and inlined in the page. Each loops a little bit of business, and the page
// keeps it paused until the pointer is over its button, so they come alive only when you go to use them.

const D = 1.2;

const icon = (prefix: string, title: string, size: number, children: Child) =>
  render({ width: size, height: size, duration: D, title, prefix, reducedMotion: false }, children);

const OCTOCAT =
  "M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3";

const STAR = "M0 -4L1.2 -1.2L4 0L1.2 1.2L0 4L-1.2 1.2L-4 0L-1.2 -1.2Z";

/** The octocat waves hello and a star pops out over its ear. */
export const github = () =>
  icon(
    "gh",
    "GitHub",
    28,
    <>
      <Pivot
        origin={{ x: 14, y: 26 }}
        animation={motion({ rotate: 0 })
          .to({ rotate: -12 }, 0.2, ease.out)
          .to({ rotate: 10 }, 0.3, ease.inOut)
          .to({ rotate: -5 }, 0.25, ease.inOut)
          .to({ rotate: 0 }, 0.25, ease.inOut)}
      >
        <path d={OCTOCAT} transform="translate(2 3)" fill="currentColor" />
      </Pivot>
      <g transform="translate(24 4)">
        <path
          d={STAR}
          fill="#FFC21A"
          animation={motion({ scale: 0, rotate: 0 })
            .at(0.15)
            .to({ scale: 1.2, rotate: 90 }, 0.35, ease.pop)
            .to({ scale: 0, rotate: 180 }, 0.4, ease.in)}
        />
      </g>
    </>,
  );

/** The palette's three dots juggle, one after another. */
export const dots = () =>
  icon(
    "dots",
    "Colors",
    28,
    <>
      {(["var(--code-tag)", "var(--code-string)", "var(--code-fn)"] as const).map((fill, i) => (
        <circle
          cx={7 + i * 7}
          cy={14}
          r={4.5}
          fill={fill}
          stroke="var(--bg)"
          strokeWidth={1.5}
          animation={motion({ y: 0 })
            .at(i * 0.15)
            .to({ y: -7 }, 0.22, ease.out)
            .to({ y: 0 }, 0.22, ease.in)}
        />
      ))}
    </>,
  );

const RAYS =
  "M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6";

/** The sun spins its rays and puffs up. */
export const sun = () =>
  icon(
    "sun",
    "Light",
    24,
    <g fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <Pivot
        origin={{ x: 12, y: 12 }}
        animation={motion({ rotate: 0 }).to({ rotate: 90 }, D, ease.inOut)}
      >
        <path d={RAYS} />
      </Pivot>
      <Pivot
        origin={{ x: 12, y: 12 }}
        animation={motion({ scale: 1 })
          .to({ scale: 1.25 }, D / 2, ease.out)
          .to({ scale: 1 }, D / 2, ease.in)}
      >
        <circle cx={12} cy={12} r={4} />
      </Pivot>
    </g>,
  );

/** The moon rocks to sleep while a star twinkles beside it. */
export const moon = () =>
  icon(
    "moon",
    "Dark",
    24,
    <>
      <Pivot
        origin={{ x: 12, y: 20 }}
        animation={motion({ rotate: 0 })
          .to({ rotate: -14 }, D / 3, ease.inOut)
          .to({ rotate: 10 }, D / 3, ease.inOut)
          .to({ rotate: 0 }, D / 3, ease.inOut)}
      >
        <path
          d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </Pivot>
      <g transform="translate(18.5 5)">
        <path
          d={STAR}
          fill="#FFC21A"
          animation={motion({ scale: 0 })
            .at(0.2)
            .to({ scale: 1 }, 0.3, ease.pop)
            .to({ scale: 0 }, 0.4, ease.in)}
        />
      </g>
    </>,
  );

/** The screen, with the chick's antenna popping up from behind it. */
export const system = () =>
  icon(
    "sys",
    "System",
    24,
    <>
      <g
        animation={motion({ y: 6 })
          .to({ y: 0 }, 0.3, ease.pop)
          .wait(0.5)
          .to({ y: 6 }, 0.3, ease.in)}
      >
        <path d="M12 4V0.5" stroke="#E3A100" strokeWidth={1.6} strokeLinecap="round" />
        <circle cx={12} cy={0.8} r={1.6} fill="#FFC21A" />
      </g>
      <rect
        x={3}
        y={4}
        width={18}
        height={12.5}
        rx={2}
        fill="var(--bg)"
        stroke="currentColor"
        strokeWidth={1.8}
      />
      <path
        d="M8.5 20.5h7M12 16.5v4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </>,
  );

const casual = await strokeFont.load(new URL("../fonts/EMSCasualHand.svg", import.meta.url));

/** A word for the header, hand-lettered in the page's text color, written once when the page loads. */
export const word = (text: string, prefix: string) => {
  const size = 24;
  const probe = casual.path(text, { size, x: 0, y: 0 }).d;
  const xs = (probe.match(/-?[\d.]+/g) ?? []).map(Number).filter((_, i) => i % 2 === 0);
  const width = Math.ceil(Math.max(...xs) - Math.min(...xs)) + 6;
  const d = casual.path(text, { size, x: 3 - Math.min(...xs), y: 21 }).d;
  const pen = tool.pen({ size: 2, seed: 3 });
  let t = 0.2;
  const strokes = d.split(/(?=M)/).map((piece) => {
    const over = 0.12;
    const stroke = { d: piece, at: t, over };
    t += over;

    return stroke;
  });

  return render(
    {
      width,
      height: 28,
      duration: t + 0.1,
      loop: false,
      title: text,
      prefix,
      reducedMotion: { at: t + 0.1 },
    },
    <>
      {strokes.map((s) => (
        <Ink
          d={s.d}
          tool={pen}
          fill="currentColor"
          draw={{ at: s.at, over: s.over }}
          ease={ease.linear}
        />
      ))}
    </>,
  );
};
