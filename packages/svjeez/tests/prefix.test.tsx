import { describe, expect, test } from "bun:test";
import { validateSvg } from "svjeez/frames";
import {
  Group,
  Shape,
  Text,
  blur,
  circle,
  ease,
  font,
  linear,
  motion,
  rect,
  scene,
  span,
  track,
} from "svjeez";
import { svg } from "svjeez/tools";

const model = scene(
  { size: [100, 100], duration: 4, title: "P", desc: "D", reducedMotion: 1 },
  () => (
    <Group>
      <Shape
        geometry={rect(10, 10)}
        fill={linear({ from: [0, 0], to: [10, 0], stops: ["#FFFFFF", "#000000"] })}
        motion={motion({ opacity: 0, rotate: 0 }).to({ opacity: 1, rotate: 90 }, span(1, 1))}
      />
      <Shape
        geometry={circle(4)}
        fill="#000000"
        effects={[blur(track(0).to(4, span(2, 1), ease.linear))]}
      />
      <Shape
        geometry={circle(4)}
        fill="#000000"
        motion={motion({ scale: 1 }).to({ scale: 2 }, span(2, 1))}
      />
    </Group>
  ),
);

const emit = (prefix?: string) => svg.emit(model, prefix === undefined ? {} : { prefix });

const names = (out: string) => {
  const source = out.replace(/xmlns="[^"]*"/, "");
  const classes = [...source.matchAll(/class="([^"]*)"/g)].flatMap((match) => match[1]!.split(" "));

  const others = [
    ...source.matchAll(
      /(?:id="|url\(#|href="#|@keyframes |(?<![\w-])\.|begin="[\d.]+s;)([A-Za-z][\w-]*)/g,
    ),
  ].map((match) => match[1]!);

  const animationNames = [...source.matchAll(/animation-name:([^;}]*)/g)].flatMap((match) =>
    match[1]!.split(","),
  );

  return new Set([...classes, ...others, ...animationNames]);
};

describe("prefix", () => {
  test("an empty prefix changes nothing", () => {
    expect(emit("")).toBe(emit());
  });

  test("two scenes with different prefixes share no generated identifier", () => {
    const [a, b] = [emit("one-"), emit("two-")];

    expect([...names(a)].filter((name) => names(b).has(name))).toEqual([]);
    expect(a).toContain('id="one-t"');
    expect(a).toContain('aria-labelledby="one-t one-d"');
    expect(a).toContain("@keyframes one-k1");
    expect(a).toMatch(/\.one-m1\{/);
    expect(a).toMatch(/\.one-a\{/);
    expect(a).toMatch(/\.one-fb\{/);
    expect(a).toContain("url(#one-");
    expect(a).toMatch(/begin="[\d.]+s;one-s1\.begin/);
  });

  test("two scenes without prefixes share identifiers", () => {
    const shared = [...names(emit())].filter((name) => names(emit()).has(name));

    expect(shared).toContain("t");
    expect(shared).toContain("k1");
  });

  test("a prefix renames embedded font families in the rule and its uses", async () => {
    const sans = await font.load(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url));

    const out = svg.emit(
      scene({ size: [100, 100], duration: 1, title: "F" }, () => (
        <Text font={sans} size={12} fill="#000000">
          Hi
        </Text>
      )),
      { prefix: "one-" },
    );

    expect(out).toContain("@font-face{font-family:'one-ABeeZee'");
    expect(out).toMatch(/font-family="'one-ABeeZee'/);
    expect(out).not.toMatch(/font-family[=:]"?'ABeeZee'/);
  });

  test("a prefix must be a CSS identifier start", () => {
    for (const bad of ["1a", "-a", "a b", "a.b", 'a"b'])
      expect(() => emit(bad)).toThrow(/needs a prefix/);
  });
});

test("a prefixed scene still warns about a filter over many animated elements", () => {
  const glow = scene({ size: [100, 100], duration: 2, title: "Glow" }, () => (
    <Group effects={[blur(2)]}>
      {Array.from({ length: 45 }, (_, i) => (
        <Shape
          key={`dot-${i}`}
          at={[i, 50]}
          geometry={circle(1)}
          fill="#000000"
          motion={motion({ opacity: 0 }).to({ opacity: 1 }, span(i / 45, 0.5))}
        />
      ))}
    </Group>
  ));

  const warnings = (source: string) =>
    validateSvg(source).warnings.filter((w) => w.includes("animated elements"));

  expect(warnings(svg.emit(glow))).toHaveLength(1);
  expect(warnings(svg.emit(glow, { prefix: "p-" }))).toHaveLength(1);
});
