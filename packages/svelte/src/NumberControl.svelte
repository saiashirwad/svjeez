<script lang="ts">
  import { arrowNumber, scrubbing, type ValueOf } from "@svjeez/live";
  import type { SceneEditor } from "./editor.js";
  import { focusing } from "./selection.js";

  let { editor, value }: { editor: SceneEditor; value: ValueOf<"number"> } = $props();

  const selected = $derived(editor.state.selected === value.key);

  let drag: ReturnType<typeof scrubbing> | null = $state.raw(null);

  const down = (e: PointerEvent & { currentTarget: HTMLElement }) => {
    if (e.button !== 0) return;
    // No text selection starts under the pointer, which would end the drag.
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag = scrubbing(editor, value, e.clientX);
  };

  const key = (e: KeyboardEvent) => {
    if (arrowNumber(editor, value, e.key, e.shiftKey)) e.preventDefault();
  };
</script>

<span
  class="sj-num"
  role="slider"
  tabindex="0"
  data-sj-key={value.key}
  data-selected={selected || undefined}
  data-dragging={drag ? "" : undefined}
  aria-label={value.label || "number"}
  aria-valuemin={value.param.min}
  aria-valuemax={value.param.max}
  aria-valuenow={value.literal.value}
  aria-valuetext="{value.literal.value}{value.param.unit ?? ''}"
  title="{value.label ? `${value.label}: ` : ''}drag sideways"
  onpointerdown={down}
  onpointermove={(e) => drag?.(e.clientX, e.shiftKey)}
  onpointerup={() => (drag = null)}
  onpointercancel={() => (drag = null)}
  onkeydown={key}
  {...focusing(editor, () => value.key)}>{value.literal.text}</span
>
