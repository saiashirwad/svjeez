import assert from "node:assert/strict";
import { Code, highlight, ts } from "@svjeez/code";
import { gruvbox, rosePine, solarized, tomorrow } from "@svjeez/code/palettes";
import { Group, font, scene } from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import { SceneError, svg as backend } from "svjeez/tools";

assert.deepEqual(highlight("const answer = 42;", ts)[0][0], ["keyword", "const"]);

assert.throws(() => highlight("x", []), SceneError);

const face = await font.load(new URL("./fonts/ABeeZee-Regular.ttf", import.meta.url));

const out = backend.emit(
  scene({ size: [240, 60], duration: 1, title: "Code" }, () =>
    jsx(Group, {
      children: jsx(Code, {
        lang: ts,
        font: face,
        size: 16,
        palette: tomorrow,
        children: "const answer = 42;",
        at: [10, 10],
      }),
    }),
  ),
);

assert.match(out, /--tomorrow-keyword:#B294BB/);

assert.match(out, /prefers-color-scheme:light/);

assert.equal(new Set([gruvbox, rosePine, solarized, tomorrow]).size, 4);

console.log(`highlighted a line into ${(out.length / 1024).toFixed(1)} KB of SVG`);
