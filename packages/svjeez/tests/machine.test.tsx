import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import { Group, Sequence, Shape, clock, enter, rect, scene, span } from "svjeez";
import { svg } from "svjeez/tools";
import { machine, type Mounted } from "../src/page";

const open = clock("open", span(0, 0.4));
const grow = clock("grow", span(1, 0.4));
const step = clock("step", span(2, 0.9));

const build = () =>
  svg.emit(
    scene({ size: [60, 40], duration: 4, title: "Machine" }, () => (
      <>
        <Shape key="button" hit="button" at={[0, 25]} geometry={rect(20, 10)} fill="#444444" />
        <Sequence clock={open}>
          <Shape key="card" geometry={rect(20, 20)} fill="#ff0000" motion={enter(span(0, 0.4))} />
        </Sequence>
        <Sequence clock={grow}>
          <Group key="bars" hit="bar" at={[30, 0]}>
            <Shape key="bar" geometry={rect(20, 20)} fill="#00aa00" motion={enter(span(0, 0.4))} />
          </Group>
        </Sequence>
        <Sequence clock={step}>
          <Shape key="dot" geometry={rect(5, 5)} fill="#0000ff" motion={enter(span(0, 0.9))} />
        </Sequence>
      </>
    )),
  );

const trunk = clock("trunk", span(0, 0.4));
const eyes = clock("eyes", span(0.1, 0.2));

const nestedBuild = () =>
  svg.emit(
    scene({ size: [60, 40], duration: 4, title: "Nested machine" }, () => (
      <Sequence clock={trunk}>
        <Group key="trunk" at={[0, 0]} motion={enter(span(0, 0.4))}>
          <Shape key="body" geometry={rect(20, 20)} fill="#ff0000" />
          <Sequence clock={eyes}>
            <Shape
              key="eye"
              at={[5, 5]}
              geometry={rect(5, 5)}
              fill="#0000ff"
              motion={enter(span(0, 0.2))}
            />
          </Sequence>
        </Group>
      </Sequence>
    )),
  );

let browser: Browser;
let library = "";

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-machine-"));
  const entry = join(dir, "entry.ts");
  writeFileSync(
    entry,
    `import * as lib from ${JSON.stringify(join(import.meta.dir, "../src/page.ts"))};\nimport * as xstate from ${JSON.stringify(Bun.resolveSync("xstate", import.meta.dir))};\n(globalThis as any).lib = lib;\n(globalThis as any).xstate = xstate;\n`,
  );
  const built = await Bun.build({ entrypoints: [entry], target: "browser", format: "iife" });
  library = await built.outputs[0]!.text();
  browser = await chromium.launch();
});

afterAll(() => browser.close());

const page_ = async (
  reducedMotion: "no-preference" | "reduce" = "no-preference",
  markup = build(),
): Promise<Page> => {
  const page = await browser.newPage({ reducedMotion, viewport: { width: 400, height: 300 } });
  await page.setContent(`<!doctype html><body style="margin:0">${markup}</body>`);
  await page.addScriptTag({ content: library });

  return page;
};

// The page's own code runs as text: the library is the global `lib` there, `scene` what mount() returned.
const run = <T,>(page: Page, code: string) => page.evaluate<T>(`(async () => { ${code} })()`);

const MOUNT = "globalThis.scene = lib.mount(document.querySelector('svg'));";

const TOGGLE = `${MOUNT}
  globalThis.m = lib.machine(scene, {
    initial: "closed",
    states: { closed: { open: 0 }, opened: { open: 1 } },
    on: { toggle: { closed: "opened", opened: "closed" } },
  });`;

const mounted = async (setup: string, reducedMotion?: "no-preference" | "reduce") => {
  const page = await page_(reducedMotion);
  await run(page, setup);

  return page;
};

/** The message of the error that page code throws. */
const failure = async (page: Page, spec: string) =>
  run<string>(
    page,
    `try { lib.machine(scene, ${spec}); return ""; } catch (error) { return error.message; }`,
  );

