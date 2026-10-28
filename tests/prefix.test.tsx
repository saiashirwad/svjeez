import { describe, expect, test } from "bun:test";
import { def, font, fx, motion, render, validateSvg } from "svjeez";

const scene = (prefix?: string) =>
  render(
    { width: 100, height: 100, duration: 4, title: "P", desc: "D", prefix, reducedMotion: { at: 1 } },
    <>
      <rect width={10} height={10} fill={def.linearGradient({}, [<stop offset={0} stopColor="#fff" />])} animation={motion({ opacity: 0, rotate: 0 }).at(1).to({ opacity: 1, rotate: 90 }, 1)} />
      <circle r={4} animation={motion({ blur: 0 }).at(2).to({ blur: 4 }, 1)} />
      <circle r={4} animation={motion({ scale: 1 }).at(2).to({ scale: 2 }, 1)} />
    </>,
  );

const names = (svg: string) => {
  const source = svg.replace(/xmlns="[^"]*"/, "");
  const classes = [...source.matchAll(/class="([^"]*)"/g)].flatMap((match) => match[1]!.split(" "));
  const others = [...source.matchAll(/(?:id="|url\(#|href="#|@keyframes |\.)([A-Za-z][\w-]*)/g)].map((match) => match[1]!);
  const animationNames = [...source.matchAll(/animation-name:([^;}]*)/g)].flatMap((match) => match[1]!.split(","));
  return new Set([...classes, ...others, ...animationNames]);
};

describe("prefix", () => {
  test("an empty prefix changes nothing", () => {
    expect(scene("")).toBe(scene());
  });

  test("two scenes with different prefixes share no generated identifier", () => {
    const [a, b] = [scene("one-"), scene("two-")];
    expect([...names(a)].filter((name) => names(b).has(name))).toEqual([]);
    expect(a).toContain('id="one-t"');
    expect(a).toContain('aria-labelledby="one-t one-d"');
    expect(a).toContain("@keyframes one-k1");
    expect(a).toMatch(/\.one-m1\{/);
    expect(a).toMatch(/\.one-a\{/);
    expect(a).toMatch(/\.one-fb\{/);
    expect(a).toContain("url(#one-");
  });

  test("two scenes without prefixes share identifiers", () => {
    const shared = [...names(scene())].filter((name) => names(scene()).has(name));
    expect(shared).toContain("t");
    expect(shared).toContain("k1");
  });

  test("a prefix renames embedded font families in the rule and its uses", async () => {
    const sans = await font.load(new URL("../examples/fonts/ABeeZee-Regular.ttf", import.meta.url));
    const svg = render({ width: 100, height: 100, duration: 1, title: "F", prefix: "one-" }, <text fontFamily={sans}>Hi</text>);
    expect(svg).toContain("@font-face{font-family:'one-ABeeZee'");
    expect(svg).toContain(`font-family="'one-ABeeZee', sans-serif"`);
  });

  test("a prefix must be a CSS identifier start", () => {
    for (const bad of ["1a", "-a", "a b", "a.b", 'a"b']) expect(() => scene(bad)).toThrow(/needs a prefix/);
  });
});

test("a prefixed scene still warns about a filter over many animated elements", () => {
  const svg = (prefix?: string) =>
    render(
      { width: 100, height: 100, duration: 2, title: "Glow", prefix },
      <g filter={fx.blur(2)}>
        {Array.from({ length: 45 }, (_, i) => (
          <circle cx={i} cy={50} r={1} animation={motion({ opacity: 0 }).at(i / 45).to({ opacity: 1 }, 0.5)} />
        ))}
      </g>,
    );
  const warnings = (source: string) => validateSvg(source).warnings.filter((w) => w.includes("animated elements"));
  expect(warnings(svg())).toHaveLength(1);
  expect(warnings(svg("p-"))).toHaveLength(1);
});
