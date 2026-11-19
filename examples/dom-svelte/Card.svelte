<script lang="ts">
  import type { Task } from "../dom-react/Task.ts";

  let { task, onDone }: { task: Task; onDone: (id: number) => void } = $props();
</script>

<div class="card" class:done={task.done} data-key={`card-${task.id}`}>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
    <circle cx="12" cy="12" r="9" />
    <path d="M7.5 12.5l3 3 6-6.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  <div class="text">
    <div class="title">{task.title}</div>
    <div class="note">{task.note}</div>
  </div>
  {#if !task.done}
    <button onclick={() => onDone(task.id)}>Done</button>
  {/if}
</div>

<style>
  .card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    margin-bottom: 10px;
    border-radius: 14px;
    background: var(--card);
    box-shadow: 0 3px 10px var(--shadow);
    border: 1px solid var(--line);
  }

  svg {
    width: 22px;
    height: 22px;
    flex: none;
    color: var(--muted);
  }

  .done svg {
    color: var(--ok);
  }

  .text {
    flex: 1;
  }

  .title {
    font-size: 15px;
    line-height: 20px;
  }

  .note {
    font-size: 12px;
    line-height: 16px;
    color: var(--muted);
  }

  button {
    font:
      13px/16px Body,
      sans-serif;
    padding: 6px 12px;
    border-radius: 10px;
    cursor: pointer;
    color: #fff;
    background: var(--accent);
    border: 0;
  }
</style>
