import { describe, expect, test } from "bun:test";
import { font, scene } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { drawRequirement, parseRequirement, type RequirementDoc } from "../src/requirement.ts";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const lines = (text: string): Line[] =>
  text
    .split("\n")
    .map((t, i) => ({ file: "req.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "" && !l.text.startsWith("%%"));

const parse = (text: string): RequirementDoc => {
  const [first, ...body] = lines(`requirementDiagram\n${text}`);

  return parseRequirement(first!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;

    throw e;
  }

  throw new Error("parseRequirement() did not throw");
};

describe("parse requirement", () => {
  test("reads every requirement type with its fields", () => {
    const doc = parse(`
      requirement a {
        id: 1
        text: the text.
        risk: high
        verifymethod: test
      }
      functionalRequirement b { 
        id: 1.1
        risk: LOW
      }
      interfaceRequirement c {
      }
      performanceRequirement d {
      }
      physicalRequirement e {
      }
      designConstraint "f g" {
        text: "quoted"
      }`);

    expect(doc.requirements.map((r) => [r.id, r.kind])).toEqual([
      ["a", "requirement"],
      ["b", "functionalRequirement"],
      ["c", "interfaceRequirement"],
      ["d", "performanceRequirement"],
      ["e", "physicalRequirement"],
      ["f g", "designConstraint"],
    ]);
    expect(doc.requirements[0]).toMatchObject({
      reqId: "1",
      text: "the text.",
      risk: "High",
      verifyMethod: "Test",
    });
    expect(doc.requirements[1]).toMatchObject({ reqId: "1.1", risk: "Low", text: "" });
    expect(doc.requirements[5]!.text).toBe("quoted");
  });

  test("reads elements, with the brace on the next line too", () => {
    const doc = parse(`
      element x
      {
        type: word doc
        docRef: reqs/x
      }
      element y {
        type: "test suite"
      }`);

    expect(doc.elements.map((e) => [e.id, e.type, e.docRef])).toEqual([
      ["x", "word doc", "reqs/x"],
      ["y", "test suite", ""],
    ]);
  });

  test("reads relationships in both directions", () => {
    const doc = parse(`
      requirement a {
      }
      element b {
      }
      b - satisfies -> a
      a <- copies - b
      a - contains -> b
      a - Traces -> b`);

    expect(doc.relations.map((r) => [r.from, r.to, r.type])).toEqual([
      ["b", "a", "satisfies"],
      ["b", "a", "copies"],
      ["a", "b", "contains"],
      ["a", "b", "traces"],
    ]);
  });

  test("reads direction", () => {
    expect(parse("direction LR\nelement a {\n}").direction).toBe("LR");
    expect(parse("element a {\n}").direction).toBe("TB");
  });
});

describe("parse requirement errors", () => {
  test("rejects what svjeez does not draw, with the reason", () => {
    expect(message("style a fill:#f9f")).toContain("style is not supported");
    expect(message("classDef x fill:#f00")).toContain("classDef is not supported");
    expect(message("element a:::x {\n}")).toContain("`:::`");
    expect(message("direction UP")).toContain("not one of TB, LR, BT or RL");
  });

  test("rejects bad fields, names and relationships with a fix", () => {
    expect(message("requirement a {\nrisk: extreme\n}")).toContain("is not one of low, medium");
    expect(message("requirement a {\nverifymethod: guess\n}")).toContain("verifymethod");
    expect(message("requirement a {\ncolour: red\n}")).toContain('"colour" is not a field');
    expect(message("element a {\ntype: x\ntype: y\n}")).toContain("given twice");
    expect(message("element a {\n}\nelement a {\n}")).toContain("already used");
    expect(message("element a {\n}\na - lovesx -> a")).toContain("is not a relationship");
    expect(message("element a {\n}\na - traces -> z")).toContain('"z" is not a requirement');
  });

  test("reports unclosed blocks and nonsense with file and line", () => {
    expect(message("element a {\ntype: x")).toContain('"a" is never closed');
    expect(message("element a")).toContain("needs `{`");
    expect(message("two words")).toMatch(/^req\.mmd:2: "two words": cannot read this line/);
    expect(message("requirement a {\nnonsense\n}")).toContain("cannot read this field");
    expect(() => parse("")).toThrow("has no requirements or elements");
  });
});

describe("drawRequirement", () => {
  test("draws a part per node and relationship", () => {
    const doc = parse(`
      requirement a {
        id: 1
        text: Do the thing
      }
      element b {
        type: service
      }
      b - satisfies -> a`);

    const diagram = drawRequirement(doc, { font: mono });

    const markup = svg.emit(
      scene({ size: [600, 600], duration: 1, title: "Req", loop: false }, () => diagram.node),
    );

    expect(() => diagram.part("b->a")).not.toThrow();
    expect(markup).toContain("Do the thing");
    expect(markup).toContain("satisfies");
    expect(markup).toContain("Requirement");
  });
});
