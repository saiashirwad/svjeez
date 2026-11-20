import { ogScene } from "@svjeez/og";
import { Group } from "svjeez";
import { theme } from "@examples/theme";
import { Backdrop, Chip, Copy } from "../../og/kit";
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
      <Group at={[80, 560 - Math.ceil(packages.length / COLUMNS) * (H + GAP)]}>
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
