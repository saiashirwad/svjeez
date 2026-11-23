import { describe, expect, test } from "bun:test";
import {
  Arrow,
  Group,
  Shape,
  Text,
  component,
  font,
  rect,
  ref,
  scene,
  type SceneElement,
  type StandardJSONSchemaV1,
  type StandardSchemaV1,
} from "svjeez";
import { jsxDEV } from "svjeez/jsx-dev-runtime";
import { componentMeta, isComponent, isStandardJsonSchema, SceneError, svg } from "svjeez/tools";
import type { Model } from "svjeez/tools";

const mono = await font.load(new URL("./fixtures/SpaceMono-Regular.ttf", import.meta.url));

const made = (build: () => SceneElement): Model.Scene =>
  scene({ size: [300, 200], duration: 2, title: "Components" }, build);

const thrown = (build: () => void): SceneError => {
  try {
    build();
  } catch (error) {
    if (error instanceof SceneError) return error;
    throw error;
  }

  throw new Error("nothing was thrown");
};

const at = (line: number) => ({ fileName: "scene.tsx", lineNumber: line, columnNumber: 3 });

const find = (node: Model.SceneNode, id: string): Model.SceneNode | undefined => {
  if (node.id === id) return node;

  return node.kind === "group"
    ? node.children.map((child) => find(child, id)).find((found) => found !== undefined)
    : undefined;
};

const ids = (node: Model.SceneNode): string[] => [
  ...(node.id === undefined ? [] : [node.id]),
  ...(node.kind === "group" ? node.children.flatMap(ids) : []),
];

const links = (node: Model.SceneNode): Model.SceneNode[] => [
  ...(node.key.endsWith("link") ? [node] : []),
  ...(node.kind === "group" ? node.children.flatMap(links) : []),
];

interface Card {
  readonly title: string;
  readonly width: number;
}

interface CardInput {
  readonly title?: string;
  readonly width?: number;
}

const isText = (value: string | number | undefined): value is string =>
  value !== undefined && `${value}` === value;

/** A hand-written Standard Schema (and Standard JSON Schema) for { title: string, width?: number }. */
const cardSchema: StandardSchemaV1<CardInput, Card> & StandardJSONSchemaV1<CardInput, Card> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => {
      const given: Readonly<Record<string, string | number | undefined>> = Object.fromEntries(
        Object.entries(value ?? {}),
      );

      const { title, width = 80 } = given;

      if (!isText(title)) return { issues: [{ message: "title is required", path: ["title"] }] };

      if (width !== 80 && !Number.isFinite(width))
        return { issues: [{ message: "width must be a number", path: [{ key: "width" }] }] };

      return { value: { title, width: Number(width) } };
    },
    jsonSchema: {
      input: () => ({ type: "object", required: ["title"] }),
      output: () => ({ type: "object", required: ["title", "width"] }),
    },
  },
};

const NoteCard = component({
  name: "NoteCard",
  props: cardSchema,
  render: ({ title, width }) => (
    <Group>
      <Shape id="box" geometry={rect(width, 20)} fill="#cccccc" />
      <Text id="note" font={mono} size={10} fill="#000000">
        {title}
      </Text>
    </Group>
  ),
});

