<script lang="ts">
  import { arrowEase, BEND_Y, bending, bezierOf, curveOf, type ValueOf } from "@svjeez/live";
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

  const p = $derived(bezierOf(value.literal.value));

  const d = $derived(
    curveOf(value.literal.value)
      .map((q, k) => `${k ? "L" : "M"}${X(q.x).toFixed(2)} ${Y(q.y).toFixed(2)}`)
      .join(""),
  );

  let pop: HTMLElement | undefined = $state();
  let svg: SVGSVGElement | undefined = $state();
  let drag: ReturnType<typeof bending> | null = null;

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

  const grab = (e: PointerEvent, which: 0 | 1) => {
    e.preventDefault();
    svg?.setPointerCapture(e.pointerId);
    drag = bending(editor, value, which);
  };

  const move = (e: PointerEvent) => {
    if (!drag || !svg) return;
    const box = svg.getBoundingClientRect();

    drag({
      x: UX(((e.clientX - box.left) / box.width) * W),
      y: UY(((e.clientY - box.top) / box.height) * H),
    });
  };

  const key = (e: KeyboardEvent, which: 0 | 1) => {
    if (arrowEase(editor, value, which, e.key, e.shiftKey)) e.preventDefault();
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
    onpointerup={() => (drag = null)}
    onpointercancel={() => (drag = null)}
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
        aria-valuemin={BEND_Y.min}
        aria-valuemax={BEND_Y.max}
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
