import { strict as assert } from "node:assert";
import { BrowserRunner, Session, compile, edit, parse } from "@svjeez/live";
import { Effect } from "effect";

const scene = `import { Rect, scene } from "svjeez";

export default scene({ size: [100, 80] }, () => <Rect id="bg" fill="#fff" width={30} />);
`;

const parsed = Effect.runSync(parse({ "scene.tsx": scene }));

const { files } = Effect.runSync(
  edit(parsed, [{ op: "set", target: "bg", prop: "width", value: 40 }]),
);

assert.equal(files["scene.tsx"], scene.replace("width={30}", "width={40}"));

for (const value of [BrowserRunner, Session, compile]) assert.ok(value);

console.log("parsed a scene and edited it with a minimal diff");
