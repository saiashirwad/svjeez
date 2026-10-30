import { strokeFont } from "svjeez";

export const allure = await strokeFont.load(
  new URL("../../../../examples/fonts/EMSAllure.svg", import.meta.url),
);

export const tiny =
  strokeFont(`<svg><defs><font id="T" horiz-adv-x="500"><font-face font-family="Tiny" units-per-em="1000" />
  <glyph unicode="a" horiz-adv-x="600" d="M 0 0 L 100 500 L 200 0" />
  <glyph unicode="&amp;" d="M 0 0 L 0 700" />
  <glyph unicode=" " horiz-adv-x="300" />
</font></defs></svg>`);
