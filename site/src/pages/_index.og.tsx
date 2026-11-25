import { theme } from "@examples/theme";
import { ogScene } from "@svjeez/og";
import { Align, Group, Shape, ellipse } from "svjeez";
import { Backdrop, Copy, Glow, Mascot, Sparkle, Timeline } from "../og/kit";

const HERO = [920, 255] as const;
const GROUND = [920, 340] as const;

export default ogScene(
  {
    theme,
    title: "svjeez",
    desc: "svjeez link preview: a yellow light bulb mascot above a timeline.",
  },
  () => (
    <Group>
      <Backdrop />
      <Glow at={HERO} />
      <Shape geometry={ellipse(70, 10)} offset={[920, 440]} fill={theme.raised} />
      <Mascot
        at={GROUND}
        size={230}
        pose={{
          tilt: -10,
          stretch: [0.9, 1.12],
          look: [4, -5],
          lit: true,
          feet: { left: [-6, 4], right: [10, -6], kick: 25 },
        }}
      />
      <Sparkle at={[1060, 120]} size={18} />
      <Sparkle at={[790, 150]} size={11} />
      <Sparkle at={[1090, 300]} size={9} />
      <Timeline />
      <Align place="left" inset={80}>
        <Copy
          title="svjeez"
          titleSize={132}
          text={"Write motion in TypeScript.\nShip it as one SVG."}
          note="zero-JS · CSS + SMIL · one file"
        />
      </Align>
    </Group>
  ),
);
