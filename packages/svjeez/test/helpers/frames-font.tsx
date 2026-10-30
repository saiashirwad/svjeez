import { font, render, type Child } from "svjeez";
import { renderFrames } from "svjeez/frames";

export const fontFile = new URL("../fixtures/ABeeZee-Regular.ttf", import.meta.url);

export const sans = await font.load(fontFile);

export const paintText = async (child: Child) =>
  (
    await renderFrames(
      render({ width: 240, height: 60, duration: 1, title: "Font" }, <g fill="#000">{child}</g>),
      { times: [0], colorScheme: "light", background: "#fff" },
    )
  ).frames[0]!.png;
