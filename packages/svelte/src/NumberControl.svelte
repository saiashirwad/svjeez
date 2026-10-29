<script lang="ts">
  import { nudge, scrub, type ValueOf } from "@svjeez/live";
  import type { NumberParam } from "svjeez/params";
  import type { SceneEditor } from "./editor.js";
  import { selection } from "./selection.js";

  let { editor, value }: { editor: SceneEditor; value: ValueOf<"number"> } = $props();

  const selected = $derived(editor.state.selected === value.key);

  let held: { from: number; x: number; param: NumberParam } | null = $state.raw(null);

  /** Whether a step of this gesture is already in the history, so undo takes the drag whole. */
  let going = false;

  const set = (v: number) => {
    editor.send({ type: "set", key: value.key, value: v, continues: going });
    going = true;
  };

  const ARROWS = new Map([
    ["ArrowRight", 1],
    ["ArrowUp", 1],
    ["ArrowLeft", -1],
    ["ArrowDown", -1],
  ] as const);

  const down = (e: PointerEvent & { currentTarget: HTMLElement }) => {
    if (e.button !== 0) return;
    // No text selection starts under the pointer, which would end the drag.
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    // The range is read from the value, so a drag keeps the one it started with or every step would widen it.
    held = { from: value.literal.value, x: e.clientX, param: value.param };
    going = false;
  };

  const move = (e: PointerEvent) => {
    if (held) set(scrub(held.param, held.from, e.clientX - held.x, e.shiftKey));
  };

  const key = (e: KeyboardEvent) => {
    // SAFETY: `get` accepts any string at runtime; the Map's key type is only narrower so the literals infer.
    const by = ARROWS.get(e.key as never);

    if (!by) return;
    e.preventDefault();
    going = false;
    set(nudge(value.param, value.literal.value, by, e.shiftKey));
  };
</script>

<span
  class="sj-num"
  role="slider"
  tabindex="0"
  data-sj-key={value.key}
  data-selected={selected || undefined}
  data-dragging={held ? "" : undefined}
  aria-label={value.label || "number"}
  aria-valuemin={value.param.min}
  aria-valuemax={value.param.max}
  aria-valuenow={value.literal.value}
  aria-valuetext="{value.literal.value}{value.param.unit ?? ''}"
  title="{value.label ? `${value.label}: ` : ''}drag sideways"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={() => (held = null)}
  onpointercancel={() => (held = null)}
  onkeydown={key}
  {...selection(editor, () => value.key)}>{value.literal.text}</span
>