describe("component()", () => {
  test("registers its name and props schema, and is a plain JSX component", () => {
    const meta = componentMeta(NoteCard);

    expect(meta?.name).toBe("NoteCard");
    expect(meta?.props).toBe(cardSchema);
    expect(isComponent(NoteCard)).toBe(true);
    expect(isComponent(Group)).toBe(false);
    expect(componentMeta(Group)).toBeUndefined();
    expect(NoteCard({ title: "hi" }).type).toBe("call");
  });

  test("props are optional: a component with none takes only children and an id", () => {
    const Frame = component({
      name: "Frame",
      render: ({ children }) => <Group>{children}</Group>,
    });

    const meta = componentMeta(Frame);

    expect(meta?.name).toBe("Frame");
    expect(meta && "props" in meta).toBe(false);

    const model = made(() => (
      <Frame id="frame">
        <Shape id="dot" geometry={rect(4, 4)} fill="#000000" />
      </Frame>
    ));

    // A child is written outside the component, so it is scoped by where it is written, not by where it lands.
    expect(ids(model.root)).toEqual(["frame", "dot"]);
  });

  test("render gets the schema's output: defaults are applied, children are passed", () => {
    let seen: Card | undefined;

    const Probe = component({
      name: "Probe",
      props: cardSchema,
      render: (props) => {
        seen = { title: props.title, width: props.width };

        return <Group>{props.children}</Group>;
      },
    });

    made(() => (
      <Probe title="x">
        <Shape geometry={rect(1, 1)} fill="#000000" />
      </Probe>
    ));

    expect(seen).toEqual({ title: "x", width: 80 });
  });

  test("render is never given id or key", () => {
    let given: string[] = [];

    const Probe = component({
      name: "Probe",
      render: (props) => {
        given = Object.keys(props);

        return <Group />;
      },
    });

    made(() => <Probe id="p" key="k" />);

    expect(given).toEqual([]);
  });

  test("props the schema rejects throw a SceneError that names the component and the prop", () => {
    const error = thrown(() => made(() => jsxDEV(NoteCard, { width: 1 }, undefined, false, at(9))));

    expect(error.problem).toContain("<NoteCard> got props its schema rejects");
    expect(error.problem).toContain("title: title is required");
    expect(error.node).toBe("<NoteCard>");
    expect(error.source?.line).toBe(9);
  });

  test("an issue path can be a { key } segment", () => {
    const error = thrown(() =>
      made(() => jsxDEV(NoteCard, { title: "t", width: Number.NaN }, undefined, false, at(1))),
    );

    expect(error.problem).toContain("width: width must be a number");
  });

  test("an asynchronous schema is refused", () => {
    const later: StandardSchemaV1<{}, {}> = {
      "~standard": { version: 1, vendor: "test", validate: async () => ({ value: {} }) },
    };

    const Slow = component({ name: "Slow", props: later, render: () => <Group /> });

    expect(thrown(() => made(() => <Slow />)).problem).toContain("validates asynchronously");
  });

  test("an empty name is refused", () => {
    expect(thrown(() => component({ name: "", render: () => <Group /> })).problem).toContain(
      "needs a name",
    );
  });

  test("exposes Standard JSON Schema to a host, and tells it from a plain Standard Schema", () => {
    const meta = componentMeta(NoteCard);

    expect(meta?.props && isStandardJsonSchema(meta.props)).toBe(true);

    const plain: StandardSchemaV1 = {
      "~standard": { version: 1, vendor: "test", validate: (value) => ({ value }) },
    };

    expect(isStandardJsonSchema(plain)).toBe(false);

    if (meta?.props && isStandardJsonSchema(meta.props))
      expect(meta.props["~standard"].jsonSchema.input({ target: "draft-2020-12" })).toEqual({
        type: "object",
        required: ["title"],
      });
  });

  test("its registered name is used in errors even when the function's own name is lost", () => {
    // What a minifier does: the function is called `a`, and says nothing of Minified.
    const holder = {
      a: component({
        name: "Minified",
        render: (): SceneElement => {
          throw new Error("boom");
        },
      }),
    };

    expect(holder.a.name).not.toBe("Minified");

    const error = thrown(() => made(() => jsxDEV(holder.a, {}, undefined, false, at(5))));

    expect(error.node).toBe("<Minified>");
  });

  test("plain function components keep working, named by the function", () => {
    const Plain = (): SceneElement => {
      throw new Error("boom");
    };

    const error = thrown(() => made(() => jsxDEV(Plain, {}, undefined, false, at(5))));

    expect(error.node).toBe("<Plain>");
    expect(componentMeta(Plain)).toBeUndefined();
  });
});

describe("key", () => {
  test("a component keeps the key it is given, so a list of one component has distinct keys", () => {
    const Card = component({
      name: "Card",
      render: () => <Shape geometry={rect(2, 2)} fill="#000000" />,
    });

    const model = made(() => (
      <Group>
        {[1, 2].map((i) => (
          <Card key={"c" + i} />
        ))}
      </Group>
    ));

    const keys = model.root.kind === "group" ? model.root.children.map((child) => child.key) : [];

    expect(keys.map((key) => key.split("/").pop())).toEqual(["c1", "c2"]);
  });
});

