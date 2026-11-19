import { Group, Shape, circle, ellipse, path, type SceneElement, type Vec } from "svjeez";
import type { Layers } from "svjeez/tools";

const GLASS = "#FFC21A";
const SHADE = "#F2A900";
const RIM = "#E3A100";
const INK = "#26262A";
const BLUSH = "#FF8C6B";

const cap = path.parse("M104 60V42");

const body = path.parse(
  "M38 150C38 94 68 60 104 60S170 94 170 150C170 158 165 162 157 162H51C43 162 38 158 38 150Z",
);

const belly = path.parse(
  "M38 150C38 158 43 162 51 162H157C165 162 170 158 170 150C170 146 170 143 169 140C160 148 150 150 104 150S48 148 39 140C38 143 38 146 38 150Z",
);

const smile = path.parse("M97 124Q104 131 111 124");
const wobble = path.parse("M96 128Q100 121 104 126T112 124");

interface BulbProps {
  readonly mood?: "happy" | "lost";
  readonly size?: number;
  readonly at?: Vec;
  readonly motion?: Layers;
}

/** The svjeez mascot, drawn from the favicon. `size` is its width; `at` places its center. */
export const Bulb = ({
  mood = "happy",
  size = 132,
  at = [0, 0],
  motion,
}: BulbProps): SceneElement => (
  <Group at={at} anchor="center" origin="center" scale={size / 132} motion={motion}>
    <Group>
      <Shape geometry={cap} stroke={{ color: RIM, width: 7, cap: "round" }} />
      <Shape geometry={circle(9)} at={[104, 38]} anchor="center" fill={GLASS} />
      <Shape geometry={body} fill={GLASS} />
      <Shape geometry={belly} fill={SHADE} />
      <Shape geometry={ellipse(9, 6)} at={[66, 124]} anchor="center" fill={BLUSH} opacity={0.55} />
      <Shape geometry={ellipse(9, 6)} at={[142, 124]} anchor="center" fill={BLUSH} opacity={0.55} />
      <Shape geometry={ellipse(7, 9)} at={[84, 110]} anchor="center" fill={INK} />
      <Shape geometry={ellipse(7, 9)} at={[124, 110]} anchor="center" fill={INK} />
      <Shape geometry={circle(2.4)} at={[86, 106]} anchor="center" fill="#FFFFFF" />
      <Shape geometry={circle(2.4)} at={[126, 106]} anchor="center" fill="#FFFFFF" />
      <Shape
        geometry={mood === "happy" ? smile : wobble}
        stroke={{ color: INK, width: 4.5, cap: "round" }}
      />
    </Group>
  </Group>
);
