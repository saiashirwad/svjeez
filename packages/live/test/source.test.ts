import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { edit, elementAt, elementOf, locate, parse } from "../src/index.ts";
import type { Edit, Files, Parsed } from "../src/index.ts";

const scene = `import { Layer, Rect, Text, scene, ref, ease } from "svjeez";

// A comment that must survive.
export default scene({ size: [420, 560] }, ({ guest }) => (
  <Layer id="card">
    <Rect id="bg"   fill="#fff"  width={300} />
    <Text id="name" text={guest.name} ease={ease.out} bold>
      Hello
    </Text>
    <Group id="box">
      <Rect
        id="inner"
        width={10}
        height={20}
      />
    </Group>
    <Arrow id="arrow" from={ref("name")} to={ref("box/inner")} {...rest} label={compute(1)} />
  </Layer>
));
`;

const files: Files = { "scene.tsx": scene };

const read = (f: Files = files): Parsed => Effect.runSync(parse(f));
const run = (edits: readonly Edit[], f: Files = files) => Effect.runSync(edit(read(f), edits));

const fail = (edits: readonly Edit[], f: Files = files) =>
  Effect.runSync(Effect.flip(edit(read(f), edits)));

const text = (edits: readonly Edit[], f: Files = files) => run(edits, f).files["scene.tsx"]!;

describe("parse", () => {
  test("lists elements, ids and their tree", () => {
    const parsed = read();

    expect(parsed.order).toEqual(["card", "bg", "name", "box", "inner", "arrow"]);
    expect(elementOf(parsed, "card")?.children).toEqual(["bg", "name", "box", "arrow"]);
    expect(elementOf(parsed, "inner")?.parent).toBe("box");
    expect(elementOf(parsed, "name")?.component).toBe("Text");
  });

  test("reads literal props and marks the rest read-only", () => {
    const { props } = elementOf(read(), "name")!;

    expect(props["bold"]).toMatchObject({ kind: "literal", value: true, form: "shorthand" });
    expect(props["ease"]).toMatchObject({ kind: "literal", lit: "ease", value: "ease.out" });
    expect(props["text"]).toMatchObject({ kind: "param", param: "guest", text: "{guest.name}" });
    expect(elementOf(read(), "bg")?.props["fill"]).toMatchObject({ lit: "color", value: "#fff" });
    expect(elementOf(read(), "arrow")?.props["label"]).toMatchObject({ kind: "expression" });
    expect(elementOf(read(), "arrow")?.attributes.map((a) => a.kind)).toContain("spread");
  });

  test("collects refs and file hashes", () => {
    const parsed = read();

    expect(parsed.refs.map((r) => r.id)).toEqual(["name", "box/inner"]);
    expect(parsed.hashes["scene.tsx"]).toMatch(/^[0-9a-f]{8}$/);
  });

  test("scopes ids inside component definitions and reports duplicates", () => {
    const parsed = read({
      "a.tsx": `export const Card = component({ name: "NoteCard", render: () => <Text id="note" /> });
export default scene({}, () => <Layer id="a"><Rect id="x" /><Rect id="x" /><Text id="note" /></Layer>);`,
    });

    expect(parsed.order).toContain("NoteCard/note");
    expect(parsed.order).toContain("note");
    expect(parsed.duplicates.map((d) => d.id)).toEqual(["x"]);
  });

  test("fails on source that is not TSX", () => {
    const error = Effect.runSync(Effect.flip(parse({ "x.tsx": "const = <A" })));

    expect(error._tag).toBe("ParseError");
  });

  test("never mistakes __proto__ keys in literals for a prototype", () => {
    const parsed = read({ "x.tsx": `const s = <A id="a" v={{ "__proto__": 1 }} />;` });
    const value = elementOf(parsed, "a")?.props["v"];

    expect(value?.kind === "literal" && JSON.stringify(value.value)).toBe('{"__proto__":1}');
  });
});

