import { describe, expect, test } from "bun:test";
import { Effect, Fiber, Layer, Stream, SubscriptionRef } from "effect";
import type { StandardSchemaV1 } from "svjeez";
import {
  BunRunner,
  Denied,
  Hooks,
  InvalidValue,
  NoHooks,
  Rejected,
  RenderError,
  Session,
  StaleSource,
  defineEdit,
} from "../src/index.ts";
import type { ApplyOptions, Change, Edit, Limits, RawInput, State } from "../src/index.ts";

const SOURCE = `import { Group, Shape, rect, scene } from "svjeez";

// Kept as written.
export default scene({ size: [200, 100], duration: 1, title: "T" }, () => (
  <Group id="all">
    <Shape id="box" geometry={rect(40, 30)} fill="#ff0000" />
    <Shape id="dot" geometry={rect(4, 4)} fill="#0000ff" />
  </Group>
));
`;

const recolor = (id: string, fill: string): Edit => ({
  op: "set",
  target: id,
  prop: "fill",
  value: fill,
});

type Behavior = Parameters<typeof Hooks.of>[0];

const hooksLayer = (hooks: Partial<Behavior> = {}): Layer.Layer<Hooks> =>
  Layer.succeed(
    Hooks,
    Hooks.of({
      beforeEdit: (edit) => Effect.succeed(edit),
      afterEdit: () => Effect.void,
      ...hooks,
    }),
  );

interface Setup {
  readonly limits?: Limits;
  readonly hooks?: Layer.Layer<Hooks>;
}

const layer = ({ limits, hooks = NoHooks }: Setup = {}) =>
  Session.layer({
    files: { "scene.tsx": SOURCE },
    entry: "scene.tsx",
    ...(limits && { limits }),
  }).pipe(Layer.provide(Layer.mergeAll(BunRunner, hooks)));

const run = <A, E>(effect: Effect.Effect<A, E, Session>, setup?: Setup) =>
  Effect.runPromise(effect.pipe(Effect.provide(layer(setup))));

const failure = <A, E>(effect: Effect.Effect<A, E, Session>, setup?: Setup) =>
  Effect.runPromise(Effect.flip(effect.pipe(Effect.provide(layer(setup)))));

const applying = (edits: readonly Edit[], opts?: ApplyOptions) =>
  Session.use((session) => session.apply(edits, opts));

const current = Session.use((session) => SubscriptionRef.get(session.state));

const sourceOf = (state: State) => state.files["scene.tsx"];

