import { afterAll, beforeAll, expect, test } from "bun:test";
import { voxel } from "../src/index.ts";

// Node 20 has no Map.groupBy; remove it so this runs as it would there.
const native = Map.groupBy;

beforeAll(() => {
  // SAFETY: TypeScript types Map.groupBy as required, but this test deletes it, so the cast lets delete compile.
  delete (Map as { groupBy?: unknown }).groupBy;
});

afterAll(() => {
  Map.groupBy = native;
});

test("voxel scenes group blocks by cell without Map.groupBy", () => {
  const view = voxel.camera({ yaw: 45, pitch: 30, unit: 8 });
  const skin = voxel.texture({ g: "#5DA03A" }, "g");

  expect(
    voxel.scene({
      camera: view,
      blocks: [
        { at: [0, 0, 0], skin },
        { at: [0, 0, 0], skin },
      ],
    }),
  ).toBeDefined();
});