test("a toggle runs its clock between two resting places and reports the state", async () => {
  const page = await mounted(TOGGLE);

  expect(await run(page, "return [m.state, scene.clock('open').time];")).toEqual(["closed", 0]);

  const forward = await run<[boolean, string, number, number]>(
    page,
    `const seen = []; m.subscribe((state, from) => seen.push(from + ">" + state));
     const t = performance.now(); const ok = await m.send("toggle");
     return [ok, m.state + " " + seen.join(), scene.clock('open').time, performance.now() - t];`,
  );

  expect(forward.slice(0, 3)).toEqual([true, "opened closed>opened", 0.4]);
  expect(forward[3]).toBeGreaterThan(350);
  expect(forward[3]).toBeLessThan(900);

  expect(
    await run(
      page,
      "const ok = await m.send('toggle'); return [ok, m.state, scene.clock('open').time];",
    ),
  ).toEqual([true, "closed", 0]);
  await page.close();
});

test("a move interrupted half way turns back from where the clock was", async () => {
  const page = await mounted(TOGGLE);

  const result = await run<[boolean, number, boolean, number, string]>(
    page,
    `const first = m.send("toggle");
     await new Promise((r) => setTimeout(r, 150));
     const between = scene.clock('open').time;
     const second = m.send("toggle");
     const interrupted = await first;
     const ok = await second;
     return [interrupted, between, ok, scene.clock('open').time, m.state];`,
  );

  expect(result[0]).toBe(false);
  expect(result[1]).toBeGreaterThan(0);
  expect(result[1]).toBeLessThan(0.4);
  expect(result.slice(2)).toEqual([true, 0, "closed"]);
  await page.close();
});

test("a state moves its clocks together and leaves the ones it does not name", async () => {
  const page = await mounted(`${MOUNT}
    globalThis.m = lib.machine(scene, {
      initial: "rest",
      states: { rest: { open: 0, grow: 0 }, both: { open: 1, grow: 1 }, grown: { grow: 0.5 } },
      on: { next: { rest: "both", both: "grown" } },
    });`);

  expect(
    await run(
      page,
      "return [await m.send('next'), scene.clock('open').time, scene.clock('grow').time];",
    ),
  ).toEqual([true, 0.4, 0.4]);

  expect(
    await run(
      page,
      "return [await m.send('next'), m.state, scene.clock('open').time, scene.clock('grow').time];",
    ),
  ).toEqual([true, "grown", 0.4, 0.2]);

  // The clock a new state does not name stays where the last move had got it to.
  const stayed = await run<[boolean, number, number]>(
    page,
    `await m.go("rest");
     const moving = m.go("both");
     await new Promise((r) => setTimeout(r, 100));
     const then = m.go("grown");
     const was = await moving;
     const at = scene.clock('open').time;
     await then;
     return [was, at > 0 && at < 0.4 ? at : -1, scene.clock('open').time - at];`,
  );

  expect(stayed[0]).toBe(false);
  expect(stayed[1]).toBeGreaterThan(0);
  expect(stayed[2]).toBe(0);
  await page.close();
});

test("a function can decide from the state, as a stepper with four stops does", async () => {
  const page = await mounted(`${MOUNT}
    globalThis.m = lib.machine(scene, {
      initial: "one",
      states: { one: { step: 0 }, two: { step: 1 / 3 }, three: { step: 2 / 3 }, four: { step: 1 } },
      on: {
        next: (state) => ({ one: "two", two: "three", three: "four" })[state],
        back: (state) => ({ four: "three", three: "two", two: "one" })[state],
      },
    });`);

  expect(
    await run(
      page,
      `const out = [];
       for (const event of ["back", "next", "next", "next", "next", "back"]) {
         out.push([await m.send(event), m.state]);
       }
       return out;`,
    ),
  ).toEqual([
    [false, "one"],
    [true, "two"],
    [true, "three"],
    [true, "four"],
    [false, "four"],
    [true, "three"],
  ]);

  expect(await run<number>(page, "return scene.clock('step').time;")).toBeCloseTo(0.6, 9);
  await page.close();
});

test("an event the state does not lead anywhere from is ignored and resolves false", async () => {
  const page = await mounted(`${MOUNT}
    globalThis.m = lib.machine(scene, {
      initial: "closed",
      states: { closed: { open: 0 }, opened: { open: 1 } },
      on: { press: { closed: "opened" } },
    });`);

  expect(
    await run(
      page,
      `await m.send("press"); const seen = []; m.subscribe((s) => seen.push(s));
       return [await m.send("press"), m.state, seen, scene.clock('open').time];`,
    ),
  ).toEqual([false, "opened", [], 0.4]);
  await page.close();
});

