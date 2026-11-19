import Card from "./Card.tsx";
import styles from "./Column.module.css";
import type { Task } from "./Task.ts";

interface ColumnProps {
  name: string;
  done: boolean;
  tasks: readonly Task[];
  onDone: (id: number) => void;
}

export default function Column({ name, done, tasks, onDone }: ColumnProps) {
  return (
    <section className={styles.col} data-key={done ? "col-done" : "col-todo"}>
      <h2>{name}</h2>
      {tasks
        .filter((task) => task.done === done)
        .map((task) => (
          <Card key={task.id} task={task} onDone={onDone} />
        ))}
    </section>
  );
}
