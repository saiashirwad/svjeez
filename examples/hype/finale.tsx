import {
  chartBar,
  code as codeIcon,
  bolt,
  mathFunction,
  icons,
  rocket,
  sitemap,
  typography,
  video,
  world,
} from "@svjeez/icons/tabler";
import { Glyphs, Icon, draw, ease, enter, motion } from "svjeez";
import { code, shot, typewriter } from "svjeez/extras";
import { mono, theme } from "../style";
import { C, centered, display, rise, show, W } from "./kit";
import { HAND } from "./write";

const FACTS = [
  { lead: "0 bytes", rest: " of runtime JS." },
  { lead: "1 file.", rest: " Self-contained." },
  { lead: "CSS + SMIL.", rest: " That's it." },
] as const;

const FACT = 64;
export const FACTS_SPAN = { at: HAND.at + HAND.over, over: 3.4 };

export const facts = (
  <g animation={shot(FACTS_SPAN, { exit: "zoom" })}>
    {FACTS.map((fact, i) => {
      const x = (W - display.measure(fact.lead + fact.rest, FACT)) / 2;
      const y = 270 + i * 110;

      return (
        <g animation={rise(FACTS_SPAN.at + 0.2 + i * 0.7, 0.45, 24)}>
          <Glyphs font={display} text={fact.lead} size={FACT} x={x} y={y} fill={C.accent} />
          <Glyphs
            font={display}
            text={fact.rest}
            size={FACT}
            x={x + display.measure(fact.lead, FACT)}
            y={y}
            fill={C.ink}
          />
        </g>
      );
    })}
  </g>
);

// ─── Shot 6: the logo, the install line, and the reveal. ─────────────────────

export const END_AT = FACTS_SPAN.at + FACTS_SPAN.over;
const LOGO = "svjeez";
const logoX = centered(LOGO, 190);
const TAG = "Give Claude a motion designer.";
const INSTALL = "npx svjeez skill --install";
const installW = mono.measure(`❯ ${INSTALL}`, 20) + 52;

const installCode = code([[["blue", "❯"], " ", ["plain", INSTALL]]], {
  theme,
  font: mono,
  fontSize: 20,
  x: (W - installW) / 2 + 26,
  y: 448,
});

const install = typewriter(installCode, { at: END_AT + 1.8, cps: 34, cursor: C.accent });

const PACKAGES = [
  ["charts", chartBar],
  ["code", codeIcon],
  ["fonts", typography],
  ["geo", world],
  ["icons", icons],
  ["math", mathFunction],
  ["mermaid", sitemap],
  ["video", video],
  ["vite", bolt],
  ["astro", rocket],
] as const;

const CHIP = { h: 34, gap: 10, icon: 16, pad: 14, fontSize: 14 };
const chipW = (name: string) => CHIP.pad * 2 + CHIP.icon + 8 + mono.measure(name, CHIP.fontSize);
const rowW = PACKAGES.reduce((w, [name]) => w + chipW(name), 0) + CHIP.gap * (PACKAGES.length - 1);
const chipsAt = install.end + 0.25;

/** The family, one chip per package, left to right. */
const chips = PACKAGES.map(([name, icon], i) => {
  const x = (W - rowW) / 2 + PACKAGES.slice(0, i).reduce((w, [n]) => w + chipW(n) + CHIP.gap, 0);
  const y = 530;

  return (
    <g animation={rise(chipsAt + i * 0.06, 0.4, 10)}>
      <rect
        x={x}
        y={y}
        width={chipW(name)}
        height={CHIP.h}
        rx={CHIP.h / 2}
        fill="none"
        stroke={C.hairline}
      />
      <Icon
        icon={icon}
        x={x + CHIP.pad}
        y={y + (CHIP.h - CHIP.icon) / 2}
        size={CHIP.icon}
        stroke={C.accent}
      />
      <text
        x={x + CHIP.pad + CHIP.icon + 8}
        y={y + CHIP.h / 2 + 5}
        fontSize={CHIP.fontSize}
        fill={C.text}
      >
        {name}
      </text>
    </g>
  );
});

const sizeAt = chipsAt + PACKAGES.length * 0.06 + 0.5;
export const D = sizeAt + 3;

export const finale = (size: string) => (
  <g animation={show(END_AT)}>
    <Glyphs
      font={display}
      text={LOGO}
      size={190}
      x={logoX}
      y={320}
      fill="none"
      stroke={C.ink}
      strokeWidth={2}
      animation={(_, i) => draw({ at: END_AT + 0.1 + i * 0.1, over: 0.8 }, ease.inOut)}
    />
    <Glyphs
      font={display}
      text={LOGO}
      size={190}
      x={logoX}
      y={320}
      fill={C.ink}
      alt=""
      animation={(_, i) => enter({ at: END_AT + 0.75 + i * 0.07, over: 0.45 }, { opacity: 0 })}
    />
    <rect
      x={logoX}
      y={350}
      width={display.measure(LOGO, 190)}
      height={3}
      rx={1.5}
      fill={C.accent}
      animation={motion({ scale: 0 })
        .at(END_AT + 1.1)
        .to({ scale: 1 }, 0.7, ease.inOut)}
    />
    <g animation={rise(END_AT + 1.35, 0.5, 10)}>
      <Glyphs font={display} text={TAG} size={24} x={centered(TAG, 24)} y={402} fill={C.soft} />
    </g>
    <g animation={rise(END_AT + 1.6, 0.4, 8)}>
      <rect
        x={(W - installW) / 2}
        y={436}
        width={installW}
        height={56}
        rx={28}
        fill={C.surface}
        stroke={C.hairline}
      />
    </g>
    {install.node}
    {chips}
    <g animation={rise(sizeAt, 0.6, 8)}>
      <text x={W / 2} y={622} fontSize={14} textAnchor="middle" fill={C.soft}>
        {"this entire video is "}
        <tspan fill={C.ink}>{`one ${size} SVG`}</tspan>
        {". no video file, no JavaScript."}
      </text>
    </g>
  </g>
);