test("go moves to a state directly, and listeners can stop listening", async () => {
  const page = await mounted(TOGGLE);

  expect(
    await run(
      page,
      `const seen = []; const stop = m.subscribe((state, from) => seen.push([from, state]));
       const ok = await m.go("opened"); stop(); await m.go("closed");
       return [ok, seen, m.state, await m.go("closed")];`,
    ),
  ).toEqual([true, [["closed", "opened"]], "closed", true]);
  await page.close();
});

test("stop halts the move where it is", async () => {
  const page = await mounted(TOGGLE);

  const result = await run<[boolean, number, number, string]>(
    page,
    `const moving = m.send("toggle");
     await new Promise((r) => setTimeout(r, 120));
     m.stop();
     const at = scene.clock('open').time;
     const ok = await moving;
     await new Promise((r) => setTimeout(r, 120));
     return [ok, at, scene.clock('open').time, m.state];`,
  );

  expect(result[0]).toBe(false);
  expect(result[1]).toBeGreaterThan(0);
  expect(result[2]).toBe(result[1]);
  expect(result[3]).toBe("opened");
  await page.close();
});

test("under reduced motion a move jumps", async () => {
  const page = await mounted(TOGGLE, "reduce");

  expect(
    await run(page, "return [await m.send('toggle'), m.state, scene.clock('open').time];"),
  ).toEqual([true, "opened", 0.4]);
  await page.close();
});

test("the initial state's places show at once", async () => {
  const page = await mounted(`${MOUNT}
    globalThis.m = lib.machine(scene, {
      initial: "opened",
      states: { closed: { open: 0 }, opened: { open: 0.5, grow: 1 } },
      on: {},
    });`);

  expect(await run(page, "return [scene.clock('open').time, scene.clock('grow').time];")).toEqual([
    0.2, 0.4,
  ]);
  await page.close();
});

test("a spec that does not fit the scene is refused with the fix", async () => {
  const page = await mounted(MOUNT);

  expect(await failure(page, '{ initial: "a", states: { a: { nope: 0 } }, on: {} }')).toBe(
    'State "a" names the clock "nope", but this SVG has "open", "grow", "step". Name one of them.',
  );

  for (const amount of ["1.5", "-0.1", "NaN", "Infinity"])
    expect(
      await failure(page, `{ initial: "a", states: { a: { open: ${amount} } }, on: {} }`),
    ).toContain("a place is progress from 0 to 1");

  expect(await failure(page, '{ initial: "z", states: { a: {} }, on: {} }')).toBe(
    'The machine starts in "z", which is not a state; the states are "a". Set initial to one of them.',
  );

  expect(await failure(page, '{ initial: "a", states: { a: {} }, on: { go: { a: "b" } } }')).toBe(
    'Event "go" leads from "a" to "b", but the states are "a". Use only those.',
  );

  expect(
    await failure(page, '{ initial: "a", states: { a: {} }, on: { go: { b: "a" } } }'),
  ).toContain('Event "go" leads from "b" to "a"');

  const late = await run<string>(
    page,
    `const m = lib.machine(scene, { initial: "a", states: { a: {} }, on: { go: () => "b" } });
     try { await m.send("go"); return ""; } catch (error) { return error.message; }`,
  );

  expect(late).toBe(
    'Event "go" leads from "a" to "b", but the states are "a". Return one of them.',
  );
  await page.close();
});

test("typos in names are type errors", () => {
  const none: Mounted = {
    states: {},
    clocks: new Map(),
    clock: () => {
      throw new Error("no clocks");
    },
    hit: () => [],
    slot: () => {
      throw new Error("no slots");
    },
    unmount: () => undefined,
  };

  expect(() =>
    machine(none, {
      // @ts-expect-error "nope" is not a state
      initial: "nope",
      states: { a: {} },
      on: {},
    }),
  ).toThrow("not a state");

  expect(() =>
    machine(none, {
      initial: "a",
      states: { a: {} },
      // @ts-expect-error "b" is not a state
      on: { go: { a: "b" } },
    }),
  ).toThrow("leads from");
});