describe("id", () => {
  test("a plain function component takes an id, found by ref and written to the svg", () => {
    const Plain = (): SceneElement => (
      <Group>
        <Shape geometry={rect(4, 4)} fill="#000000" />
      </Group>
    );

    const model = made(() => (
      <Group>
        <Plain id="p" />
        <Arrow key="link" from={ref("p").right} to={[100, 20]} stroke={{ color: "#000000" }} />
      </Group>
    ));

    expect(ids(model.root)).toEqual(["p"]);
    expect(svg.emit(model, { ids: true })).toContain('data-svz-id="p"');
  });

  test("reaches the node, and a plain scene has none", () => {
    const model = made(() => (
      <Group>
        <Shape id="dot" geometry={rect(4, 4)} fill="#000000" />
        <Shape geometry={rect(4, 4)} fill="#000000" />
      </Group>
    ));

    expect(ids(model.root)).toEqual(["dot"]);
  });

  test("scopes ids by the components they sit in, and composes down a path", () => {
    const Inner = component({
      name: "Inner",
      render: () => (
        <Text id="label" font={mono} size={10} fill="#000000">
          in
        </Text>
      ),
    });

    const Outer = component({
      name: "Outer",
      render: () => (
        <Group>
          <Inner id="b" />
        </Group>
      ),
    });

    const model = made(() => (
      <Group>
        <NoteCard id="card1" title="hi" />
        <NoteCard id="card2" title="yo" />
        <Outer id="a" />
        <Text id="note" font={mono} size={10} fill="#000000">
          top
        </Text>
      </Group>
    ));

    expect(ids(model.root)).toEqual([
      "card1",
      "card1/box",
      "card1/note",
      "card2",
      "card2/box",
      "card2/note",
      "a",
      "a/b",
      "a/b/label",
      "note",
    ]);
  });

  test("a plain function that forwards its id under a registered component is not scoped twice", () => {
    const Wrap = ({ id }: { readonly id?: string }): SceneElement => (
      <Shape id={id} geometry={rect(4, 4)} fill="#000000" />
    );

    const Outer = component({
      name: "Outer",
      render: () => (
        <Group>
          <Wrap id="w" />
        </Group>
      ),
    });

    const model = made(() => <Outer id="outer" />);

    expect(ids(model.root)).toEqual(["outer", "outer/w"]);
  });

  test("keyed registered components that return nodes with their own ids keep their keys when reordered", () => {
    const Item = component({
      name: "Item",
      render: () => <Shape id="dot" geometry={rect(4, 4)} fill="#000000" />,
    });

    const keysOf = (order: readonly string[]): string[] => {
      const model = made(() => (
        <Group>
          {order.map((name) => (
            <Item key={name} id={name} />
          ))}
        </Group>
      ));

      return model.root.kind === "group" ? model.root.children.map((child) => child.key) : [];
    };

    expect(keysOf(["a", "b"]).map((key) => key.split("/").pop())).toEqual(["a", "b"]);
    expect(keysOf(["b", "a"]).map((key) => key.split("/").pop())).toEqual(["b", "a"]);
  });

  test("a component with no id leaves the ids inside it unscoped", () => {
    const model = made(() => <NoteCard title="hi" />);

    expect(ids(model.root)).toEqual(["box", "note"]);
  });

  test("a component's id lands on the node it renders, or on a group around a fragment", () => {
    const One = component({
      name: "One",
      render: () => <Shape geometry={rect(2, 2)} fill="#000000" />,
    });

    const Two = component({
      name: "Two",
      render: () => (
        <>
          <Shape geometry={rect(2, 2)} fill="#000000" />
          <Shape geometry={rect(2, 2)} fill="#000000" />
        </>
      ),
    });

    const model = made(() => (
      <Group>
        <One id="one" />
        <Two id="two" />
      </Group>
    ));

    expect(find(model.root, "one")?.kind).toBe("shape");

    const two = find(model.root, "two");

    expect(two?.kind).toBe("group");
    expect(two?.kind === "group" && two.children.length).toBe(2);
  });

  test("a function component that hands its id to a node is not scoped twice", () => {
    const Wrap = ({ id }: { readonly id?: string }): SceneElement => (
      <Shape id={id} geometry={rect(2, 2)} fill="#000000" />
    );

    const model = made(() => (
      <Group>
        <NoteCard id="c" title="t" />
        <Wrap id="w" />
      </Group>
    ));

    expect(ids(model.root)).toEqual(["c", "c/box", "c/note", "w"]);
  });

  test("an id is one word: a slash or nothing is refused", () => {
    expect(
      thrown(() => made(() => <Shape id="a/b" geometry={rect(2, 2)} fill="#000000" />)).problem,
    ).toContain("An id is one word");

    expect(
      thrown(() => made(() => <Shape id="" geometry={rect(2, 2)} fill="#000000" />)).problem,
    ).toContain("An id is one word");
  });

  test("two nodes with one id in a scope throw, listing both places; nothing is renamed", () => {
    const shape = { geometry: rect(2, 2), fill: "#000000" } as const;

    const error = thrown(() =>
      made(() => (
        <Group>
          {jsxDEV(Shape, { id: "dup", ...shape }, undefined, false, at(11))}
          {jsxDEV(Shape, { id: "dup", ...shape }, undefined, false, at(12))}
        </Group>
      )),
    );

    expect(error.problem).toContain('Two nodes have the id "dup"');
    expect(error.problem).toContain("scene.tsx:11:3");
    expect(error.problem).toContain("scene.tsx:12:3");
  });

  test("two components with one id collide, but the same inner id under different ones does not", () => {
    expect(() =>
      made(() => (
        <Group>
          <NoteCard id="c" title="a" />
          <NoteCard id="c" title="b" />
        </Group>
      )),
    ).toThrow(/Two nodes have the id "c"/);

    expect(() =>
      made(() => (
        <Group>
          <NoteCard id="c1" title="a" />
          <NoteCard id="c2" title="b" />
        </Group>
      )),
    ).not.toThrow();
  });

  test("the same id twice inside one component collides under its path", () => {
    const Twice = component({
      name: "Twice",
      render: () => (
        <Group>
          <Shape id="x" geometry={rect(2, 2)} fill="#000000" />
          <Shape id="x" geometry={rect(2, 2)} fill="#000000" />
        </Group>
      ),
    });

    expect(() => made(() => <Twice id="t" />)).toThrow(/Two nodes have the id "t\/x"/);
  });
});

