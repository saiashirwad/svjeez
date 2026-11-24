import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import { parseArchitecture, type ArchitectureDoc } from "../src/architecture.ts";
import type { Line } from "../src/errors.ts";
import { mermaid, parseMermaid } from "../src/index";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const parse = (text: string): ArchitectureDoc => {
  const [header, ...body] = text
    .split("\n")
    .map((t, i): Line => ({ file: "a.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "");

  return parseArchitecture(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parseArchitecture() did not throw");
};

const text = `architecture-beta
    group api(cloud)[API]
    group inner[Inner] in api
    service db(database)[Database] in api
    service disk1(disk)[Storage] in inner
    service server(server)[Server]
    service bare
    junction j in api
    db:L -- R:server
    disk1:T --> B:server
    server:R <-- L:db
    db:B <--> T:j
    j:R -[hello]-> L:bare`;

describe("parse architecture", () => {
  test("reads groups, services, icons, titles, nesting and junctions", () => {
    const doc = parse(text);

    expect(doc.kind).toBe("architecture");
    expect(doc.source).toEqual({ file: "a.mmd", line: 1 });
    expect(doc.groups).toEqual([
      { id: "api", icon: "cloud", title: "API" },
      { id: "inner", title: "Inner", in: "api" },
    ]);
    expect(doc.services).toEqual([
      { id: "db", icon: "database", title: "Database", in: "api" },
      { id: "disk1", icon: "disk", title: "Storage", in: "inner" },
      { id: "server", icon: "server", title: "Server" },
      { id: "bare", title: "bare" },
    ]);
    expect(doc.junctions).toEqual([{ id: "j", in: "api" }]);
  });

  test("reads the sides, arrows and labels of an edge", () => {
    expect(parse(text).edges).toEqual([
      { from: "db", fromSide: "L", to: "server", toSide: "R", head: "none" },
      { from: "disk1", fromSide: "T", to: "server", toSide: "B", head: "to" },
      { from: "server", fromSide: "R", to: "db", toSide: "L", head: "from" },
      { from: "db", fromSide: "B", to: "j", toSide: "T", head: "both" },
      { from: "j", fromSide: "R", to: "bare", toSide: "L", label: "hello", head: "to" },
    ]);
  });

  test("reads quoted titles and ids with hyphens", () => {
    const doc = parse(`architecture-beta
      service my-db(database)["The DB"]
      service my-api[API]
      my-api:R --> L:my-db`);

    expect(doc.services[0]).toMatchObject({ id: "my-db", title: "The DB" });
    expect(doc.edges[0]).toMatchObject({ from: "my-api", to: "my-db" });
  });

  test("errors name the line and say how to fix it", () => {
    expect(message("architecture-beta\nservice a(logos:aws)[A]")).toContain("is not available");
    expect(message("architecture-beta\nservice a[A]\nservice a[B]")).toContain("already used");
    expect(message("architecture-beta\nservice a[A] in g")).toContain("does not exist yet");
    expect(message("architecture-beta\nservice a[A]\nservice b[B] in a")).toContain("not a group");
    expect(message("architecture-beta\ngroup g[G]\nservice a[A]\na:R -- L:g")).toContain(
      "is a group",
    );
    expect(message("architecture-beta\nservice a[A]\na:R -- L:b")).toContain("not declared");
    expect(message("architecture-beta\nservice a[A]\na:R -- L:a")).toContain("joined to itself");
    expect(
      message("architecture-beta\ngroup g[G]\nservice a[A] in g\nservice b[B]\na{group}:R -- L:b"),
    ).toContain("{group}");
    expect(message("architecture-beta\nalign row a b")).toContain("align is not supported");
    expect(message("architecture-beta\nservice a[A]\na -- b")).toContain("cannot read this line");
    expect(message("architecture-beta")).toContain("no services");
    expect(message("architecture-beta x")).toContain("cannot read the architecture header");
  });

  test("is found by its header word", () => {
    expect(parseMermaid("architecture-beta\nservice a[A]").kind).toBe("architecture");
  });
});

describe("mermaid architecture", () => {
  test("draws the doc with a part for each service, group, junction and edge", () => {
    const chart = mermaid(text, { font: mono, reveal: span(0, 0.5) });

    const out = svg.emit(
      scene(
        { size: [900, 700], duration: 6, title: "Architecture", loop: false },
        () => chart.node,
      ),
    );

    expect(chart.kind).toBe("architecture");
    expect(chart.when("db")).toBeDefined();
    expect(chart.when("api")).toBeDefined();
    expect(chart.when("j")).toBeDefined();
    expect(chart.when("j->bare")).toBeDefined();
    expect(out).toContain(">Database<");
    expect(out).toContain(">hello<");
  });

  test("rejects a direction", () => {
    expect(() => mermaid(text, { font: mono, direction: "LR" })).toThrow(
      "A cloud architecture diagram has no direction.",
    );
  });
});