describe("Session", () => {
  test("opens at revision 0, described and compiled", async () => {
    const state = await run(current);

    expect(state.revision).toBe(0);
    expect(state.describe.root).toBe("all");
    expect(state.describe.nodes["box"]?.props["fill"]).toMatchObject({ value: "#ff0000" });
  });

  test("a set edit rewrites only the literal", async () => {
    const state = await run(applying([recolor("box", "#00ff00")]));

    expect(state.revision).toBe(1);
    expect(sourceOf(state)).toBe(SOURCE.replace('"#ff0000"', '"#00ff00"'));
    expect(state.describe.nodes["box"]?.props["fill"]).toMatchObject({ value: "#00ff00" });
  });

  test("render draws the current source", async () => {
    const svg = await run(
      Effect.gen(function* () {
        const session = yield* Session;

        yield* session.apply([recolor("box", "#00ff00")]);

        return yield* session.render({});
      }),
    );

    expect(svg).toContain("#00FF00");
    expect(svg).toContain('data-svz-id="box"');
  });

  test("a failing edit is reported and the state stays", async () => {
    const outcome = await run(
      Effect.gen(function* () {
        const session = yield* Session;
        const error = yield* Effect.flip(session.apply([recolor("nope", "#ffffff")]));

        return { error, state: yield* SubscriptionRef.get(session.state) };
      }),
    );

    expect(outcome.error).toMatchObject({ _tag: "UnknownId", target: "nope" });
    expect(outcome.state.revision).toBe(0);
  });

  test("changes streams the current state, then each kept batch", async () => {
    const revisions = await run(
      Effect.gen(function* () {
        const session = yield* Session;

        const seen = yield* Stream.runCollect(Stream.take(session.changes, 3)).pipe(
          Effect.map((states) => states.map((state) => state.revision)),
          Effect.forkChild,
        );

        yield* Effect.yieldNow;
        yield* session.apply([recolor("box", "#111111")]);
        yield* session.apply([recolor("box", "#222222")]);

        return yield* Fiber.join(seen);
      }),
    );

    expect(revisions).toEqual([0, 1, 2]);
  });

  test("concurrent batches apply one after another, none lost", async () => {
    const state = await run(
      Effect.gen(function* () {
        const session = yield* Session;

        yield* Effect.all(
          [
            session.apply([recolor("box", "#111111")]),
            session.apply([recolor("dot", "#222222")]),
            session.apply([{ op: "set", target: "box", prop: "opacity", value: 0.5 }]),
          ],
          { concurrency: "unbounded" },
        );

        return yield* SubscriptionRef.get(session.state);
      }),
    );

    expect(state.revision).toBe(3);
    expect(sourceOf(state)).toContain('fill="#111111"');
    expect(sourceOf(state)).toContain('fill="#222222"');
    expect(sourceOf(state)).toContain("opacity={0.5}");
  });

  test("a replayed requestId returns the same state, without applying or announcing again", async () => {
    const commits: Change[] = [];

    const hooks = hooksLayer({
      afterEdit: (change) => Effect.sync(() => void commits.push(change)),
    });

    const [first, again, later] = await run(
      Effect.gen(function* () {
        const session = yield* Session;
        const first = yield* session.apply([recolor("box", "#111111")], { requestId: "r1" });
        const again = yield* session.apply([recolor("box", "#111111")], { requestId: "r1" });
        const later = yield* session.apply([recolor("box", "#222222")], { requestId: "r2" });

        return [first, again, later] as const;
      }),
      { hooks },
    );

    expect(again).toBe(first);
    expect(later.revision).toBe(2);
    expect(commits).toHaveLength(2);
  });

  test("hashes that no longer match the source fail with StaleSource", async () => {
    const error = await failure(
      Effect.gen(function* () {
        const session = yield* Session;
        const before = yield* SubscriptionRef.get(session.state);

        yield* session.apply([recolor("box", "#111111")]);

        return yield* session.apply([recolor("dot", "#222222")], { hashes: before.parsed.hashes });
      }),
    );

    expect(error).toBeInstanceOf(StaleSource);
    expect(error).toMatchObject({ file: "scene.tsx" });
  });

  test("hashes that match let the batch through", async () => {
    const state = await run(
      Effect.gen(function* () {
        const session = yield* Session;
        const now = yield* SubscriptionRef.get(session.state);

        return yield* session.apply([recolor("dot", "#222222")], { hashes: now.parsed.hashes });
      }),
    );

    expect(state.revision).toBe(1);
  });
});

describe("hooks", () => {
  const commits: string[] = [];

  const room = hooksLayer({
    beforeEdit: (edit) =>
      edit.op === "insert" && edit.element.component === "Envelope"
        ? Effect.fail(new Denied({ reason: "Envelope is not allowed" }))
        : Effect.succeed(edit),
    validate: (state) =>
      Effect.gen(function* () {
        yield* Effect.mapError(state.program.render(), (e) => new Rejected({ reason: e.message }));

        const width = state.describe.nodes["box"]?.props["width"];

        if (width?.editable && Number(width.value) > 100)
          return yield* new Rejected({ reason: "overflow", node: "box" });
      }),
    afterEdit: (_, edits) => Effect.sync(() => void commits.push(`${edits.length} edits`)),
  });

  const attempt = (edits: readonly Edit[], hooks = room) =>
    run(
      Effect.gen(function* () {
        const session = yield* Session;
        const error = yield* Effect.flip(session.apply(edits));

        return { error, state: yield* SubscriptionRef.get(session.state) };
      }),
      { hooks },
    );

  test("beforeEdit denies an edit; nothing is kept or announced", async () => {
    commits.length = 0;

    const { error, state } = await attempt([
      recolor("box", "#111111"),
      { op: "insert", parent: "all", at: 0, element: { component: "Envelope", id: "mail" } },
    ]);

    expect(error).toEqual(new Denied({ reason: "Envelope is not allowed" }));
    expect(state.revision).toBe(0);
    expect(sourceOf(state)).toBe(SOURCE);
    expect(commits).toEqual([]);
  });

  test("beforeEdit may rewrite an edit", async () => {
    const hooks = hooksLayer({
      beforeEdit: (edit) =>
        Effect.succeed(edit.op === "set" ? { ...edit, value: "#abcdef" } : edit),
    });

    const state = await run(applying([recolor("box", "#111111")]), { hooks });

    expect(sourceOf(state)).toContain('fill="#abcdef"');
  });

  test("validate rejects a state; it is not kept and not announced", async () => {
    commits.length = 0;

    const { error, state } = await attempt([
      { op: "set", target: "box", prop: "width", value: 500 },
    ]);

    expect(error).toEqual(new Rejected({ reason: "overflow", node: "box" }));
    expect(state.revision).toBe(0);
    expect(sourceOf(state)).toBe(SOURCE);
    expect(commits).toEqual([]);
  });

  test("afterEdit sees each kept batch with the edits that were applied", async () => {
    commits.length = 0;

    await run(
      Effect.gen(function* () {
        const session = yield* Session;

        yield* session.apply([recolor("box", "#111111"), recolor("dot", "#222222")]);
        yield* session.apply([{ op: "set", target: "box", prop: "width", value: 50 }]);
      }),
      { hooks: room },
    );

    expect(commits).toEqual(["2 edits", "1 edits"]);
  });
});

