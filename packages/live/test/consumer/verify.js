import assert from "node:assert/strict";
import { createEditor } from "@svjeez/live";
import { compileScene } from "@svjeez/live/compile";

const text = `import { enter, ease, render } from "svjeez";
export default () =>
  render(
    { width: 200, height: 120, duration: 4, title: "Dot" },
    <circle cx={40} cy={60} r={8} fill="#3EE6D6" animation={enter({ at: 0.5, over: 0.4 }, { scale: 0 }, ease.pop)} />,
  );
`;

const compiled = await compileScene(text);

assert.ok(compiled.ok, compiled.ok ? "" : compiled.error.message);

assert.deepEqual(compiled.scene, { width: 200, height: 120, duration: 4, title: "Dot" });

const shown = [];

const editor = createEditor(
  { text },
  {
    compile: compileScene,
    show: async (svg) => (shown.push(svg), `blob:${shown.length}`),
    release: () => {},
    now: () => 0,
  },
);

const settled = () =>
  new Promise((resolve) => {
    const stop = editor.subscribe((state) => {
      if (state.picture && state.picture.text === state.text) {
        stop();
        resolve(state);
      }
    });
  });

const named = (state, label) => state.values.find((v) => v.label === label);

const first = await settled();

editor.send({ type: "set", key: named(first, "cx").key, value: 120 });

const state = await settled();

assert.equal(named(state, "cx").literal.value, 120);

assert.match(shown.at(-1), /cx="120"/);

assert.equal(named(state, "over").param.unit, "s");

console.log(`edited a scene on Node: ${state.values.length} values, ${shown.length} pictures`);
