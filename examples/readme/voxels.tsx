import { ease, enter, render, voxel } from "svg-motion";
import { CSS, theme } from "./kit";

const view = voxel.camera({ yaw: 45, pitch: 30, unit: 24 });
const grass = voxel.texture(
  { g: "#5DA03A", d: "#7A5534" },
  `
  gggg
  gdgg
  dddd
  dddd
`,
);
const dirt = voxel.texture(
  { d: "#7A5534", e: "#6A4A2C" },
  `
  dded
  eddd
  ddde
  dedd
`,
);

export default function build(): string {
  return render(
    { width: 200, height: 120, duration: 10, title: "Voxels", desc: "A grass block, a dirt block that pops in at three seconds and leaves at nine, and a dirt block that drops onto the grass.", css: CSS, reducedMotion: { at: 5 } },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <g transform="translate(100 64)">
        {voxel.scene({
          camera: view,
          blocks: [
            { at: [0, 0, 0], skin: { side: dirt, top: grass } },
            { at: [1, 0, 0], skin: dirt, from: 3, until: 9 },
            { at: [0, 0, 1], skin: { side: dirt, top: grass }, from: 1, animation: enter({ at: 1, over: 0.6 }, { y: -30 }, ease.pop) },
          ],
        })}
      </g>
    </>,
  );
}