describe("edit", () => {
  test("no edits reprints every byte", () => {
    expect(run([]).files).toEqual(files);
    expect(run([]).diff).toBe("");
  });

  test("set changes only the value", () => {
    const out = text([{ op: "set", target: "bg", prop: "width", value: 320 }]);

    expect(out).toBe(scene.replace("width={300}", "width={320}"));
    expect(run([{ op: "set", target: "bg", prop: "width", value: 320 }]).diff).toContain(
      '+    <Rect id="bg"   fill="#fff"  width={320} />',
    );
  });

  test("set keeps string and expression forms, and turns a shorthand into a value", () => {
    expect(text([{ op: "set", target: "bg", prop: "fill", value: "#000" }])).toContain(
      'fill="#000"  width',
    );
    expect(text([{ op: "set", target: "name", prop: "bold", value: false }])).toContain(
      "bold={false}>",
    );
    expect(text([{ op: "set", target: "name", prop: "ease", value: "ease.inOut" }])).toContain(
      "ease={ease.inOut}",
    );
  });

  test("set adds a prop, on its own line when the tag is multi-line", () => {
    expect(text([{ op: "set", target: "bg", prop: "opacity", value: 0.5 }])).toContain(
      "width={300} opacity={0.5} />",
    );
    expect(text([{ op: "set", target: "inner", prop: "x", value: [1, 2] }])).toContain(
      "        height={20}\n        x={[1, 2]}\n      />",
    );
  });

  test("unset removes the prop and its leading space", () => {
    expect(text([{ op: "unset", target: "bg", prop: "fill" }])).toBe(
      scene.replace('   fill="#fff"', ""),
    );
    expect(text([{ op: "unset", target: "bg", prop: "nothing" }])).toBe(scene);
  });

  test("edits apply in order, each against the last", () => {
    const out = text([
      { op: "set", target: "bg", prop: "width", value: 1 },
      { op: "set", target: "bg", prop: "width", value: 22 },
      { op: "set", target: "bg", prop: "height", value: 3 },
    ]);

    expect(out).toContain("width={22} height={3} />");
  });

  describe("escaping", () => {
    const written = (value: string) => text([{ op: "set", target: "bg", prop: "label", value }]);

    const roundTrip = (value: string) => {
      const out = written(value);
      const prop = elementOf(read({ "scene.tsx": out }), "bg")?.props["label"];

      expect(prop?.kind === "literal" && prop.value).toBe(value);

      return out;
    };

    test("plain text stays a JSX string", () => {
      expect(written("Save drafts")).toContain('label="Save drafts" />');
    });

    test.each([
      ['say "hi"', "quotes"],
      ["line\nbreak", "newlines"],
      ["a { b } c", "braces"],
      ["<script>alert(1)</script>", "script tags"],
      ["Tom & Jerry &amp; co", "ampersands"],
      ["back\\slash \\n", "backslashes"],
      ["tab\tand \u2028 sep", "control characters"],
    ])("%s (%s) reads back as written", (value) => {
      const out = roundTrip(value);

      expect(out).not.toContain("<script>");
      expect(out).not.toContain("\n    label");
    });

    test("falls back to an expression only when it must", () => {
      expect(written("a & b")).toContain('label={"a \\u0026 b"}');
      expect(written("it's")).toContain(`label="it's"`);
    });
  });

  describe("insert", () => {
    test("before a child, after a child and at the end", () => {
      const at0 = text([
        {
          op: "insert",
          parent: "card",
          at: 0,
          element: { component: "Circle", id: "dot", props: { r: 4 } },
        },
      ]);

      expect(at0).toContain(
        '  <Layer id="card">\n    <Circle id="dot" r={4} />\n    <Rect id="bg"',
      );

      const after = text([
        {
          op: "insert",
          parent: "card",
          at: { after: "bg" },
          element: { component: "Circle", id: "dot" },
        },
      ]);

      expect(after).toContain('width={300} />\n    <Circle id="dot" />\n    <Text id="name"');

      const end = text([
        { op: "insert", parent: "card", at: 4, element: { component: "Circle", id: "dot" } },
      ]);

      expect(end).toContain('{...rest} label={compute(1)} />\n    <Circle id="dot" />\n  </Layer>');
    });

    test("into a self-closing parent expands it", () => {
      const out = text([
        { op: "insert", parent: "bg", at: 0, element: { component: "Circle", id: "dot" } },
      ]);

      expect(out).toContain(
        '<Rect id="bg"   fill="#fff"  width={300}>\n      <Circle id="dot" />\n    </Rect>',
      );
      expect(read({ "scene.tsx": out }).elements["dot"]?.parent).toBe("bg");
    });

    test("refuses an id already used, a bad name and prototype props", () => {
      const insert = (id: string): Edit => ({
        op: "insert",
        parent: "card",
        at: 0,
        element: { component: "Circle", id },
      });
      // A literal `{ __proto__: 1 }` would set a prototype, not a key; JSON.parse makes the key.

      const props = JSON.parse('{"__proto__":1}');

      expect(fail([insert("bg")])._tag).toBe("DuplicateId");
      expect(fail([insert("a b")])._tag).toBe("InvalidValue");
      expect(
        fail([
          { op: "insert", parent: "card", at: 0, element: { component: "Circle", id: "z", props } },
        ])._tag,
      ).toBe("InvalidValue");
    });
  });

  test("remove drops the element and its lines", () => {
    const out = text([{ op: "remove", target: "box" }]);

    expect(out).toBe(scene.replace(/    <Group id="box">[\s\S]*?<\/Group>\n/, ""));
    expect(fail([{ op: "remove", target: "card" }])._tag).toBe("InvalidValue");
  });

  describe("move", () => {
    test("keeps a multi-line element's indentation", () => {
      const out = text([{ op: "move", target: "inner", parent: "card", at: 0 }]);

      expect(out).toContain(
        '<Layer id="card">\n    <Rect\n      id="inner"\n      width={10}\n      height={20}\n    />\n    <Rect id="bg"',
      );
      expect(read({ "scene.tsx": out }).elements["inner"]?.parent).toBe("card");
    });

    test("re-indents when it goes deeper", () => {
      const out = text([{ op: "move", target: "bg", parent: "box", at: { after: "inner" } }]);

      expect(out).toContain(
        '        height={20}\n      />\n      <Rect id="bg"   fill="#fff"  width={300} />\n    </Group>',
      );
      expect(out).not.toContain('<Layer id="card">\n    <Rect id="bg"');
    });

    test("moves a multi-line element deeper and back to the same text", () => {
      const down = text([{ op: "move", target: "inner", parent: "card", at: { after: "arrow" } }]);

      const back = text([{ op: "move", target: "inner", parent: "box", at: 0 }], {
        "scene.tsx": down,
      });

      expect(back).toBe(scene);
    });

    test("refuses a cycle and an unknown anchor", () => {
      expect(fail([{ op: "move", target: "box", parent: "inner", at: 0 }])._tag).toBe(
        "InvalidValue",
      );
      expect(fail([{ op: "move", target: "bg", parent: "box", at: { after: "nope" } }])._tag).toBe(
        "UnknownId",
      );
    });
  });

  describe("rename", () => {
    test("renames the id and every ref to it or below it", () => {
      const out = text([{ op: "rename", target: "box", to: "group" }]);

      expect(out).toContain('<Group id="group">');
      expect(out).toContain('to={ref("group/inner")}');
      expect(out).toContain('from={ref("name")}');
      expect(out).toBe(scene.replace('id="box"', 'id="group"').replace("box/inner", "group/inner"));
    });

    test('rewrites ref("old") exactly', () => {
      expect(text([{ op: "rename", target: "name", to: "title" }])).toContain(
        'from={ref("title")}',
      );
    });

    test("refuses an existing id", () => {
      expect(fail([{ op: "rename", target: "bg", to: "name" }])._tag).toBe("DuplicateId");
    });

    test("renaming to itself changes nothing", () => {
      expect(text([{ op: "rename", target: "bg", to: "bg" }])).toBe(scene);
    });
  });

  describe("refusals", () => {
    test("param, expression and spread props are not editable", () => {
      expect(fail([{ op: "set", target: "name", prop: "text", value: "x" }])).toMatchObject({
        _tag: "NotEditable",
        reason: "param",
        prop: "text",
      });
      expect(fail([{ op: "set", target: "arrow", prop: "label", value: "x" }])).toMatchObject({
        _tag: "NotEditable",
        reason: "expression",
      });
      expect(fail([{ op: "unset", target: "arrow", prop: "from" }])).toMatchObject({
        _tag: "NotEditable",
        reason: "expression",
      });
      expect(fail([{ op: "set", target: "arrow", prop: "...rest", value: 1 }])).toMatchObject({
        _tag: "NotEditable",
        reason: "spread",
      });
    });

    test("prototype keys are refused as props and inside values", () => {
      for (const prop of ["__proto__", "constructor", "prototype"])
        expect(fail([{ op: "set", target: "bg", prop, value: 1 }])._tag).toBe("InvalidValue");
      const value = JSON.parse('{"a":{"__proto__":{"x":1}}}');

      expect(fail([{ op: "set", target: "bg", prop: "p", value }])._tag).toBe("InvalidValue");
      expect(fail([{ op: "set", target: "bg", prop: "p", value: { constructor: 1 } }])._tag).toBe(
        "InvalidValue",
      );
    });

    test("unknown ids, non-finite numbers and id edits", () => {
      expect(fail([{ op: "set", target: "nope", prop: "x", value: 1 }])).toMatchObject({
        _tag: "UnknownId",
        target: "nope",
      });
      expect(fail([{ op: "set", target: "bg", prop: "x", value: Number.NaN }])._tag).toBe(
        "InvalidValue",
      );
      expect(fail([{ op: "set", target: "bg", prop: "id", value: "z" }])._tag).toBe("InvalidValue");
      expect(fail([{ op: "set", target: "toString", prop: "x", value: 1 }])._tag).toBe("UnknownId");
    });

    test("a stale source is refused", () => {
      const error = Effect.runSync(
        Effect.flip(edit(read(), [], { "scene.tsx": `${scene}// changed\n` })),
      );

      expect(error._tag).toBe("StaleSource");
    });
  });
});

