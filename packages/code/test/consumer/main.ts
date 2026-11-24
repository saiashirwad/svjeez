import { Code, highlight, type CodeProps, type Lang } from "@svjeez/code";
import { tomorrow } from "@svjeez/code/palettes";
import { Group, Shape, font, scene } from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import { svg as backend } from "svjeez/tools";

const lang: Lang = "tsx";

const runs: readonly (readonly (readonly [string, string])[])[] = highlight(
  "const answer = 42;",
  lang,
  {
    tabSize: 4,
  },
);

const face = await font.load(new URL("./fonts/ABeeZee-Regular.ttf", import.meta.url));

const props: CodeProps = {
  lang,
  font: face,
  size: 16,
  palette: tomorrow,
  children: "const answer = 42;",
};

export const out: string = backend.emit(
  scene({ size: [240, 60], duration: 1, title: "Code" }, (canvas) =>
    jsx(Group, {
      children: [
        jsx(Shape, { geometry: canvas.rect, fill: "#FFFFFF" }),
        jsx(Code, { ...props, at: [10, 10] }),
      ],
    }),
  ),
);

export { runs };
