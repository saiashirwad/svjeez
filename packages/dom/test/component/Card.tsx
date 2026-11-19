/** @jsxImportSource react */
export interface Task {
  readonly id: number;
  readonly title: string;
  readonly done: boolean;
}

export interface CardProps {
  task: Task;
  onDone: (id: number) => void;
  note?: string;
}

export default function Card({ task, onDone, note }: CardProps) {
  return (
    <div id="card" data-done={task.done} onClick={() => onDone(task.id)}>
      <b>{task.title}</b>
      {note ? <i>{note}</i> : null}
    </div>
  );
}

export const Named = ({ label }: { label: string }) => <p id="named">{label}</p>;
