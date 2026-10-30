import type { Compiled } from "../../src/compile";
import { createEditor, valueOf, type Editor } from "../../src/editor";

export const scene = `const x = 10;
const fill = "#112233";
const curve = ease.linear;
export default () => x;
`;

/** An editor that compiles nothing, so only the messages its gestures send change it. */
export const editing = (text = scene) =>
  createEditor({ text }, { compile: () => new Promise<Compiled>(() => {}) });

export const number = (editor: Editor, key: string) => {
  const v = valueOf(editor.getState(), key);

  if (v?.kind !== "number") throw new Error(`${key} is a number`);

  return v;
};

export const easeAt = (editor: Editor, key: string) => {
  const v = valueOf(editor.getState(), key);

  if (v?.kind !== "ease") throw new Error(`${key} is an ease`);

  return v;
};
