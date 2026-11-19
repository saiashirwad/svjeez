import { useState } from "react";
import styles from "./AddTask.module.css";

export default function AddTask({ onAdd }: { onAdd: (title: string) => void }) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const title = draft.trim();

    if (!title) return;
    onAdd(title);
    setDraft("");
  };

  return (
    <div className={styles.add}>
      <input
        value={draft}
        placeholder="New task"
        onChange={(event) => setDraft(event.target.value)}
      />
      <button onClick={submit}>Add</button>
    </div>
  );
}
