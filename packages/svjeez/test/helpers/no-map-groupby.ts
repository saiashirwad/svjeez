import { afterAll, beforeAll } from "bun:test";

// Node 20 has no Map.groupBy; remove it so these run as they would there.
export const withoutMapGroupBy = () => {
  const native = Map.groupBy;

  beforeAll(() => {
    // SAFETY: TypeScript types Map.groupBy as required, but this test deletes it, so the cast lets delete compile.
    delete (Map as { groupBy?: unknown }).groupBy;
  });
  afterAll(() => {
    Map.groupBy = native;
  });
};
