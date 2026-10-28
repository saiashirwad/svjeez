import { css, def, ease, motion, render } from "svjeez";
import { palette } from "../style";

const theme = palette.dark;

const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });
const px = def.property("px", { syntax: "number", inherits: false, initial: 0 });

export default function build(): string {
  return render(
    {
      width: 200,
      height: 200,
      duration: 4,
      title: "Orbit",
      desc: "A dot orbits the center, driven by an animated angle property.",
      reducedMotion: { at: 1 },
      css: css`
        .dot {
          translate: calc(100px + 60px * ${px} * cos(${yaw})) calc(100px + 60px * ${px} * sin(${yaw}));
        }
      `,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <circle cx={100} cy={100} r={60} fill="none" stroke={theme.base02} strokeWidth={1.5} />
      <g animation={motion().to({ [yaw]: 360 }, 4, ease.linear)}>
        <circle class="dot" r={8} fill={theme.base0E} style={{ [px]: 1 }} />
      </g>
    </>,
  );
}
