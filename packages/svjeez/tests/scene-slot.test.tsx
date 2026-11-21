import { describe, expect, test } from "bun:test";
import {
  Arrow,
  Center,
  Group,
  Shape,
  Slot,
  Stack,
  rect,
  ref,
  scene,
  type SceneElement,
} from "svjeez";
import { svg, type Model } from "svjeez/tools";

const made = (build: () => SceneElement): Model.Scene =>
  scene({ size: [200, 160], duration: 2, title: "Test" }, build);

/** The SVG on one line, without the indents. */
const flat = (out: string): string => out.replace(/\n\s*/g, "");

const emitted = (build: () => SceneElement): string => flat(svg.emit(made(build)));

const fallback = <Shape geometry={rect(60, 40)} fill="#00ff00" />;

// Two shapes, so a group of them is worth writing once and copying.
const pair = (
  <>
    <Shape geometry={rect(60, 40)} fill="#00ff00" />
    <Shape geometry={rect(20, 20)} fill="#0000ff" stroke={{ color: "#000000", width: 2 }} />
  </>
);

describe("Slot", () => {
  test("takes its width by height in a layout, and marks its group with its name and box", () => {
    const model = made(() => (
      <Stack key="column" at={[10, 20]} gap={5}>
        <Shape key="bar" geometry={rect(30, 10)} fill="#ff0000" />
        <Slot key="fx" name="fx" width={80} height={50}>
          {fallback}
        </Slot>
      </Stack>
    ));

    const [column] = model.root.children;
    const slot = column!.kind === "group" ? column!.children[1] : undefined;

    expect(slot?.slot).toBe("fx");
    expect([slot?.box.width, slot?.box.height]).toEqual([80, 50]);
    expect(column?.box.height).toBe(65);

    expect(flat(svg.emit(model))).toContain(
      '<g data-slot="fx" data-slot-box="10 35 80 50"><rect x="20" y="40" width="60" height="40" fill="#00FF00"/></g>',
    );
  });

  test("draws its fallback centered, and keeps its box when moved by its own at", () => {
    const out = emitted(() => (
      <Slot name="fx" width={100} height={60} at={[50, 50]} anchor="center">
        {fallback}
      </Slot>
    ));

    expect(out).toMatch(/<g[^>]* data-slot="fx" data-slot-box="0 20 100 60"/);
    expect(out).toContain('<rect x="20" y="30" width="60" height="40" fill="#00FF00"/>');
  });

  test("an arrow meets its edge, as at any node", () => {
    const box = ref();

    const model = made(() => (
      <Group>
        <Slot ref={box} key="fx" name="fx" width={80} height={40} at={[100, 60]}>
          {fallback}
        </Slot>
        <Arrow key="arrow" from={[10, 80]} to={box.left} stroke={{ color: "#000000" }} />
      </Group>
    ));

    expect(svg.emit(model)).toContain('<line x1="10" y1="80" x2="100" y2="80"');
  });

  test("is not written once and copied, even when another group draws the same", () => {
    const out = emitted(() => (
      <Stack direction="row">
        <Center width={60} height={40} rotate={10}>
          {pair}
        </Center>
        <Slot name="fx" width={60} height={40} rotate={10}>
          {pair}
        </Slot>
      </Stack>
    ));

    expect(out).toMatch(/<g [^>]*data-slot="fx"[^>]*><rect /);
  });

  test("needs a name of letters, digits, - and _ that starts with a letter", () => {
    for (const name of ["", "1st", "a b", 'a"b'])
      expect(() => emitted(() => <Slot name={name} width={10} height={10} />)).toThrow(
        "<Slot> needs a name of letters, digits, - and _ that starts with a letter",
      );
  });

  test("needs a size above 0", () => {
    expect(() => emitted(() => <Slot name="fx" width={0} height={10} />)).toThrow(
      '<Slot name="fx"> needs a width and a height above 0, got 0 by 10.',
    );
  });

  test("needs a name of its own", () => {
    expect(() =>
      emitted(() => (
        <Stack>
          <Slot name="fx" width={10} height={10} />
          <Group>
            <Slot name="fx" width={10} height={10} />
          </Group>
        </Stack>
      )),
    ).toThrow('Two <Slot>s are both named "fx".');
  });

  test("a fallback larger than the box is an error", () => {
    expect(() =>
      emitted(() => (
        <Slot name="fx" width={40} height={40}>
          {fallback}
        </Slot>
      )),
    ).toThrow("is 40 wide, but its children and padding need 60.");
  });
});
