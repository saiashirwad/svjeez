import { ease, enter, motion, rect } from "svjeez";
import { highlight } from "@svjeez/code";
import { Marker, appWindow, code, shot, typewriter } from "svjeez/extras";
import { mono, theme } from "../style";
import { C, rise, show } from "./kit";
import { TERM } from "./session";

const SOURCE = [
  `import { draw, ease, enter, motion, render } from "svjeez";`,
  ``,
  `export default () => render(`,
  `  { width: 420, height: 440, duration: 4, title: "Launch" },`,
  `  <>`,
  `    <path d={wave} animation={draw({ at: 0, over: 1.2 })} />`,
  `    <circle r={18} fill={ink}`,
  `      animation={enter({ at: 1, over: 0.4 }, { scale: 0 }, ease.pop)} />`,
  `    <g animation={motion().to({ rotate: 360 }, 2).loop(2)}>`,
  `      {ring}`,
  `    </g>`,
  `  </>,`,
  `);`,
];

const CODE_AT = TERM.at + TERM.over;
const editor = appWindow(rect(40, 96, 810, 568), { theme, title: "launch.tsx" });
const preview = appWindow(rect(870, 96, 370, 568), { theme, title: "dist/launch.svg" });

const src = code(highlight(SOURCE.join("\n"), "tsx"), {
  theme,
  font: mono,
  fontSize: 16.5,
  lineHeight: 1.95,
  x: editor.body.x + 24,
  y: editor.body.y + 40,
});

const typed = typewriter(src, { at: CODE_AT + 0.45, cps: 150, cursor: C.accent, blink: false });
const landed = (n: number) => typed.spans[n - 1]!.at + typed.spans[n - 1]!.over;
const runAt = typed.end + 0.25;

/** Live edits after the first run: each swaps one value in the source, and the preview follows a beat later. */
const EDITS = [
  { from: "18", to: "32", role: "number" },
  { from: "ink", to: "sky", role: "plain" },
  { from: "360", to: "720", role: "number" },
  { from: "1.2", to: "0.4", role: "number" },
] as const;

const editAt = (i: number) => runAt + 0.8 + i * 1.4;
const applied = (i: number) => editAt(i) + 0.3;
export const CODE = { at: CODE_AT, over: applied(EDITS.length - 1) + 1.6 - CODE_AT };

const edit = ({ from, to, role }: (typeof EDITS)[number], i: number) => {
  const at = editAt(i);
  const word = src.find(from);

  const swapped = code([[[role, to]]], {
    theme,
    font: mono,
    fontSize: 16.5,
    lineHeight: 1.95,
    x: word.x,
    y: word.y,
  });

  const box = word.pad(3);

  return (
    <>
      <g animation={show(applied(i))}>
        <rect x={word.x - 1} y={word.y} width={word.w + 2} height={word.h} fill={C.page} />
        {swapped.node}
      </g>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={4}
        fill={C.accent}
        animation={motion({ opacity: 0 })
          .at(at)
          .to({ opacity: 0.3 }, 0.12)
          .at(applied(i))
          .set({ opacity: 0 })}
      />
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={4}
        fill={C.green}
        animation={motion({ opacity: 0 })
          .at(applied(i))
          .set({ opacity: 0.3 })
          .to({ opacity: 0 }, 0.8)}
      />
    </>
  );
};

const P = preview.body.center;
const WAVE = `M${P.x - 135} ${P.y + 110}c30 -54 56 -54 90 0s60 54 90 0s60 -54 90 0`;
const RING = 60;
const spinAt = landed(9);
const react = (i: number) => applied(i) + 0.1;

// The ring turns at 180°/s until the edit doubles it, then at 360°/s to the cut.
const turned = 180 * (react(2) - spinAt);

const spin = motion({ rotate: 0 })
  .at(spinAt)
  .to({ rotate: turned }, react(2) - spinAt, ease.linear)
  .to(
    { rotate: turned + 360 * (CODE.at + CODE.over - react(2)) },
    CODE.at + CODE.over - react(2),
    ease.linear,
  );

const previewArt = (
  <>
    <path
      d={WAVE}
      fill="none"
      stroke={C.accent}
      strokeWidth={4}
      strokeLinecap="round"
      animation={motion({ draw: 0 })
        .at(landed(6))
        .to({ draw: 1 }, 1.2, ease.inOut)
        .at(react(3))
        .set({ draw: 0 })
        .to({ draw: 1 }, 0.4, ease.inOut)}
    />
    <g transform={`translate(${P.x} ${P.y - 50})`}>
      <g
        animation={motion({ scale: 1 })
          .at(react(0))
          .to({ scale: 32 / 18 }, 0.45, ease.pop)}
      >
        <circle
          r={16}
          fill={C.ink}
          animation={enter({ at: landed(8), over: 0.45 }, { scale: 0 }, ease.pop)}
        />
        <circle
          r={16}
          fill={theme.base0D}
          animation={motion({ opacity: 0 }).at(react(1)).to({ opacity: 1 }, 0.3)}
        />
      </g>
      <g animation={[enter({ at: spinAt, over: 0.5 }, { opacity: 0, scale: 0.6 }), spin]}>
        <circle
          r={RING + 14}
          fill="none"
          stroke={C.muted}
          strokeWidth={1.5}
          strokeDasharray="2 8"
          strokeLinecap="round"
        />
        {[0, 1, 2].map((i) => (
          <circle
            cx={(RING + 14) * Math.cos((i * 2 * Math.PI) / 3)}
            cy={(RING + 14) * Math.sin((i * 2 * Math.PI) / 3)}
            r={i === 0 ? 6 : 4}
            fill={i === 0 ? C.accent : C.soft}
          />
        ))}
      </g>
    </g>
  </>
);

const lineRect = (first: number, last = first) => src.lines(first, last).pad(4);

export const codeShot = (
  <g animation={shot(CODE, { exit: "rise" })}>
    <g animation={rise(CODE.at, 0.45, 20)}>
      {editor.node}
      <g
        animation={motion({ opacity: 0 })
          .at(landed(6) - 0.05)
          .set({ opacity: 1 })
          .at(runAt)
          .to({ opacity: 0 }, 0.3)}
      >
        <Marker
          color={C.accent}
          over={0.2}
          stops={[lineRect(6), lineRect(7, 8), lineRect(9, 11)].map((r, i) => ({
            during: { at: landed([6, 8, 9][i]!) - 0.05, over: 0.2 },
            target: r,
          }))}
        />
      </g>
      {typed.node}
      {EDITS.map(edit)}
    </g>
    <g animation={rise(CODE.at + 0.12, 0.45, 20)}>
      {preview.node}
      {previewArt}
    </g>
    <g animation={rise(runAt, 0.4, 8)}>
      <circle
        cx={preview.body.x + 36}
        cy={preview.body.bottom.y - 32}
        r={4}
        fill={C.green}
        animation={EDITS.reduce(
          (m, _, i) => m.at(applied(i)).set({ opacity: 0.15 }).to({ opacity: 1 }, 0.5),
          motion({ opacity: 1 }),
        )}
      />
      <text
        x={preview.body.x + 48}
        y={preview.body.bottom.y - 28}
        fontSize={12}
        letterSpacing={1}
        fill={C.soft}
      >
        CSS keyframes · no runtime · 2.1 KB
      </text>
    </g>
  </g>
);
