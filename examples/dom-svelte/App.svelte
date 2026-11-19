<script lang="ts">
  import type { Task } from "../dom-react/Task.ts";
  import Card from "./Card.svelte";

  let tasks = $state<Task[]>([
    { id: 1, title: "Sketch the board", note: "Two columns, soft shadows", done: false },
    { id: 2, title: "Wire up the cards", note: "Buttons move them across", done: false },
    { id: 3, title: "Ship the first draft", note: "Light and dark, both", done: true },
  ]);

  const finish = (id: number) => {
    tasks = tasks.map((task) => (task.id === id ? { ...task, done: true } : task));
  };
</script>

<div id="app" data-key="app">
  <h1>Svelte board</h1>
  <div class="cols">
    {#each [false, true] as done (done)}
      <section data-key={done ? "col-done" : "col-todo"}>
        <h2>{done ? "Done" : "To do"}</h2>
        {#each tasks.filter((task) => task.done === done) as task (task.id)}
          <Card {task} onDone={finish} />
        {/each}
      </section>
    {/each}
  </div>
</div>

<style>
  h1 {
    margin: 0 0 16px;
    padding: 16px 22px;
    border-radius: 18px;
    color: #fff;
    font:
      24px/30px Display,
      system-ui,
      sans-serif;
    background: linear-gradient(135deg, #5b5bf0, #b05bf0);
    box-shadow: 0 8px 20px var(--shadow);
  }

  .cols {
    display: flex;
    gap: 16px;
  }

  section {
    flex: 1;
    padding: 12px;
    border-radius: 16px;
    background: var(--panel);
    min-height: 200px;
  }

  h2 {
    margin: 2px 4px 12px;
    font:
      13px/16px Body,
      sans-serif;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--muted);
  }
</style>
