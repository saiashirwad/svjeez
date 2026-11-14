<script lang="ts">
  import {
    arrowNumber,
    following,
    handleAt,
    type Grip,
    type SceneSize,
    type ValueOf,
  } from "@svjeez/live";
  import type { SceneEditor } from "./editor.js";
  import { focusing } from "./selection.js";

  let {
    editor,
    value,
    grip,
    scene,
  }: { editor: SceneEditor; value: ValueOf<"number">; grip: Grip; scene: SceneSize } = $props();

  const selected = $derived(editor.state.selected === value.key);
  const at = $derived(handleAt(grip, value.literal.value));

  let drag: ReturnType<typeof following> | null = null;

  const down = (e: PointerEvent & { currentTarget: HTMLElement }) => {
    if (e.button !== 0) return;
    // No text selection or native drag starts under the pointer, which would cancel this one.
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    // The picture keeps its size for the drag, so measure it once rather than on every move.
    const picture = e.currentTarget.parentElement;
    const scale = picture ? scene.width / picture.clientWidth : 1;
    drag = following(editor, value, grip, { x: e.clientX, y: e.clientY }, scale);
  };

  const key = (e: KeyboardEvent) => {
    if (arrowNumber(editor, value, e.key, e.shiftKey)) e.preventDefault();
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
  onpointermove={(e) => drag?.({ x: e.clientX, y: e.clientY })}
  onpointerup={() => (drag = null)}
  onpointercancel={() => (drag = null)}
  onkeydown={key}
  {...focusing(editor, () => value.key)}
></div>
