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
  const shown = tasks.filter((task) => task.done === done);

  return (
    <section className={styles.col} data-key={done ? "col-done" : "col-todo"}>
      <div className={styles.top}>
        <h2>{name}</h2>
        <span className={styles.count}>{shown.length}</span>
      </div>
      {shown.map((task) => (
        <Card key={task.id} task={task} onDone={onDone} />
      ))}
    </section>
  );
}
