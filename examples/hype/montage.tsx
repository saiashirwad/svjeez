import { shot, timeline } from "svjeez/extras";
import { CODE } from "./editor";
import { dataShot } from "./data";
import { mapShot } from "./map";
import { pipelineShot } from "./pipeline";
import { springShot } from "./spring";

/** Four shots, each composing two or more packages in one frame. */
export const SHOTS = timeline(
  { map: 5, pipeline: 5.2, spring: 4.6, data: 4.6 },
  { at: CODE.at + CODE.over },
);

export const MONTAGE = { at: SHOTS.map.at, over: SHOTS.duration };

export const montage = (
  <>
    <g animation={shot(SHOTS.map, { enter: "zoom", exit: "rise" })}>{mapShot(SHOTS.map)}</g>
    <g animation={shot(SHOTS.pipeline, { enter: "rise", exit: "rise" })}>
      {pipelineShot(SHOTS.pipeline)}
    </g>
    <g animation={shot(SHOTS.spring, { enter: "rise", exit: "rise" })}>
      {springShot(SHOTS.spring)}
    </g>
    <g animation={shot(SHOTS.data, { enter: "rise", exit: "zoom" })}>{dataShot(SHOTS.data)}</g>
  </>
);
