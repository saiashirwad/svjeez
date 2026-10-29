<script lang="ts">
  import { bend, bezierOf, curveOf, type ValueOf } from "@svjeez/live";
  import type { Attachment } from "svelte/attachments";
  import type { SceneEditor } from "./editor.js";

  let {
    editor,
    value,
    anchor,
    onclose,
  }: {
    editor: SceneEditor;
    value: ValueOf<"ease">;
    /** The glyph the popover opened from, which it sits under and returns focus to. */
    anchor: HTMLElement;
    onclose: () => void;
  } = $props();

  // The unit square sits low in the box so a curve can overshoot above and below it.
  const W = 200;
  const H = 240;
  const X = (u: number) => 20 + u * (W - 60);
  const Y = (v: number) => 195 - v * 85;
  const UX = (x: number) => (x - 20) / (W - 60);
  const UY = (y: number) => (195 - y) / 85;
  const MIN_Y = -0.8;
  const MAX_Y = 2.2;

  const p = $derived(bezierOf(value.literal.value));

  const d = $derived(
    curveOf(value.literal.value)
      .map((q, k) => `${k ? "L" : "M"}${X(q.x).toFixed(2)} ${Y(q.y).toFixed(2)}`)
      .join(""),
  );

  let pop: HTMLElement | undefined = $state();
  let svg: SVGSVGElement | undefined = $state();
  let held: 0 | 1 | null = null;
  let going = false;

  /** The popover sits in the top layer, so the code panel's scrolling never clips it. */
  const place: Attachment<HTMLElement> = (el) => {
    el.showPopover();
    const at = anchor.getBoundingClientRect();
    const room = window.innerHeight - at.bottom;
    const left = Math.max(8, Math.min(at.left, window.innerWidth - el.offsetWidth - 8));

    el.style.left = `${left}px`;
    el.style.top = `${room >= el.offsetHeight + 12 ? at.bottom + 6 : Math.max(8, at.top - el.offsetHeight - 6)}px`;
    el.querySelector<SVGElement>(".sj-handle")?.focus();
  };

  const set = (which: 0 | 1, x: number, y: number) => {
    editor.send({
      type: "set",
      key: value.key,
      value: bend(value.literal.value, which, x, Math.min(MAX_Y, Math.max(MIN_Y, y))),
      continues: going,
    });
    going = true;
  };

  const grab = (e: PointerEvent, which: 0 | 1) => {
    e.preventDefault();
    svg?.setPointerCapture(e.pointerId);
    held = which;
    going = false;
  };

  const move = (e: PointerEvent) => {
    if (held === null || !svg) return;
    const box = svg.getBoundingClientRect();

    set(
      held,
      UX(((e.clientX - box.left) / box.width) * W),
      UY(((e.clientY - box.top) / box.height) * H),
    );
  };

  const ARROWS = new Map<string, readonly [number, number]>([
    ["ArrowLeft", [-1, 0]],
    ["ArrowRight", [1, 0]],
    ["ArrowUp", [0, 1]],
    ["ArrowDown", [0, -1]],
  ]);

  const key = (e: KeyboardEvent, which: 0 | 1) => {
    const by = ARROWS.get(e.key);

    if (!by) return;
    e.preventDefault();
    const step = e.shiftKey ? 0.25 : 0.05;
    going = false;
    set(which, p[which * 2]! + by[0] * step, p[which * 2 + 1]! + by[1] * step);
  };

  const outside = (e: PointerEvent) => {
    const hit = e.target;

    if (hit instanceof Node && !pop?.contains(hit) && !anchor.contains(hit)) onclose();
  };

  const escape = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    anchor.focus();
    onclose();
  };
</script>

<svelte:document onpointerdown={outside} onkeydown={escape} onscrollcapture={onclose} />

<span bind:this={pop} class="sj-pop" popover="manual" role="dialog" aria-label="Ease curve" {@attach place}
  ><svg
    bind:this={svg}
    class="sj-curve"
    viewBox="0 0 {W} {H}"
    role="presentation"
    onpointermove={move}
    onpointerup={() => (held = null)}
    onpointercancel={() => (held = null)}
    ><rect class="sj-box" x={X(0)} y={Y(1)} width={X(1) - X(0)} height={Y(0) - Y(1)} /><line
      class="sj-arm"
      x1={X(0)}
      y1={Y(0)}
      x2={X(p[0])}
      y2={Y(p[1])}
    /><line class="sj-arm" x1={X(1)} y1={Y(1)} x2={X(p[2])} y2={Y(p[3])} /><path
      class="sj-path"
      {d}
    />{#each [0, 1] as const as which (which)}<circle
        class="sj-handle"
        role="slider"
        tabindex="0"
        data-which={which}
        aria-label="{which ? 'Second' : 'First'} control point"
        aria-valuemin={MIN_Y}
        aria-valuemax={MAX_Y}
        aria-valuenow={p[which * 2 + 1]}
        aria-valuetext="x {p[which * 2]}, y {p[which * 2 + 1]}"
        cx={X(p[which * 2]!)}
        cy={Y(p[which * 2 + 1]!)}
        r="7"
        onpointerdown={(e) => grab(e, which)}
        onkeydown={(e) => key(e, which)}
      />{/each}</svg
  ><code class="sj-pop-text">{value.literal.text}</code></span
>
