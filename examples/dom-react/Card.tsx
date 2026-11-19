import CheckIcon from "./CheckIcon.tsx";
import styles from "./Card.module.css";
import type { Task } from "./Task.ts";

interface CardProps {
  task: Task;
  onDone: (id: number) => void;
}

export default function Card({ task, onDone }: CardProps) {
  return (
    <div className={`${styles.card} ${task.done ? styles.done : ""}`} data-key={`card-${task.id}`}>
      <CheckIcon />
      <div className={styles.text}>
        <div className={styles.title}>{task.title}</div>
        <div className={styles.note}>{task.note}</div>
      </div>
      {task.done ? null : <button onClick={() => onDone(task.id)}>Done</button>}
    </div>
  );
}
