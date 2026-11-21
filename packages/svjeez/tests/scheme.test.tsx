import { describe, expect, test } from "bun:test";
import { renderFrames } from "svjeez/frames";
import { restyle } from "svjeez/page";
import {
  Group,
  Shape,
  Stack,
  Text,
  enter,
  exit,
  font,
  morph,
  path,
  rect,
  scene,
  span,
  tokens,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { boxesOf, check, svg, type Code, type Model, type Problem } from "svjeez/tools";

const mono = await font.load(new URL("./fixtures/SpaceMono-Regular.ttf", import.meta.url));

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Scheme" }, build);

const only = (model: Model.Scene, code: Code): Problem[] =>
  check(model).problems.filter((found) => found.code === code);

const HIDE_IN_LIGHT = "@media (prefers-color-scheme:light){.sd{display:none!important}}";
const HIDE_IN_DARK = "@media (prefers-color-scheme:dark){.sl{display:none!important}}";

describe("scheme", () => {
  test("a node shows in one scheme through a class and one rule per scheme", () => {
    const out = svg.emit(
      made(() => (
        <Group>
          <Shape geometry={rect(10, 10)} fill="#FF0000" scheme="light" />
          <Shape geometry={rect(10, 10)} at={[20, 0]} fill="#00FF00" scheme="light" />
          <Group scheme="dark">
            <Shape geometry={rect(10, 10)} fill="#0000FF" />
            <Shape geometry={rect(10, 10)} at={[20, 0]} fill="#0000FF" />
          </Group>
          <Text font={mono} size={12} fill="#000000" at={[0, 40]} scheme="dark">
            night
          </Text>
        </Group>
      )),
    );

    expect(out.match(/class="sl"/g)).toHaveLength(2);
    expect(out.match(/class="sd"/g)).toHaveLength(2);
    expect(out.split(HIDE_IN_DARK)).toHaveLength(2);
    expect(out.split(HIDE_IN_LIGHT)).toHaveLength(2);
  });

  test("no scheme, no rule; a prefix prefixes the class", () => {
    const plain = svg.emit(made(() => <Shape geometry={rect(10, 10)} fill="#FF0000" />));

    expect(plain).not.toContain("display:none!important");

    const prefixed = svg.emit(
      made(() => <Shape geometry={rect(10, 10)} fill="#FF0000" scheme="dark" />),
      { prefix: "p" },
    );

    expect(prefixed).toContain('class="psd"');
    expect(prefixed).toContain(".psd{display:none!important}");
  });

  test("a moving node keeps its own animation class beside the scheme's", () => {
    const out = svg.emit(
      made(() => (
        <Shape
          geometry={rect(10, 10)}
          fill="#FF0000"
          scheme="dark"
          motion={enter(span(0, 1), { from: { opacity: 0 } })}
        />
      )),
    );

    expect(out).toMatch(/class="[^"]*\bsd\b[^"]*"/);
    expect(out).toMatch(/class="[^"]*\ba\b[^"]*"/);
  });

  test("a hidden node still takes its space in a Stack", () => {
    const stack = (scheme?: "light" | "dark") =>
      boxesOf(
        made(() => (
          <Stack direction="row" gap={4}>
            <Shape key="a" geometry={rect(10, 10)} fill="#FF0000" scheme={scheme} />
            <Shape key="b" geometry={rect(10, 10)} fill="#FF0000" />
          </Stack>
        )),
      );

    expect(stack("dark")["0/b"]).toEqual(stack()["0/b"]);
  });

  test("a copied drawing keeps its scheme on the copy", () => {
    const leaf = path.parse(
      "M0 0C10 20 30 20 40 0C50 -20 70 -20 80 0C90 20 110 20 120 0C130 -20 150 -20 160 0",
    );

    const Leaves = (props: { at: Vec; scheme?: "light" | "dark" }) => (
      <Group offset={props.at} scheme={props.scheme}>
        <Shape geometry={leaf} fill="#000000" />
        <Shape geometry={leaf} at={[0, 5]} fill="#FF0000" />
        <Shape geometry={leaf} at={[0, 10]} fill="#00FF00" />
      </Group>
    );

    const out = svg.emit(
      made(() => (
        <Group>
          <Leaves at={[0, 20]} />
          <Leaves at={[0, 50]} />
          <Leaves at={[0, 80]} scheme="dark" />
        </Group>
      )),
    );

    expect(out).toContain("<use");
    expect(out).toMatch(/<use[^>]*class="sd"/);
  });

  test("a morph keeps a scheme every state agrees on, and refuses one that changes", () => {
    const kept = made(() =>
      morph(
        <Shape key="a" geometry={rect(10, 10)} fill="#FF0000" scheme="dark" />,
        <Shape key="a" geometry={rect(20, 10)} fill="#FF0000" scheme="dark" />,
        span(0, 1),
      ),
    );

    expect(svg.emit(kept)).toMatch(/class="sd\b/);

    expect(() =>
      made(() =>
        morph(
          <Shape key="a" geometry={rect(10, 10)} fill="#FF0000" scheme="dark" />,
          <Shape key="a" geometry={rect(20, 10)} fill="#FF0000" scheme="light" />,
          span(0, 1),
        ),
      ),
    ).toThrow("its scheme differs between states");
  });

  test("a scheme other than light or dark throws", () => {
    expect(() =>
      made(() => (
        // SAFETY: a wrong value on purpose, as plain JavaScript could pass one.
        <Shape geometry={rect(10, 10)} fill="#FF0000" scheme={"dusk" as "dark"} />
      )),
    ).toThrow('a scheme is "light" or "dark"');
  });

  test("restyle() leaves the rules be, and pinning the query pins them", () => {
    const theme = tokens({ light: { ink: "#000000" }, dark: { ink: "#FFFFFF" } });

    const out = svg.emit(
      scene({ size: [20, 20], duration: 1, title: "Scheme", theme }, () => (
        <Shape geometry={rect(10, 10)} fill={theme.ink} scheme="light" />
      )),
    );

    expect(restyle(out, { theme })).toContain(HIDE_IN_DARK);

    // The site pins a scheme by answering each query, as site/src/scripts/scheme.ts does.
    const pinned = out.replace(/\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/g, (_, query) =>
      query === "light" ? "(min-width: 0)" : "(max-width: -1px)",
    );

    expect(pinned).toContain("@media (max-width: -1px){.sl{display:none!important}}");
  });
});

describe("check and scheme", () => {
  const Line = ({ words, scheme }: { words: string; scheme?: "light" | "dark" }) => (
    <Text font={mono} size={14} fill="#000000" at={[20, 40]} scheme={scheme}>
      {words}
    </Text>
  );

  test("light and dark alternatives in one place don't overlap", () => {
    const overlaps = (a?: "light" | "dark", b?: "light" | "dark") =>
      only(
        made(() => (
          <Group>
            <Line words="the sun" scheme={a} />
            <Line words="the moon" scheme={b} />
          </Group>
        )),
        "overlap",
      );

    expect(overlaps("light", "dark")).toHaveLength(0);
    expect(overlaps("dark", undefined)).toHaveLength(1);
  });

  test("a node is never visible when its scheme fights the group around it", () => {
    const [found] = only(
      made(() => (
        <Group scheme="dark">
          <Shape key="a" geometry={rect(10, 10)} fill="#FF0000" scheme="light" />
        </Group>
      )),
      "never-visible",
    );

    expect(found?.message).toContain("shows only in the light scheme");
  });

  test("a node that shows in one scheme is judged on that scheme's paint", () => {
    const theme = tokens({ light: { star: "#00000000" }, dark: { star: "#FFFFFF" } });

    const stars = (scheme?: "light" | "dark") =>
      only(
        scene({ size: [200, 100], duration: 4, title: "Scheme", theme }, () => (
          <Shape key="a" geometry={rect(10, 10)} fill={theme.star} scheme={scheme} />
        )),
        "never-visible",
      );

    expect(stars("dark")).toHaveLength(0);
    expect(stars("light")).toHaveLength(1);
  });

  test("a cover in one scheme doesn't hide what shows in both", () => {
    const covered = (scheme?: "light" | "dark") =>
      only(
        made(() => (
          <Group>
            <Shape key="under" geometry={rect(10, 10)} at={[20, 20]} fill="#FF0000" />
            <Shape key="cover" geometry={rect(50, 50)} fill="#000000" scheme={scheme} />
          </Group>
        )),
        "never-visible",
      );

    expect(covered()).toHaveLength(1);
    expect(covered("dark")).toHaveLength(0);
  });

  test("contrast is judged against what is behind in each scheme the text shows in", () => {
    const contrast = (scheme?: "light" | "dark") =>
      only(
        made(() => (
          <Group>
            <Shape geometry={rect(200, 100)} fill="#FFFFFF" scheme="light" />
            <Shape geometry={rect(200, 100)} fill="#111111" scheme="dark" />
            <Text font={mono} size={14} fill="#222222" at={[20, 40]} scheme={scheme}>
              hello
            </Text>
          </Group>
        )),
        "low-contrast",
      );

    expect(contrast("light")).toHaveLength(0);
    const [dark] = contrast("dark");

    expect(dark?.message).toContain("in the dark scheme,");
    expect(dark?.message).not.toContain(":1 in light");
    expect(contrast()).toHaveLength(1);
  });
});

describe("loop-seam on layers together", () => {
  const popped = (layers: Parameters<typeof Shape>[0]["motion"]) =>
    only(
      made(() => <Shape key="a" geometry={rect(10, 10)} fill="#FF0000" motion={layers} />),
      "loop-seam",
    );

  test("an enter() and an exit() on the same value end where they start", () => {
    expect(
      popped([
        enter(span(0.5, 0.5), { from: { offset: [0, 40] } }),
        exit(span(3, 0.5), { to: { offset: [0, 40] } }),
      ]),
    ).toHaveLength(0);

    expect(
      popped([
        enter(span(0.5, 0.5), { from: { scale: 0.5, rotate: 20 } }),
        exit(span(3, 0.5), { to: { scale: 0.5, rotate: 20 } }),
      ]),
    ).toHaveLength(0);
  });

  test("layers that don't come back together still jump", () => {
    const [jump] = popped([
      enter(span(0.5, 0.5), { from: { offset: [0, 40], opacity: 1 } }),
      exit(span(3, 0.5), { to: { offset: [0, 10], opacity: 1 } }),
    ]);

    expect(jump?.message).toContain("its offset moves it 30");

    expect(popped({ offset: track<Vec>([0, 0]).to([60, 0], span(0, 1)) })[0]?.message).toContain(
      "moves it 60",
    );
  });
});

const browser = await renderFrames(
  svg.emit(made(() => <Shape geometry={rect(4, 4)} fill="#000000" />)),
  { times: [0] },
).then(
  () => true,
  (error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping scheme frame tests: ${error.message.split("\n")[0]}`);

    return false;
  },
);

describe.if(browser)("scheme in a browser", () => {
  const same = (a: Uint8Array, b: Uint8Array) => Buffer.from(a).equals(Buffer.from(b));

  const frame = async (build: () => SceneElement, colorScheme: "light" | "dark") =>
    (
      await renderFrames(svg.emit(scene({ size: [20, 20], duration: 1, title: "Scheme" }, build)), {
        times: [0],
        colorScheme,
      })
    ).frames[0]!.png;

  test("each scheme shows only its own node", async () => {
    const both = () => (
      <Group>
        <Shape geometry={rect(20, 20)} fill="#FF0000" scheme="light" />
        <Shape geometry={rect(20, 20)} fill="#0000FF" scheme="dark" />
      </Group>
    );

    const red = () => <Shape geometry={rect(20, 20)} fill="#FF0000" />;
    const blue = () => <Shape geometry={rect(20, 20)} fill="#0000FF" />;

    expect(same(await frame(both, "light"), await frame(red, "light"))).toBe(true);
    expect(same(await frame(both, "dark"), await frame(blue, "dark"))).toBe(true);
  });
});
