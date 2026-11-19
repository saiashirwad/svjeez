import styles from "./Header.module.css";

export default function Header({ open }: { open: number }) {
  return (
    <header className={styles.head}>
      <span className={styles.pulse} />
      <h1>Sprint board</h1>
      <span className={styles.badge} data-key="badge">
        {open} open
      </span>
    </header>
  );
}
