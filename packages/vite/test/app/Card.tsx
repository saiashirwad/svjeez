export interface CardProps {
  readonly title: string;
  readonly done: boolean;
  readonly onToggle?: () => void;
}

export default function Card({ title, done, onToggle }: CardProps) {
  return (
    <button
      id="card"
      onClick={onToggle}
      style={{
        padding: "12px 16px",
        border: "1px solid #ccc",
        borderRadius: 8,
        background: done ? "#d7f5e9" : "#fff",
        font: "14px sans-serif",
      }}
    >
      {done ? "✓ " : ""}
      {title}
    </button>
  );
}