test("hit finds the marked elements, and a click on one can send an event", async () => {
  const page = await mounted(TOGGLE);

  expect(
    await run(
      page,
      "return [scene.hit('button').length, scene.hit('bar')[0].localName, scene.hit('button')[0].getAttribute('data-hit')];",
    ),
  ).toEqual([1, "rect", "button"]);

  expect(
    await run<string>(
      page,
      "try { scene.hit('nope'); return ''; } catch (e) { return e.message; }",
    ),
  ).toBe('This SVG has no hit "nope"; it has "button", "bar"');

  await run(
    page,
    "scene.hit('button').forEach((one) => one.addEventListener('click', () => m.send('toggle')));",
  );
  await page.click("[data-hit=button]");
  await page.waitForFunction("scene.clock('open').time === 0.4");

  expect(await run(page, "return m.state;")).toBe("opened");
  await page.close();
});

const PLACES = `${MOUNT}
  globalThis.view = lib.rests(scene, {
    closed: { open: 0 },
    opened: { open: 1 },
  });`;

test("rests moves clocks to the places of a state name and remembers it", async () => {
  const page = await mounted(PLACES);

  expect(await run(page, "return [view.state, scene.clock('open').time];")).toEqual([undefined, 0]);

  expect(
    await run(
      page,
      `view.show("closed");
       const ok = await view.go("opened");
       return [ok, view.state, scene.clock('open').time];`,
    ),
  ).toEqual([true, "opened", 0.4]);

  expect(
    await run(page, "return [await view.go('closed'), view.state, scene.clock('open').time];"),
  ).toEqual([true, "closed", 0]);
  await page.close();
});

test("going again mid-way retargets from where the clock is", async () => {
  const page = await mounted(PLACES);

  const result = await run<[boolean, number, boolean, number]>(
    page,
    `const first = view.go("opened");
     await new Promise((r) => setTimeout(r, 150));
     const between = scene.clock('open').time;
     const second = view.go("closed");
     return [await first, between, await second, scene.clock('open').time];`,
  );

  expect(result[0]).toBe(false);
  expect(result[1]).toBeGreaterThan(0);
  expect(result[1]).toBeLessThan(0.4);
  expect(result.slice(2)).toEqual([true, 0]);
  await page.close();
});

test("show jumps with no animation and halts a move", async () => {
  const page = await mounted(PLACES);

  expect(
    await run(
      page,
      `const moving = view.go("opened");
       view.show("closed");
       view.show("opened");
       const at = scene.clock('open').time;
       const ok = await moving;
       return [ok, at, scene.clock('open').time, view.state];`,
    ),
  ).toEqual([false, 0.4, 0.4, "opened"]);
  await page.close();
});

test("a nested value applies the parent's rests, then the child's over them", async () => {
  const page = await mounted(`${MOUNT}
    globalThis.view = lib.rests(scene, {
      form: { open: 0.5, grow: 0 },
      "form.editing": { open: 1 },
      "menu.open.hovered": { step: 1 },
      unused: { grow: 1 },
    });`);

  const times = "[scene.clock('open').time, scene.clock('grow').time, scene.clock('step').time]";

  expect(
    await run(page, `const ok = await view.go({ form: "editing" }); return [ok, ...${times}];`),
  ).toEqual([true, 0.4, 0, 0]);

  expect(await run(page, `view.show({ form: "idle" }); return ${times};`)).toEqual([0.2, 0, 0]);

  expect(
    await run(
      page,
      `const ok = await view.go({ menu: { open: "hovered" } }); return [ok, ...${times}];`,
    ),
  ).toEqual([true, 0.2, 0, 0.9]);
  await page.close();
});

test("parallel regions move different clocks at once", async () => {
  const page = await mounted(`${MOUNT}
    globalThis.view = lib.rests(scene, {
      "field.typing": { open: 1 },
      "submit.sending": { grow: 1 },
    });`);

  expect(
    await run(
      page,
      `const ok = await view.go({ field: "typing", submit: "sending" });
       return [ok, scene.clock('open').time, scene.clock('grow').time];`,
    ),
  ).toEqual([true, 0.4, 0.4]);
  await page.close();
});

test("a value that matches no place changes nothing and resolves false", async () => {
  const page = await mounted(PLACES);

  expect(
    await run(
      page,
      `await view.go("opened");
       return [await view.go("nope"), await view.go({ other: "x" }), view.state, scene.clock('open').time];`,
    ),
  ).toEqual([false, false, "opened", 0.4]);
  await page.close();
});

