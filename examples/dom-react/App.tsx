import { useState } from "react";

interface Task {
  readonly id: number;
  readonly title: string;
  readonly note: string;
  readonly done: boolean;
}

const START: readonly Task[] = [
  { id: 1, title: "Sketch the board", note: "Two columns, soft shadows", done: false },
  { id: 2, title: "Wire up the cards", note: "Buttons move them across", done: false },
  { id: 3, title: "Ship the first draft", note: "Light and dark, both", done: true },
];

const CSS = `
@font-face { font-family: Body; src: url(/body.ttf) format("truetype"); }
@font-face { font-family: Display; src: url(/display.ttf) format("truetype"); }
:root {
  color-scheme: light dark;
  --page: #eef1f7; --panel: #e3e8f2; --card: #ffffff; --ink: #1c2233; --muted: #6a7389;
  --line: #d3d9e6; --accent: #5b5bf0; --ok: #1f9d6b; --shadow: rgba(28, 34, 51, 0.16);
}
@media (prefers-color-scheme: dark) {
  :root {
    --page: #12141c; --panel: #1b1f2b; --card: #262b3a; --ink: #eceff7; --muted: #9aa3ba;
    --line: #353b4e; --accent: #8b8bff; --ok: #4ad19a; --shadow: rgba(0, 0, 0, 0.5);
  }
}
html, body { margin: 0; background: var(--page); }
body { padding: 20px; font: 15px/20px Body, system-ui, sans-serif; color: var(--ink); }
#app { width: 680px; background: var(--page); }
.head {
  display: flex; align-items: center; gap: 12px; padding: 18px 22px; border-radius: 18px; color: #fff;
  background: linear-gradient(135deg, #5b5bf0, #b05bf0); box-shadow: 0 8px 20px var(--shadow);
}
.head h1 { margin: 0; font: 24px/30px Display, system-ui, sans-serif; flex: 1; }
.pulse { width: 12px; height: 12px; border-radius: 6px; background: #7dffc4; animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.7); opacity: 0.35; } }
.badge { padding: 3px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.25); font-size: 14px; }
.cols { display: flex; gap: 16px; margin-top: 16px; }
.col { flex: 1; padding: 12px; border-radius: 16px; background: var(--panel); min-height: 230px; }
.col h2 { margin: 2px 4px 12px; font: 13px/16px Body, sans-serif; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.card {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px; margin-bottom: 10px; border-radius: 14px;
  background: var(--card); box-shadow: 0 3px 10px var(--shadow); border: 1px solid var(--line);
}
.card .text { flex: 1; }
.card .title { font-size: 15px; line-height: 20px; }
.card .note { font-size: 12px; line-height: 16px; color: var(--muted); }
.check { width: 22px; height: 22px; flex: none; color: var(--muted); }
.done .check { color: var(--ok); }
.card button, .add button {
  font: 13px/16px Body, sans-serif; padding: 6px 12px; border-radius: 10px; cursor: pointer;
  color: #fff; background: var(--accent); border: 0;
}
.add { display: flex; gap: 10px; margin-top: 16px; }
.add input {
  flex: 1; font: 15px/20px Body, sans-serif; padding: 9px 14px; border-radius: 12px; outline: none;
  color: var(--ink); background: var(--card); border: 1px solid var(--line);
}
`;

const Check = () => (
  <svg className="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="12" cy="12" r="9" />
    <path d="M7.5 12.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function App() {
  const [tasks, setTasks] = useState(START);
  const [draft, setDraft] = useState("");

  const finish = (id: number) =>
    setTasks((all) => all.map((task) => (task.id === id ? { ...task, done: true } : task)));

  const add = () => {
    const title = draft.trim();

    if (!title) return;
    setTasks((all) => [...all, { id: all.length + 1, title, note: "Just added", done: false }]);
    setDraft("");
  };

  const column = (name: string, done: boolean) => (
    <section className={done ? "col done" : "col"} data-key={done ? "col-done" : "col-todo"}>
      <h2>{name}</h2>
      {tasks
        .filter((task) => task.done === done)
        .map((task) => (
          <div className="card" key={task.id} data-key={`card-${task.id}`}>
            <Check />
            <div className="text">
              <div className="title">{task.title}</div>
              <div className="note">{task.note}</div>
            </div>
            {done ? null : <button onClick={() => finish(task.id)}>Done</button>}
          </div>
        ))}
    </section>
  );

  return (
    <>
      <style>{CSS}</style>
      <div id="app" data-key="app">
        <header className="head">
          <span className="pulse" />
          <h1>Sprint board</h1>
          <span className="badge" data-key="badge">
            {tasks.filter((task) => !task.done).length} open
          </span>
        </header>
        <div className="cols">
          {column("To do", false)}
          {column("Done", true)}
        </div>
        <div className="add">
          <input
            value={draft}
            placeholder="New task"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button onClick={add}>Add</button>
        </div>
      </div>
    </>
  );
}
