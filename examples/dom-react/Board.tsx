import { useState } from "react";
import AddTask from "./AddTask.tsx";
import styles from "./Board.module.css";
import Column from "./Column.tsx";
import Header from "./Header.tsx";
import type { Task } from "./Task.ts";

const START: readonly Task[] = [
  { id: 1, title: "Sketch the board", note: "Two columns, soft shadows", done: false },
  { id: 2, title: "Wire up the cards", note: "Buttons move them across", done: false },
  { id: 3, title: "Ship the first draft", note: "Light and dark, both", done: true },
];

export default function Board() {
  const [tasks, setTasks] = useState(START);

  const finish = (id: number) =>
    setTasks((all) => all.map((task) => (task.id === id ? { ...task, done: true } : task)));

  const add = (title: string) =>
    setTasks((all) => [...all, { id: all.length + 1, title, note: "Just added", done: false }]);

  return (
    <div id="app" data-key="app">
      <Header open={tasks.filter((task) => !task.done).length} />
      <div className={styles.cols}>
        <Column name="To do" done={false} tasks={tasks} onDone={finish} />
        <Column name="Done" done tasks={tasks} onDone={finish} />
      </div>
      <AddTask onAdd={add} />
    </div>
  );
}