describe("defineEdit", () => {
  interface Recolor {
    readonly color: string;
  }

  const isRecolor = (value: unknown): value is Recolor =>
    typeof value === "object" &&
    value !== null &&
    "color" in value &&
    typeof value.color === "string";

  const input: StandardSchemaV1<Recolor> = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) =>
        isRecolor(value) ? { value } : { issues: [{ message: "color must be a string" }] },
    },
  };

  const recolorAll = defineEdit({
    name: "recolor",
    input,
    expand: ({ color }, state) =>
      Effect.succeed(
        Object.values(state.describe.nodes).flatMap((node) =>
          node.props["fill"]?.editable ? [recolor(node.id, color)] : [],
        ),
      ),
  });

  const expanding = (raw: RawInput, custom: Pick<typeof recolorAll, "expand"> = recolorAll) =>
    Session.use((session) =>
      Effect.flatMap(SubscriptionRef.get(session.state), (state) => custom.expand(raw, state)).pipe(
        Effect.flatMap((edits) => session.apply(edits)),
      ),
    );

  test("expands a checked input into primitive edits against the current state", async () => {
    const state = await run(expanding({ color: "#123456" }));

    expect(recolorAll.name).toBe("recolor");
    expect(sourceOf(state)).toBe(SOURCE.replaceAll(/"#(ff0000|0000ff)"/g, '"#123456"'));
  });

  test("an input the schema refuses fails with InvalidValue", async () => {
    expect(await failure(expanding({ color: 7 }))).toEqual(
      new InvalidValue({ target: "recolor", prop: "", issue: "color must be a string" }),
    );
  });

  test("an expand that denies surfaces Denied", async () => {
    const guarded = defineEdit({
      name: "guarded",
      input,
      expand: () => Effect.fail(new Denied({ reason: "no" })),
    });

    expect(await failure(expanding({ color: "#ffffff" }, guarded))).toEqual(
      new Denied({ reason: "no" }),
    );
  });
});

describe("limits", () => {
  test("maxSourceBytes denies an edit that grows the source past it, and a session that opens past it", async () => {
    const size = new TextEncoder().encode(SOURCE).length;

    const grown = await failure(
      applying([{ op: "set", target: "box", prop: "stroke", value: "#222222" }]),
      {
        limits: { maxSourceBytes: size + 4 },
      },
    );

    expect(grown).toBeInstanceOf(Denied);
    expect(await failure(current, { limits: { maxSourceBytes: 10 } })).toBeInstanceOf(Denied);
  });

  test("maxFiles, maxNodes and maxTreeDepth deny a scene that is too large", async () => {
    expect(await failure(current, { limits: { maxFiles: 0 } })).toBeInstanceOf(Denied);
    expect(await failure(current, { limits: { maxNodes: 2 } })).toBeInstanceOf(Denied);
    expect(await failure(current, { limits: { maxTreeDepth: 1 } })).toBeInstanceOf(Denied);
  });

  test("maxNodes denies an insert that adds one too many, and the state stays", async () => {
    const outcome = await run(
      Effect.gen(function* () {
        const session = yield* Session;

        const error = yield* Effect.flip(
          session.apply([
            {
              op: "insert",
              parent: "all",
              at: 0,
              element: { component: "Shape", id: "extra", props: { fill: "#ffffff" } },
            },
          ]),
        );

        return { error, state: yield* SubscriptionRef.get(session.state) };
      }),
      { limits: { maxNodes: 3 } },
    );

    expect(outcome.error).toBeInstanceOf(Denied);
    expect(outcome.state.revision).toBe(0);
  });

  test("maxRevisions refuses batches past the cap, and keeps what was applied", async () => {
    const outcome = await run(
      Effect.gen(function* () {
        const session = yield* Session;

        yield* session.apply([recolor("box", "#111111")]);

        const error = yield* Effect.flip(session.apply([recolor("box", "#222222")]));

        return { error, state: yield* SubscriptionRef.get(session.state) };
      }),
      { limits: { maxRevisions: 1 } },
    );

    expect(outcome.error).toBeInstanceOf(Denied);
    expect(outcome.state.revision).toBe(1);
  });

  test("rateLimit refuses calls past maxEdits in the window, and forgets them after it", async () => {
    const limited = await run(
      Effect.gen(function* () {
        const session = yield* Session;

        yield* session.apply([recolor("box", "#111111")]);

        return yield* Effect.flip(session.apply([recolor("box", "#222222")]));
      }),
      { limits: { rateLimit: { maxEdits: 1, windowMs: 60_000 } } },
    );

    expect(limited).toBeInstanceOf(Denied);

    const state = await run(
      Effect.gen(function* () {
        const session = yield* Session;

        yield* session.apply([recolor("box", "#111111")]);
        yield* Effect.sleep("30 millis");

        return yield* session.apply([recolor("box", "#222222")]);
      }),
      { limits: { rateLimit: { maxEdits: 1, windowMs: 10 } } },
    );

    expect(state.revision).toBe(2);
  });

  test("maxSvgBytes fails a render that draws more", async () => {
    const render = Session.use((session) => session.render());

    expect(await failure(render, { limits: { maxSvgBytes: 50 } })).toBeInstanceOf(RenderError);
    expect(await run(render, { limits: { maxSvgBytes: 1_000_000 } })).toStartWith("<svg");
  });
});