test("places that do not fit the scene are refused with the fix", async () => {
  const page = await mounted(MOUNT);

  const refused = (places: string) =>
    run<string>(
      page,
      `try { lib.rests(scene, ${places}); return ""; } catch (error) { return error.message; }`,
    );

  expect(await refused("{ a: { nope: 0 } }")).toBe(
    'State "a" names the clock "nope", but this SVG has "open", "grow", "step". Name one of them.',
  );
  expect(await refused("{ a: { open: 2 } }")).toBe(
    'State "a" rests the clock "open" at 2, but a place is progress from 0 to 1.',
  );
  await page.close();
});

test("an XState actor drives a view: parallel regions reach their rests", async () => {
  const page = await mounted(`${MOUNT}
    globalThis.view = lib.rests(scene, {
      "field.empty": { open: 0 },
      "field.typing": { open: 0.5 },
      "field.valid": { open: 1 },
      "submit.idle": { grow: 0 },
      "submit.sending": { grow: 1 },
    });
    const form = xstate.createMachine({
      type: "parallel",
      states: {
        field: {
          initial: "empty",
          states: {
            empty: { on: { type: "typing" } },
            typing: { on: { done: "valid" } },
            valid: {},
          },
        },
        submit: {
          initial: "idle",
          states: { idle: { on: { send: { guard: xstate.stateIn({ field: "valid" }), target: "sending" } } }, sending: {} },
        },
      },
    });
    globalThis.actor = xstate.createActor(form);
    view.show(actor.getSnapshot().value);
    actor.subscribe((snapshot) => view.go(snapshot.value));
    actor.start();`);

  const times = "[scene.clock('open').time, scene.clock('grow').time]";

  expect(await run(page, `return ${times};`)).toEqual([0, 0]);

  await run(page, "actor.send({ type: 'type' });");
  await page.waitForFunction("scene.clock('open').time === 0.2");

  // The guard holds the button back until the field is valid.
  await run(page, "actor.send({ type: 'send' });");
  expect(await run(page, `return ${times};`)).toEqual([0.2, 0]);

  await run(page, "actor.send({ type: 'done' });");
  await page.waitForFunction("scene.clock('open').time === 0.4");
  await run(page, "actor.send({ type: 'send' });");
  await page.waitForFunction("scene.clock('grow').time === 0.4");

  expect(await run(page, `return [${times}, actor.getSnapshot().value];`)).toEqual([
    [0.4, 0.4],
    { field: "valid", submit: "sending" },
  ]);
  await page.close();
});

const LOOPS = `${MOUNT}
  globalThis.view = lib.rests(scene, {
    idle: { open: 0 },
    busy: { open: 1, grow: lib.looping },
    done: { grow: 1 },
    spin: { grow: lib.looping },
    early: { grow: 0.1 },
  });
  globalThis.sample = async (ms) => {
    const times = [];
    const end = performance.now() + ms;
    while (performance.now() < end) {
      times.push(scene.clock('grow').time);
      await new Promise(requestAnimationFrame);
    }
    return times;
  };`;

test("a looping clock resolves at once, keeps running and wraps from its end back to 0", async () => {
  const page = await mounted(LOOPS);

  const result = await run<[boolean, number, number, boolean, boolean]>(
    page,
    `const t = performance.now(); const ok = await view.go("spin");
     const quick = performance.now() - t < 100;
     const times = await sample(1200);
     return [ok, Math.max(...times), Math.min(...times.slice(5)), times.some((x, i) => i && x < times[i - 1]), quick];`,
  );

  expect(result[0]).toBe(true);
  expect(result[1]).toBeGreaterThan(0.3);
  expect(result[1]).toBeLessThanOrEqual(0.4);
  expect(result[2]).toBeLessThan(0.1);
  expect(result.slice(3)).toEqual([true, true]);
  await page.close();
});

test("leaving a loop for a state that rests the clock runs it to the rest", async () => {
  const page = await mounted(LOOPS);

  expect(
    await run(
      page,
      `await view.go("busy"); await new Promise((r) => setTimeout(r, 120));
       const ok = await view.go("done"); return [ok, scene.clock('grow').time];`,
    ),
  ).toEqual([true, 0.4]);
  await page.close();
});

