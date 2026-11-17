import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { choice, count } from "svjeez/params";
import { listValues, nearestKeys, SetError, setValues } from "../src/commands";
import { parse } from "../src/source";

const scene = `export const params = {
  look: choice("circle", ["circle", "square"]),
  n: count(3, { min: 1, max: 9 }),
};
export default () => (
  <circle cx={40.0} fill='#3EE6D6' animation={enter({ at: 1.2, over: 0.5 }, {}, ease.pop)} />
);
`;

const schema = {
  look: choice("circle", ["circle", "square"]),
  n: count(3, { min: 1, max: 9 }),
};

describe("listValues", () => {
  test("lists what the editor shows, with where it is and what it can be", () => {
    const listed = listValues(parse(scene), schema);

    expect(listed.map((v) => [v.key, v.kind, v.value])).toEqual([
      ["params.look", "choice", "circle"],
      ["params.n", "number", 3],
      ["default:circle.cx", "number", 40],
      ["default:circle.fill", "color", "#3EE6D6"],
      ["default:enter.0.at", "number", 1.2],
      ["default:enter.0.over", "number", 0.5],
      ["default:enter.2", "ease", "ease.pop"],
    ]);

    expect(listed[0]).toMatchObject({ options: ["circle", "square"], line: 2, column: 16 });
    expect(listed[1]!.range).toMatchObject({ min: 1, max: 9, declared: true });
    expect(listed[4]!.range).toMatchObject({ min: 0, unit: "s", declared: false });
    expect(listed[2]).toMatchObject({ text: "40.0", line: 6, column: 15 });
  });
});

describe("setValues", () => {
  test("writes each value into its literal and nothing else, keeping decimals and quotes", () => {
    const { text, changes, shifted } = setValues(
      scene,
      [
        ["default:circle.cx", "64"],
        ["default:circle.fill", "#ff8800"],
        ["default:enter.2", "bezier(0.2, 1.4, 0.5, 1)"],
        ["default:enter.0.over", "0.75"],
        ["params.look", "square"],
      ],
      schema,
    );

    expect(text).toBe(
      scene
        .replace('"circle", ["circle"', '"square", ["circle"')
        .replace("cx={40.0} fill='#3EE6D6'", "cx={64.0} fill='#ff8800'")
        .replace("over: 0.5 }, {}, ease.pop", "over: 0.75 }, {}, ease.bezier(0.2, 1.4, 0.5, 1)"),
    );
    expect(changes.map((c) => [c.key, c.line])).toEqual([
      ["params.look", 2],
      ["default:circle.cx", 6],
      ["default:circle.fill", 6],
      ["default:enter.0.over", 6],
      ["default:enter.2", 6],
    ]);
    expect(shifted).toEqual([]);
  });

  test("an ease reads as a name, ease.name, or four numbers", () => {
    const set = (raw: string) => setValues(scene, [["default:enter.2", raw]]).text;

    expect(set("out")).toContain("ease.out)");
    expect(set("ease.inOut")).toContain("ease.inOut)");
    expect(set("0.3, 0, 0.2, 1")).toContain("ease.bezier(0.3, 0, 0.2, 1)");
  });

  test("a number param's own range can be widened, and then set past the old one", () => {
    const wide = setValues(scene, [["params.n.max", "20"]], schema).text;

    expect(wide).toContain("max: 20");
    expect(() => setValues(scene, [["params.n", "12"]], schema)).toThrow(
      "params.n=12 is outside params.n's range, 1 to 9.",
    );
  });

  test("every bad key and value is named at once, with the keys nearest an unknown one", () => {
    const thrown = (() => {
      try {
        setValues(
          scene,
          [
            ["default:circle.x", "1"],
            ["default:circle.fill", "red"],
            ["default:enter.2", "bezier(1.5, 0, 0, 1)"],
            ["params.look", "triangle"],
            ["default:enter.0.at", "soon"],
            ["default:enter.0.at", "2"],
          ],
          schema,
        );
      } catch (error) {
        return error;
      }
    })();

    expect(thrown).toBeInstanceOf(SetError);
    expect(String(thrown).split("\n")).toEqual([
      expect.stringContaining("No value has the key default:circle.x. Nearest: default:circle.cx"),
      "default:circle.fill=red is not a color. Write a hex: #rgb, #rrggbb or #rrggbbaa.",
      expect.stringContaining("x1 or x2 is outside 0 to 1"),
      "params.look=triangle is not one of params.look's options: circle, square.",
      "default:enter.0.at=soon is not a number. Pass one, as in default:enter.0.at=1.2.",
      "default:enter.0.at is set twice. Pass each key once.",
    ]);
  });
});

test("nearestKeys puts keys sharing the last part first", () => {
  expect(
    nearestKeys("default:rect.over", ["default:enter.0.at", "default:enter.0.over", "x"], 2),
  ).toEqual(["default:enter.0.over", "default:enter.0.at"]);
});

describe("the CLI", () => {
  const cli = join(import.meta.dir, "../../svjeez/src/cli.ts");

  const run = async (dir: string, ...args: string[]) => {
    const child = Bun.spawn(["bun", cli, ...args], {
      cwd: import.meta.dir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [out, err, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    return { out: out + err, code, dir };
  };

  test("svjeez values lists, and svjeez set writes and shows the lines it changed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "svjeez-set-"));
    const file = join(dir, "scene.tsx");
    const text = 'export default () => <circle cx={40} r={8} fill="#3EE6D6" />;\n';
    await writeFile(file, text);

    try {
      const listed = await run(dir, "values", file, "--filter", "circle.r");
      expect(listed.code).toBe(0);
      expect(listed.out).toContain(`${file}:1:41  default:circle.r  number  8`);

      const dry = await run(dir, "set", file, "default:circle.r=12", "--dry-run");
      expect(dry.out).toContain("+ export default () => <circle cx={40} r={12}");
      expect(await readFile(file, "utf8")).toBe(text);

      const set = await run(dir, "set", file, "default:circle.r=12");
      expect(set.code).toBe(0);
      expect(set.out).toContain("keys unchanged.");
      expect(await readFile(file, "utf8")).toBe(text.replace("r={8}", "r={12}"));

      const bad = await run(dir, "set", file, "default:circle.radius=3");
      expect(bad.code).toBe(1);
      expect(bad.out).toContain("Nearest: default:circle.r");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