describe('ref("id")', () => {
  test("anchors an arrow to nodes by id, as an anonymous ref would", () => {
    const byId = made(() => (
      <Group>
        <Shape id="name" geometry={rect(20, 20)} at={[10, 10]} fill="#000000" />
        <Shape id="note" geometry={rect(20, 20)} at={[150, 10]} fill="#000000" />
        <Arrow
          key="link"
          from={ref("name").right}
          to={ref("note").left}
          stroke={{ color: "#000000" }}
        />
      </Group>
    ));

    const byRef = made(() => {
      const [name, note] = [ref(), ref()];

      return (
        <Group>
          <Shape ref={name} geometry={rect(20, 20)} at={[10, 10]} fill="#000000" />
          <Shape ref={note} geometry={rect(20, 20)} at={[150, 10]} fill="#000000" />
          <Arrow key="link" from={name.right} to={note.left} stroke={{ color: "#000000" }} />
        </Group>
      );
    });

    expect(links(byId.root)[0]?.box).toEqual(links(byRef.root)[0]?.box);
    expect(links(byId.root)[0]?.box.width).toBeGreaterThan(100);
  });

  test("finds a scoped id by its full path", () => {
    const model = made(() => (
      <Group>
        <NoteCard id="card1" title="hi" />
        <Shape id="other" geometry={rect(20, 20)} at={[200, 10]} fill="#000000" />
        <Arrow
          key="link"
          from={ref("card1/box").right}
          to={ref("other").left}
          stroke={{ color: "#000000" }}
        />
      </Group>
    ));

    const near = made(() => (
      <Group>
        <NoteCard id="card1" title="hi" />
        <Shape id="other" geometry={rect(20, 20)} at={[200, 10]} fill="#000000" />
        <Arrow
          key="link"
          from={ref("card1/note").right}
          to={ref("other").left}
          stroke={{ color: "#000000" }}
        />
      </Group>
    ));

    // box is 80 wide and the note text is narrower, so the two arrows start in different places.
    expect(links(model.root)[0]?.box.x).not.toBe(links(near.root)[0]?.box.x);
    expect(links(model.root)[0]?.box.x).toBeGreaterThan(70);
  });

  test("inside a component, a bare id finds the node in the component's own scope first", () => {
    const Pair = component({
      name: "Pair",
      render: () => (
        <Group>
          <Shape id="a" geometry={rect(10, 10)} at={[0, 0]} fill="#000000" />
          <Shape id="b" geometry={rect(10, 10)} at={[100, 0]} fill="#000000" />
          <Arrow
            key="link"
            from={ref("a").right}
            to={ref("b").left}
            stroke={{ color: "#000000" }}
          />
        </Group>
      ),
    });

    // A top-level "a" far away must not capture the arrows inside each Pair.
    const model = made(() => (
      <Group>
        <Shape id="a" geometry={rect(10, 10)} at={[250, 150]} fill="#000000" />
        <Pair id="p1" />
        <Group at={[0, 100]}>
          <Pair id="p2" />
        </Group>
      </Group>
    ));

    const found = links(model.root);

    expect(found.length).toBe(2);

    // The gap in a Pair is 90 wide; the far-off top-level "a" would make it over 150.
    for (const arrow of found) {
      expect(arrow.box.width).toBeGreaterThan(85);
      expect(arrow.box.width).toBeLessThan(100);
    }
  });

  test("ref() with no id is still an anonymous ref given to one node", () => {
    const model = made(() => {
      const card = ref();

      return (
        <Group>
          <Shape ref={card} geometry={rect(20, 20)} at={[10, 10]} fill="#000000" />
          <Arrow key="link" from={card.right} to={[100, 20]} stroke={{ color: "#000000" }} />
        </Group>
      );
    });

    expect(links(model.root)[0]?.box.x).toBeGreaterThan(25);
  });

  test("a ref to an id nobody has throws, naming the id and the ids that exist", () => {
    const error = thrown(() =>
      made(() => (
        <Group>
          <Shape id="here" geometry={rect(20, 20)} at={[10, 10]} fill="#000000" />
          <Arrow
            key="link"
            from={ref("missing").right}
            to={[100, 20]}
            stroke={{ color: "#000000" }}
          />
        </Group>
      )),
    );

    expect(error.problem).toContain('ref("missing").right names the id "missing"');
    expect(error.problem).toContain('"here"');
  });

  test("a scene with no ids at all says so", () => {
    const error = thrown(() =>
      made(() => (
        <Group>
          <Arrow key="link" from={ref("nope").right} to={[100, 20]} stroke={{ color: "#000000" }} />
        </Group>
      )),
    );

    expect(error.problem).toContain("No node has an id");
  });

  test("an empty or malformed id is refused", () => {
    expect(thrown(() => ref("")).problem).toContain("ref() needs an id");
    expect(thrown(() => ref("a//b")).problem).toContain("ref() needs an id");
  });

  test("ref(id) can't be given to a node as ref={…}", () => {
    const error = thrown(() =>
      made(() => <Shape ref={ref("x")} geometry={rect(2, 2)} fill="#000000" />),
    );

    expect(error.problem).toContain('ref("id") finds a node by its id');
  });
});

