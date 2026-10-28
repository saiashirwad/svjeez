import { highlight, type CodeTokens, type Lang } from "@svjeez/code";
import { render } from "svjeez";
import { code, defaultDark } from "svjeez/extras";

const lang: Lang = "tsx";
const tokens: CodeTokens = highlight("const answer = 42;", lang, { tabSize: 4 });

export const svg: string = render(
  { width: 400, height: 80, duration: 1, title: "Code" },
  code(tokens, { x: 10, y: 10, theme: defaultDark }).node,
);
