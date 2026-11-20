import { ogScene } from "@svjeez/og";
import { Group } from "svjeez";
import { theme } from "@examples/theme";
import { Backdrop, Chip, Copy, Mascot, Sparkle } from "../../og/kit";
import { packages } from "../../packages";

const colors = [
  theme.yellow,
  theme.red,
  theme.orange,
  theme.green,
  theme.cyan,
  theme.blue,
  theme.magenta,
];

const COLUMNS = 4;
const [W, H, GAP] = [248, 42, 10];

/** The top of the shelf of chips. */
const SHELF = 560 - Math.ceil(packages.length / COLUMNS) * (H + GAP);

// No timeline here: this card is a shelf. The title across the top, one chip for every package below it, so the
// card is always the list the page shows.
export default ogScene(
  { theme, title: "Packages", desc: "A shelf of the svjeez packages, each as a small chip." },
  () => (
    <Group>
      <Backdrop />
      <Group at={[80, 64]}>
        <Copy
          title="Packages"
          titleSize={88}
          text={`${packages.length} small packages around one core.`}
          width={1040}
        />
      </Group>
      {/* Blip does a handstand on top of the shelf, feet kicking in the air. */}
      <Mascot
        at={[1010, SHELF - 92]}
        size={130}
        pose={{
          tilt: 180,
          stretch: [0.95, 1.05],
          look: [0, 3],
          lit: true,
          feet: { left: [-8, 10], right: [10, 16], kick: 25 },
        }}
      />
      <Sparkle at={[925, SHELF - 110]} size={12} />
      <Sparkle at={[1100, SHELF - 70]} size={9} />
      <Group at={[80, SHELF]}>
        {packages.map(({ name }, i) => (
          <Chip
            key={`p${i}`}
            label={name}
            color={colors[i % colors.length]!}
            size={[W, H]}
            at={[(i % COLUMNS) * (W + GAP), Math.floor(i / COLUMNS) * (H + GAP)]}
          />
        ))}
      </Group>
    </Group>
  ),
);