describe("svg.emit ids", () => {
  const model = made(() => (
    <Group>
      <NoteCard id="card1" title="hi" />
      <Group id="solo">
        <Shape geometry={rect(4, 4)} fill="#000000" />
      </Group>
      <Shape geometry={rect(4, 4)} fill="#111111" />
    </Group>
  ));

  test("writes data-svz-id on every node with an id when asked", () => {
    const out = svg.emit(model, { ids: true });

    for (const id of ["card1", "card1/box", "card1/note", "solo"])
      expect(out).toContain(`data-svz-id="${id}"`);
    expect(out.match(/data-svz-id=/g)?.length).toBe(4);
  });

  test("keeps a group that has an id even when it holds one child", () => {
    expect(svg.emit(model, { ids: true })).toMatch(/<g[^>]*data-svz-id="solo"/);
  });

  test("writes none by default, and a scene with no ids is unchanged by asking", () => {
    expect(svg.emit(model)).not.toContain("data-svz-id");
    expect(svg.emit(model, { ids: false })).toBe(svg.emit(model));

    const bare = made(() => (
      <Group>
        <Shape geometry={rect(4, 4)} fill="#000000" />
      </Group>
    ));

    expect(svg.emit(bare, { ids: true })).toBe(svg.emit(bare));
  });

  test("works alongside sources", () => {
    const out = svg.emit(model, { ids: true, sources: true });

    expect(out).toContain('data-svz-id="card1/box"');
    expect(out).toContain("data-key=");
  });
});