test("leaving a loop for a rest behind the clock runs on through the end, never backward", async () => {
  const page = await mounted(LOOPS);

  const result = await run<[boolean, number[]]>(
    page,
    `await view.go("busy"); await new Promise((r) => setTimeout(r, 150));
     const start = scene.clock('grow').time;
     const moving = view.go("early");
     const times = [start, ...(await sample(150))];
     const ok = await moving;
     return [ok, [...times, scene.clock('grow').time]];`,
  );

  const times = result[1];
  const drops = times.filter((time, at) => at > 0 && time < times[at - 1]!);

  expect(result[0]).toBe(true);
  expect(times[0]).toBeGreaterThan(0.1);
  expect(drops).toHaveLength(1);
  expect(drops[0]).toBeLessThan(0.1);
  expect(times.at(-1)).toBeCloseTo(0.04, 9);
  await page.close();
});

test("a clock that is not looping still runs backward to a rest behind it", async () => {
  const page = await mounted(LOOPS);

  const result = await run<number[]>(
    page,
    `scene.clock('grow').seek(0.3); const moving = view.go("early");
     const times = await sample(60); await moving;
     return times;`,
  );

  expect(result.every((time, at) => at === 0 || time <= result[at - 1]!)).toBe(true);
  await page.close();
});

test("leaving a loop for a state that does not name the clock pauses it where it is", async () => {
  const page = await mounted(LOOPS);

  const result = await run<[number, number, number]>(
    page,
    `await view.go("busy"); await new Promise((r) => setTimeout(r, 120));
     await view.go("idle");
     const paused = scene.clock('grow').time;
     await new Promise((r) => setTimeout(r, 150));
     return [paused, scene.clock('grow').time, scene.clock('open').time];`,
  );

  expect(result[0]).toBeGreaterThan(0);
  expect(result[1]).toBe(result[0]);
  expect(result[2]).toBe(0);
  await page.close();
});

test("show starts a loop with no animation, and a later state still ends it", async () => {
  const page = await mounted(LOOPS);

  const result = await run<[number, boolean, number]>(
    page,
    `view.show("busy"); const open = scene.clock('open').time;
     const times = await sample(300);
     view.show("idle");
     const held = scene.clock('grow').time;
     await new Promise((r) => setTimeout(r, 100));
     return [open, Math.max(...times) > 0, scene.clock('grow').time - held];`,
  );

  expect(result).toEqual([0.4, true, 0]);
  await page.close();
});

test("under reduced motion a looping clock shows 0 and does not run", async () => {
  const page = await mounted(LOOPS, "reduce");

  expect(
    await run(
      page,
      `const ok = await view.go("busy"); const times = await sample(300);
       view.show("busy"); const shown = scene.clock('grow').time;
       return [ok, Math.max(...times), shown];`,
    ),
  ).toEqual([true, 0, 0]);
  await page.close();
});

test("a machine takes looping places, and the loop string from a scene's data-states means the same", async () => {
  const page = await mounted(`${MOUNT}
    globalThis.m = lib.machine(scene, {
      initial: "idle",
      states: { idle: { grow: 0 }, busy: { grow: "loop" } },
      on: { start: { idle: "busy" }, stop: { busy: "idle" } },
    });`);

  expect(
    await run(
      page,
      `const loops = lib.looping; const ok = await m.send("start");
       await new Promise((r) => setTimeout(r, 120));
       const running = scene.clock('grow').time > 0;
       m.stop();
       return [loops, ok, running, m.state];`,
    ),
  ).toEqual(["loop", true, true, "busy"]);
  await page.close();
});

test("a state rests an outer clock and the clock nested in it, each at its own place", async () => {
  const page = await page_("no-preference", nestedBuild());

  const result = await run<unknown[]>(
    page,
    `${MOUNT}
     const view = lib.rests(scene, {
       closed: { trunk: 0, eyes: 0 },
       awake: { trunk: 1 },
       "awake.watching": { eyes: 1 },
     });
     const ok = await view.go({ awake: "watching" });
     const opacity = (name) => getComputedStyle(document.querySelector('[data-clock="' + name + '"]')).opacity;
     const times = [scene.clock('trunk').time, scene.clock('eyes').time, opacity('trunk'), opacity('eyes')];
     await view.go("awake");
     const rested = [scene.clock('trunk').time, scene.clock('eyes').time];
     return [ok, times, rested];`,
  );

  expect(result).toEqual([true, [0.4, 0.2, "1", "1"], [0.4, 0.2]]);
  await page.close();
});
