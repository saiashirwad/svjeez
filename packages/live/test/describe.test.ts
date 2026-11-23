import { describe as suite, expect, test } from "bun:test";
import { Effect } from "effect";
import { BunRunner, compile, defaultAllowlist, describe, locate, parse } from "../src/index.ts";
import type { Files, Prop } from "../src/index.ts";

const CARD = `import { Group, Shape, component, rect } from "svjeez";

const label = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => ({ value }),
    jsonSchema: {
      input: () => ({
        type: "object",
        properties: {
          label: { type: "string", title: "Label", "x-ui": { control: "textarea", rows: 3 } },
          size: { type: "number", minimum: 1 },
        },
      }),
      output: () => ({}),
    },
  },
};

export const NoteCard = component({
  name: "NoteCard",
  props: label,
  render: ({ label }) => (
    <Group id="back">
      <Shape id="note" geometry={rect(label.length, 4)} fill="#000000" />
    </Group>
  ),
});
`;

const SCENE = `import { Group, Shape, rect, scene } from "svjeez";
import { NoteCard } from "./card.tsx";

export default scene({ size: [200, 100], duration: 1, title: "T" }, () => (
  <Group id="all">
    <NoteCard id="one" label="Hello" size={4} extra="x" />
    <Shape id="box" geometry={rect(40, 30)} fill="#ff0000" opacity={0.5} hidden visible={false} />
  </Group>
));

export const Dynamic = ({ guest, rest }) => (
  <Shape id="dyn" geometry={rect(guest.w, 30)} fill={guest.fill} rotate={1 + 2} {...rest} />
);
`;

const files: Files = { "scene.tsx": SCENE, "card.tsx": CARD };

const load = (source: Files = files) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const parsed = yield* parse(source);

      const program = yield* compile(source, { entry: "scene.tsx" }).pipe(
        Effect.provide(BunRunner),
      );

      return { parsed, program, description: describe(parsed, program) };
    }),
  );

const editable = (prop: Prop | undefined) => {
  if (!prop?.editable) throw new Error("expected an editable prop");

  return prop;
};

suite("describe", () => {
  test("roots the tree at the outermost element and lists every node", async () => {
    const { description } = await load();

    expect(description.root).toBe("all");
    expect(Object.keys(description.nodes)).toEqual([
      "all",
      "one",
      "box",
      "dyn",
      "NoteCard/back",
      "NoteCard/note",
    ]);
    expect(description.nodes["all"]?.children).toEqual(["one", "box"]);
    expect(description.params).toEqual({
      type: "object",
      properties: {},
      additionalProperties: false,
    });
  });

  test("takes a prop's schema and x-ui hint from the component's JSON Schema", async () => {
    const { description } = await load();
    const label = editable(description.nodes["one"]?.props["label"]);

    expect(label.value).toBe("Hello");
    expect(label.schema).toEqual({
      type: "string",
      title: "Label",
      "x-ui": { control: "textarea", rows: 3 },
    });
    expect(label.ui).toEqual({ control: "textarea", rows: 3 });
    expect(editable(description.nodes["one"]?.props["size"]).ui).toBeUndefined();
    expect(editable(description.nodes["one"]?.props["size"]).schema).toEqual({
      type: "number",
      minimum: 1,
    });
  });

  test("infers a schema from the literal when the component declares none", async () => {
    const { description } = await load();
    const props = description.nodes["box"]?.props ?? {};

    expect(editable(props["fill"]).schema).toEqual({ type: "string", format: "color" });
    expect(editable(props["opacity"]).schema).toEqual({ type: "number" });
    expect(editable(props["hidden"]).schema).toEqual({ type: "boolean" });
    expect(editable(props["visible"]).value).toBe(false);
    expect(editable(description.nodes["one"]?.props["extra"]).schema).toEqual({ type: "string" });
    expect(props["geometry"]).toMatchObject({ editable: false, reason: "expression" });
  });

  test("marks params, expressions and spreads read-only, with the text and the param", async () => {
    const { description, parsed } = await load();
    const props = description.nodes["dyn"]?.props ?? {};

    expect(props["fill"]).toMatchObject({
      editable: false,
      reason: "param",
      text: "{guest.fill}",
      param: "guest",
    });
    expect(props["rotate"]).toMatchObject({ editable: false, reason: "expression" });
    expect(props["rotate"]).not.toHaveProperty("param");

    const spread = Object.values(props).find((prop) => !prop.editable && prop.reason === "spread");

    expect(spread).toMatchObject({ editable: false, text: "{...rest}" });
    expect(props["fill"]?.range).toEqual(parsed.elements["dyn"]?.props["fill"]?.range);
  });

  test("carries each prop's source range, which is the whole attribute", async () => {
    const { description, parsed } = await load();
    const { range } = editable(description.nodes["box"]?.props["fill"]);

    expect(parsed.files[range.file]?.slice(range.from, range.to)).toBe('fill="#ff0000"');
  });

  test("an empty set of files describes nothing", async () => {
    const { description } = await load({ "scene.tsx": "export default null;\n" });

    expect(description.root).toBe("");
    expect(description.nodes).toEqual({});
  });

  test("roots the tree at the scene's own root, even when a component's file comes first", async () => {
    const { description } = await load({ "card.tsx": CARD, "scene.tsx": SCENE });

    expect(description.root).toBe("all");
  });

  test("reads an Effect schema's JSON Schema, with an x-ui hint the host adds", async () => {
    // Effect writes only the annotations it knows, so a hint is added to the JSON Schema it writes.
    const effectCard = `import { Schema } from "effect";
import { Group, Shape, component, rect } from "svjeez";

const Props = Schema.Struct({
  label: Schema.String.annotate({ title: "Label" }),
  size: Schema.Number,
});

const checked = Schema.toStandardSchemaV1(Props)["~standard"];
const written = Schema.toStandardJSONSchemaV1(Props)["~standard"].jsonSchema;

const withUi = (schema) => ({
  ...schema,
  properties: { ...schema.properties, label: { ...schema.properties.label, "x-ui": { control: "textarea" } } },
});

const props = {
  "~standard": {
    ...checked,
    jsonSchema: {
      input: (options) => withUi(written.input(options)),
      output: (options) => written.output(options),
    },
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

    const source: Files = {
      "card.tsx": effectCard,
      "scene.tsx": SCENE.replace(
        '<NoteCard id="one" label="Hello" size={4} extra="x" />',
        '<NoteCard id="one" label="Hello" size={4} />',
      ),
    };

    const parsed = await Effect.runPromise(parse(source));

    const program = await Effect.runPromise(
      compile(source, {
        entry: "scene.tsx",
        modules: (name) => defaultAllowlist(name) || name === "effect",
      }).pipe(Effect.provide(BunRunner)),
    );

    const { nodes } = describe(parsed, program);
    const label = editable(nodes["one"]?.props["label"]);

    expect(label.schema).toMatchObject({ type: "string", title: "Label" });
    expect(label.ui).toEqual({ control: "textarea" });
    expect(editable(nodes["one"]?.props["size"]).ui).toBeUndefined();
  });

  test("locate finds the node of every data-svz-id in the rendered SVG", async () => {
    const { parsed, program } = await load();

    const { svg } = await Effect.runPromise(program.render());
    const ids = [...svg.matchAll(/data-svz-id="([^"]+)"/g)].map((match) => match[1]!);

    expect(ids).toContain("one/note");
    expect(ids.length).toBeGreaterThan(3);

    for (const id of ids) expect(locate(parsed, id), id).toBeDefined();
  });
});