describe("locate and elementAt", () => {
  const parsed = read();

  test("locate returns an element's range", () => {
    const range = locate(parsed, "inner")!;

    expect(scene.slice(range.from, range.to)).toStartWith('<Rect\n        id="inner"');
    expect(locate(parsed, "nope")).toBeUndefined();
  });

  test("locate follows an instance path to its last segment when that is unambiguous", () => {
    expect(locate(parsed, "card1/inner")).toEqual(locate(parsed, "inner"));
  });

  test("elementAt finds the innermost element", () => {
    expect(elementAt(parsed, "scene.tsx", scene.indexOf("height={20}"))).toBe("inner");
    expect(elementAt(parsed, "scene.tsx", scene.indexOf("Hello"))).toBe("name");
    expect(elementAt(parsed, "scene.tsx", scene.indexOf("<Layer") + 2)).toBe("card");
    expect(elementAt(parsed, "scene.tsx", 3)).toBeUndefined();
    expect(elementAt(parsed, "other.tsx", 100)).toBeUndefined();
  });
});

describe("component instances", () => {
  const card = `import { Group, Shape, component, ref, rect } from "svjeez";

export const NoteCard = component({
  name: "NoteCard",
  render: () => (
    <Group id="back">
      <Shape id="note" geometry={rect(4, 4)} fill="#000000" />
      <Shape id="mark" geometry={rect(1, 1)} fill={ref("note")} />
    </Group>
  ),
});
`;

  const main = `import { Group, Shape, rect, ref, scene } from "svjeez";
import { NoteCard } from "./card.tsx";

export default scene({ size: [200, 100], duration: 1, title: "T" }, () => (
  <Group id="all">
    <NoteCard id="card1" />
    <Shape id="note" geometry={rect(9, 9)} fill="#ffffff" />
    <Arrow id="a" from={ref("card1/note")} to={ref("note")} />
  </Group>
));
`;

  const both: Files = { "scene.tsx": main, "card.tsx": card };
  const sourceOf = (change: { readonly files: Files }, file: string) => change.files[file]!;

  test("locate resolves an instance path through the instance's component, not a scene element of the same name", () => {
    const parsed = read(both);

    expect(locate(parsed, "card1/note")).toEqual(elementOf(parsed, "NoteCard/note")!.range);
    expect(locate(parsed, "note")).toEqual(elementOf(parsed, "note")!.range);
  });

  test("locate follows nested instances", () => {
    const outer = `import { Group, component } from "svjeez";
import { NoteCard } from "./card.tsx";

export const Board = component({
  name: "Board",
  render: () => (
    <Group id="grid">
      <NoteCard id="slot" />
    </Group>
  ),
});
`;

    const nested: Files = {
      ...both,
      "board.tsx": outer,
      "scene.tsx": main.replace('<NoteCard id="card1" />', '<Board id="b" />'),
    };

    const parsed = read(nested);

    expect(locate(parsed, "b/slot/note")).toEqual(elementOf(parsed, "NoteCard/note")!.range);
  });

  test("renaming inside a component also rewrites instance-path refs to it", () => {
    const change = run([{ op: "rename", target: "NoteCard/note", to: "body" }], both);

    expect(sourceOf(change, "card.tsx")).toContain('id="body"');
    expect(sourceOf(change, "card.tsx")).toContain('ref("body")');
    expect(sourceOf(change, "scene.tsx")).toContain('ref("card1/body")');
    expect(sourceOf(change, "scene.tsx")).toContain('to={ref("note")}');
  });

  test("renaming a scene element leaves a same-named ref inside a component alone", () => {
    const change = run([{ op: "rename", target: "note", to: "paper" }], both);

    expect(sourceOf(change, "scene.tsx")).toContain('to={ref("paper")}');
    expect(sourceOf(change, "scene.tsx")).toContain('from={ref("card1/note")}');
    expect(sourceOf(change, "card.tsx")).toContain('ref("note")');
  });
});

describe("edits that go wrong", () => {
  const twice: Files = {
    "scene.tsx": `import { Group, Shape, rect, scene } from "svjeez";

export default scene({ size: [10, 10], duration: 1, title: "T" }, () => (
  <Group id="all">
    <Shape id="dup" geometry={rect(1, 1)} fill="#000000" />
    <Shape id="dup" geometry={rect(2, 2)} fill="#111111" />
  </Group>
));
`,
  };

  test("an edit that names a duplicated id fails with both ranges instead of editing the first", () => {
    const error = fail([{ op: "set", target: "dup", prop: "fill", value: "#ffffff" }], twice);

    expect(error._tag).toBe("DuplicateId");

    if (error._tag === "DuplicateId") {
      expect(error.id).toBe("dup");
      expect(error.ranges).toHaveLength(2);
    }
  });

  test("insert and move at a position past the end or before the start fail", () => {
    for (const at of [99, -1]) {
      expect(
        fail([{ op: "insert", parent: "card", at, element: { component: "Rect", id: "x" } }]),
      ).toMatchObject({ _tag: "InvalidValue" });

      expect(fail([{ op: "move", target: "bg", parent: "card", at }])).toMatchObject({
        _tag: "InvalidValue",
      });
    }
  });
});
