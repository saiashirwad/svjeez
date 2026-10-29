<script lang="ts">
  import { handleAt, nudge, type Grip, type SceneSize, type ValueOf } from "@svjeez/live";
  import { fit, follow } from "svjeez/params";
  import type { SceneEditor } from "./editor.js";
  import { selection } from "./selection.js";

  let {
    editor,
    value,
    grip,
    scene,
  }: { editor: SceneEditor; value: ValueOf<"number">; grip: Grip; scene: SceneSize } = $props();

  const selected = $derived(editor.state.selected === value.key);
  const at = $derived(handleAt(grip, value.literal.value));

  /** A drag carries the value as far as it carries the handle, along the way the handle travels. */
  let held: { raw: number; scale: number; x: number; y: number } | null = null;
  let going = false;

  const set = (v: number) => {
    editor.send({ type: "set", key: value.key, value: v, continues: going });
    going = true;
  };

  const down = (e: PointerEvent & { currentTarget: HTMLElement }) => {
    if (e.button !== 0) return;
    // No text selection or native drag starts under the pointer, which would cancel this one.
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    // The picture keeps its size for the drag, so measure it once rather than on every move.
    const picture = e.currentTarget.parentElement;
    held = {
      raw: value.literal.value,
      scale: picture ? scene.width / picture.clientWidth : 1,
      x: e.clientX,
      y: e.clientY,
    };
    going = false;
  };

  const move = (e: PointerEvent) => {
    if (!held) return;
    const by = { x: (e.clientX - held.x) * held.scale, y: (e.clientY - held.y) * held.scale };
    held = { ...held, x: e.clientX, y: e.clientY };
    held.raw = follow(value.param, (v) => handleAt(grip, v), held.raw, by);
    set(fit(value.param, held.raw));
  };

  const ARROWS = new Map([
    ["ArrowRight", 1],
    ["ArrowUp", 1],
    ["ArrowLeft", -1],
    ["ArrowDown", -1],
  ] as const);

  const key = (e: KeyboardEvent) => {
    // SAFETY: `get` accepts any string at runtime; the Map's key type is only narrower so the literals infer.
    const by = ARROWS.get(e.key as never);

    if (!by) return;
    e.preventDefault();
    going = false;
    set(nudge(value.param, value.literal.value, by, e.shiftKey));
  };
</script>

<div
  class="sj-grip"
  role="slider"
  tabindex="0"
  data-sj-key={value.key}
  data-selected={selected || undefined}
  data-text="{value.label || value.key} {value.literal.text}{value.param.unit ?? ''}"
  aria-label={value.label || value.key}
  aria-valuemin={value.param.min}
  aria-valuemax={value.param.max}
  aria-valuenow={value.literal.value}
  style:left="{(at.x / scene.width) * 100}%"
  style:top="{(at.y / scene.height) * 100}%"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={() => (held = null)}
  onpointercancel={() => (held = null)}
  onkeydown={key}
  {...selection(editor, () => value.key)}
></div>
