import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { Group, Run, Text, font, scene, type SceneElement } from "svjeez";
import { svg } from "svjeez/tools";

const fixture = (name: string) => new URL(`./fixtures/${name}.ttf`, import.meta.url);
const regular = await font.load(fixture("SpaceMono-Regular"));
const bold = await font.load(fixture("SpaceMono-Bold"));
const family = font.family(regular, bold);
const sans = await font.load(fixture("ABeeZee-Regular"));
const sansItalic = await font.load(fixture("ABeeZee-Italic"));
const slanted = font.family(sans, sansItalic);

const emit = (build: () => SceneElement) =>
  svg.emit(scene({ size: [200, 100], duration: 1, title: "Faces" }, build));

const embeds = (out: string) =>
  new Map(
    [
      ...out.matchAll(
        /url\(data:font\/ttf;base64,([^)]+)\)[^}]*font-weight:(\d+);font-style:(\w+)/g,
      ),
    ].map((m) => [`${m[2]} ${m[3]}`, font(Buffer.from(m[1]!, "base64"))]),
  );

describe("per-face subsetting", () => {
  test("each weight embeds only the glyphs drawn in it", () => {
    const cut = embeds(
      emit(() => (
        <Group>
          <Text font={family} weight={400} size={10} fill="#000000">
            abc
          </Text>
          <Text font={family} weight={700} size={10} fill="#000000">
            XYZ
          </Text>
        </Group>
      )),
    );

    expect(cut.get("400 normal")!.has("a") && cut.get("400 normal")!.has("c")).toBe(true);
    expect(cut.get("400 normal")!.has("X")).toBe(false);
    expect(cut.get("700 normal")!.has("X") && cut.get("700 normal")!.has("Z")).toBe(true);
    expect(cut.get("700 normal")!.has("a")).toBe(false);
  });

  test("a run takes its face from the text around it, and a nearer weight wins", () => {
    const cut = embeds(
      emit(() => (
        <Text font={family} weight={700} size={10} fill="#000000">
          XYZ<Run weight={400}>abc</Run>
        </Text>
      )),
    );

    expect(cut.get("700 normal")!.has("X")).toBe(true);
    expect(cut.get("700 normal")!.has("a")).toBe(false);
    expect(cut.get("400 normal")!.has("a")).toBe(true);
    expect(cut.get("400 normal")!.has("X")).toBe(false);
  });

  test("texts that inherit their face from the root still cut by the face they draw in", () => {
    const out = emit(() => (
      <Group>
        <Text font={family} weight={700} size={10} fill="#000000">
          XY
        </Text>
        <Text font={family} weight={700} size={10} fill="#000000">
          Z
        </Text>
        <Text font={family} size={10} fill="#000000">
          abc
        </Text>
      </Group>
    ));

    const cut = embeds(out);

    expect(out).toMatch(/<svg[^>]*font-family="'Space Mono'"/);
    expect(cut.get("700 normal")!.has("Z")).toBe(true);
    expect(cut.get("700 normal")!.has("a")).toBe(false);
    expect(cut.get("400 normal")!.has("a")).toBe(true);
    expect(cut.get("400 normal")!.has("X")).toBe(false);
  });

  test("an italic run goes only to the italic face", () => {
    const cut = embeds(
      emit(() => (
        <Text font={slanted} size={10} fill="#000000">
          up <Run italic>slant</Run>
        </Text>
      )),
    );

    expect(cut.get("400 italic")!.has("s") && cut.get("400 italic")!.has("t")).toBe(true);
    expect(cut.get("400 italic")!.has("u")).toBe(false);
    expect(cut.get("400 normal")!.has("u")).toBe(true);
    expect(cut.get("400 normal")!.has("s")).toBe(false);
  });

  test("each family's face holds only its own family's text", () => {
    const faces = [
      ...emit(() => (
        <Group>
          <Text font={family} size={10} fill="#000000">
            abc
          </Text>
          <Text font={sans} size={10} fill="#000000">
            XYZ
          </Text>
        </Group>
      )).matchAll(/url\(data:font\/ttf;base64,([^)]+)\)/g),
    ].map((m) => font(Buffer.from(m[1]!, "base64")));

    expect(faces.length).toBe(2);

    for (const face of faces) {
      const mine = face.family === "Space Mono" ? "a" : "X";
      const theirs = face.family === "Space Mono" ? "X" : "a";
      expect(face.has(mine)).toBe(true);
      expect(face.has(theirs)).toBe(false);
    }
  });
});

describe("subset: false", () => {
  for (const order of ["cut first", "whole first"])
    test(`a copy loaded with subset: false embeds the whole file, ${order}`, async () => {
      const bytes = await readFile(fixture("ABeeZee-Regular"));
      const cut = font(bytes);
      const whole = font(bytes, { subset: false });
      const [first, second] = order === "cut first" ? [cut, whole] : [whole, cut];

      const out = emit(() => (
        <Group>
          <Text font={first} size={10} fill="#000000">
            Hi
          </Text>
          <Text font={second} size={10} fill="#000000">
            Yo
          </Text>
        </Group>
      ));

      expect(out).toContain(whole.href!);
      expect(out.match(/@font-face/g)).toHaveLength(1);
    });
});