describe("Session prop validation", () => {
  const CARD = `import { Group, Shape, component, rect } from "svjeez";

const props = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) =>
      typeof value.label === "string" && value.label.length > 0
        ? { value }
        : { issues: [{ message: "Expected a non-empty string", path: ["label"] }] },
  },
};

export const NoteCard = component({
  name: "NoteCard",
  props,
  render: ({ label }) => (
    <Group id="back">
      <Shape id="note" geometry={rect(label.length, 4)} fill="#000000" />
    </Group>
  ),
});
`;

  const SCENE = `import { Group, scene } from "svjeez";
import { NoteCard } from "./card.tsx";

export default scene({ size: [200, 100], duration: 1, title: "T" }, () => (
  <Group id="all">
    <NoteCard id="one" label="Hello" />
  </Group>
));
`;

  const both = (hooks: Layer.Layer<Hooks> = NoHooks) =>
    Session.layer({ files: { "scene.tsx": SCENE, "card.tsx": CARD }, entry: "scene.tsx" }).pipe(
      Layer.provide(Layer.mergeAll(BunRunner, hooks)),
    );

  test("refuses a set value the component's props schema rejects, and keeps the state", async () => {
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const session = yield* Session;

        const error = yield* Effect.flip(
          session.apply([{ op: "set", target: "one", prop: "label", value: "" }]),
        );

        return { error, state: yield* SubscriptionRef.get(session.state) };
      }).pipe(Effect.provide(both())),
    );

    expect(outcome.error).toMatchObject({
      _tag: "InvalidValue",
      target: "one",
      prop: "label",
      issue: "label: Expected a non-empty string",
    });
    expect(outcome.state.revision).toBe(0);
  });

  test("refuses an inserted element whose props the schema rejects, and accepts valid ones", async () => {
    const insert = (label: string): Edit => ({
      op: "insert",
      parent: "all",
      at: 1,
      element: { component: "NoteCard", id: "two", props: { label } },
    });

    const error = await Effect.runPromise(
      Effect.flip(
        Session.use((session) => session.apply([insert("")])).pipe(Effect.provide(both())),
      ),
    );

    expect(error).toMatchObject({ _tag: "InvalidValue", target: "two", prop: "label" });

    const state = await Effect.runPromise(
      Session.use((session) => session.apply([insert("Hi")])).pipe(Effect.provide(both())),
    );

    expect(state.parsed.order).toContain("two");
  });

  test("a failing afterEdit keeps the old state from every observer", async () => {
    const hooks = hooksLayer({ afterEdit: () => Effect.die("not persisted") });

    const revision = await Effect.runPromise(
      Effect.gen(function* () {
        const session = yield* Session;

        yield* Effect.exit(session.apply([recolor("box", "#111111")]));

        return (yield* SubscriptionRef.get(session.state)).revision;
      }).pipe(Effect.provide(layer({ hooks }))),
    );

    expect(revision).toBe(0);
  });
});
