import { createEditor, update, valuesOf, type Editor, type State, type Value } from "@svjeez/live";
import { createCompiler } from "@svjeez/live/client";
import { compileScene, type Compiled } from "@svjeez/live/compile";
import { parse } from "@svjeez/live/source";

const text = `export default () => <circle cx={40} r={8} fill="#3EE6D6" />;`;

export const values: Value[] = valuesOf(parse(text));

export const editor: Editor = createEditor(
  { text },
  {
    compile: (): Promise<Compiled> => compileScene(text),
    show: async () => "blob:x",
    release: () => {},
    now: () => 0,
  },
);

export const next: State = update(editor.getState(), { type: "undo" })[0];

export const compiler: (source: string) => Promise<Compiled> = createCompiler({ timeout: 1000 });
