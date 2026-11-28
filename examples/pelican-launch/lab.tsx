/** The same pelican rig in four surface treatments, side by side, for choosing textures. */
import {
  Group,
  Shape,
  Text,
  blur,
  displace,
  ellipse,
  rect,
  scene,
  type SceneElement,
  type Vec,
} from "svjeez";
import { H, W, mono } from "./kit";
import { engraving, risoBlue, risoPink, studio, watercolor } from "./looks";
import { Pelican } from "./rig";
import { ColdPress, Granulation, LaidPaper, RisoPaper, StudioSweep } from "./textures";

const PW = W / 2;
const PH = H / 2;
const SCALE = 1.72;
const GROUND = 336;

/** One panel: its paper, a pelican standing on its ground line, a label in the corner. */
const Panel = ({
  at,
  paper,
  label,
  ink,
  children,
}: {
  readonly at: Vec;
  readonly paper: SceneElement;
  readonly label: string;
  readonly ink: `#${string}`;
  readonly children: SceneElement | readonly SceneElement[];
}): SceneElement => (
  <Group offset={at} clip={rect(PW, PH)}>
    {paper}
    {children}
    <Text font={mono} size={11} letterSpacing={1.5} fill={ink} at={[18, 26]}>
      {label}
    </Text>
  </Group>
);

/** The rig, scaled to the panel and stood on its ground line. */
const Rider = ({ children }: { readonly children: SceneElement }): SceneElement => (
  <Group offset={[PW / 2 - 14, GROUND]} scale={SCALE} origin="own">
    {children}
  </Group>
);

export default scene(
  { size: [W, H], duration: 2, title: "Claude Pelican 1: texture lab", loop: true },
  () => (
    <Group>
      <Panel at={[0, 0]} paper={<StudioSweep w={PW} h={PH} />} label="STUDIO" ink="#5A5247">
        <Shape
          geometry={ellipse(130, 7)}
          offset={[PW / 2, GROUND + 1]}
          fill="#2A2520"
          opacity={0.25}
          effects={[blur(6)]}
        />
        <Rider>
          <Pelican look={studio} />
        </Rider>
      </Panel>
      <Panel at={[PW, 0]} paper={<LaidPaper />} label="ENGRAVING · HAND-TINTED" ink="#5A4630">
        <Rider>
          <Pelican look={engraving} />
        </Rider>
      </Panel>
      <Panel at={[0, PH]} paper={<ColdPress />} label="WATERCOLOUR · COLD PRESS" ink="#5B5048">
        <Group
          blend="multiply"
          effects={[displace({ scale: 3, frequency: 0.05, seed: 6, octaves: 3 })]}
        >
          <Rider>
            <Pelican look={watercolor} />
          </Rider>
        </Group>
        <Granulation />
      </Panel>
      <Panel at={[PW, PH]} paper={<RisoPaper />} label="RISOGRAPH · TWO DRUMS" ink="#0078BF">
        <Group blend="multiply">
          <Rider>
            <Group offset={[1.4, 0.9]}>
              <Pelican look={risoPink} />
            </Group>
          </Rider>
        </Group>
        <Group blend="multiply">
          <Rider>
            <Pelican look={risoBlue} />
          </Rider>
        </Group>
      </Panel>
    </Group>
  ),
);
