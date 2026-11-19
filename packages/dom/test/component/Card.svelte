<script lang="ts">
  let { task, onDone }: { task: { id: number; title: string; done: boolean }; onDone: (id: number) => void } = $props();
</script>

<div id="card" data-done={task.done} onclick={() => onDone(task.id)}>
  <b>{task.title}</b>
</div>

<style>
  div {
    padding: 8px;
    background: var(--bg, white);
    border: 1px solid #999;
  }
</style>
