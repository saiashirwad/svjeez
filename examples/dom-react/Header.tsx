import styles from "./Header.module.css";

export default function Header({ open }: { open: number }) {
  return (
    <header className={styles.head}>
      <span className={styles.mark} />
      <span className={styles.crumb}>acme</span>
      <span className={styles.slash}>/</span>
      <h1>Sprint board</h1>
      <span className={styles.live}>
        <span className={styles.pulse} />
        Live
      </span>
      <span className={styles.badge} data-key="badge">
        {open} open
      </span>
    </header>
  );
}
